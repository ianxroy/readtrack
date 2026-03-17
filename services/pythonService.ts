import {
    StudentDiagnosisResult,
    TextComplexityResult
} from "../types";

export const analyzeStudentWorkAPI = async (text: string, base64Image?: string, mimeType?: string): Promise<StudentDiagnosisResult> => {
    const response = await fetch('http://localhost:8000/analyze/student', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'accept': 'application/json'
        },
        body: JSON.stringify({ text, image: base64Image, mimeType }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    if (data?.error) {
        throw new Error(data.error);
    }
    return data;
};

export const classifyTextComplexityAPI = async (text: string, base64Image?: string, mimeType?: string): Promise<TextComplexityResult> => {
    const response = await fetch('http://localhost:8000/analyze/complexity', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'accept': 'application/json'
        },
        body: JSON.stringify({ text, image: base64Image, mimeType }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    if (data?.error) {
        throw new Error(data.error);
    }
    return data;
};

export const extractTextFromImageAPI = async (base64Image: string, mimeType?: string): Promise<{text: string; warning?: string}> => {
    const response = await fetch('http://localhost:8000/ocr/extract', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'accept': 'application/json'
        },
        body: JSON.stringify({ image: base64Image, mimeType }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    if (data?.error) {
        throw new Error(data.error);
    }
    return { text: data.text || '', warning: data.warning };
};

export const ingestReferenceAPI = async (payload: {
    name?: string;
    mimeType?: string;
    text?: string;
    file?: string;
}): Promise<{ title: string; text: string }> => {
    const response = await fetch('http://localhost:8000/reference/ingest', {
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

    const data = await response.json();
    if (data?.error) {
        throw new Error(data.error);
    }
    return data;
};
