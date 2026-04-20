import spacy
import os
import base64
import json
import re
import logging
import threading
import asyncio
import pickle
import functools
import concurrent.futures
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional, cast
from io import BytesIO
from pypdf import PdfReader
from dotenv import load_dotenv
from spacy.cli.download import download as spacy_download
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from preprocessing import extract_features
from svm_models import TextComplexitySVM, StudentProficiencySVM
from catboost import CatBoostClassifier
from sklearn.metrics import classification_report, confusion_matrix as sklearn_cm
import numpy as np
from supabase import create_client
from train_utils import load_asap_data
from ocr import extract_text_from_image
from tagalog_service import router as tagalog_router
from grammar_service import router as grammar_router

logger = logging.getLogger(__name__)

def _available_cpu_count() -> int:
    """Return effective CPU count, respecting affinity masks when available."""
    try:
        return len(os.sched_getaffinity(0))
    except Exception:
        return os.cpu_count() or 4


def _resolve_cpu_workers() -> int:
    """Resolve worker count from env override or auto-detected defaults."""
    raw = os.getenv("ANALYSIS_CPU_WORKERS")
    if raw is not None and raw.strip() != "":
        try:
            parsed = int(raw)
            if parsed > 0:
                return parsed
        except ValueError:
            pass

    # Auto mode: leave one core for event loop/OS, cap to avoid oversubscription.
    cores = _available_cpu_count()
    return max(2, min(8, cores - 1 if cores > 2 else cores))


def _resolve_spacy_gpu_mode() -> str:
    """Return 'auto', 'on', or 'off' based on USE_SPACY_GPU env."""
    raw = os.getenv("USE_SPACY_GPU")
    if raw is None or raw.strip() == "":
        return "auto"

    val = raw.strip().lower()
    if val in {"1", "true", "yes", "on"}:
        return "on"
    if val in {"0", "false", "no", "off"}:
        return "off"
    if val == "auto":
        return "auto"
    return "auto"


# Bounded worker pool for CPU-heavy work so independent tasks can use multiple cores
# without oversubscribing the host.
CPU_WORKERS = _resolve_cpu_workers()
CPU_EXECUTOR = concurrent.futures.ThreadPoolExecutor(max_workers=CPU_WORKERS)

import struct as _struct

def _friendly_error(e: Exception) -> str:
    """Return a user-friendly error message without leaking internal details."""
    import traceback
    traceback.print_exc()
    msg = str(e).lower()
    if isinstance(e, _struct.error) or "ubyte" in msg or "format requires" in msg:
        return "The file could not be processed. It may be corrupted or use an unsupported format. Try re-saving and uploading again."
    if isinstance(e, MemoryError) or "memory" in msg:
        return "The file is too large to process. Please try a smaller file."
    if isinstance(e, TimeoutError) or "timeout" in msg or "timed out" in msg:
        return "The request timed out. Please try again."
    if "connection" in msg or "network" in msg or "refused" in msg:
        return "Could not connect to a required service. Please try again later."
    if "api key" in msg or "invalid key" in msg or "unauthorized" in msg:
        return "API key error. Please contact your administrator."
    if "no text" in msg or "empty" in msg:
        return "No text could be extracted from the file. Please ensure the file contains readable text."
    return "An unexpected error occurred. Please try again."

BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND_DIR.parent

# Preferred: a single workspace-level env file shared by frontend/backend.
# Backward-compatible fallback: backend-local env files.
load_dotenv(BACKEND_DIR / '.env.local')
load_dotenv(BACKEND_DIR / '.env')
load_dotenv(PROJECT_ROOT / '.env.local')
load_dotenv(PROJECT_ROOT / '.env')


def get_gemini_api_key() -> str:
    # Reload env files with override so key updates are picked up without stale process state.
    load_dotenv(BACKEND_DIR / '.env.local', override=True)
    load_dotenv(BACKEND_DIR / '.env', override=True)
    load_dotenv(PROJECT_ROOT / '.env.local', override=True)
    load_dotenv(PROJECT_ROOT / '.env', override=True)

    key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or ""
    normalized = key.strip().strip('"').strip("'")
    if normalized.lower().startswith("bearer "):
        normalized = normalized[7:].strip()
    return normalized


GEMINI_API_KEY = get_gemini_api_key()
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
        gpu_mode = _resolve_spacy_gpu_mode()
        if gpu_mode == "off":
            print("spaCy GPU disabled by USE_SPACY_GPU=off")
        elif spacy.prefer_gpu():
            print(f"GPU acceleration enabled for spaCy (mode={gpu_mode})")
        else:
            print("GPU not available for spaCy, using CPU")

        print(f"CPU analysis workers: {CPU_WORKERS} (override with ANALYSIS_CPU_WORKERS)")
    except Exception as e:
        print(f"Could not enable GPU: {e}")

    try:
        spacy.load("en_core_web_sm")
    except OSError:
        print("Downloading spaCy model 'en_core_web_sm'...")
        spacy_download("en_core_web_sm")
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


async def run_cpu_bound(func, *args, **kwargs):
    """Run blocking CPU or I/O-bound functions off the event loop."""
    loop = asyncio.get_running_loop()
    call = functools.partial(func, *args, **kwargs)
    return await loop.run_in_executor(CPU_EXECUTOR, call)

models_dir = os.path.join(os.path.dirname(__file__), 'models')
_teacher_samples_path = os.path.join(os.path.dirname(__file__), 'data', 'teacher_samples.jsonl')
_retrain_lock = threading.Lock()
complexity_model = TextComplexitySVM()
student_model_en = StudentProficiencySVM()
student_model_tl = StudentProficiencySVM()

def retrain_complexity_model(samples_path: str):
    """Retrain TextComplexitySVM using CommonLit CSV + teacher samples. Thread-safe."""
    global complexity_model

    if not _retrain_lock.acquire(blocking=False):
        raise RuntimeError("Retrain already in progress — sample saved, will apply next retrain.")

    try:
        from train_utils import load_commonlit_features, load_teacher_samples

        X_orig, y_orig = load_commonlit_features(base_dir=os.path.dirname(__file__))
        if X_orig is None:
            print("Warning: complexity_features.csv missing — retraining on teacher samples only.")
            X_orig, y_orig = np.empty((0, 24)), np.array([], dtype=int)
        else:
            X_orig = np.asarray(X_orig)
            y_orig = np.asarray(y_orig) if y_orig is not None else np.array([], dtype=int)

        X_teach, y_teach = load_teacher_samples(samples_path)
        X_teach = np.asarray(X_teach) if X_teach is not None else np.empty((0, 24))
        y_teach = np.asarray(y_teach) if y_teach is not None else np.array([], dtype=int)

        if len(X_orig) == 0 and len(X_teach) == 0:
            raise RuntimeError("No training data available for retrain.")

        if len(X_teach) > 0 and len(X_orig) > 0:
            X = np.concatenate([X_orig, X_teach])
            y = np.concatenate([y_orig, y_teach])
        elif len(X_teach) > 0:
            X, y = X_teach, y_teach
        else:
            X, y = X_orig, y_orig

        new_model = TextComplexitySVM()
        new_model.train(X, y)

        comp_path = os.path.join(models_dir, 'complexity_model.pkl')
        with open(comp_path, 'wb') as f:
            pickle.dump({
                'model': new_model.model,
                'scaler': new_model.scaler,
                'feature_idx': getattr(new_model, 'feature_idx', None),
            }, f)

        # Thread-safe global replacement — lock already held
        complexity_model = new_model
        print(f"[retrain] Done: {len(X_orig)} CommonLit + {len(X_teach)} teacher samples.")
    finally:
        _retrain_lock.release()


