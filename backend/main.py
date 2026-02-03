import spacy
import os
import torch
import base64
from typing import Optional
from io import BytesIO
from pypdf import PdfReader
from dotenv import load_dotenv
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from preprocessing import extract_features
from svm_models import TextComplexitySVM, StudentProficiencySVM
from ocr import extract_text_from_image
from tagalog_service import router as tagalog_router
from grammar_service import router as grammar_router


load_dotenv('.env.local')
load_dotenv('.env')

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", os.getenv("API_KEY", ""))
if GEMINI_API_KEY:
    print(f"✓ Loaded Gemini API key: {GEMINI_API_KEY[:8]}...")
else:
    print("⚠ Warning: No Gemini API key found in environment")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Enable GPU if available for spaCy
    try:
        if torch.cuda.is_available():
            spacy.prefer_gpu()
            print("✓ GPU acceleration enabled for spaCy")
        else:
            print("ℹ GPU not available, using CPU for spaCy")
    except Exception as e:
        print(f"⚠ Could not enable GPU: {e}")

    try:
        spacy.load("en_core_web_sm")
    except OSError:
        print("Downloading spaCy model 'en_core_web_sm'...")
        spacy.cli.download("en_core_web_sm")
        print("Model downloaded successfully.")
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
student_model = StudentProficiencySVM()

class TextRequest(BaseModel):
    text: str
    image: Optional[str] = None

class OCRRequest(BaseModel):
    image: str

class ReferenceIngestRequest(BaseModel):
    name: Optional[str] = None
    mimeType: Optional[str] = None
    text: Optional[str] = None
    file: Optional[str] = None

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

@app.get("/")
def read_root():
    return {"message": "FastAPI backend is running!"}


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
    """
    Returns performance metrics for both the student proficiency and text complexity models.
    """
    return {
        "proficiency": student_model.get_performance_metrics(),
        "complexity": complexity_model.get_performance_metrics()
    }

@app.post("/analyze/student")
def analyze_student_text(request: TextRequest):
    """Analyzes text for student proficiency."""
    try:
        text_to_analyze = request.text
        if request.image:
            print("\n" + "=" * 70)
            print("📷 PROCESSING IMAGE FOR STUDENT ANALYSIS")
            print("=" * 70)
            print(f"Image data length: {len(request.image)} bytes")
            print(f"Input text length: {len(request.text)} characters")
            
            ocr_text = extract_text_from_image(request.image, GEMINI_API_KEY)
            
            print("\n" + "-" * 70)
            print("📝 OCR EXTRACTED TEXT:")
            print("-" * 70)
            if ocr_text:
                print(ocr_text)
                print("-" * 70)
                print(f"✓ Extracted {len(ocr_text)} characters from image")
                text_to_analyze = (text_to_analyze + "\n" + ocr_text).strip()
                print(f"✓ Combined text length: {len(text_to_analyze)} characters")
            else:
                print("⚠ WARNING: No text extracted from image")
            print("=" * 70 + "\n")

        # Detect language and pass it to feature extraction
        from grammar_service import detect_language
        detected_lang = detect_language(text_to_analyze)
        features = extract_features(text_to_analyze, language=detected_lang)
        result = student_model.predict(features, text_to_analyze)
        
        result["analyzed_text"] = text_to_analyze
        
        print("Student Analysis Result:", result)
        return result
    except Exception as e:
        import traceback
        print("ERROR in analyze_student_text:")
        traceback.print_exc()
        return {"error": str(e), "trace": traceback.format_exc()}

@app.post("/ocr/extract")
def extract_text_from_image_endpoint(request: OCRRequest):
    """Extracts text from an image using Gemini OCR."""
    try:
        print("\n" + "=" * 70)
        print("📷 PROCESSING IMAGE FOR OCR ONLY")
        print("=" * 70)
        print(f"Image data length: {len(request.image)} bytes")

        ocr_text = extract_text_from_image(request.image, GEMINI_API_KEY)
        print("\n" + "-" * 70)
        print("📝 OCR EXTRACTED TEXT:")
        print("-" * 70)
        if ocr_text:
            print(ocr_text)
            print("-" * 70)
            print(f"✓ Extracted {len(ocr_text)} characters from image")
        else:
            print("⚠ WARNING: No text extracted from image")
        print("=" * 70 + "\n")

        return {"text": ocr_text}
    except Exception as e:
        import traceback
        print("ERROR in extract_text_from_image_endpoint:")
        traceback.print_exc()
        return {"error": str(e), "trace": traceback.format_exc()}

@app.post("/reference/ingest")
def ingest_reference(request: ReferenceIngestRequest):
    """Ingest a reference file (text/pdf/image) and return extracted text."""
    try:
        text = ""
        if request.text:
            text = request.text
        elif request.file and request.mimeType:
            if request.mimeType == "application/pdf":
                text = extract_text_from_pdf(request.file)
            elif request.mimeType.startswith("image/"):
                text = extract_text_from_image(request.file, GEMINI_API_KEY)
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
    """Analyzes text for complexity."""
    try:
        text_to_analyze = request.text
        if request.image:
            print("\n" + "=" * 70)
            print("📷 PROCESSING IMAGE FOR COMPLEXITY ANALYSIS")
            print("=" * 70)
            print(f"Image data length: {len(request.image)} bytes")
            print(f"Input text length: {len(request.text)} characters")
            
            ocr_text = extract_text_from_image(request.image, GEMINI_API_KEY)
            
            print("\n" + "-" * 70)
            print("📝 OCR EXTRACTED TEXT:")
            print("-" * 70)
            if ocr_text:
                print(ocr_text)
                print("-" * 70)
                print(f"✓ Extracted {len(ocr_text)} characters from image")
                text_to_analyze = (text_to_analyze + "\n" + ocr_text).strip()
                print(f"✓ Combined text length: {len(text_to_analyze)} characters")
            else:
                print("⚠ WARNING: No text extracted from image")
            print("=" * 70 + "\n")

        # Detect language and pass it to feature extraction
        from grammar_service import detect_language
        detected_lang = detect_language(text_to_analyze)
        features = extract_features(text_to_analyze, language=detected_lang)
        result = complexity_model.predict(features, text_to_analyze)
        
        result["analyzed_text"] = text_to_analyze
        print("Complexity Analysis Result:", result)
        return result
    except Exception as e:
        import traceback
        print("ERROR in analyze_complexity_text:")
        traceback.print_exc()
        return {"error": str(e), "trace": traceback.format_exc()}

if __name__ == "__main__":
    import uvicorn
    print("--- Starting FastAPI Server ---")
    print("Access at http://localhost:8000")
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
