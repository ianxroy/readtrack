import {
    StudentDiagnosisResult,
    TextComplexityResult,
    DepEdRubricScore,
} from "../types";

const normalizeBaseUrl = (value: string | undefined): string => {
    if (!value) return '';
    return value.trim().replace(/\/$/, '');
};

const getApiBaseUrl = (): string => {
    const viteEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
    const envBase = normalizeBaseUrl(viteEnv?.VITE_BACKEND_URL);
    if (envBase) return envBase;

    if (typeof window !== 'undefined') {
        const { hostname, protocol } = window.location;
        const localHosts = new Set(['localhost', '127.0.0.1']);
        if (localHosts.has(hostname)) {
            return 'http://localhost:8000';
        }
        return `${protocol}//${hostname}:8000`;
    }

    return 'http://localhost:8000';
};

const API_BASE_URL = getApiBaseUrl();

const apiUrl = (path: string): string => `${API_BASE_URL}${path}`;

const unwrapErrorMessage = async (response: Response): Promise<string> => {
    try {
        const errorData = await response.json();
        return errorData.detail || `HTTP error! status: ${response.status}`;
    } catch {
        return `HTTP error! status: ${response.status}`;
    }
};

const fetchOrThrowNetworkError = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    try {
        return await fetch(input, init);
    } catch {
        throw new Error(`Cannot reach backend at ${API_BASE_URL}. Set VITE_BACKEND_URL if your API runs elsewhere.`);
    }
};

export const analyzeStudentWorkAPI = async (text: string, base64Image?: string, mimeType?: string): Promise<StudentDiagnosisResult> => {
    const response = await fetchOrThrowNetworkError(apiUrl('/analyze/student'), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'accept': 'application/json'
        },
        body: JSON.stringify({ text, image: base64Image, mimeType }),
    });

    if (!response.ok) {
        throw new Error(await unwrapErrorMessage(response));
    }
    const data = await response.json();
    if (data?.error) {
        throw new Error(data.error);
    }
    return data;
};

export const classifyTextComplexityAPI = async (text: string, base64Image?: string, mimeType?: string): Promise<TextComplexityResult> => {
    const response = await fetchOrThrowNetworkError(apiUrl('/analyze/complexity'), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'accept': 'application/json'
        },
        body: JSON.stringify({ text, image: base64Image, mimeType }),
    });

    if (!response.ok) {
        throw new Error(await unwrapErrorMessage(response));
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
    const response = await fetchOrThrowNetworkError(apiUrl('/ocr/extract'), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'accept': 'application/json'
        },
        body: JSON.stringify({ image: base64Image, mimeType }),
    });

    if (!response.ok) {
        throw new Error(await unwrapErrorMessage(response));
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
    const response = await fetchOrThrowNetworkError(apiUrl('/reference/ingest'), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'accept': 'application/json'
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        throw new Error(await unwrapErrorMessage(response));
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
    const response = await fetchOrThrowNetworkError(apiUrl('/analyze/rubric'), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'accept': 'application/json',
        },
        body: JSON.stringify({ text, language, grade_level: gradeLevel }),
    });

    if (!response.ok) {
        throw new Error(await unwrapErrorMessage(response));
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

/** Single round-trip: proficiency + complexity + rubric, features extracted once. */
export const analyzeAllAPI = async (
    text: string,
    language: 'english' | 'filipino' = 'filipino',
): Promise<{ student: StudentDiagnosisResult; complexity: TextComplexityResult; rubric: DepEdRubricScore | null }> => {
    const response = await fetchOrThrowNetworkError(apiUrl('/analyze/all'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'accept': 'application/json' },
        body: JSON.stringify({ text }),
    });
    if (!response.ok) throw new Error(await unwrapErrorMessage(response));
    const data = await response.json();
    if (data?.error) throw new Error(data.error);

    const rubricRaw = data.rubric;
    const rubric: DepEdRubricScore | null = rubricRaw ? {
        content:         rubricRaw.content,
        organization:    rubricRaw.organization,
        languageVocab:   rubricRaw.language_vocab,
        grammar:         rubricRaw.grammar,
        mechanics:       rubricRaw.mechanics,
        overallScore:    rubricRaw.overall_score,
        overallFeedback: rubricRaw.overall_feedback,
        gradeLevel:      rubricRaw.grade_level,
        language,
    } as DepEdRubricScore : null;

    return { student: data.student, complexity: data.complexity, rubric };
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
    const response = await fetchOrThrowNetworkError(apiUrl('/train/status'), {
        method: 'GET',
        headers: {
            'accept': 'application/json',
        },
    });

    if (!response.ok) {
        throw new Error(await unwrapErrorMessage(response));
    }

    const data = await response.json();
    if (data?.error) throw new Error(data.error);
    return data;
};

