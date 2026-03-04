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

def extract_text_from_image(base64_string: str, api_key: Optional[str] = None, mime_type: Optional[str] = None) -> str:

    if genai is None:
        return ""

        api_key = api_key or os.getenv("GEMINI_API_KEY", "")
    if not api_key:
        print("⚠ Warning: No Gemini API key available for OCR")
        return ""
    print(f"DEBUG: Using API key starting with: {api_key[:8]}...")

    model_name = os.getenv("GEMINI_OCR_MODEL", "gemini-2.5-flash") # Reverting to 2.5 flash as per user confirmation and list_models result
    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(model_name)

        # Ensure base64 is clean
        clean_base64 = _normalize_base64(base64_string)
        image_bytes = base64.b64decode(clean_base64)
        
        prompt = "Transcribe all the text from this image exactly as it appears. Do not include any of your own words, explanations, or labels. Only provide the text found in the image."

        # Default to image/png if mime_type is not provided or invalid
        final_mime = mime_type if mime_type and mime_type.startswith("image/") else "image/png"

        print(f"DEBUG: Starting Gemini OCR with model {model_name}, mime {final_mime}, bytes length {len(image_bytes)}")
        
        # Standard order for SDK: [prompt, image_dict]
        response = model.generate_content([
            prompt,
            {"mime_type": final_mime, "data": image_bytes}
        ])

        print(f"DEBUG: Full Gemini API response: {response}")

        if not response:
            print("DEBUG: Gemini returned a completely null response object")
            return ""
            
        # Check for safety blocks or errors in candidates
        if hasattr(response, 'candidates') and response.candidates:
            candidate = response.candidates[0]
            if candidate.finish_reason != 1: # 1 is STOP (success)
                print(f"DEBUG: OCR failed. Finish reason: {candidate.finish_reason}")
                if hasattr(candidate, 'safety_ratings'):
                    print(f"DEBUG: Safety ratings: {candidate.safety_ratings}")
        
        try:
            extracted_text = response.text.strip()
            if not extracted_text:
                print("DEBUG: Gemini response text was empty")
            return extracted_text
        except Exception as e:
            print(f"DEBUG: Error accessing response.text: {e}")
            # If text fails, try to see if there's any part content
            try:
                if response.candidates and response.candidates[0].content.parts:
                    return response.candidates[0].content.parts[0].text.strip()
            except:
                pass
            return ""

    except Exception as e:
        print(f"Gemini OCR error: {e}")
        import traceback
        traceback.print_exc()
        return ""
