import base64
import os
from typing import Any, Optional, cast
import re
import concurrent.futures

try:
    from google import generativeai as genai
except ImportError:
    genai = None
    print("Warning: google-generativeai not installed. OCR functionality will be disabled.")

def _normalize_base64(base64_string: str) -> str:
    if "," in base64_string:
        base64_string = base64_string.split(",", 1)[1]

    # Remove whitespace/newlines and restore missing padding.
    clean = "".join(base64_string.split())
    missing_padding = len(clean) % 4
    if missing_padding:
        clean += "=" * (4 - missing_padding)
    return clean

import json


def _strip_viewer_ui_noise(text: str) -> str:
    """Remove common mobile/desktop viewer chrome captured in screenshots."""
    lines = text.split("\n")
    cleaned_lines = []

    for idx, raw_line in enumerate(lines):
        line = raw_line.strip()
        if not line:
            cleaned_lines.append("")
            continue

        compact = re.sub(r"\s+", " ", line)
        lower = compact.lower()
        is_top_region = idx <= 2

        # Status-bar/toolbar noise commonly present at the top of screenshots.
        if is_top_region:
            if re.search(r"\b\d{1,2}:\d{2}\b", lower):
                continue
            if re.search(r"\b(mon|tue|wed|thu|fri|sat|sun)\b", lower):
                continue
            if re.search(r"\b\d+(?:\.\d+)?\s*(kb|mb|gb)/s\b", lower):
                continue
            if re.search(r"\b\d{1,3}%\b", lower):
                continue
            if re.search(r"\b(4g|5g|lte|wifi|vo(?:lte)?)\b", lower):
                continue
            if re.search(r"\b[\w .()\-]+\.(pdf|docx?|pptx?|xlsx?|png|jpe?g|webp)\b", lower):
                continue

        # Standalone file-name lines from viewer headers.
        if re.fullmatch(r"[\w .()\-]{3,}\.(pdf|docx?|pptx?|xlsx?|png|jpe?g|webp)", lower):
            continue

        cleaned_lines.append(compact)

    # Collapse long blank runs introduced by removals.
    out = "\n".join(cleaned_lines)
    out = re.sub(r"\n{3,}", "\n\n", out)
    return out.strip()


def _normalize_ocr_text_flow(text: str) -> str:
    if not text:
        return ""

    # Normalize line endings first.
    normalized = text.replace("\r\n", "\n").replace("\r", "\n")
    normalized = _strip_viewer_ui_noise(normalized)
    paragraphs = re.split(r"\n\s*\n", normalized)
    rebuilt = []

    for paragraph in paragraphs:
        lines = [ln.strip() for ln in paragraph.split("\n") if ln.strip()]
        if not lines:
            continue

        merged_parts = [lines[0]]
        for line in lines[1:]:
            prev = merged_parts[-1]

            # Join hyphenated word wraps: bene- + fits -> benefits
            if prev.endswith("-") and line and line[0].isalnum():
                merged_parts[-1] = prev[:-1] + line
                continue

            # Treat single newlines as soft wraps in running prose.
            if prev and line:
                merged_parts[-1] = f"{prev} {line}"
            else:
                merged_parts.append(line)

        rebuilt.append(" ".join(merged_parts))

    out = " ".join(rebuilt)
    out = re.sub(r" {2,}", " ", out)
    return out.strip()

