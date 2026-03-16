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
  try {
    localStorage.setItem(SECTIONS_KEY, JSON.stringify(sections));
  } catch (e) {
    throw new Error('Failed to save sections: storage may be full.');
  }
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
  try {
    localStorage.setItem(SUBJECTS_KEY, JSON.stringify(subjects));
  } catch (e) {
    throw new Error('Failed to save subjects: storage may be full.');
  }
}

// ─── Students ───────────────────────────────────────────
export function loadStudents(): Student[] {
  try {
    const raw = localStorage.getItem(STUDENTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw).map((s: any) => ({
      ...s,
      sectionId: s.sectionId ?? '',   // empty string = needs migration
      essays: (s.essays ?? []).map((e: any) => ({
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
  try {
    localStorage.setItem(STUDENTS_KEY, JSON.stringify(students));
  } catch (e) {
    throw new Error('Failed to save students: storage may be full.');
  }
}

// ─── Migration check ────────────────────────────────────
/**
 * Returns true if any student record predates the Section/Subject redesign.
 * After migration completes, sectionId is always a real Section.id — never empty.
 * An empty string here means the record was loaded from legacy data and not yet migrated.
 */
export function needsMigration(students: Student[]): boolean {
  return students.some(
    (s) => !s.sectionId || s.essays.some((e) => !e.subjectId)
  );
}
