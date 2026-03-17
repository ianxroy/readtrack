import spacy
import os
import torch
import base64
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from io import BytesIO
from pypdf import PdfReader
from dotenv import load_dotenv
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from preprocessing import extract_features
from svm_models import TextComplexitySVM, StudentProficiencySVM
from sklearn.svm import SVC
from sklearn.preprocessing import RobustScaler
import numpy as np
from supabase import create_client
from train_utils import load_asap_data
from ocr import extract_text_from_image
from tagalog_service import router as tagalog_router
from grammar_service import router as grammar_router

load_dotenv('.env.local')
load_dotenv('.env')

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")
MODEL_DIR = Path(__file__).parent / "models"
RETRAIN_STATUS_PATH = MODEL_DIR / "retrain_status.json"
if GEMINI_API_KEY:
    print(f"Loaded Gemini API key: {GEMINI_API_KEY[:8]}...")
else:
    print("Warning: No Gemini API key found in environment")

@asynccontextmanager
async def lifespan(app: FastAPI):

    try:
        if torch.cuda.is_available():
            spacy.prefer_gpu()
            print("GPU acceleration enabled for spaCy")
        else:
            print("GPU not available, using CPU for spaCy")
    except Exception as e:
        print(f"Could not enable GPU: {e}")

    try:
        spacy.load("en_core_web_sm")
    except OSError:
        print("Downloading spaCy model 'en_core_web_sm'...")
        spacy.cli.download("en_core_web_sm")
        print("Model downloaded successfully.")

    models_dir = os.path.join(os.path.dirname(__file__), 'models')
    comp_path = os.path.join(models_dir, 'complexity_model.pkl')
    prof_path = os.path.join(models_dir, 'proficiency_model.pkl')
    prof_en_path = os.path.join(models_dir, 'proficiency_model_en.pkl')
    prof_tl_path = os.path.join(models_dir, 'proficiency_model_tl.pkl')

    if complexity_model.load(comp_path):
        print("Complexity ML model loaded")
    # Preferred: language-specific models. Fallback: shared proficiency model.
    if student_model_en.load(prof_en_path):
        print("English proficiency ML model loaded")
    elif student_model_en.load(prof_path):
        print("English proficiency model fallback loaded")

    if student_model_tl.load(prof_tl_path):
        print("Filipino proficiency ML model loaded")
    elif student_model_tl.load(prof_path):
        print("Filipino proficiency model fallback loaded")

    yield

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tagalog_router, tags=["Tagalog NLP"])
app.include_router(grammar_router, tags=["Grammar & Spell Check"])

complexity_model = TextComplexitySVM()
student_model_en = StudentProficiencySVM()
student_model_tl = StudentProficiencySVM()

class TextRequest(BaseModel):
    text: str
    image: Optional[str] = None
    mimeType: Optional[str] = None

class OCRRequest(BaseModel):
    image: str
    mimeType: Optional[str] = None

class ReferenceIngestRequest(BaseModel):
    name: Optional[str] = None
    mimeType: Optional[str] = None
    text: Optional[str] = None
    file: Optional[str] = None

class RubricRequest(BaseModel):
    text: str
    language: str = "filipino"   # "english" or "filipino"
    grade_level: str = "Grade 7"

class RubricDimension(BaseModel):
    score: int   # 1-5
    rationale: str

class RubricResponse(BaseModel):
    content: RubricDimension
    organization: RubricDimension
    language_vocab: RubricDimension
    grammar: RubricDimension
    mechanics: RubricDimension
    overall_score: float
    overall_feedback: str
    grade_level: str
    language: str

class RetrainRequest(BaseModel):
    language: str  # en | tl


def _confidence_level(count: int) -> str:
    if count >= 100:
        return "Kumpiyansa"
    if count >= 30:
        return "Kalibrado"
    if count >= 5:
        return "Papaunlad"
    return "Natututo pa"