class TextRequest(BaseModel):
    text: str
    image: Optional[str] = None
    mimeType: Optional[str] = None


class BenchmarkRequest(BaseModel):
    text: str
    image: Optional[str] = None
    mimeType: Optional[str] = None
    iterations: int = 3

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
    score: int   # 1-4
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

class TrainingSampleRequest(BaseModel):
    text: str
    level: str  # "Independent" | "Instructional" | "Frustration"


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
    load_dotenv(BACKEND_DIR / '.env.local', override=True)
    load_dotenv(BACKEND_DIR / '.env', override=True)
    load_dotenv(PROJECT_ROOT / '.env.local', override=True)
    load_dotenv(PROJECT_ROOT / '.env', override=True)
    supabase_url = os.getenv("SUPABASE_URL", "")
    supabase_service_key = os.getenv("SUPABASE_SERVICE_KEY", "")

    if not supabase_url or not supabase_service_key:
        raise ValueError("Supabase service key not configured")

    client = create_client(supabase_url, supabase_service_key)

    def _lang_match(value, target: str) -> bool:
        val = str(value or "").strip().lower()
        if not val:
            # Backward compatibility for rows created before subject_language existed.
            return True
        if target == "en":
            return val in {"en", "english"}
        return val in {"tl", "filipino", "tagalog"}

    # Try schema-aware query first (fast path).
    try:
        response = (
            client
            .table("student_grading_uploads")
            .select("essay_text, teacher_rubric_scores, subject_language")
            .in_("subject_language", ["en", "english"] if language == "en" else ["tl", "filipino", "tagalog"])
            .not_.is_("teacher_rubric_scores", "null")
            .execute()
        )
        rows = response.data or []
        if rows:
            return rows
    except Exception as e:
        print(f"[_get_training_rows] language-filter query fallback: {e}")

    # Fallback for schema drift/missing column: avoid selecting subject_language at all.
    response = (
        client
        .table("student_grading_uploads")
        .select("essay_text, teacher_rubric_scores")
        .not_.is_("teacher_rubric_scores", "null")
        .execute()
    )
    rows = response.data or []
    filtered_rows = []
    for row in rows:
        if isinstance(row, dict) and _lang_match(row.get("subject_language"), language):
            filtered_rows.append(row)
    return filtered_rows


def _score_to_label(avg: float) -> str:
    """Map average teacher rubric score (1–4 scale) to DepEd 3-band badge."""
    if avg >= 3.5:
        return "Mahusay"
    if avg >= 2.5:
        return "Papaunlad"
    return "Nagsisimula"


def _safe_float(value: Any) -> Optional[float]:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _extract_training_matrix(rows: list, language: str):
    X, y = [], []
    for row in rows:
        if not isinstance(row, dict):
            continue

        text = str(row.get("essay_text") or "").strip()
        rubric = row.get("teacher_rubric_scores") or {}
        if not text or not isinstance(rubric, dict):
            continue

        dims_raw = [rubric.get("content"), rubric.get("organization"), rubric.get("languageVocab"), rubric.get("grammar"), rubric.get("mechanics")]
        dims = [_safe_float(v) for v in dims_raw]
        if any(v is None for v in dims):
            continue

        avg = sum(cast(list[float], dims)) / 5.0

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

    model = CatBoostClassifier(
        loss_function="MultiClass",
        eval_metric="Accuracy",
        random_seed=42,
        verbose=False,
        depth=6,
        learning_rate=0.05,
        iterations=500,
        l2_leaf_reg=3,
    )
    model.fit(X_train, y_train)
    train_pred = np.asarray(model.predict(X_train)).ravel()
    train_acc = float((train_pred == y_train).mean() * 100.0)

    model_path = MODEL_DIR / ("proficiency_model_en.pkl" if language == "en" else "proficiency_model_tl.pkl")
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    with open(model_path, "wb") as f:
        import pickle
        pickle.dump({"model": model, "scaler": None, "model_type": "catboost"}, f)

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

def clean_extracted_text(text: str) -> str:
    """Normalize text extracted from PDF, DOCX, or TXT uploads."""
    if not text:
        return ""
    # Normalize line endings
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    # Remove standalone page numbers (lines that are just a number)
    text = re.sub(r"(?m)^\s*\d{1,4}\s*$", "", text)
    # Join hyphenated line-breaks (word- \n wrap -> wordwrap)
    text = re.sub(r"-\n(\w)", r"\1", text)
    # Collapse 3+ blank lines to a single blank line
    text = re.sub(r"\n{3,}", "\n\n", text)
    # Collapse multiple spaces (but preserve paragraph breaks)
    lines = text.split("\n")
    lines = [re.sub(r" {2,}", " ", line).strip() for line in lines]
    text = "\n".join(lines)
    return text.strip()


def extract_text_from_pdf(base64_string: str) -> str:
    try:
        import struct
        file_bytes = base64.b64decode(base64_string)
        reader = PdfReader(BytesIO(file_bytes), strict=False)
        pages_text = []
        for page in reader.pages:
            try:
                page_text = page.extract_text() or ""
            except (struct.error, Exception):
                page_text = ""
            pages_text.append(page_text)
        raw = "\n\n".join(t.strip() for t in pages_text if t.strip())
        return clean_extracted_text(raw)
    except Exception as e:
        print(f"ERROR in extract_text_from_pdf: {e}")
        return ""

def generate_reference_title(text: str, name: Optional[str] = None) -> str:
    if name and name.strip():
        return name.strip()[:80]

    lines = [line.strip() for line in text.split("\n") if line.strip()]
    if not lines:
        return "Reference"

    def _clean_title(candidate: str) -> str:
        cleaned = re.sub(r"^\s*(?:chapter\s+\d+[:.-]?\s*)", "", candidate, flags=re.IGNORECASE)
        cleaned = re.sub(r"^\s*[#*\-–•\d\.)\(:]+", "", cleaned)
        cleaned = re.sub(r"\s+", " ", cleaned)
        cleaned = cleaned.strip("\"'`~|:;,. ")
        return cleaned

    def _split_merged_title_and_body(candidate: str) -> tuple[str, str]:
        words = candidate.split()
        if len(words) <= 12:
            return candidate, ""

        sentence_starters = {
            "there", "this", "these", "those", "it", "i", "we", "they", "he", "she",
            "if", "when", "while", "because", "nowadays", "today", "in", "on", "at",
        }

        limit = min(len(words), 18)
        for idx in range(4, limit):
            prev_word = re.sub(r"[^A-Za-z]", "", words[idx - 1])
            current_word = re.sub(r"[^A-Za-z]", "", words[idx])
            if not prev_word or not current_word:
                continue

            # Boundary when a sentence-starter follows a lowercase word (e.g. "time there")
            # OR when a sentence-starter follows a run of title-cased words (e.g. "Time There")
            title_words_so_far = [re.sub(r"[^A-Za-z]", "", w) for w in words[:idx] if re.sub(r"[^A-Za-z]", "", w)]
            mostly_title_case = (
                len(title_words_so_far) > 0
                and sum(1 for w in title_words_so_far if w[0].isupper()) / len(title_words_so_far) >= 0.6
            )
            looks_like_boundary = (
                current_word.lower() in sentence_starters
                and current_word[0].isupper()
                and (prev_word.islower() or mostly_title_case)
            )
            if not looks_like_boundary:
                continue

            title_part = " ".join(words[:idx]).strip()
            body_part = " ".join(words[idx:]).strip()
            if 3 <= len(title_part.split()) <= 12 and len(body_part.split()) >= 4:
                return title_part, body_part

        return candidate, ""

    for line in lines[:3]:
        candidate = _clean_title(line)
        if len(candidate) < 3:
            continue

        title_part, _ = _split_merged_title_and_body(candidate)
        if len(title_part) >= 3:
            return title_part[:80]

    return "Reference"