export const triggerRetrainAPI = async (language: 'en' | 'tl'): Promise<RetrainResponse> => {
    const response = await fetchOrThrowNetworkError(apiUrl('/train/retrain'), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'accept': 'application/json',
        },
        body: JSON.stringify({ language }),
    });

    if (!response.ok) {
        throw new Error(await unwrapErrorMessage(response));
    }

    const data = await response.json();
    if (data?.error) throw new Error(data.error);
    return data;
};

export const addTrainingSampleAPI = async (
    text: string,
    level: 'Independent' | 'Instructional' | 'Frustration'
): Promise<{ status: string; message: string }> => {
    let response: Response;
    try {
        response = await fetch(apiUrl('/training/add-sample'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'accept': 'application/json',
            },
            body: JSON.stringify({ text, level }),
        });
    } catch {
        // Backend offline — training will happen on next retrain; not a user-facing error.
        return { status: 'pending', message: 'Material saved. Training sample will be submitted on next model retrain.' };
    }

    if (!response.ok) {
        throw new Error(await unwrapErrorMessage(response));
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
    const res = await fetchOrThrowNetworkError(apiUrl(`/train/performance?lang=${lang}`));
    if (!res.ok) {
        throw new Error(await unwrapErrorMessage(res));
    }
    const data = await res.json();
    if (data?.error) throw new Error(data.error);
    return data;
};

interface DetectLanguageResponse {
    language: string;
}

// Client-side fallback: matches backend grammar_service.py detect_language() heuristic.
// Returns 'fil' if >= 3 Filipino function words found, otherwise 'eng'.
export function detectLanguageClientSide(text: string): 'eng' | 'fil' {
    // Only unambiguous Filipino words — exclude English homophones like 'at', 'ay', 'may', 'ka', 'si'
    const filipinoWords = new Set([
        'ang','ng','mga','sa','na','ni','kay','para','kung','pero',
        'dahil','kaya','nang','din','rin','nga','ba','mo','ko','niya','namin',
        'natin','nila','siya','sila','kami','tayo','ito','iyan','iyon','dito',
        'diyan','doon','hindi','wala','mayroon','po','opo','ako',
        'ikaw','kita','naman','talaga','lang','pala','kasi','kahit','kapag',
        'habang','ngayon','kanina','bukas','kahapon','bakit','paano',
        'sino','gaano','huwag','grabe','sayang',
    ]);
    const words = (text ?? '').toLowerCase().match(/\b\w+\b/g) ?? [];
    const hits = words.filter(w => filipinoWords.has(w)).length;
    // Require both a minimum hit count and a meaningful ratio to avoid
    // English texts with Filipino-looking words (e.g. "ang", "sa" in proper nouns)
    const ratio = words.length > 0 ? hits / words.length : 0;
    return (hits >= 4 && ratio >= 0.02) ? 'fil' : 'eng';
}

// detectLanguageAPI is intentionally fail-safe: network errors and non-OK responses
// fall back to client-side heuristic rather than defaulting to 'fil'.
export const detectLanguageAPI = async (text: string): Promise<'eng' | 'fil'> => {
    try {
        const response = await fetchOrThrowNetworkError(apiUrl('/detect-language'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'accept': 'application/json' },
            body: JSON.stringify({ text }),
        });
        if (!response.ok) return detectLanguageClientSide(text);
        const data = await response.json() as DetectLanguageResponse;
        return data.language === 'eng' ? 'eng' : 'fil';
    } catch {
        return detectLanguageClientSide(text);
    }
};