def _read_retrain_status() -> dict:
    if not RETRAIN_STATUS_PATH.exists():
        return {"en": {"last_retrain": None, "rated_at_retrain": 0}, "tl": {"last_retrain": None, "rated_at_retrain": 0}}
    try:
        with open(RETRAIN_STATUS_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
            return {
                "en": data.get("en", {"last_retrain": None, "rated_at_retrain": 0}),
                "tl": data.get("tl", {"last_retrain": None, "rated_at_retrain": 0}),
            }
    except Exception:
        return {"en": {"last_retrain": None, "rated_at_retrain": 0}, "tl": {"last_retrain": None, "rated_at_retrain": 0}}


def _write_retrain_status(status: dict) -> None:
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    with open(RETRAIN_STATUS_PATH, "w", encoding="utf-8") as f:
        json.dump(status, f, indent=2)


def _get_training_rows(language: str):
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        raise ValueError("Supabase service key not configured")

    client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    response = (
        client
        .table("student_grading_uploads")
        .select("essay_text, teacher_rubric_scores, subject_language")
        .eq("subject_language", language)
        .not_.is_("teacher_rubric_scores", "null")
        .execute()
    )
    return response.data or []


def _score_to_label(avg: float) -> str:
    """Map average teacher rubric score (1–4 scale) to DepEd 3-band badge."""
    if avg >= 3.5:
        return "Mahusay"
    if avg >= 2.5:
        return "Papaunlad"
    return "Nagsisimula"


def _extract_training_matrix(rows: list, language: str):
    X, y = [], []
    for row in rows:
        text = (row.get("essay_text") or "").strip()
        rubric = row.get("teacher_rubric_scores") or {}
        if not text or not isinstance(rubric, dict):
            continue

        dims = [rubric.get("content"), rubric.get("organization"), rubric.get("languageVocab"), rubric.get("grammar"), rubric.get("mechanics")]
        if any(d is None for d in dims):
            continue

        try:
            avg = float(sum(float(v) for v in dims) / 5.0)
        except Exception:
            continue

        features = extract_features(text, language=language)
        vec = features.get("vector")
        if vec is None or len(vec) == 0:
            continue
        X.append(np.array(vec[0], dtype=float))
        y.append(_score_to_label(avg))

    if not X:
        return np.array([]), np.array([])
    return np.vstack(X), np.array(y)


def _train_language_model(language: str) -> dict:
    rows = _get_training_rows(language)
    X_ph, y_ph = _extract_training_matrix(rows, language=language)
    if len(X_ph) < 5:
        raise ValueError(f"Need at least 5 rated essays for {language}, found {len(X_ph)}")

    # Blend with ASAP2 for English only. PH samples are weighted 2x.
    if language == "en":
        asap_path = os.path.join(os.path.dirname(__file__), "ASAP2_train_sourcetexts.csv")
        if os.path.exists(asap_path):
            X_asap, y_asap = load_asap_data(asap_path)
            X_train = np.vstack([X_asap, X_ph, X_ph])
            y_train = np.concatenate([y_asap, y_ph, y_ph])
        else:
            X_train, y_train = X_ph, y_ph
    else:
        X_train, y_train = X_ph, y_ph

    scaler = RobustScaler()
    X_scaled = scaler.fit_transform(X_train)
    model = SVC(kernel="rbf", C=10, gamma="scale", class_weight="balanced", random_state=42)
    model.fit(X_scaled, y_train)
    train_acc = float((model.predict(X_scaled) == y_train).mean() * 100.0)

    model_path = MODEL_DIR / ("proficiency_model_en.pkl" if language == "en" else "proficiency_model_tl.pkl")
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    with open(model_path, "wb") as f:
        import pickle
        pickle.dump({"model": model, "scaler": scaler}, f)

    # Hot-reload model into memory for immediate use.
    if language == "en":
        student_model_en.load(str(model_path))
    else:
        student_model_tl.load(str(model_path))

    return {
        "language": language,
        "samples_used": int(len(X_ph)),
        "asap2_samples": int(len(X_train) - len(X_ph) * 2) if language == "en" and len(X_train) > len(X_ph) else 0,
        "accuracy": f"{train_acc:.1f}%",
        "confidence_level": _confidence_level(int(len(X_ph))),
        "model_saved": model_path.name,
    }

def extract_text_from_pdf(base64_string: str) -> str:
    try:
        file_bytes = base64.b64decode(base64_string)
        reader = PdfReader(BytesIO(file_bytes))
        pages_text = []
        for page in reader.pages:
            page_text = page.extract_text() or ""
            pages_text.append(page_text)
        return "\n\n".join(t.strip() for t in pages_text if t.strip())
    except Exception as e:
        print(f"ERROR in extract_text_from_pdf: {e}")
        return ""

def generate_reference_title(text: str, name: Optional[str] = None) -> str:
    if name:
        return name
    first_line = next((line.strip() for line in text.split("\n") if line.strip()), "Reference")
    return first_line[:80]

async def evaluate_rubric_with_gemini(text: str, language: str, grade_level: str) -> dict:
    if not GEMINI_API_KEY:
        raise ValueError("Gemini API key not configured")

    import google.generativeai as genai
    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel("gemini-2.5-flash")

    lang_label = "Filipino (Tagalog)" if language == "filipino" else "English"

    if language == "filipino":
        language_calibration = (
            "- For Filipino-language essays: Taglish code-switching is the main vocabulary concern; "
            "minor verb focus errors are expected at G7"
        )
        grammar_note = ", Filipino verb focus system (mag-, um-, -in, -an, i-)"
        vocab_note = " (no Taglish)"
        english_esl_note = ""
    else:
        language_calibration = ""
        grammar_note = ", tense consistency, articles"
        vocab_note = ""
        english_esl_note = (
            "\nADDITIONAL CALIBRATION FOR ENGLISH ESSAYS BY FILIPINO G7 STUDENTS:\n"
            "- These students are second-language English writers. English is NOT their mother tongue.\n"
            "- EXPECTED L1 transfer errors (do NOT heavily penalize): article omission/misuse "
            "(a/an/the - Filipino has no article system), preposition misuse, verb tense inconsistency\n"
            "- Students transitioned to English-medium instruction from Grade 4 only - "
            "they have ~3 years of English writing experience\n"
            "- Content, organization, and ideas should be prioritized over surface grammar errors\n"
            "- A Filipino G7 student writing a coherent, on-topic English essay with minor grammar "
            "errors is performing well for this context\n"
            "- Do NOT apply native-speaker English standards - apply Philippine ESL Grade 7 standards"
        )

    prompt = f"""You are a DepEd-trained Philippine {grade_level} teacher grading a student essay.

Use the official DepEd 5-dimension analytic rubric. Each dimension is scored 1-5:
- 5: Excellent - exceeds {grade_level} expectations
- 4: Proficient - meets {grade_level} expectations
- 3: Developing - partially meets expectations (PASSING threshold for PH G7)
- 2: Beginning - minimally meets expectations
- 1: Poor - does not meet expectations

IMPORTANT CALIBRATION FOR PHILIPPINE GRADE 7:
- The average PH G7 student scores ~2.3/5 on Organization nationally (research baseline)
- Mechanical errors (punctuation, spelling) are the MOST COMMON error type in PH G7 - do not heavily penalize them
- PH G7 students writing in ANY language may use narrative/anecdote-heavy structure, collective experience, and faith/family themes - this is culturally appropriate and should NOT be penalized
- An essay that sustains a topic, has a clear 3-part structure, and communicates effectively is performing AT OR ABOVE the Philippine national average for G7
{language_calibration}{english_esl_note}

ESSAY LANGUAGE: {lang_label}

ESSAY TEXT:
\"\"\"
{text}
\"\"\"

Evaluate on these 5 dimensions:
1. CONTENT - Relevance, depth of ideas, supporting details, topic development
2. ORGANIZATION - Clear intro-body-conclusion structure, logical flow, paragraph transitions
3. LANGUAGE_VOCAB - Word choice, register appropriateness, formal vocabulary{vocab_note}
4. GRAMMAR - Verb forms, sentence construction, agreement{grammar_note}
5. MECHANICS - Capitalization, punctuation, spelling

Respond ONLY with valid JSON in this exact format:
{{
  "content": {{"score": <1-5>, "rationale": "<one sentence>"}},
  "organization": {{"score": <1-5>, "rationale": "<one sentence>"}},
  "language_vocab": {{"score": <1-5>, "rationale": "<one sentence>"}},
  "grammar": {{"score": <1-5>, "rationale": "<one sentence>"}},
  "mechanics": {{"score": <1-5>, "rationale": "<one sentence>"}},
  "overall_feedback": "<2-3 sentence teacher-facing feedback in {lang_label}>"
}}"""

    import json
    response = model.generate_content(
        prompt,
        generation_config=genai.types.GenerationConfig(
            response_mime_type="application/json",
            temperature=0.2,
        )
    )

    data = json.loads(response.text)
    scores = [
        data["content"]["score"],
        data["organization"]["score"],
        data["language_vocab"]["score"],
        data["grammar"]["score"],
        data["mechanics"]["score"],
    ]
    data["overall_score"] = round(sum(scores) / len(scores), 2)
    data["grade_level"] = grade_level
    data["language"] = language
    return data


@app.get("/")
def read_root():
    return {"message": "FastAPI backend is running!"}

@app.get("/health")
def health_check():
    """Health check endpoint for Docker and load balancers."""
    return {"status": "healthy", "service": "readtrack-backend"}

@app.post("/test-complexity")
def test_complexity(request: TextRequest):
    try:
        features = extract_features(request.text)
        result = complexity_model.predict(features, request.text)

        import json
        print("\n--- API /test-complexity Endpoint Result ---")
        print(json.dumps(result, indent=2))
        print("--------------------------------------------\n")

        return result
    except Exception as e:
        import traceback
        return {"error": str(e), "trace": traceback.format_exc()}

@app.get("/api/evaluation")
def get_evaluation_metrics():

    return {
        "proficiency": {
            "en": student_model_en.get_performance_metrics(),
            "tl": student_model_tl.get_performance_metrics(),
        },
        "complexity": complexity_model.get_performance_metrics()
    }

@app.post("/analyze/student")
async def analyze_student_text(request: TextRequest): # Added async to handle await
    try:
        text_to_analyze = request.text
        if request.image:
            mime = (request.mimeType or "").lower()
            if mime == "application/pdf":
                ocr_text = extract_text_from_pdf(request.image)
            else:
                ocr_text = extract_text_from_image(request.image, GEMINI_API_KEY, mime_type=mime).get("text", "")

            if ocr_text:
                text_to_analyze = (text_to_analyze + "\n" + ocr_text).strip()

        from grammar_service import detect_language, check_grammar, GrammarCheckRequest
        detected_lang = detect_language(text_to_analyze)
        
        # 1. NEW: Get real grammar data from the service
        # This replaces the hard-coded 85.0 accuracy in the model
        grammar_result = await check_grammar(GrammarCheckRequest(
            text=text_to_analyze, 
            language=detected_lang
        ))
        
        # 2. Extract features as usual
        features = extract_features(text_to_analyze, language=detected_lang)
        
        # 3. MODIFIED: Pass the grammar results into the prediction model
        # This allows the classifier and metrics to work together for the score
        model = student_model_en if detected_lang == 'en' else student_model_tl
        result = model.predict(
            features,
            text_to_analyze,
            grammar_data=grammar_result.dict(),
            language=detected_lang
        )

        result["analyzed_text"] = text_to_analyze
        return result
        
    except Exception as e:
        import traceback
        print("ERROR in analyze_student_text:")
        traceback.print_exc()
        return {"error": str(e), "trace": traceback.format_exc()}

@app.post("/analyze/rubric")
async def analyze_rubric(request: RubricRequest):
    try:
        result = await evaluate_rubric_with_gemini(
            text=request.text,
            language=request.language,
            grade_level=request.grade_level
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"error": str(e)}


@app.get("/train/status")
def train_status():
    try:
        status_meta = _read_retrain_status()
        en_count = len(_get_training_rows("en"))
        tl_count = len(_get_training_rows("tl"))

        return {
            "english": {
                "rated_essays": en_count,
                "confidence_level": _confidence_level(en_count),
                "last_retrain": status_meta["en"].get("last_retrain"),
                "new_since_retrain": max(0, en_count - int(status_meta["en"].get("rated_at_retrain", 0))),
            },
            "filipino": {
                "rated_essays": tl_count,
                "confidence_level": _confidence_level(tl_count),
                "last_retrain": status_meta["tl"].get("last_retrain"),
                "new_since_retrain": max(0, tl_count - int(status_meta["tl"].get("rated_at_retrain", 0))),
            },
        }
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"error": str(e)}


