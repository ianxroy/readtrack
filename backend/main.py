import spacy
import os
import base64
from typing import Optional
from io import BytesIO
from pypdf import PdfReader
from dotenv import load_dotenv
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from backend.preprocessing import extract_features
from backend.svm_models import TextComplexitySVM, StudentProficiencySVM
from backend.ocr import extract_text_from_image
from backend.tagalog_service import router as tagalog_router
from backend.grammar_service import router as grammar_router

# Load environment variables from .env.local
load_dotenv('.env.local')

# Get Gemini API key from environment
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", os.getenv("API_KEY", ""))
if GEMINI_API_KEY:
    print(f"✓ Loaded Gemini API key: {GEMINI_API_KEY[:8]}...")
else:
    print("⚠ Warning: No Gemini API key found in environment")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # On startup, ensure the spaCy model is downloaded
    try:
        spacy.load("en_core_web_sm")
    except OSError:
        print("Downloading spaCy model 'en_core_web_sm'...")
        spacy.cli.download("en_core_web_sm")
        print("Model downloaded successfully.")
    yield
    # Run shutdown logic if needed

app = FastAPI(lifespan=lifespan)

# IMPORTANT: Configure CORS BEFORE adding routes
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust for production!
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include the routers from services
app.include_router(tagalog_router, tags=["Tagalog NLP"])
app.include_router(grammar_router, tags=["Grammar & Spell Check"])

# Initialize the models once
complexity_model = TextComplexitySVM()
student_model = StudentProficiencySVM()

# Pydantic model for request body
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


# Endpoint to test TextComplexitySVM
@app.post("/test-complexity")
def test_complexity(request: TextRequest):
    try:
        features = extract_features(request.text)
        result = complexity_model.predict(features, request.text)
        
        # Print the result to the CLI
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

        features = extract_features(text_to_analyze)
        result = student_model.predict(features, text_to_analyze)
        
        # Add the analyzed text to the result so frontend can display it
        result["analyzed_text"] = text_to_analyze
        
        print("Student Analysis Result:", result) # For CLI logging
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
                text = decoded.decode("utf-8", errors="ignore")
        
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

        features = extract_features(text_to_analyze)
        result = complexity_model.predict(features, text_to_analyze)
        
        # Add the analyzed text to the result so frontend can display it
        result["analyzed_text"] = text_to_analyze
        
        print("Complexity Analysis Result:", result) # For CLI logging
        return result
    except Exception as e:
        import traceback
        print("ERROR in analyze_complexity_text:")
        traceback.print_exc()
        return {"error": str(e), "trace": traceback.format_exc()}

if __name__ == "__main__":
    # This block runs only when you execute the script directly
    # e.g., `python main.py`
    print("--- Running CLI Test for TextComplexitySVM ---")
    
    # 1. Define sample text
    sample_text = """
In the heart of every forest, a hidden world thrives among the towering trees. Trees,
those silent giants, are more than just passive observers of nature's drama; they are
active participants in an intricate dance of life.

Did you know that trees communicate with each other? It's not through words or gestures
like ours, but rather through a complex network of fungi that connect their roots
underground. This network, often called the "wood wide web," allows trees to share
nutrients, water, and even warnings about potential threats.

But trees are not just generous benefactors; they are also masters of adaptation. Take
the mighty sequoias, for example, towering giants that have stood the test of time for
thousands of years. These giants have evolved thick, fire-resistant bark to withstand
the frequent wildfires of their native California.

And speaking of longevity, did you know that some trees have been around for centuries,
witnessing history unfold? The ancient bristlecone pines of the American West, for
instance, can live for over 5,000 years, making them some of the oldest living organisms
on Earth.

So the next time you find yourself wandering through a forest, take a moment to appreciate
the remarkable world of trees. They may seem like silent spectators, but their lives are
full of fascinating stories waiting to be discovered.
"""
    print(f"Input Text: {sample_text}\n")

    try:
        # 2. Extract features
        print("Extracting features...")
        features = extract_features(sample_text)
        
        # 3. Initialize and predict
        print("Initializing model and predicting...")
        model = TextComplexitySVM()
        result = model.predict(features, sample_text)
        
        # 4. Print the result
        print("\n--- Prediction Result ---")
        import json
        print(json.dumps(result, indent=2))
        print("-------------------------\n")

        # 5. Test StudentProficiencySVM
        print("--- Running CLI Test for StudentProficiencySVM ---")
        print("Initializing model and predicting...")
        student_model_cli = StudentProficiencySVM()
        student_result = student_model_cli.predict(features, sample_text)

        # 6. Print the student proficiency result
        print("\n--- Student Proficiency Prediction Result ---")
        print(json.dumps(student_result, indent=2))
        print("-------------------------------------------\n")

    except Exception as e:
        print(f"An error occurred: {e}")
        import traceback
        traceback.print_exc()

    # Add a simple server run command for easy testing
    import uvicorn
    print("--- Starting FastAPI Server for CLI Test ---")
    print("Access at http://localhost:8000")
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
