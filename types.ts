
export enum ProficiencyLevel {
  BEGINNING = "Beginning",
  DEVELOPING = "Developing",
  PROFICIENT = "Proficient",
  ADVANCED = "Advanced"
}

export enum ComplexityLevel {
  LITERAL = "Literal",
  INFERENTIAL = "Inferential",
  EVALUATIVE = "Evaluative"
}

export enum Language {
  ENGLISH = "English",
  FILIPINO = "Filipino"
}

export enum LearningBand {
  INTERVENTION = "Intervention (Score 0-4)",
  CONSOLIDATION = "Consolidation",
  ENHANCEMENT = "Enhancement"
}

export enum PhilIriLevel {
  FRUSTRATION = "Frustration",
  INSTRUCTIONAL = "Instructional",
  INDEPENDENT = "Independent"
}

export enum IssueCategory {
  GRAMMAR = "Grammar",   // Red
  CLARITY = "Clarity",   // Blue
  VOCABULARY = "Vocabulary", // Purple/Pink
  STYLE = "Style"       // Orange
}

export interface GrammarIssue {
  id?: string;
  original: string;
  suggestion: string;
  type: string;
  category: IssueCategory; // Added for UI color coding
  context: string;
  explanation?: string; // For the tooltip
}

export interface LinguisticMetrics {
  vocabularyRichness: number; // 0-100
  sentenceComplexity: number; // 0-100
  grammarAccuracy: number; // 0-100
  structureCohesion: number; // 0-100
  cefrDistribution?: { [level: string]: number };
  cefrWordGroups?: {
    basic: string[];
    independent: string[];
    proficient: string[];
  };
  advancedWords?: string[];
}

export interface ContentValidation {
  hasReference: boolean;
  accuracyScore: number; // 0-100
  missingPoints: string[];
  misconceptions: string[];
  suggestion: string;
}

export interface StudentDiagnosisResult {
  proficiency: ProficiencyLevel;
  feedback: string;
  metrics: LinguisticMetrics;
  issues: GrammarIssue[];
  contentValidation?: ContentValidation; // New field for Reference Checking
  analyzed_text?: string; // The full text that was analyzed (includes OCR text if image was provided)
  // Grade 7 Specifics
  natScore: number; // Mean Percentage Score (Target 75%)
  learningBand: LearningBand;
  philIriLevel: PhilIriLevel;
}

export interface TextComplexityResult {
  level: ComplexityLevel;
  score: number; // 0-100
  reasoning: string;
  readabilityScore: number;
  wordCount: number;
  keywords: string[];
  analyzed_text?: string; // The full text that was analyzed (includes OCR text if image was provided)
  // New Simulated Metrics matching reference
  fixationDuration: number; // Percentage or ms
  regressionIndex: number; // Percentage
  estimatedReadingTime: number; // Minutes
  avgSentenceLength: number;
  difficultWordRatio: number; // Percentage
  highlightedSegments: string[]; // Words/Phrases to highlight in Red/Pink
}

export interface ReferenceFile {
  id: string;
  name: string;
  files: { base64: string; mimeType: string; name: string }[];
  date: string;
}

export interface CachedAnalysis {
  id: string;
  timestamp: Date;
  title: string;
  studentText: string;
  diagnosisResult?: StudentDiagnosisResult;
  complexityResult?: TextComplexityResult;
  referenceUsed?: string;
}

export type AnalysisMode = 'diagnosis' | 'complexity';

export type ViewState = 'dashboard' | 'reports' | 'evaluation' | 'grammar';

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content?: string;
  data?: StudentDiagnosisResult | TextComplexityResult;
  mode?: AnalysisMode;
  timestamp: Date;
}

// --- API Response Types ---

export interface PerformanceMetrics {
    accuracy: string;
    f1: number;
    precision: number;
    recall: number;
    labels: string[];
    matrix: number[][];
}

export interface EvaluationApiResponse {
    proficiency: PerformanceMetrics;
    complexity: PerformanceMetrics;
}