@app.post("/train/retrain")
def retrain_model(request: RetrainRequest):
    language = (request.language or "").strip().lower()
    if language not in {"en", "tl"}:
        raise HTTPException(status_code=400, detail="language must be 'en' or 'tl'")

    try:
        result = _train_language_model(language)
        status_meta = _read_retrain_status()
        rated_count = int(result.get("samples_used", 0))
        status_meta[language] = {
            "last_retrain": datetime.now(timezone.utc).isoformat(),
            "rated_at_retrain": rated_count,
        }
        _write_retrain_status(status_meta)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"error": str(e)}

@app.post("/ocr/extract")
def extract_text_from_image_endpoint(request: OCRRequest):

    try:
        print(f"Processing image for OCR. Mime: {request.mimeType}")
        ocr_result = extract_text_from_image(request.image, GEMINI_API_KEY, mime_type=request.mimeType)
        ocr_text = ocr_result.get("text", "")
        ocr_warning = ocr_result.get("warning")
        print(f"Extracted OCR text: {ocr_text}")
        if ocr_text:
            print(f"Extracted {len(ocr_text)} characters from image")
        else:
            print("Warning: No text extracted from image")

        return {"text": ocr_text, "warning": ocr_warning}
    except Exception as e:
        import traceback
        print("ERROR in extract_text_from_image_endpoint:")
        traceback.print_exc()
        return {"error": str(e), "trace": traceback.format_exc()}

