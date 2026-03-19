import { StudentDiagnosisResult, TextComplexityResult } from '../../types';

export interface TeacherRubricScores {
  content: number;
  organization: number;
  languageVocab: number;
  grammar: number;
  mechanics: number;
  overall: number;
  percentage: number;
  transmuted?: number;
}

export interface Section {
  id: string;   // Date.now().toString()
  name: string;
}

export interface Subject {
  id: string;
  name: string;
  language: 'english' | 'filipino';
}

export interface StudentEssay {
  id: string;
  title: string;
  text: string;
  subjectId: string;
  uploadedAt: Date;
  diagnosisResult?: StudentDiagnosisResult;
  complexityResult?: TextComplexityResult;
  teacherRating?: number;
  teacherComment?: string;
  teacherRubricScores?: TeacherRubricScores;
  originalFile?: { base64: string; mimeType: string; name: string };
}

export interface Student {
  id: string;
  name: string;
  sectionId: string;
  essays: StudentEssay[];
}

export const SECTIONS_KEY = 'readtrack_sections';
export const SUBJECTS_KEY = 'readtrack_subjects';
export const STUDENTS_KEY = 'readtrack_student_essays';
