import { 
    StudentDiagnosisResult, 
    TextComplexityResult 
} from "../types";

/**
 * Calls the FastAPI backend to analyze student text.
 * @param text The text to analyze.
 * @param base64Image Optional base64 encoded image string.
 * @returns A promise that resolves to a StudentDiagnosisResult.
 */
export const analyzeStudentWorkAPI = async (text: string, base64Image?: string): Promise<StudentDiagnosisResult> => {
    const response = await fetch('http://127.0.0.1:8000/analyze/student', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'accept': 'application/json'
        },
        body: JSON.stringify({ text, image: base64Image }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }
    return response.json();
};

/**
 * Calls the FastAPI backend to classify text complexity.
 * @param text The text to classify.
 * @param base64Image Optional base64 encoded image string.
 * @returns A promise that resolves to a TextComplexityResult.
 */
export const classifyTextComplexityAPI = async (text: string, base64Image?: string): Promise<TextComplexityResult> => {
    const response = await fetch('http://127.0.0.1:8000/analyze/complexity', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'accept': 'application/json'
        },
        body: JSON.stringify({ text, image: base64Image }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }
    return response.json();
};

/**
 * Calls the FastAPI backend to extract text from an image using Gemini OCR.
 * @param base64Image Base64 encoded image string.
 * @returns A promise that resolves to the extracted text.
 */
export const extractTextFromImageAPI = async (base64Image: string): Promise<string> => {
    const response = await fetch('http://127.0.0.1:8000/ocr/extract', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'accept': 'application/json'
        },
        body: JSON.stringify({ image: base64Image }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.text || '';
};

/**
 * Ingest a reference file (text/pdf/image) and return extracted text.
 */
export const ingestReferenceAPI = async (payload: {
    name?: string;
    mimeType?: string;
    text?: string;
    file?: string;
}): Promise<{ title: string; text: string }> => {
    const response = await fetch('http://127.0.0.1:8000/reference/ingest', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'accept': 'application/json'
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }

    return response.json();
};