@app.post("/reference/ingest")
def ingest_reference(request: ReferenceIngestRequest):

    try:
        text = ""
        if request.text:
            text = request.text
        elif request.file and request.mimeType:
            if request.mimeType == "application/pdf":
                text = extract_text_from_pdf(request.file)
            elif request.mimeType.startswith("image/"):
                text = extract_text_from_image(request.file, GEMINI_API_KEY, mime_type=request.mimeType).get("text", "")
            elif request.mimeType.startswith("text/"):
                decoded = base64.b64decode(request.file)
                text = decoded.decode("utf-8", errors="replace")

        title = generate_reference_title(text, request.name)
        return {"title": title, "text": text}
    except Exception as e:
        import traceback
        print("ERROR in ingest_reference:")
        traceback.print_exc()
        return {"error": str(e), "trace": traceback.format_exc()}



@app.post("/analyze/complexity")
def analyze_complexity_text(request: TextRequest):
    print(f"DEBUG: analyze_complexity_text called. Has image: {bool(request.image)}, Has text: {bool(request.text)}")
    try:
        text_to_analyze = request.text
        if request.image:
            mime = (request.mimeType or "").lower()
            if mime == "application/pdf":
                ocr_text = extract_text_from_pdf(request.image)
            else:
                ocr_text = extract_text_from_image(request.image, GEMINI_API_KEY, mime_type=mime).get("text", "")
            if ocr_text:
                text_to_analyze = (text_to_analyze + "\n" + ocr_text).strip()

        from grammar_service import detect_language
        detected_lang = detect_language(text_to_analyze)
        
        # Ensure preprocessing.py is synced with the training features
        features = extract_features(text_to_analyze, language=detected_lang)
        
        # Use the TextComplexitySVM predict method
        result = complexity_model.predict(features, text_to_analyze)

        result["analyzed_text"] = text_to_analyze
        return result
    except Exception as e:
        import traceback
        return {"error": str(e), "trace": traceback.format_exc()}

if __name__ == "__main__":
    import uvicorn
    print("Starting FastAPI Server on http://localhost:8000")
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
