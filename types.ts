
export enum ProficiencyLevel {
  NAGSISIMULA  = "Nagsisimula",
  PAPAUNLAD    = "Papaunlad",
  MAHUSAY      = "Mahusay",
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
  GRAMMAR = "Grammar",
  CLARITY = "Clarity",
  VOCABULARY = "Vocabulary",
  STYLE = "Style"
}

export interface GrammarIssue {
  id?: string;
  original: string;
  suggestion: string;
  type: string;
  category: IssueCategory;
  context: string;
  explanation?: string;
}

export interface LinguisticMetrics {
  vocabularyRichness: number;
  sentenceComplexity: number;
  grammarAccuracy: number;
  structureCohesion: number;
  cefrDistribution?: { [level: string]: number };
  cefrWordGroups?: {
    basic: string[];
    independent: string[];
    proficient: string[];
  };
  advancedWords?: string[];
}

export interface DepEdRubricDimension {
  score: number;       // 1–4
  rationale: string;   // one-sentence explanation
}

export interface DepEdRubricScore {
  content: DepEdRubricDimension;
  organization: DepEdRubricDimension;
  languageVocab: DepEdRubricDimension;
  grammar: DepEdRubricDimension;
  mechanics: DepEdRubricDimension;
  overallScore: number;        // average of 5 dimensions, 1–4
  overallFeedback: string;     // 2–3 sentence teacher-facing summary
  gradeLevel: string;          // e.g. "Grade 7"
  language: 'english' | 'filipino';
}

export interface ContentValidation {
  hasReference: boolean;
  accuracyScore: number;
  missingPoints: string[];
  misconceptions: string[];
  suggestion: string;
}

export interface StudentDiagnosisResult {
  proficiency: ProficiencyLevel;
  feedback: string;
  metrics: LinguisticMetrics;
  issues: GrammarIssue[];
  contentValidation?: ContentValidation;
  analyzed_text?: string;
  rubricScore?: DepEdRubricScore;

  natScore: number;
  learningBand: LearningBand;
  philIriLevel: PhilIriLevel;
}

export interface TextComplexityResult {
  level: ComplexityLevel;
  score: number;
  reasoning: string;
  readabilityScore: number;
  wordCount: number;
  keywords: string[];
  analyzed_text?: string;

  fixationDuration: number;
  regressionIndex: number;
  estimatedReadingTime: number;
  avgSentenceLength: number;
  difficultWordRatio: number;
  highlightedSegments: string[];

  /** Readability indices computed by the trained model */
  readability?: {
    flesch_kincaid?: number;
    gunning_fog?: number;
  };
}

export interface OriginalFile {
  base64: string;
  mimeType: string;
  name: string;
}

export interface LibraryMaterial {
  id: string;
  name: string;
  text: string;
  uploadedAt: Date;
  complexityResult: TextComplexityResult;
  originalFile?: OriginalFile;
  originalFiles?: OriginalFile[];
  teacherVerifiedLevel?: ComplexityLevel;
  teacherVerifiedAt?: string;
  verificationComment?: string;
  isVerified?: boolean;
  // ISO-style language code detected from material text.
  // Distinct from the Language enum ('English'/'Filipino') used elsewhere.
  // 'eng' = English, 'fil' = Filipino (default/fallback).
  language?: 'eng' | 'fil';
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
