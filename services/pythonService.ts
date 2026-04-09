import {
    StudentDiagnosisResult,
    TextComplexityResult,
    DepEdRubricScore,
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

export const extractTextFromImageAPI = async (
    base64Image: string,
    mimeType?: string
): Promise<{text: string; warning?: string; error?: string}> => {
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
    return { text: data.text || '', warning: data.warning, error: data.error };
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

export const evaluateDepEdRubricAPI = async (
    text: string,
    language: 'english' | 'filipino' = 'filipino',
    gradeLevel: string = 'Grade 7'
): Promise<DepEdRubricScore> => {
    const response = await fetch('http://localhost:8000/analyze/rubric', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'accept': 'application/json',
        },
        body: JSON.stringify({ text, language, grade_level: gradeLevel }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    if (data?.error) throw new Error(data.error);

    return {
        content: data.content,
        organization: data.organization,
        languageVocab: data.language_vocab,
        grammar: data.grammar,
        mechanics: data.mechanics,
        overallScore: data.overall_score,
        overallFeedback: data.overall_feedback,
        gradeLevel: data.grade_level,
        language: language,
    } as DepEdRubricScore;
};

export interface TrainLanguageStatus {
    rated_essays: number;
    confidence_level: string;
    last_retrain: string | null;
    new_since_retrain: number;
}

export interface TrainStatusResponse {
    english: TrainLanguageStatus;
    filipino: TrainLanguageStatus;
}

export interface RetrainResponse {
    language: 'en' | 'tl';
    samples_used: number;
    asap2_samples: number;
    accuracy: string;
    confidence_level: string;
    model_saved: string;
}

export const getTrainStatusAPI = async (): Promise<TrainStatusResponse> => {
    const response = await fetch('http://localhost:8000/train/status', {
        method: 'GET',
        headers: {
            'accept': 'application/json',
        },
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    if (data?.error) throw new Error(data.error);
    return data;
};

export const triggerRetrainAPI = async (language: 'en' | 'tl'): Promise<RetrainResponse> => {
    const response = await fetch('http://localhost:8000/train/retrain', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'accept': 'application/json',
        },
        body: JSON.stringify({ language }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    if (data?.error) throw new Error(data.error);
    return data;
};

export const addTrainingSampleAPI = async (
    text: string,
    level: 'Literal' | 'Inferential' | 'Evaluative'
): Promise<{ status: string; message: string }> => {
    const response = await fetch('http://localhost:8000/training/add-sample', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'accept': 'application/json',
        },
        body: JSON.stringify({ text, level }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    if (data?.error) throw new Error(data.error);
    return {
        status: data.status || 'ok',
        message: data.message || 'Sample saved and model retrained.',
    };
};

export interface PerClassMetrics {
    precision: number;
    recall: number;
    f1: number;
    support: number;
}

export interface DimensionMetrics {
    mae: number | null;
    samples: number;
    avg_system: number | null;
    avg_teacher: number | null;
}

export interface ModelPerformanceData {
    lang: string;
    total_compared: number;
    macro_f1: number;
    macro_precision: number;
    macro_recall: number;
    per_class: Record<string, PerClassMetrics>;
    confusion_matrix: {
        labels: string[];
        matrix: number[][];
        row_label: string;
        col_label: string;
    };
    per_dimension: Record<string, DimensionMetrics>;
    confidence_level: string;
    rated_essays: number;
    last_retrain: string | null;
    insufficient_data?: boolean;
    error?: string;
}

export const getModelPerformanceAPI = async (lang: 'en' | 'tl'): Promise<ModelPerformanceData> => {
    const res = await fetch(`http://localhost:8000/train/performance?lang=${lang}`);
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `HTTP error! status: ${res.status}`);
    }
    const data = await res.json();
    if (data?.error) throw new Error(data.error);
    return data;
};

interface DetectLanguageResponse {
    language: string;
}

// detectLanguageAPI is intentionally fail-safe: network errors and non-OK responses
// return 'fil' rather than throwing, so callers need not handle errors.
// This differs from other functions in this file which propagate errors to callers.
export const detectLanguageAPI = async (text: string): Promise<'eng' | 'fil'> => {
    try {
        const response = await fetch('http://localhost:8000/detect-language', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'accept': 'application/json' },
            body: JSON.stringify({ text }),
        });
        if (!response.ok) return 'fil';
        const data = await response.json() as DetectLanguageResponse;
        return data.language === 'eng' ? 'eng' : 'fil';
    } catch {
        return 'fil';
    }
};