def _normalize_title_for_match(value: str) -> str:
    normalized = re.sub(r"[^\w\s]", " ", value.lower())
    normalized = re.sub(r"_", " ", normalized)
    normalized = re.sub(r"\s+", " ", normalized).strip()
    return normalized


def remove_title_from_body(text: str, title: str) -> str:
    if not text.strip() or not title.strip():
        return text

    lines = text.splitlines()
    first_non_empty_index = next((i for i, line in enumerate(lines) if line.strip()), None)
    if first_non_empty_index is None:
        return text

    first_line = lines[first_non_empty_index].strip()
    normalized_first_line = _normalize_title_for_match(first_line)
    normalized_title = _normalize_title_for_match(title)

    if len(normalized_first_line) < 3 or len(normalized_title) < 3:
        return text

    is_title_duplicate = (
        normalized_first_line == normalized_title
        or normalized_first_line.startswith(normalized_title)
        or normalized_title.startswith(normalized_first_line)
    )

    if not is_title_duplicate:
        return text

    remaining_lines = lines[first_non_empty_index + 1 :]
    first_line_tokens = first_line.split()
    title_token_count = len(title.split())

    # If OCR merged title + paragraph into one line, remove only the title prefix.
    if len(first_line_tokens) > title_token_count:
        trimmed_first_line = " ".join(first_line_tokens[title_token_count:]).strip(" -:;,.\t")
        merged_lines = [trimmed_first_line] + remaining_lines
        cleaned_inline = "\n".join(line for line in merged_lines if line.strip()).strip()
        if cleaned_inline:
            return cleaned_inline

    while remaining_lines and not remaining_lines[0].strip():
        remaining_lines.pop(0)

    cleaned_text = "\n".join(remaining_lines).strip()
    return cleaned_text or text

async def evaluate_rubric_with_gemini(text: str, language: str, grade_level: str) -> dict:
    api_key = get_gemini_api_key()
    if not api_key:
        raise ValueError("Gemini API key not configured")

    import google.generativeai as genai
    genai_api = cast(Any, genai)
    genai_api.configure(api_key=api_key)
    model = genai_api.GenerativeModel("gemini-2.5-flash")

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

Use the official DepEd 4-level performance task rubric. Each dimension is scored 1-4:
- 4: Mahusay (Proficient) - fully meets {grade_level} expectations
- 3: Papalapit sa Kahusayan (Approaching Proficiency) - mostly meets expectations (above the passing threshold)
- 2: Papaunlad (Developing) - partially meets expectations (minimum passing for a single dimension)
- 1: Nagsisimula (Beginning) - does not yet meet expectations

