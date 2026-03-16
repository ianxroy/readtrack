import { Section, Subject, Student, SECTIONS_KEY, SUBJECTS_KEY, STUDENTS_KEY } from './types';

// ─── Sections ───────────────────────────────────────────
export function loadSections(): Section[] {
  try {
    const raw = localStorage.getItem(SECTIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveSections(sections: Section[]): void {
  localStorage.setItem(SECTIONS_KEY, JSON.stringify(sections));
}

// ─── Subjects ───────────────────────────────────────────
export function loadSubjects(): Subject[] {
  try {
    const raw = localStorage.getItem(SUBJECTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveSubjects(subjects: Subject[]): void {
  localStorage.setItem(SUBJECTS_KEY, JSON.stringify(subjects));
}

// ─── Students ───────────────────────────────────────────
export function loadStudents(): Student[] {
  try {
    const raw = localStorage.getItem(STUDENTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw).map((s: any) => ({
      ...s,
      sectionId: s.sectionId ?? '',   // empty string = needs migration
      essays: s.essays.map((e: any) => ({
        ...e,
        subjectId: e.subjectId ?? '', // empty string = needs migration
        uploadedAt: new Date(e.uploadedAt),
      })),
    }));
  } catch {
    return [];
  }
}

export function saveStudents(students: Student[]): void {
  localStorage.setItem(STUDENTS_KEY, JSON.stringify(students));
}

// ─── Migration check ────────────────────────────────────
/** Returns true if any student is missing sectionId or any essay is missing subjectId */
export function needsMigration(students: Student[]): boolean {
  return students.some(
    (s) => !s.sectionId || s.essays.some((e) => !e.subjectId)
  );
}
