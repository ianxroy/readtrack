import base64
import os
from typing import Optional

try:
    from google import generativeai as genai
except ImportError:
    genai = None
    print("Warning: google-generativeai not installed. OCR functionality will be disabled.")


def _normalize_base64(base64_string: str) -> str:
    if "," in base64_string:
        return base64_string.split(",")[1]
    return base64_string


def extract_text_from_image(base64_string: str, api_key: Optional[str] = None) -> str:
    """
    Extracts text from a base64 encoded image using Gemini.
    """
    if genai is None:
        return ""

    api_key = api_key or os.getenv("GEMINI_API_KEY", os.getenv("API_KEY", ""))
    if not api_key:
        print("⚠ Warning: No Gemini API key available for OCR")
        return ""

    model_name = os.getenv("GEMINI_OCR_MODEL", "gemini-1.5-flash")
    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(model_name)

        image_bytes = base64.b64decode(_normalize_base64(base64_string))
        prompt = "Extract all readable text from the image. Return only the extracted text."

        response = model.generate_content([
            prompt,
            {"mime_type": "image/png", "data": image_bytes}
        ])

        return (response.text or "").strip()
    except Exception as e:
        print(f"Gemini OCR error: {e}")
        return ""
