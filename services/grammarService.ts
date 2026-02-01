/**
 * Grammar and Spell Check Service
 * Provides grammar checking, spell checking, and auto-correction for English and Tagalog
 */

const API_BASE_URL = 'http://localhost:8000';

export interface GrammarIssue {
  type: string; // grammar, spelling, style, punctuation
  message: string;
  offset: number;
  length: number;
  replacements: string[];
  context: string;
  severity: string; // error, warning, info
  rule_id?: string;
  ai_explanation?: string;  // Gemini-generated explanation
  ai_suggestion?: string;   // Gemini-generated better alternative
}

export interface GrammarCheckResponse {
  text: string;
  language: string;
  detected_language: string;  // Shows auto-detected language
  issues: GrammarIssue[];
  issue_count: number;
  suggestions_count: number;
  corrected_text?: string;
  ai_overall_feedback?: string;  // Overall feedback from Gemini
}

export interface SpellCheckResponse {
  original: string;
  corrected: string;
  has_errors: boolean;
  suggestions: string[];
}

export interface AutoCorrectResponse {
  original: string;
  corrected: string;
  changes_count: number;
  changes: Array<{
    type: string;
    original: string;
    corrected: string;
    message: string;
  }>;
}

export interface LanguageInfo {
  code: string;
  name: string;
  available: boolean;
}

export type Language = 'en' | 'tl';

/**
 * Check grammar with AI-enhanced explanations using Gemini
 */
export async function checkGrammarWithAI(
  text: string,
  language: Language = 'en',
  geminiApiKey: string
): Promise<GrammarCheckResponse> {
  const response = await fetch(`${API_BASE_URL}/api/grammar/check-enhanced`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text, language, gemini_api_key: geminiApiKey }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'AI-enhanced grammar check failed');
  }

  return response.json();
}

/**
 * Check grammar with automatic language detection and AI-powered spelling.
 * Language is auto-detected from the text.
 * AI is always used for spelling when geminiApiKey is provided.
 */
export async function checkGrammar(
  text: string,
  geminiApiKey?: string
): Promise<GrammarCheckResponse> {
  const response = await fetch(`${API_BASE_URL}/api/grammar/check`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ 
      text, 
      gemini_api_key: geminiApiKey 
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Grammar check failed');
  }

  return response.json();
}

/**
 * Check spelling only (faster than full grammar check)
 */
export async function checkSpelling(
  text: string,
  language: Language = 'en'
): Promise<SpellCheckResponse> {
  const response = await fetch(`${API_BASE_URL}/api/grammar/spell-check`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text, language }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Spell check failed');
  }

  return response.json();
}

/**
 * Automatically correct all errors (language auto-detected)
 */
export async function autoCorrect(
  text: string
): Promise<AutoCorrectResponse> {
  const response = await fetch(`${API_BASE_URL}/api/grammar/auto-correct`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Auto-correct failed');
  }

  return response.json();
}

/**
 * Get list of supported languages
 */
export async function getSupportedLanguages(): Promise<LanguageInfo[]> {
  const response = await fetch(`${API_BASE_URL}/api/grammar/languages`);

  if (!response.ok) {
    throw new Error('Failed to fetch supported languages');
  }

  const data = await response.json();
  return data.languages;
}

/**
 * Check if grammar service is healthy
 */
export async function checkHealth(): Promise<{
  status: string;
  english_available: boolean;
  tagalog_available: boolean;
  spell_checker_available: boolean;
}> {
  const response = await fetch(`${API_BASE_URL}/api/grammar/health`);

  if (!response.ok) {
    throw new Error('Health check failed');
  }

  return response.json();
}

/**
 * Helper function to highlight issues in text
 */
export function highlightIssues(text: string, issues: GrammarIssue[]): string {
  let highlighted = text;
  const sortedIssues = [...issues].sort((a, b) => b.offset - a.offset);

  for (const issue of sortedIssues) {
    const before = highlighted.slice(0, issue.offset);
    const error = highlighted.slice(issue.offset, issue.offset + issue.length);
    const after = highlighted.slice(issue.offset + issue.length);

    const className = `grammar-${issue.severity}`;
    highlighted = `${before}<mark class="${className}" data-message="${issue.message}">${error}</mark>${after}`;
  }

  return highlighted;
}

/**
 * Get issue statistics
 */
export function getIssueStats(issues: GrammarIssue[]): {
  total: number;
  errors: number;
  warnings: number;
  info: number;
  byType: Record<string, number>;
} {
  const stats = {
    total: issues.length,
    errors: 0,
    warnings: 0,
    info: 0,
    byType: {} as Record<string, number>,
  };

  for (const issue of issues) {
    // Count by severity
    if (issue.severity === 'error') stats.errors++;
    else if (issue.severity === 'warning') stats.warnings++;
    else if (issue.severity === 'info') stats.info++;

    // Count by type
    stats.byType[issue.type] = (stats.byType[issue.type] || 0) + 1;
  }

  return stats;
}

/**
 * Format issue for display
 */
export function formatIssue(issue: GrammarIssue): string {
  const icon = issue.severity === 'error' ? '🔴' : issue.severity === 'warning' ? '🟡' : 'ℹ️';
  const suggestions = issue.replacements.length > 0
    ? ` Suggestion: ${issue.replacements.join(', ')}`
    : '';
  
  return `${icon} ${issue.message}${suggestions}`;
}

/**
 * Debounced grammar check for real-time checking (language auto-detected)
 */
export function createDebouncedGrammarCheck(
  delay: number = 1000
): (text: string, callback: (result: GrammarCheckResponse) => void, geminiApiKey?: string) => void {
  let timeoutId: NodeJS.Timeout | null = null;

  return (text: string, callback: (result: GrammarCheckResponse) => void, geminiApiKey?: string) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(async () => {
      try {
        const result = await checkGrammar(text, geminiApiKey);
        callback(result);
      } catch (error) {
        console.error('Grammar check error:', error);
      }
    }, delay);
  };
}