IMPORTANT CALIBRATION FOR PHILIPPINE GRADE 7:
- The average PH G7 student scores ~2.3/4 on Organization nationally (research baseline)
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
  "content": {{"score": <1-4>, "rationale": "<one sentence>"}},
  "organization": {{"score": <1-4>, "rationale": "<one sentence>"}},
  "language_vocab": {{"score": <1-4>, "rationale": "<one sentence>"}},
  "grammar": {{"score": <1-4>, "rationale": "<one sentence>"}},
  "mechanics": {{"score": <1-4>, "rationale": "<one sentence>"}},
  "overall_feedback": "<2-3 sentence teacher-facing feedback in {lang_label}>"
}}"""

    import json
    response = model.generate_content(
        prompt,
        generation_config=genai_api.types.GenerationConfig(
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


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def _band_to_overall_score(band: str) -> float:
    # Center each proficiency band in the DepEd 1-4 scale.
    if band == "Mahusay":
        return 3.6
    if band == "Papaunlad":
        return 2.8
    if band == "Nagsisimula":
        return 1.8
    return 2.8


def _to_rubric_score(value_0_100: float) -> int:
    # Convert normalized feature score to DepEd rubric 1-4 band.
    if value_0_100 >= 80:
        return 4
    if value_0_100 >= 60:
        return 3
    if value_0_100 >= 40:
        return 2
    return 1


def _normalize_rubric_language(value: str) -> str:
    v = str(value or "").strip().lower()
    if v in {"english", "en", "eng"}:
        return "english"
    return "filipino"


def _build_ml_rubric_feedback(overall_score: float, content: int, organization: int, language_vocab: int, grammar: int, mechanics: int) -> str:
    strengths = []
    needs = []

    dimension_labels = {
        "content": (content, "idea development"),
        "organization": (organization, "organization and flow"),
        "language_vocab": (language_vocab, "word choice and language range"),
        "grammar": (grammar, "grammar control"),
        "mechanics": (mechanics, "mechanics and conventions"),
    }

    for _, (score, label) in dimension_labels.items():
        if score >= 3:
            strengths.append(label)
        else:
            needs.append(label)

    if overall_score >= 3.5:
        opener = "The essay is performing at a proficient level for Grade 7 English tasks."
    elif overall_score >= 2.5:
        opener = "The essay is approaching proficiency and shows a workable Grade 7 foundation."
    else:
        opener = "The essay is still in the beginning range and needs focused support."

    strength_line = (
        f"Strongest areas: {', '.join(strengths[:3])}."
        if strengths
        else "No strong dimensions are consistent yet."
    )
    need_line = (
        f"Priority next steps: strengthen {', '.join(needs[:3])}."
        if needs
        else "Next step is to sustain the current quality across longer tasks."
    )
    return f"{opener} {strength_line} {need_line}"


def _safe_float_metric(value: Any, default: float = 0.0) -> float:
    try:
        parsed = float(value)
        if np.isnan(parsed) or np.isinf(parsed):
            return default
        return parsed
    except Exception:
        return default


def _safe_model_dump(obj: Any) -> dict:
    if obj is None:
        return {}
    if hasattr(obj, "model_dump"):
        try:
            return cast(dict, obj.model_dump())
        except Exception:
            return {}
    if hasattr(obj, "dict"):
        try:
            return cast(dict, obj.dict())
        except Exception:
            return {}
    if isinstance(obj, dict):
        return obj
    return {}


def _build_reliable_fallback_rubric(grade_level: str, reason: str) -> dict:
    neutral_score = 2
    return {
        "content": {
            "score": neutral_score,
            "rationale": "Not enough stable signal yet; using a conservative baseline score.",
        },
        "organization": {
            "score": neutral_score,
            "rationale": "Not enough stable signal yet; using a conservative baseline score.",
        },
        "language_vocab": {
            "score": neutral_score,
            "rationale": "Not enough stable signal yet; using a conservative baseline score.",
        },
        "grammar": {
            "score": neutral_score,
            "rationale": "Not enough stable signal yet; using a conservative baseline score.",
        },
        "mechanics": {
            "score": neutral_score,
            "rationale": "Not enough stable signal yet; using a conservative baseline score.",
        },
        "overall_score": 2.0,
        "overall_feedback": (
            "The system returned a reliability-safe baseline because analysis inputs were incomplete "
            f"or unstable ({reason}). Please provide a longer essay and try again for a more precise score."
        ),
        "grade_level": grade_level,
        "language": "english",
    }


async def evaluate_rubric_with_ml_english(text: str, grade_level: str) -> dict:
    """Local ML rubric scoring for English only (no Gemini dependency)."""
    from grammar_service import GrammarCheckRequest, check_grammar

    cleaned_text = (text or "").strip()
    if len(cleaned_text.split()) < 10:
        return _build_reliable_fallback_rubric(grade_level, "text too short")

    features_task = asyncio.create_task(run_cpu_bound(extract_features, cleaned_text, language="en"))
    grammar_task = asyncio.create_task(check_grammar(GrammarCheckRequest(text=cleaned_text, language="en")))
    feature_result, grammar_result = await asyncio.gather(features_task, grammar_task, return_exceptions=True)

    if isinstance(feature_result, Exception):
        logger.warning(f"ML rubric feature extraction failed: {feature_result}")
        return _build_reliable_fallback_rubric(grade_level, "feature extraction failed")

    features = feature_result if isinstance(feature_result, dict) else {}
    grammar_data = _safe_model_dump(None if isinstance(grammar_result, Exception) else grammar_result)

    metrics = features.get("metrics", {})
    vector = features.get("vector")

    # Use trained English proficiency model signal as the global anchor.
    model_band = student_model_en.ml_predict(vector) if vector is not None else None
    anchored_overall = _band_to_overall_score(str(model_band or "Papaunlad"))

    word_count = _safe_float_metric(metrics.get("wordCount", 0), 0.0)
    vocab = _safe_float_metric(metrics.get("vocabularyRichness", 0), 0.0)
    structure = _safe_float_metric(metrics.get("structureCohesion", 0), 0.0)
    sentence_complexity = _safe_float_metric(metrics.get("sentenceComplexity", 0), 0.0)
    discourse_ratio = _safe_float_metric(metrics.get("discourseConnectorRatio", 0), 0.0)
    advanced_count = _safe_float_metric(metrics.get("advancedWordCount", 0), 0.0)
    sent_variety = _safe_float_metric(metrics.get("sentLenStdDev", 0), 0.0)
    difficult_ratio = _safe_float_metric(metrics.get("difficultWordRatio", 0), 0.0)

    grammar_issues = grammar_data.get("issues", []) if isinstance(grammar_data.get("issues", []), list) else []
    issue_count = _safe_float_metric(grammar_data.get("issue_count", len(grammar_issues)), float(len(grammar_issues)))
    error_count = float(len([
        i for i in grammar_issues
        if isinstance(i, dict) and str(i.get("severity", "")).lower() == "error"
    ]))

    if word_count <= 0:
        per_100_words_issues = 0.0
    else:
        per_100_words_issues = (issue_count / word_count) * 100.0
    grammar_quality = _clamp(100.0 - (per_100_words_issues * 8.0), 0.0, 100.0)

    # NLP/grammar feature composites (0-100), then projected to DepEd 1-4.
    content_base = (
        _clamp(word_count / 2.5, 0.0, 100.0) * 0.25
        + _clamp(discourse_ratio * 220.0, 0.0, 100.0) * 0.25
        + _clamp(structure, 0.0, 100.0) * 0.25
        + _clamp(vocab, 0.0, 100.0) * 0.25
    )
    organization_base = (
        _clamp(structure, 0.0, 100.0) * 0.45
        + _clamp(sentence_complexity, 0.0, 100.0) * 0.35
        + _clamp(sent_variety / 12.0 * 100.0, 0.0, 100.0) * 0.20
    )
    language_base = (
        _clamp(vocab, 0.0, 100.0) * 0.55
        + _clamp((advanced_count / max(word_count, 1.0)) * 1400.0, 0.0, 100.0) * 0.30
        + _clamp((1.0 - difficult_ratio) * 100.0, 0.0, 100.0) * 0.15
    )
    grammar_base = (
        grammar_quality * 0.75
        + _clamp(structure, 0.0, 100.0) * 0.25
    )
    mechanics_base = _clamp(100.0 - (error_count / max(word_count, 1.0) * 900.0), 0.0, 100.0)

    # Keep per-dimension scores consistent with the model's overall proficiency signal.
    anchor_0_100 = (anchored_overall - 1.0) / 3.0 * 100.0
    blend = lambda raw: _clamp((raw * 0.65) + (anchor_0_100 * 0.35), 0.0, 100.0)

    content_score = _to_rubric_score(blend(content_base))
    organization_score = _to_rubric_score(blend(organization_base))
    language_score = _to_rubric_score(blend(language_base))
    grammar_score = _to_rubric_score(blend(grammar_base))
    mechanics_score = _to_rubric_score(blend(mechanics_base))

    overall_score = round((
        content_score
        + organization_score
        + language_score
        + grammar_score
        + mechanics_score
    ) / 5.0, 2)
    overall_score = round(_clamp(overall_score, 1.0, 4.0), 2)

    overall_feedback = _build_ml_rubric_feedback(
        overall_score,
        content_score,
        organization_score,
        language_score,
        grammar_score,
        mechanics_score,
    )

    return {
        "content": {
            "score": content_score,
            "rationale": f"ML signals show content depth and support at a score-{content_score} level for this grade.",
        },
        "organization": {
            "score": organization_score,
            "rationale": f"Cohesion and sentence-flow features place organization at score {organization_score}.",
        },
        "language_vocab": {
            "score": language_score,
            "rationale": f"Vocabulary richness and lexical range features map to score {language_score}.",
        },
        "grammar": {
            "score": grammar_score,
            "rationale": f"Error-rate and syntax-control features indicate grammar performance at score {grammar_score}.",
        },
        "mechanics": {
            "score": mechanics_score,
            "rationale": f"Convention-level issue density aligns with mechanics score {mechanics_score}.",
        },
        "overall_score": overall_score,
        "overall_feedback": overall_feedback,
        "grade_level": grade_level,
        "language": "english",
    }


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
        return {"error": _friendly_error(e)}

@app.get("/api/evaluation")
def get_evaluation_metrics():

    return {
        "proficiency": student_model_en.get_performance_metrics(),
        "complexity": complexity_model.get_performance_metrics()
    }


@app.post("/analyze/benchmark")
async def benchmark_analysis_pipeline(request: BenchmarkRequest):
    """Benchmark analysis stages and compare sequential vs concurrent execution."""
    try:
        iterations = max(1, min(int(request.iterations or 1), 20))
        text_to_analyze = request.text or ""

        ocr_ms = 0.0
        if request.image:
            ocr_start = time.perf_counter()
            mime = (request.mimeType or "").lower()
            if mime == "application/pdf":
                ocr_text = await run_cpu_bound(extract_text_from_pdf, request.image)
                if not ocr_text.strip():
                    ocr_result = await run_cpu_bound(
                        extract_text_from_image,
                        request.image,
                        get_gemini_api_key(),
                        mime_type="application/pdf"
                    )
                    ocr_text = ocr_result.get("text", "")
            else:
                ocr_result = await run_cpu_bound(
                    extract_text_from_image,
                    request.image,
                    get_gemini_api_key(),
                    mime_type=mime
                )
                ocr_text = ocr_result.get("text", "")

            if ocr_text:
                text_to_analyze = (text_to_analyze + "\n" + ocr_text).strip()
            ocr_ms = round((time.perf_counter() - ocr_start) * 1000.0, 2)

        from grammar_service import detect_language, check_grammar, GrammarCheckRequest

        lang_start = time.perf_counter()
        detected_lang = detect_language(text_to_analyze)
        detect_language_ms = round((time.perf_counter() - lang_start) * 1000.0, 2)

        student_model = student_model_en if detected_lang == 'en' else student_model_tl

        # Sequential baseline (single run)
        seq_grammar_start = time.perf_counter()
        seq_grammar = await check_grammar(GrammarCheckRequest(text=text_to_analyze, language=detected_lang))
        seq_grammar_ms = (time.perf_counter() - seq_grammar_start) * 1000.0

        seq_features_start = time.perf_counter()
        seq_features = await run_cpu_bound(extract_features, text_to_analyze, language=detected_lang)
        seq_features_ms = (time.perf_counter() - seq_features_start) * 1000.0

        seq_model_start = time.perf_counter()
        await run_cpu_bound(
            student_model.predict,
            seq_features,
            text_to_analyze,
            grammar_data=seq_grammar.model_dump(),
            language=detected_lang
        )
        seq_model_ms = (time.perf_counter() - seq_model_start) * 1000.0
        sequential_total_ms = seq_grammar_ms + seq_features_ms + seq_model_ms

        # Sequential complexity baseline (single run)
        seq_complexity_features_start = time.perf_counter()
        seq_complexity_features = await run_cpu_bound(extract_features, text_to_analyze, language=detected_lang)
        seq_complexity_features_ms = (time.perf_counter() - seq_complexity_features_start) * 1000.0

        seq_complexity_model_start = time.perf_counter()
        await run_cpu_bound(complexity_model.predict, seq_complexity_features, text_to_analyze)
        seq_complexity_model_ms = (time.perf_counter() - seq_complexity_model_start) * 1000.0
        sequential_complexity_total_ms = seq_complexity_features_ms + seq_complexity_model_ms

        runs = []
        for i in range(iterations):
            run_start = time.perf_counter()

            # Student analysis (concurrent grammar + features)
            student_start = time.perf_counter()
            grammar_task = asyncio.create_task(check_grammar(GrammarCheckRequest(
                text=text_to_analyze,
                language=detected_lang
            )))
            features_task = asyncio.create_task(run_cpu_bound(
                extract_features,
                text_to_analyze,
                language=detected_lang
            ))

            grammar_result, student_features = await asyncio.gather(grammar_task, features_task)

            student_model_start = time.perf_counter()
            await run_cpu_bound(
                student_model.predict,
                student_features,
                text_to_analyze,
                grammar_data=grammar_result.model_dump(),
                language=detected_lang
            )
            student_model_ms = (time.perf_counter() - student_model_start) * 1000.0
            student_total_ms = (time.perf_counter() - student_start) * 1000.0

            # Complexity analysis
            complexity_start = time.perf_counter()
            complexity_features = await run_cpu_bound(extract_features, text_to_analyze, language=detected_lang)

            complexity_model_start = time.perf_counter()
            await run_cpu_bound(complexity_model.predict, complexity_features, text_to_analyze)
            complexity_model_ms = (time.perf_counter() - complexity_model_start) * 1000.0
            complexity_total_ms = (time.perf_counter() - complexity_start) * 1000.0

            run_total_ms = (time.perf_counter() - run_start) * 1000.0
            runs.append({
                "run": i + 1,
                "student_total_ms": round(student_total_ms, 2),
                "student_model_ms": round(student_model_ms, 2),
                "complexity_total_ms": round(complexity_total_ms, 2),
                "complexity_model_ms": round(complexity_model_ms, 2),
                "combined_total_ms": round(run_total_ms, 2),
            })

        def _avg(key: str) -> float:
            vals = [r[key] for r in runs]
            return round(sum(vals) / len(vals), 2) if vals else 0.0

        avg_student_ms = _avg("student_total_ms")
        avg_complexity_ms = _avg("complexity_total_ms")
        avg_combined_ms = _avg("combined_total_ms")

        old_student_ms = round(sequential_total_ms, 2)
        old_complexity_ms = round(sequential_complexity_total_ms, 2)
        old_combined_ms = round(sequential_total_ms + sequential_complexity_total_ms, 2)

        def _improvement(old: float, new: float) -> float:
            if old <= 0:
                return 0.0
            return round(((old - new) / old) * 100.0, 2)

        old_vs_new = {
            "student": {
                "old_ms": old_student_ms,
                "new_ms": avg_student_ms,
                "speedup_x": round(old_student_ms / max(avg_student_ms, 1e-6), 2),
                "improvement_percent": _improvement(old_student_ms, avg_student_ms),
            },
            "complexity": {
                "old_ms": old_complexity_ms,
                "new_ms": avg_complexity_ms,
                "speedup_x": round(old_complexity_ms / max(avg_complexity_ms, 1e-6), 2),
                "improvement_percent": _improvement(old_complexity_ms, avg_complexity_ms),
            },
            "combined": {
                "old_ms": old_combined_ms,
                "new_ms": avg_combined_ms,
                "speedup_x": round(old_combined_ms / max(avg_combined_ms, 1e-6), 2),
                "improvement_percent": _improvement(old_combined_ms, avg_combined_ms),
            },
        }

        return {
            "language": "eng" if detected_lang == "en" else "fil",
            "cpu_workers": CPU_WORKERS,
            "iterations": iterations,
            "one_time": {
                "ocr_ms": ocr_ms,
                "detect_language_ms": detect_language_ms,
            },
            "student_sequential_baseline_ms": {
                "grammar_ms": round(seq_grammar_ms, 2),
                "features_ms": round(seq_features_ms, 2),
                "model_ms": round(seq_model_ms, 2),
                "total_ms": round(sequential_total_ms, 2),
            },
            "complexity_sequential_baseline_ms": {
                "features_ms": round(seq_complexity_features_ms, 2),
                "model_ms": round(seq_complexity_model_ms, 2),
                "total_ms": round(sequential_complexity_total_ms, 2),
            },
            "concurrent_averages_ms": {
                "student_total_ms": avg_student_ms,
                "complexity_total_ms": avg_complexity_ms,
                "combined_total_ms": avg_combined_ms,
            },
            "estimated_student_speedup_x": round(
                (sequential_total_ms / max(avg_student_ms, 1e-6)),
                2
            ),
            "old_vs_new": old_vs_new,
            "runs": runs,
        }
    except Exception as e:
        return {"error": _friendly_error(e)}

@app.post("/analyze/student")
async def analyze_student_text(request: TextRequest): # Added async to handle await
    try:
        text_to_analyze = request.text
        if request.image:
            mime = (request.mimeType or "").lower()
            if mime == "application/pdf":
                ocr_text = await run_cpu_bound(extract_text_from_pdf, request.image)
            else:
                ocr_result = await run_cpu_bound(
                    extract_text_from_image,
                    request.image,
                    get_gemini_api_key(),
                    mime_type=mime
                )
                ocr_text = ocr_result.get("text", "")

            if ocr_text:
                text_to_analyze = (text_to_analyze + "\n" + ocr_text).strip()

        from grammar_service import detect_language, check_grammar, GrammarCheckRequest
        detected_lang = detect_language(text_to_analyze)

        # Run independent heavy stages concurrently to use multiple cores.
        grammar_task = asyncio.create_task(check_grammar(GrammarCheckRequest(
            text=text_to_analyze,
            language=detected_lang
        )))
        features_task = asyncio.create_task(run_cpu_bound(
            extract_features,
            text_to_analyze,
            language=detected_lang
        ))

        grammar_result, features = await asyncio.gather(grammar_task, features_task)
        
        # Run model inference off the event loop to avoid blocking other requests.
        model = student_model_en if detected_lang == 'en' else student_model_tl
        result = await run_cpu_bound(
            model.predict,
            features,
            text_to_analyze,
            grammar_data=grammar_result.model_dump(),
            language=detected_lang
        )

        result["analyzed_text"] = text_to_analyze
        return result
        
    except Exception as e:
        return {"error": _friendly_error(e)}

@app.post("/analyze/rubric")
async def analyze_rubric(request: RubricRequest):
    try:
        normalized_language = _normalize_rubric_language(request.language)
        if normalized_language == "english":
            result = await evaluate_rubric_with_ml_english(
                text=request.text,
                grade_level=request.grade_level,
            )
        else:
            result = await evaluate_rubric_with_gemini(
                text=request.text,
                language=normalized_language,
                grade_level=request.grade_level,
            )
        return result
    except ValueError as e:
        raise HTTPException(status_code=503, detail="Rubric evaluation is temporarily unavailable. Please try again.")
    except Exception as e:
        return {"error": _friendly_error(e)}


@app.get("/train/status")
def train_status():
    def _safe_count(lang: str) -> int:
        try:
            return len(_get_training_rows(lang))
        except Exception as e:
            print(f"[train/status] _safe_count({lang}) failed: {e}")
            return 0

    try:
        status_meta = _read_retrain_status()
        en_count = _safe_count("en")
        tl_count = _safe_count("tl")

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
    except Exception as e:
        return {"error": _friendly_error(e)}


@app.get("/train/performance")
def train_performance(lang: str = "en"):
    if lang not in {"en", "tl"}:
        return {"error": "lang must be 'en' or 'tl'"}

    try:
        load_dotenv(BACKEND_DIR / '.env.local', override=True)
        load_dotenv(BACKEND_DIR / '.env', override=True)
        load_dotenv(PROJECT_ROOT / '.env.local', override=True)
        load_dotenv(PROJECT_ROOT / '.env', override=True)
        supabase_url = os.getenv("SUPABASE_URL", "")
        supabase_service_key = os.getenv("SUPABASE_SERVICE_KEY", "")

        if not supabase_url or not supabase_service_key:
            return {"insufficient_data": True, "rated_essays": 0, "lang": lang}

        client = create_client(supabase_url, supabase_service_key)
        def _lang_match(value, target: str) -> bool:
            val = str(value or "").strip().lower()
            if not val:
                # Backward compatibility for rows created before subject_language existed.
                return True
            if target == "en":
                return val in {"en", "english"}
            return val in {"tl", "filipino", "tagalog"}

        rows = []
        try:
            response = (
                client
                .table("student_grading_uploads")
                .select("diagnosis_result, teacher_rubric_scores, subject_language")
                .in_("subject_language", ["en", "english"] if lang == "en" else ["tl", "filipino", "tagalog"])
                .not_.is_("teacher_rubric_scores", "null")
                .not_.is_("diagnosis_result", "null")
                .execute()
            )
            rows = response.data or []
        except Exception as e:
            print(f"[train/performance] language-filter query fallback: {e}")

        if not rows:
            # Fallback for schema drift/missing column: avoid selecting subject_language at all.
            response = (
                client
                .table("student_grading_uploads")
                .select("diagnosis_result, teacher_rubric_scores")
                .not_.is_("teacher_rubric_scores", "null")
                .not_.is_("diagnosis_result", "null")
                .execute()
            )
            rows = []
            for r in (response.data or []):
                if isinstance(r, dict) and _lang_match(r.get("subject_language"), lang):
                    rows.append(r)

        VALID_LABELS = {"Mahusay", "Papaunlad", "Nagsisimula"}
        LEGACY_MAP = {"Independent": "Mahusay", "Instructional": "Papaunlad", "Frustration": "Nagsisimula"}

        teacher_labels = []
        system_labels = []

        for row in rows:
            if not isinstance(row, dict):
                continue

            dr_raw = row.get("diagnosis_result") or {}
            tr_raw = row.get("teacher_rubric_scores") or {}
            if not isinstance(dr_raw, dict) or not isinstance(tr_raw, dict):
                continue

            dr = cast(dict[str, Any], dr_raw)
            tr = cast(dict[str, Any], tr_raw)

            sys_raw_val = dr.get("proficiency", "")
            sys_raw = sys_raw_val if isinstance(sys_raw_val, str) else str(sys_raw_val)
            sys_label = LEGACY_MAP.get(sys_raw, sys_raw)
            if sys_label not in VALID_LABELS:
                continue

            teacher_overall = _safe_float(tr.get("overall"))
            if teacher_overall is None:
                continue
            teacher_label = _score_to_label(teacher_overall)

            teacher_labels.append(teacher_label)
            system_labels.append(sys_label)

        total_compared = len(teacher_labels)
        if total_compared < 5:
            return {"insufficient_data": True, "rated_essays": total_compared, "lang": lang}

        LABELS = ["Mahusay", "Papaunlad", "Nagsisimula"]
        report_raw = classification_report(
            teacher_labels, system_labels,
            labels=LABELS, output_dict=True, zero_division=0
        )
        report = cast(dict[str, Any], report_raw)
        cm = sklearn_cm(teacher_labels, system_labels, labels=LABELS).tolist()

        macro = report.get("macro avg", {})
        macro_dict = macro if isinstance(macro, dict) else {}
        macro_f1        = round(float(macro_dict.get("f1-score", 0.0)), 3)
        macro_precision = round(float(macro_dict.get("precision", 0.0)), 3)
        macro_recall    = round(float(macro_dict.get("recall", 0.0)), 3)

        per_class = {}
        for label in LABELS:
            cls_raw = report.get(label, {})
            cls = cls_raw if isinstance(cls_raw, dict) else {}
            per_class[label] = {
                "precision": round(float(cls.get("precision", 0.0)), 3),
                "recall":    round(float(cls.get("recall", 0.0)), 3),
                "f1":        round(float(cls.get("f1-score", 0.0)), 3),
                "support":   int(float(cls.get("support", 0))),
            }

        # Per-dimension MAE
        DIMS = ["content", "organization", "languageVocab", "grammar", "mechanics"]
        dim_sys_scores  = {d: [] for d in DIMS}
        dim_tea_scores  = {d: [] for d in DIMS}

        for row in rows:
            if not isinstance(row, dict):
                continue

            dr_raw = row.get("diagnosis_result") or {}
            tr_raw = row.get("teacher_rubric_scores") or {}
            if not isinstance(dr_raw, dict) or not isinstance(tr_raw, dict):
                continue

            rubric_raw = dr_raw.get("rubricScore")
            if not isinstance(rubric_raw, dict):
                continue

            tr = cast(dict[str, Any], tr_raw)
            rubric = cast(dict[str, Any], rubric_raw)
            for dim in DIMS:
                dim_obj = rubric.get(dim)
                sys_score = dim_obj.get("score") if isinstance(dim_obj, dict) else None
                tea_score = tr.get(dim)
                sys_num = _safe_float(sys_score)
                tea_num = _safe_float(tea_score)
                if sys_num is not None and tea_num is not None:
                    dim_sys_scores[dim].append(sys_num)
                    dim_tea_scores[dim].append(tea_num)

        per_dimension = {}
        for dim in DIMS:
            s_list = dim_sys_scores[dim]
            t_list = dim_tea_scores[dim]
            n = len(s_list)
            if n == 0:
                per_dimension[dim] = {"mae": None, "samples": 0, "avg_system": None, "avg_teacher": None}
            else:
                mae = round(sum(abs(s - t) for s, t in zip(s_list, t_list)) / n, 2)
                per_dimension[dim] = {
                    "mae":        mae,
                    "samples":    n,
                    "avg_system":  round(sum(s_list) / n, 2),
                    "avg_teacher": round(sum(t_list) / n, 2),
                }

        status_meta = _read_retrain_status()
        last_retrain = status_meta.get(lang, {}).get("last_retrain")

        return {
            "lang":             lang,
            "total_compared":   total_compared,
            "macro_f1":         macro_f1,
            "macro_precision":  macro_precision,
            "macro_recall":     macro_recall,
            "per_class":        per_class,
            "confusion_matrix": {
                "labels":    LABELS,
                "matrix":    cm,
                "row_label": "Guro (Tunay)",
                "col_label": "Sistema (Hula)",
            },
            "per_dimension":    per_dimension,
            "confidence_level": _confidence_level(total_compared),
            "rated_essays":     total_compared,
            "last_retrain":     last_retrain,
        }

    except Exception as e:
        return {"error": _friendly_error(e)}


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
        # Not enough samples — not an error, just nothing to retrain yet
        return {"status": "skipped", "message": str(e)}
    except Exception as e:
        return {"error": _friendly_error(e)}

@app.post("/training/add-sample")
async def add_training_sample(request: TrainingSampleRequest):
    valid_levels = {"Independent", "Instructional", "Frustration"}
    if request.level not in valid_levels:
        raise HTTPException(status_code=400, detail="Invalid level. Must be Independent, Instructional, or Frustration.")
    if not request.text or len(request.text.strip()) < 20:
        raise HTTPException(status_code=400, detail="Text too short to be a useful training sample (minimum 20 characters).")

    features = extract_features(request.text)
    raw = features['vector']
    # Real extract_features returns a 2D numpy array (shape 1×24); tests may
    # supply a flat list of 24 numbers.  Normalise to a plain Python list.
    if hasattr(raw, 'tolist'):
        # numpy array — could be 1-D or 2-D
        flat = raw.tolist()
        vector = flat[0] if flat and isinstance(flat[0], list) else flat
    elif raw and isinstance(raw[0], (list, np.ndarray)):
        # nested list/array — take first row
        inner = raw[0]
        vector = inner.tolist() if hasattr(inner, 'tolist') else list(inner)
    else:
        # already a flat list of numbers
        vector = list(raw)

    with open(_teacher_samples_path, 'a') as f:
        f.write(json.dumps({"vector": vector, "label": request.level}) + "\n")

    try:
        await asyncio.to_thread(retrain_complexity_model, _teacher_samples_path)
    except RuntimeError as e:
        return {"status": "sample_saved", "message": str(e)}

    return {"status": "ok", "message": "Sample saved and model retrained."}

@app.post("/ocr/extract")
def extract_text_from_image_endpoint(request: OCRRequest):

    try:
        if request.mimeType == "application/pdf":
            print(f"Processing PDF for text extraction. Length: {len(request.image)}")
            ocr_text = extract_text_from_pdf(request.image)
            print(f"Extracted {len(ocr_text)} characters from PDF via pypdf")
            # Scanned PDF — fall back to Gemini OCR
            if not ocr_text.strip():
                print("DEBUG: pypdf returned no text (scanned PDF), falling back to Gemini OCR")
                ocr_result = extract_text_from_image(request.image, get_gemini_api_key(), mime_type="application/pdf")
                ocr_text = ocr_result.get("text", "")
                return {"text": ocr_text, "warning": ocr_result.get("warning"), "error": ocr_result.get("error")}
            return {"text": ocr_text, "warning": None}

        print(f"\n{'='*60}")
        print(f"OCR REQUEST  mime={request.mimeType}  size={len(request.image)} chars")
        ocr_result = extract_text_from_image(request.image, get_gemini_api_key(), mime_type=request.mimeType)
        ocr_text = ocr_result.get("text", "")
        ocr_warning = ocr_result.get("warning")
        ocr_error = ocr_result.get("error")
        if ocr_error:
            print(f"OCR ERROR: {ocr_error}")
            print(f"{'='*60}\n")
            return {"text": "", "warning": None, "error": ocr_error}
        if ocr_text:
            print(f"OCR SUCCESS  {len(ocr_text)} chars extracted")
            print(f"--- EXTRACTED TEXT ---")
            print(ocr_text[:2000] + ("..." if len(ocr_text) > 2000 else ""))
            print(f"--- END ---")
        else:
            print(f"OCR WARNING: No text extracted. warning={ocr_warning}")
        print(f"{'='*60}\n")

        return {"text": ocr_text, "warning": ocr_warning}
    except Exception as e:
        return {"error": _friendly_error(e)}

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
                text = extract_text_from_image(request.file, get_gemini_api_key(), mime_type=request.mimeType).get("text", "")
            elif request.mimeType.startswith("text/"):
                decoded = base64.b64decode(request.file)
                text = decoded.decode("utf-8", errors="replace")

        text = clean_extracted_text(text)
        title = generate_reference_title(text, request.name)
        cleaned_text = remove_title_from_body(text, title)
        return {"title": title, "text": cleaned_text}
    except Exception as e:
        return {"error": _friendly_error(e)}



class DetectLanguageRequest(BaseModel):
    text: str


async def _detect_language_gemini(text: str) -> Optional[str]:
    """Use Gemini to detect whether text is English or Filipino. Returns 'eng'|'fil' or None on failure."""
    try:
        api_key = get_gemini_api_key()
        if not api_key:
            return None
        import google.generativeai as genai
        genai_api = cast(Any, genai)
        genai_api.configure(api_key=api_key)
        model = genai_api.GenerativeModel("gemini-2.5-flash")
        snippet = text[:800]
        prompt = (
            "Identify the primary language of the following text. "
            "Reply with exactly one word: 'English' or 'Filipino'. "
            "Do not explain.\n\n"
            f"Text:\n{snippet}"
        )
        response = model.generate_content(
            prompt,
            generation_config=genai_api.types.GenerationConfig(
                temperature=0, max_output_tokens=5
            ),
        )
        answer = (response.text or "").strip().lower()
        if "english" in answer:
            return "eng"
        if "filipino" in answer or "tagalog" in answer:
            return "fil"
        return None
    except Exception as e:
        logger.warning(f"Gemini language detection failed: {e}")
        return None


@app.post("/detect-language")
async def detect_language_endpoint(request: DetectLanguageRequest):
    from grammar_service import detect_language
    try:
        if not request.text or len(request.text.strip()) < 10:
            return {"language": "fil"}
        # Try Gemini first for accurate detection
        gemini_result = await _detect_language_gemini(request.text)
        if gemini_result:
            return {"language": gemini_result}
        # Fall back to heuristic + langdetect
        lang = detect_language(request.text)
        return {"language": "eng" if lang == "en" else "fil"}
    except Exception as e:
        logger.error(f"detect_language_endpoint failed: {e}")
        return {"language": "fil"}


@app.post("/analyze/complexity")
async def analyze_complexity_text(request: TextRequest):
    print(f"DEBUG: analyze_complexity_text called. Has image: {bool(request.image)}, Has text: {bool(request.text)}")
    try:
        text_to_analyze = request.text
        if request.image:
            mime = (request.mimeType or "").lower()
            if mime == "application/pdf":
                ocr_text = await run_cpu_bound(extract_text_from_pdf, request.image)
                # Scanned PDF — pypdf finds no text layer; fall back to Gemini OCR
                if not ocr_text.strip():
                    print("DEBUG: pypdf returned no text (scanned PDF), falling back to Gemini OCR")
                    ocr_result = await run_cpu_bound(
                        extract_text_from_image,
                        request.image,
                        get_gemini_api_key(),
                        mime_type="application/pdf"
                    )
                    ocr_text = ocr_result.get("text", "")
            else:
                ocr_result = await run_cpu_bound(
                    extract_text_from_image,
                    request.image,
                    get_gemini_api_key(),
                    mime_type=mime
                )
                ocr_text = ocr_result.get("text", "")
            if ocr_text:
                text_to_analyze = (text_to_analyze + "\n" + ocr_text).strip()

        from grammar_service import detect_language
        detected_lang = detect_language(text_to_analyze)
        
        # Ensure preprocessing.py is synced with the training features
        features = await run_cpu_bound(extract_features, text_to_analyze, language=detected_lang)
        
        # Use the TextComplexitySVM predict method
        result = await run_cpu_bound(complexity_model.predict, features, text_to_analyze)

        result["analyzed_text"] = text_to_analyze

        # Expose raw NLP features so visualizers can display them
        m = features["metrics"]
        ri = m.get("readabilityIndices", {})
        cefr = m.get("cefrDistribution", {})
        total_cefr = sum(cefr.values()) or 1
        result["features"] = {
            "avg_word_length":          round(sum(len(w) for w in m.get("difficultWords", [])) / max(len(m.get("difficultWords", [])), 1), 2),
            "avg_sentence_length":      round(m.get("avgSentenceLength", 0), 2),
            "ttr":                      round(m.get("vocabularyRichness", 0) / 100, 3),
            "cefr_ratio":               round(((cefr.get("B2", 0) + cefr.get("C1", 0) + cefr.get("C2", 0)) / total_cefr), 3),
            "fkgl":                     round(ri.get("flesch_kincaid", 0), 1),
            "gunning_fog":              round(ri.get("gunning_fog", 0), 1),
            "dependency_depth":         round(m.get("avgDepDistance", 0), 2),
            "subordination_ratio":      round(m.get("subordinationRatio", 0), 3),
            "discourse_connector_ratio":round(m.get("discourseConnectorRatio", 0), 3),
            "passive_ratio":            round(m.get("passiveRatio", 0), 3),
            "modal_ratio":              round(m.get("modalRatio", 0), 3),
            "negation_ratio":           round(m.get("negationRatio", 0), 3),
            "abstract_noun_ratio":      round(m.get("abstractNounRatio", 0), 3),
        }
        return result
    except Exception as e:
        return {"error": _friendly_error(e)}

@app.post("/analyze/all")
async def analyze_all(request: TextRequest):
    """
    Combined endpoint: extracts NLP features once, then runs proficiency,
    complexity, grammar, and rubric models in parallel.
    Returns { student, complexity, rubric } in a single round-trip.
    """
    try:
        from grammar_service import detect_language, check_grammar, GrammarCheckRequest

        text_to_analyze = request.text or ""

        # Truncate for ML — models don't need more than ~3000 chars to be accurate.
        # Grammar check gets a 2000-char sample; full text is preserved for display.
        ML_CAP   = 3000
        GRAM_CAP = 2000
        ml_text   = text_to_analyze[:ML_CAP]   if len(text_to_analyze) > ML_CAP   else text_to_analyze
        gram_text = text_to_analyze[:GRAM_CAP]  if len(text_to_analyze) > GRAM_CAP else text_to_analyze

        detected_lang = detect_language(ml_text)

        # Extract NLP features ONCE — shared by both proficiency and complexity models
        features = await run_cpu_bound(extract_features, ml_text, language=detected_lang)

        # Run grammar check, proficiency model, and complexity model concurrently
        grammar_task = asyncio.create_task(check_grammar(GrammarCheckRequest(
            text=gram_text, language=detected_lang
        )))

        student_model = student_model_en if detected_lang == 'en' else student_model_tl
        proficiency_task = asyncio.create_task(run_cpu_bound(
            student_model.predict, features, ml_text,
            grammar_data=None,        # grammar injected below after gather
            language=detected_lang
        ))
        complexity_task = asyncio.create_task(run_cpu_bound(
            complexity_model.predict, features, ml_text
        ))

        grammar_result, proficiency_result, complexity_result = await asyncio.gather(
            grammar_task, proficiency_task, complexity_task
        )

        # Re-run proficiency with grammar data (fast — features already computed)
        proficiency_result = await run_cpu_bound(
            student_model.predict, features, ml_text,
            grammar_data=grammar_result.model_dump(),
            language=detected_lang
        )
        proficiency_result["analyzed_text"] = text_to_analyze

        # Attach feature summary to complexity result
        m  = features["metrics"]
        ri = m.get("readabilityIndices", {})
        cefr = m.get("cefrDistribution", {})
        total_cefr = sum(cefr.values()) or 1
        complexity_result["features"] = {
            "avg_word_length":           round(sum(len(w) for w in m.get("difficultWords", [])) / max(len(m.get("difficultWords", [])), 1), 2),
            "avg_sentence_length":       round(m.get("avgSentenceLength", 0), 2),
            "ttr":                       round(m.get("vocabularyRichness", 0) / 100, 3),
            "cefr_ratio":                round((cefr.get("B2", 0) + cefr.get("C1", 0) + cefr.get("C2", 0)) / total_cefr, 3),
            "fkgl":                      round(ri.get("flesch_kincaid", 0), 1),
            "gunning_fog":               round(ri.get("gunning_fog", 0), 1),
        }
        complexity_result["analyzed_text"] = text_to_analyze

        # Rubric (Gemini-based — runs concurrently with above but can't share features)
        lang_for_rubric = "english" if detected_lang == "en" else "filipino"
        try:
            rubric_result = await evaluate_rubric_with_ml_english(text=ml_text, grade_level="Grade 7") \
                if detected_lang == "en" \
                else await evaluate_rubric_with_gemini(text=ml_text, language=lang_for_rubric, grade_level="Grade 7")
        except Exception as e:
            rubric_result = None

        return {
            "student":    proficiency_result,
            "complexity": complexity_result,
            "rubric":     rubric_result,
        }

    except Exception as e:
        import traceback; traceback.print_exc()
        return {"error": _friendly_error(e)}


if __name__ == "__main__":
    import uvicorn
    print("Starting FastAPI Server on http://localhost:8000")
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
