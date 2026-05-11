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
        return {"text": "", "title": "Untitled", "warning": None, "error": "ocr_unavailable"}

    api_key = api_key or os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY", "")
    api_key = api_key.strip().strip('"').strip("'")
    if api_key.lower().startswith("bearer "):
        api_key = api_key[7:].strip()
    if not api_key:
        return {"text": "", "title": "Untitled", "warning": None, "error": "no_api_key"}

    model_name = os.getenv("GEMINI_OCR_MODEL", "gemini-2.5-flash") 
    try:
        genai_api = cast(Any, genai)
        genai_api.configure(api_key=api_key)
        model = genai_api.GenerativeModel(model_name)

        clean_base64 = _normalize_base64(base64_string)
        try:
            image_bytes = base64.b64decode(clean_base64, validate=True)
        except Exception:
            return {"text": "", "title": "Untitled", "warning": None, "error": "invalid_base64"}
        
        # Your original prompt with the title instruction added at the end
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
- "title": Identify the main title of the document based on the visual layout and text.
- "text": string containing the full transcribed text as per the instructions above.
- "warning": a warning string if the image is blurry, partially cut off, or too low quality to read accurately — otherwise null

No markdown code blocks. Output raw JSON only."""

        ALLOWED_MIMES = {"image/", "application/pdf"}
        final_mime = (
            mime_type
            if mime_type and any(mime_type.startswith(p) for p in ALLOWED_MIMES)
            else "image/png"
        )

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
                return {"text": "", "title": "Untitled", "warning": None, "error": "ocr_timeout"}

        if not response:
            return {"text": "", "title": "Untitled", "warning": None}
            
        try:
            extracted_json = response.text.strip()
            
            # Clean markdown if present
            if extracted_json.startswith("```"):
                extracted_json = re.sub(r"```json\n?|```", "", extracted_json).strip()
                
            parsed = json.loads(extracted_json)
            print(f"SUCCESS: Extracted Title: {parsed.get('title')}")
            # KEY CHANGE: Return both 'text' and 'title'
            return {
                "title": parsed.get("title", "Untitled Document").strip(),
                "text": _normalize_ocr_text_flow(parsed.get("text", "")),
                "warning": parsed.get("warning"),
                "error": None
            }
        except json.JSONDecodeError:
            # Fallback if JSON parsing fails
            return {
                "title": "Untitled Document",
                "text": _normalize_ocr_text_flow(response.text),
                "warning": "json_parse_failed"
            }

    except Exception as e:
        print(f"Gemini OCR error: {e}")
        return {"text": "", "title": "Untitled", "warning": None, "error": "ocr_failed"}