def extract_text_from_image(base64_string: str, api_key: Optional[str] = None, mime_type: Optional[str] = None) -> dict:

    if genai is None:
        return {"text": "", "warning": None, "error": "ocr_unavailable"}

    api_key = api_key or os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY", "")
    api_key = api_key.strip().strip('"').strip("'")
    if api_key.lower().startswith("bearer "):
        api_key = api_key[7:].strip()
    if not api_key:
        print("⚠ Warning: No Gemini API key available for OCR")
        return {"text": "", "warning": None, "error": "no_api_key"}
    print(f"DEBUG: Using API key starting with: {api_key[:8]}...")

    model_name = os.getenv("GEMINI_OCR_MODEL", "gemini-2.5-flash") # Reverting to 2.5 flash as per user confirmation and list_models result
    try:
        genai_api = cast(Any, genai)
        genai_api.configure(api_key=api_key)
        model = genai_api.GenerativeModel(model_name)

        # Ensure base64 is clean
        clean_base64 = _normalize_base64(base64_string)
        try:
            image_bytes = base64.b64decode(clean_base64, validate=True)
        except Exception:
            return {"text": "", "warning": None, "error": "invalid_base64"}
        
        prompt = """Transcribe ALL text from the actual document/page content in this image exactly as it appears. The text may be handwritten or printed, in English or Filipino/Tagalog.

Instructions:
- Transcribe every word, number, and punctuation mark exactly as written or printed
- Do NOT correct spelling, grammar, or formatting — preserve the original text faithfully
    - If the image is a screenshot, IGNORE app/device UI text (status bar time/date, battery/network indicators, file name in toolbar, page counters, menu labels, navigation icons)
    - Only transcribe the document itself, not the viewer interface around it
- For multi-column layouts, transcribe left column first, then right column
- Ignore line numbers printed in the margins (e.g. "5", "10", "15") — do not include them
- Preserve paragraph breaks
- For unclear words, use your best interpretation based on context
- Do NOT add explanations, labels, or commentary of your own

Output ONLY a valid JSON object with these keys:
- "text": string containing the full transcribed text
- "warning": a warning string if the image is blurry, partially cut off, or too low quality to read accurately — otherwise null

No markdown code blocks. Output raw JSON only."""

        # Allow image/* and application/pdf (Gemini supports PDF natively)
        ALLOWED_MIMES = {"image/", "application/pdf"}
        final_mime = (
            mime_type
            if mime_type and any(mime_type.startswith(p) for p in ALLOWED_MIMES)
            else "image/png"
        )

        print(f"DEBUG: Starting Gemini OCR with model {model_name}, mime {final_mime}, bytes length {len(image_bytes)}")

        OCR_TIMEOUT_SECONDS = 25

        def _call_gemini():
            return model.generate_content(
                [prompt, {"mime_type": final_mime, "data": image_bytes}],
                generation_config=genai_api.types.GenerationConfig(response_mime_type="application/json"),
            )

        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(_call_gemini)
            try:
                response = future.result(timeout=OCR_TIMEOUT_SECONDS)
            except concurrent.futures.TimeoutError:
                print(f"DEBUG: Gemini OCR timed out after {OCR_TIMEOUT_SECONDS}s")
                return {"text": "", "warning": None, "error": "ocr_timeout"}

        print(f"DEBUG: Gemini responded, finish_reason={response.candidates[0].finish_reason if response and response.candidates else 'unknown'}")

        if not response:
            print("DEBUG: Gemini returned a completely null response object")
            return {"text": "", "warning": None}
            
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
                return {"text": "", "warning": None}
            
            # Remove markdown blocks if present
            if extracted_text.startswith("```"):
                lines = extracted_text.split('\n')
                if lines[0].startswith("```"):
                    lines = lines[1:]
                if lines[-1].startswith("```"):
                    lines = lines[:-1]
                extracted_text = "\n".join(lines).strip()
                
            try:
                parsed = json.loads(extracted_text)
                return {
                    "text": _normalize_ocr_text_flow(parsed.get("text", "")),
                    "warning": parsed.get("warning")
                }
            except json.JSONDecodeError:
                print(f"DEBUG: Failed to parse JSON: {extracted_text}")
                return {"text": _normalize_ocr_text_flow(extracted_text), "warning": None}

        except Exception as e:
            print(f"DEBUG: Error accessing response.text: {e}")
            # If text fails, try to see if there's any part content
            try:
                if response.candidates and response.candidates[0].content.parts:
                    fallback_text = response.candidates[0].content.parts[0].text.strip()
                    try:
                        parsed = json.loads(fallback_text)
                        return {
                            "text": _normalize_ocr_text_flow(parsed.get("text", "")),
                            "warning": parsed.get("warning")
                        }
                    except:
                        return {"text": _normalize_ocr_text_flow(fallback_text), "warning": None}
            except:
                pass
            return {"text": "", "warning": None}

    except Exception as e:
        print(f"Gemini OCR error: {e}")
        import traceback
        traceback.print_exc()
        err_str = str(e).lower()
        if (
            "permissiondenied" in err_str
            or "permission denied" in err_str
            or "has been denied access" in err_str
            or "google.api_core.exceptions.permissiondenied" in err_str
        ):
            return {"text": "", "warning": None, "error": "project_denied"}
        if "api key expired" in err_str or "api_key_invalid" in err_str or "invalid" in err_str and "key" in err_str:
            return {"text": "", "warning": None, "error": "api_key_invalid"}
        return {"text": "", "warning": None, "error": "ocr_failed"}
