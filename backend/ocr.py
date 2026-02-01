import base64
import numpy as np
import cv2

try:
    import easyocr
    # Initialize Reader (loads model into memory)
    # 'en' for English, 'tl' for Tagalog/Filipino
    reader = easyocr.Reader(['en', 'tl'], gpu=False)
except ImportError:
    print("Warning: easyocr not installed. OCR functionality will be disabled.")
    reader = None 

def decode_base64_image(base64_string):
    """Convert base64 string to numpy array (OpenCV format)."""
    try:
        if "," in base64_string:
            base64_string = base64_string.split(",")[1]
            
        img_data = base64.b64decode(base64_string)
        nparr = np.frombuffer(img_data, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        return img
    except Exception as e:
        print(f"Image decode error: {e}")
        return None

def extract_text_from_image(base64_string):
    """
    Extracts text from a base64 encoded image using EasyOCR.
    """
    if reader is None:
        return ""
    
    image = decode_base64_image(base64_string)
    
    if image is None:
        return ""

    # Run OCR
    # detail=0 returns just the text list
    result_list = reader.readtext(image, detail=0, paragraph=True)
    
    # Join into a single string
    full_text = " ".join(result_list)
    return full_text
