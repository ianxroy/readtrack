# Student Grading Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat StudentGrading component with a three-panel layout (Sidebar › Student Grid › Essay Panel) organized around a mandatory Section → Subject → Student → Essays hierarchy.

**Architecture:** The existing `components/StudentGrading.tsx` is replaced by a `components/StudentGrading/` directory with focused single-responsibility components. A shared `storage.ts` handles all localStorage operations. A `types.ts` file defines the data model. The main `index.tsx` orchestrates the three panels and owns all state. No test framework is installed — each step is verified by running `npm run dev` and visually checking behavior.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, localStorage, react-icons/io5, Vite

**Spec:** `docs/superpowers/specs/2026-03-17-student-grading-redesign.md`

---

## Chunk 1: Data Layer — types.ts + storage.ts

### Task 1: Create the StudentGrading directory and types.ts

**Files:**
- Create: `components/StudentGrading/types.ts`

- [ ] **Step 1.1: Create directory and types file**

```bash
mkdir -p components/StudentGrading
```

Create `components/StudentGrading/types.ts`:

```ts
import { StudentDiagnosisResult, TextComplexityResult } from '../../types';

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
```

- [ ] **Step 1.2: Verify TypeScript compiles**

```bash
cd /Volumes/Hanteck/Projects/readtrack && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors related to `types.ts`.

---

### Task 2: Create storage.ts

**Files:**
- Create: `components/StudentGrading/storage.ts`

- [ ] **Step 2.1: Write storage.ts**

Create `components/StudentGrading/storage.ts`:

```ts
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
```

- [ ] **Step 2.2: Verify TypeScript compiles**

```bash
cd /Volumes/Hanteck/Projects/readtrack && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 2.3: Commit**

```bash
cd /Volumes/Hanteck/Projects/readtrack
git add components/StudentGrading/types.ts components/StudentGrading/storage.ts
git commit -m "feat: add StudentGrading data model types and storage layer"
```

---

## Chunk 2: Setup Screen + Migration Modal

### Task 3: SetupScreen component

**Files:**
- Create: `components/StudentGrading/SetupScreen.tsx`

Shown on first launch when there are zero sections OR zero subjects.

- [ ] **Step 3.1: Write SetupScreen.tsx**

Create `components/StudentGrading/SetupScreen.tsx`:

```tsx
import React, { useState } from 'react';
import { IoSchoolOutline, IoAddOutline, IoCheckmarkOutline } from 'react-icons/io5';
import { Section, Subject } from './types';

interface SetupScreenProps {
  onComplete: (section: Section, subjects: Subject[]) => void;
}

export const SetupScreen: React.FC<SetupScreenProps> = ({ onComplete }) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [sectionName, setSectionName] = useState('');
  const [createdSection, setCreatedSection] = useState<Section | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectName, setSubjectName] = useState('');
  const [subjectLang, setSubjectLang] = useState<'english' | 'filipino' | ''>('');

  const handleCreateSection = () => {
    if (!sectionName.trim()) return;
    const section: Section = { id: Date.now().toString(), name: sectionName.trim() };
    setCreatedSection(section);
    setStep(2);
  };

  const handleAddSubject = () => {
    if (!subjectName.trim() || !subjectLang) return;
    const subject: Subject = {
      id: Date.now().toString(),
      name: subjectName.trim(),
      language: subjectLang,
    };
    setSubjects((prev) => [...prev, subject]);
    setSubjectName('');
    setSubjectLang('');
  };

  const handleFinish = () => {
    if (!createdSection || subjects.length === 0) return;
    onComplete(createdSection, subjects);
  };

  return (
    <div className="flex flex-col items-center justify-center h-full bg-[#F2F2F7] p-8">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 w-full max-w-md p-8">
        <div className="flex items-center gap-3 mb-6">
          <IoSchoolOutline className="text-3xl text-teal-500" />
          <div>
            <h1 className="text-lg font-black text-gray-900">Welcome to Student Grading</h1>
            <p className="text-xs text-gray-500">Let's set up your classes before we begin.</p>
          </div>
        </div>

        {/* Step indicators */}
        <div className="flex items-center gap-2 mb-8">
          {[1, 2].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black
                ${step === s ? 'bg-teal-500 text-white' : step > s ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
                {step > s ? <IoCheckmarkOutline /> : s}
              </div>
              <span className={`text-xs font-semibold ${step === s ? 'text-gray-800' : 'text-gray-400'}`}>
                {s === 1 ? 'Create Section' : 'Add Subjects'}
              </span>
              {s < 2 && <span className="text-gray-200 mx-1">›</span>}
            </div>
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                Section Name (Pangalan ng Seksyon)
              </label>
              <input
                autoFocus
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-400 outline-none"
                placeholder="e.g. Grade 7 – Rizal"
                value={sectionName}
                onChange={(e) => setSectionName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateSection()}
              />
            </div>
            <button
              onClick={handleCreateSection}
              disabled={!sectionName.trim()}
              className="w-full py-3 rounded-xl bg-teal-500 hover:bg-teal-600 disabled:bg-gray-100 disabled:text-gray-400 text-white font-bold text-sm transition-colors"
            >
              Create Section →
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-xs text-gray-500">
              Section <strong className="text-gray-800">{createdSection?.name}</strong> created. Now add at least one subject.
            </p>

            {subjects.length > 0 && (
              <div className="space-y-1 mb-2">
                {subjects.map((sub) => (
                  <div key={sub.id} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg border border-gray-100">
                    <span className="text-xs font-semibold text-gray-800">{sub.name}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sub.language === 'english' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'}`}>
                      {sub.language === 'english' ? '🇺🇸 English' : '🇵🇭 Filipino'}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                Subject Name (Pangalan ng Paksa)
              </label>
              <input
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-400 outline-none"
                placeholder="e.g. English, AP, Filipino, Math"
                value={subjectName}
                onChange={(e) => setSubjectName(e.target.value)}
              />
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                Grading Language (Wika ng Pagmamarka)
              </label>
              <select
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-400 outline-none appearance-none"
                value={subjectLang}
                onChange={(e) => setSubjectLang(e.target.value as 'english' | 'filipino' | '')}
              >
                <option value="">Select language…</option>
                <option value="english">🇺🇸 English</option>
                <option value="filipino">🇵🇭 Filipino</option>
              </select>
              <button
                onClick={handleAddSubject}
                disabled={!subjectName.trim() || !subjectLang}
                className="w-full py-2.5 rounded-xl border-2 border-dashed border-teal-300 hover:bg-teal-50 disabled:border-gray-200 disabled:text-gray-400 text-teal-600 font-bold text-sm transition-colors flex items-center justify-center gap-2"
              >
                <IoAddOutline /> Add Subject
              </button>
            </div>

            <button
              onClick={handleFinish}
              disabled={subjects.length === 0}
              className="w-full py-3 rounded-xl bg-teal-500 hover:bg-teal-600 disabled:bg-gray-100 disabled:text-gray-400 text-white font-bold text-sm transition-colors"
            >
              {subjects.length === 0 ? 'Add at least one subject' : 'Get Started →'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
```

- [ ] **Step 3.2: Verify TypeScript compiles**

```bash
cd /Volumes/Hanteck/Projects/readtrack && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

---

### Task 4: MigrationModal component

**Files:**
- Create: `components/StudentGrading/MigrationModal.tsx`

Shown when existing students have no `sectionId` or essays have no `subjectId`. Teacher must assign before the app continues.

- [ ] **Step 4.1: Write MigrationModal.tsx**

Create `components/StudentGrading/MigrationModal.tsx`:

```tsx
import React, { useState } from 'react';
import { IoWarningOutline } from 'react-icons/io5';
import { Student, Section, Subject } from './types';

interface MigrationModalProps {
  students: Student[];
  sections: Section[];
  subjects: Subject[];
  onComplete: (migratedStudents: Student[]) => void;
}

export const MigrationModal: React.FC<MigrationModalProps> = ({
  students, sections, subjects, onComplete,
}) => {
  const [assignments, setAssignments] = useState<Record<string, string>>(
    // studentId → sectionId
    Object.fromEntries(students.filter(s => !s.sectionId).map(s => [s.id, '']))
  );
  const [essayAssignments, setEssayAssignments] = useState<Record<string, string>>(
    // essayId → subjectId
    Object.fromEntries(
      students.flatMap(s => s.essays.filter(e => !e.subjectId).map(e => [e.id, '']))
    )
  );

  const orphanedStudents = students.filter(s => !s.sectionId);
  const orphanedEssays = students.flatMap(s =>
    s.essays.filter(e => !e.subjectId).map(e => ({ ...e, studentName: s.name }))
  );

  const allAssigned =
    Object.values(assignments).every(v => v) &&
    Object.values(essayAssignments).every(v => v);

  const handleComplete = () => {
    if (!allAssigned) return;
    const migrated = students.map(s => ({
      ...s,
      sectionId: assignments[s.id] || s.sectionId,
      essays: s.essays.map(e => ({
        ...e,
        subjectId: essayAssignments[e.id] || e.subjectId,
      })),
    }));
    onComplete(migrated);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center gap-3 mb-2">
            <IoWarningOutline className="text-2xl text-amber-500" />
            <h2 className="text-base font-black text-gray-900">Data Migration Required</h2>
          </div>
          <p className="text-xs text-gray-500">
            Some existing students and essays need to be assigned to a section or subject before you can continue.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {orphanedStudents.length > 0 && (
            <div>
              <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">
                Assign Students to a Section (Seksyon)
              </h3>
              <div className="space-y-2">
                {orphanedStudents.map(s => (
                  <div key={s.id} className="flex items-center gap-3">
                    <span className="flex-1 text-sm font-semibold text-gray-800 truncate">{s.name}</span>
                    <select
                      className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-teal-400"
                      value={assignments[s.id] || ''}
                      onChange={e => setAssignments(prev => ({ ...prev, [s.id]: e.target.value }))}
                    >
                      <option value="">Select section…</option>
                      {sections.map(sec => (
                        <option key={sec.id} value={sec.id}>{sec.name}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {orphanedEssays.length > 0 && (
            <div>
              <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">
                Assign Essays to a Subject (Paksa)
              </h3>
              <div className="space-y-2">
                {orphanedEssays.map(e => (
                  <div key={e.id} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-gray-800 truncate">{e.title}</div>
                      <div className="text-[10px] text-gray-400">{e.studentName}</div>
                    </div>
                    <select
                      className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-teal-400"
                      value={essayAssignments[e.id] || ''}
                      onChange={ev => setEssayAssignments(prev => ({ ...prev, [e.id]: ev.target.value }))}
                    >
                      <option value="">Select subject…</option>
                      {subjects.map(sub => (
                        <option key={sub.id} value={sub.id}>{sub.name}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-100">
          <button
            onClick={handleComplete}
            disabled={!allAssigned}
            className="w-full py-3 rounded-xl bg-teal-500 hover:bg-teal-600 disabled:bg-gray-100 disabled:text-gray-400 text-white font-bold text-sm transition-colors"
          >
            {allAssigned ? 'Save & Continue →' : 'Assign all items to continue'}
          </button>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 4.2: Verify TypeScript compiles**

```bash
cd /Volumes/Hanteck/Projects/readtrack && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 4.3: Commit**

```bash
cd /Volumes/Hanteck/Projects/readtrack
git add components/StudentGrading/SetupScreen.tsx components/StudentGrading/MigrationModal.tsx
git commit -m "feat: add SetupScreen and MigrationModal components"
```

---

## Chunk 3: Sidebar Component

### Task 5: Sidebar.tsx

**Files:**
- Create: `components/StudentGrading/Sidebar.tsx`

Renders the sections tree with nested subjects. Handles inline section create/rename/delete.

- [ ] **Step 5.1: Write Sidebar.tsx**

Create `components/StudentGrading/Sidebar.tsx`:

```tsx
import React, { useState, useRef, useEffect } from 'react';
import {
  IoChevronDownOutline, IoChevronForwardOutline,
  IoEllipsisHorizontal, IoAddOutline, IoCheckmarkOutline, IoCloseOutline,
} from 'react-icons/io5';
import { Section, Subject, Student } from './types';

interface SidebarProps {
  sections: Section[];
  subjects: Subject[];
  students: Student[];
  selectedSectionId: string;
  selectedSubjectId: string;
  onSelectSubject: (sectionId: string, subjectId: string) => void;
  onCreateSection: (name: string) => void;
  onRenameSection: (id: string, name: string) => void;
  onDeleteSection: (id: string) => void;
  onManageSubjects: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  sections, subjects, students,
  selectedSectionId, selectedSubjectId,
  onSelectSubject, onCreateSection, onRenameSection, onDeleteSection,
  onManageSubjects,
}) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(selectedSectionId ? [selectedSectionId] : [])
  );
  const [showNewInput, setShowNewInput] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const newInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showNewInput) newInputRef.current?.focus();
  }, [showNewInput]);

  const toggleSection = (section: Section) => {
    const isExpanded = expandedSections.has(section.id);
    if (isExpanded) {
      // Collapse this section
      setExpandedSections(prev => { const next = new Set(prev); next.delete(section.id); return next; });
    } else {
      // Accordion: collapse all others, expand this one
      setExpandedSections(new Set([section.id]));
      // Auto-select first subject
      if (subjects.length > 0) {
        onSelectSubject(section.id, subjects[0].id);
      }
    }
  };

  const handleCreateSection = () => {
    if (!newSectionName.trim()) return;
    onCreateSection(newSectionName.trim());
    setNewSectionName('');
    setShowNewInput(false);
  };

  const handleRenameConfirm = () => {
    if (!renaming || !renaming.name.trim()) return;
    onRenameSection(renaming.id, renaming.name.trim());
    setRenaming(null);
  };

  const studentCountInSection = (sectionId: string) =>
    students.filter(s => s.sectionId === sectionId).length;

  const langPill = (lang: Subject['language']) => (
    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${
      lang === 'english'
        ? 'bg-blue-50 text-blue-600 border-blue-200'
        : 'bg-pink-50 text-pink-600 border-pink-200'
    }`}>
      {lang === 'english' ? '🇺🇸' : '🇵🇭'}
    </span>
  );

  return (
    <div className="w-[200px] flex-shrink-0 bg-[#f8fafc] border-r border-gray-100 flex flex-col h-full">
      {/* Header */}
      <div className="px-3 pt-3 pb-1 flex items-center justify-between">
        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
          Sections (Seksyon)
        </span>
        <button
          onClick={onManageSubjects}
          className="text-[9px] font-bold text-teal-600 hover:text-teal-700"
        >
          ⚙ Subjects
        </button>
      </div>

      {/* Sections list */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {sections.map(section => {
          const isExpanded = expandedSections.has(section.id);
          const count = studentCountInSection(section.id);
          const isRenaming = renaming?.id === section.id;
          const isMenuOpen = menuOpenId === section.id;

          return (
            <div key={section.id} className="mb-0.5">
              {/* Section row */}
              <div className="flex items-center gap-1 group">
                <button
                  onClick={() => toggleSection(section)}
                  className={`flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-left transition-colors ${
                    selectedSectionId === section.id
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  {isExpanded
                    ? <IoChevronDownOutline className="text-[11px] flex-shrink-0" />
                    : <IoChevronForwardOutline className="text-[11px] flex-shrink-0" />
                  }
                  {isRenaming ? (
                    <input
                      autoFocus
                      className="flex-1 text-xs font-semibold bg-white border border-indigo-300 rounded px-1 outline-none"
                      value={renaming.name}
                      onChange={e => setRenaming({ ...renaming, name: e.target.value })}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleRenameConfirm();
                        if (e.key === 'Escape') setRenaming(null);
                      }}
                      onClick={e => e.stopPropagation()}
                    />
                  ) : (
                    <span className="flex-1 text-xs font-bold truncate">{section.name}</span>
                  )}
                  <span className="text-[9px] bg-indigo-100 text-indigo-600 font-bold px-1.5 rounded-full ml-auto">
                    {count}
                  </span>
                </button>

                {/* ⋯ menu */}
                <div className="relative">
                  <button
                    onClick={() => setMenuOpenId(isMenuOpen ? null : section.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-200 text-gray-500 transition-opacity"
                  >
                    <IoEllipsisHorizontal className="text-sm" />
                  </button>
                  {isMenuOpen && (
                    <div className="absolute right-0 top-full mt-1 bg-white border border-gray-100 rounded-lg shadow-xl z-30 min-w-[130px] overflow-hidden">
                      <button
                        className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 text-gray-700"
                        onClick={() => { setRenaming({ id: section.id, name: section.name }); setMenuOpenId(null); }}
                      >
                        Rename (Palitan)
                      </button>
                      <button
                        className={`w-full text-left px-3 py-2 text-xs ${
                          count > 0
                            ? 'text-gray-300 cursor-not-allowed'
                            : 'hover:bg-red-50 text-red-600'
                        }`}
                        disabled={count > 0}
                        title={count > 0 ? 'Move or delete all students first' : undefined}
                        onClick={() => { if (count === 0) { onDeleteSection(section.id); setMenuOpenId(null); } }}
                      >
                        Delete (Burahin)
                        {count > 0 && <span className="block text-[9px] text-gray-400">Move students first</span>}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Subjects (indented) */}
              {isExpanded && (
                <div className="pl-5 mt-0.5 space-y-0.5">
                  {subjects.length === 0 ? (
                    <button
                      onClick={onManageSubjects}
                      className="text-[10px] text-indigo-400 hover:text-indigo-600 px-2 py-1"
                    >
                      + Add a subject
                    </button>
                  ) : (
                    subjects.map(subject => (
                      <button
                        key={subject.id}
                        onClick={() => onSelectSubject(section.id, subject.id)}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors ${
                          selectedSectionId === section.id && selectedSubjectId === subject.id
                            ? 'bg-indigo-100 text-indigo-700'
                            : 'hover:bg-gray-100 text-gray-600'
                        }`}
                      >
                        {langPill(subject.language)}
                        <span className="text-[11px] font-semibold truncate">{subject.name}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Inline new section input */}
        {showNewInput && (
          <div className="flex items-center gap-1 px-2 py-1 mt-1">
            <input
              ref={newInputRef}
              className="flex-1 text-xs border border-teal-300 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-teal-400 bg-white"
              placeholder="Section name…"
              value={newSectionName}
              onChange={e => setNewSectionName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleCreateSection();
                if (e.key === 'Escape') { setShowNewInput(false); setNewSectionName(''); }
              }}
            />
            <button onClick={handleCreateSection} className="p-1 text-teal-600 hover:text-teal-700">
              <IoCheckmarkOutline className="text-sm" />
            </button>
            <button onClick={() => { setShowNewInput(false); setNewSectionName(''); }} className="p-1 text-gray-400 hover:text-gray-600">
              <IoCloseOutline className="text-sm" />
            </button>
          </div>
        )}
      </div>

      {/* Add section button */}
      <div className="p-2 border-t border-gray-100">
        <button
          onClick={() => setShowNewInput(true)}
          className="w-full flex items-center justify-center gap-1.5 py-2 border-2 border-dashed border-gray-200 hover:border-teal-300 hover:text-teal-600 text-gray-400 rounded-xl text-xs font-bold transition-colors"
        >
          <IoAddOutline /> New Section
        </button>
      </div>
    </div>
  );
};
```

- [ ] **Step 5.2: Verify TypeScript compiles**

```bash
cd /Volumes/Hanteck/Projects/readtrack && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 5.3: Commit**

```bash
cd /Volumes/Hanteck/Projects/readtrack
git add components/StudentGrading/Sidebar.tsx
git commit -m "feat: add Sidebar component with section/subject tree"
```

---

## Chunk 4: Student Grid + Essay Panel

### Task 6: StudentGrid.tsx

**Files:**
- Create: `components/StudentGrading/StudentGrid.tsx`

- [ ] **Step 6.1: Write StudentGrid.tsx**

Create `components/StudentGrading/StudentGrid.tsx`:

```tsx
import React from 'react';
import {
  IoAddOutline, IoEllipsisHorizontal, IoStar,
} from 'react-icons/io5';
import { Student, Section, Subject } from './types';
import { ProficiencyLevel } from '../../types';

const proficiencyMeta: Record<string, { badge: string; dot: string }> = {
  [ProficiencyLevel.INDEPENDENT]:   { badge: 'bg-green-100 text-green-700',  dot: 'bg-green-500' },
  [ProficiencyLevel.INSTRUCTIONAL]: { badge: 'bg-amber-100 text-amber-700',  dot: 'bg-amber-500' },
  [ProficiencyLevel.FRUSTRATION]:   { badge: 'bg-red-100 text-red-700',      dot: 'bg-red-500' },
};

interface StudentGridProps {
  students: Student[];
  sections: Section[];
  selectedSection: Section | null;
  selectedSubject: Subject | null;
  selectedStudentId: string | null;
  proficiencyFilter: ProficiencyLevel | 'all';
  sortKey: 'newest' | 'oldest' | 'name' | 'essays';
  searchQuery: string;
  onSelectStudent: (studentId: string) => void;
  onAddStudent: () => void;
  onMoveStudent: (studentId: string, targetSectionId: string) => void;
  onDeleteStudent: (studentId: string) => void;
  onProficiencyFilter: (f: ProficiencyLevel | 'all') => void;
  onSortChange: (key: 'newest' | 'oldest' | 'name' | 'essays') => void;
  onSearchChange: (q: string) => void;
}

export const StudentGrid: React.FC<StudentGridProps> = ({
  students, sections, selectedSection, selectedSubject,
  selectedStudentId, proficiencyFilter, sortKey, searchQuery,
  onSelectStudent, onAddStudent, onMoveStudent, onDeleteStudent,
  onProficiencyFilter, onSortChange, onSearchChange,
}) => {
  const [menuStudentId, setMenuStudentId] = React.useState<string | null>(null);

  // Students in current section who have at least one essay in selected subject (or all students if no subject filter)
  const filtered = students
    .filter(s => selectedSection ? s.sectionId === selectedSection.id : true)
    .filter(s => {
      if (proficiencyFilter === 'all') return true;
      return s.essays.some(e =>
        (!selectedSubject || e.subjectId === selectedSubject.id) &&
        e.diagnosisResult?.proficiency === proficiencyFilter
      );
    })
    .filter(s => {
      if (!searchQuery.trim()) return true;
      return s.name.toLowerCase().includes(searchQuery.toLowerCase());
    });

  const sorted = [...filtered].sort((a, b) => {
    if (sortKey === 'name') return a.name.localeCompare(b.name);
    if (sortKey === 'essays') return b.essays.length - a.essays.length;
    const aTime = a.essays[0] ? +new Date(a.essays[0].uploadedAt) : 0;
    const bTime = b.essays[0] ? +new Date(b.essays[0].uploadedAt) : 0;
    return sortKey === 'oldest' ? aTime - bTime : bTime - aTime;
  });

  const subjectEssayCount = (student: Student) =>
    selectedSubject
      ? student.essays.filter(e => e.subjectId === selectedSubject.id).length
      : student.essays.length;

  const avgRating = (student: Student) => {
    const essays = selectedSubject
      ? student.essays.filter(e => e.subjectId === selectedSubject.id)
      : student.essays;
    const rated = essays.filter(e => e.teacherRating && e.teacherRating > 0);
    if (!rated.length) return null;
    return (rated.reduce((s, e) => s + (e.teacherRating ?? 0), 0) / rated.length).toFixed(1);
  };

  const latestProficiency = (student: Student): string | null => {
    const essays = selectedSubject
      ? student.essays.filter(e => e.subjectId === selectedSubject.id)
      : student.essays;
    return essays[0]?.diagnosisResult?.proficiency ?? null;
  };

  const langPill = selectedSubject
    ? <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${selectedSubject.language === 'english' ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600'}`}>
        {selectedSubject.language === 'english' ? '🇺🇸 EN' : '🇵🇭 FIL'}
      </span>
    : null;

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-white flex-shrink-0 gap-2">
        <div className="flex items-center gap-1.5 text-xs min-w-0">
          <span className="font-bold text-gray-800 truncate">{selectedSection?.name ?? 'All'}</span>
          {selectedSubject && <>
            <span className="text-gray-300">›</span>
            <span className="font-bold text-indigo-600 truncate">{selectedSubject.name}</span>
            {langPill}
          </>}
          <span className="text-gray-400 flex-shrink-0">· {sorted.length} students</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <input
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-gray-50 outline-none w-28 focus:ring-2 focus:ring-teal-300"
            placeholder="Search…"
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
          />
          <select
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-gray-50 outline-none"
            value={sortKey}
            onChange={e => onSortChange(e.target.value as any)}
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="name">Name A–Z</option>
            <option value="essays">Most Essays</option>
          </select>
        </div>
      </div>

      {/* Proficiency filters */}
      <div className="flex gap-1.5 px-4 py-2 bg-[#fafbff] border-b border-gray-100 flex-shrink-0 flex-wrap">
        {(['all', ProficiencyLevel.INDEPENDENT, ProficiencyLevel.INSTRUCTIONAL, ProficiencyLevel.FRUSTRATION] as const).map(f => (
          <button
            key={f}
            onClick={() => onProficiencyFilter(f)}
            className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all ${
              proficiencyFilter === f
                ? f === 'all' ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                  : `${proficiencyMeta[f]?.badge} border-transparent`
                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
            }`}
          >
            {f === 'all' ? 'All (Lahat)' : f === ProficiencyLevel.INDEPENDENT ? '🟢 Independent' : f === ProficiencyLevel.INSTRUCTIONAL ? '🟡 Instructional' : '🔴 Frustration'}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {sorted.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 text-center">
            <p className="text-sm font-semibold text-gray-400">No students found</p>
            <p className="text-xs text-gray-300 mt-1">Add a student to get started</p>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          {sorted.map(student => {
            const prof = latestProficiency(student);
            const meta = prof ? proficiencyMeta[prof] : null;
            const rating = avgRating(student);
            const essayCount = subjectEssayCount(student);
            const isSelected = selectedStudentId === student.id;
            const isMenuOpen = menuStudentId === student.id;

            return (
              <div key={student.id} className="relative group">
                <button
                  onClick={() => onSelectStudent(student.id)}
                  className={`w-full text-left p-3 border-2 rounded-xl transition-all ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-50 shadow-sm'
                      : 'border-gray-200 bg-white hover:border-indigo-200 hover:shadow-sm'
                  }`}
                >
                  <div className="font-bold text-sm text-gray-900 truncate mb-1">{student.name}</div>
                  <div className="flex items-center gap-2 text-[10px] text-gray-500">
                    <span>{essayCount} essay{essayCount !== 1 ? 's' : ''}</span>
                    {rating && (
                      <span className="flex items-center gap-0.5 text-amber-500 font-bold">
                        <IoStar className="text-[10px]" />{rating}
                      </span>
                    )}
                  </div>
                  {prof && meta && (
                    <div className="mt-2">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${meta.badge}`}>
                        {prof}
                      </span>
                    </div>
                  )}
                </button>

                {/* ⋯ menu */}
                <div className="absolute top-2 right-2">
                  <button
                    onClick={e => { e.stopPropagation(); setMenuStudentId(isMenuOpen ? null : student.id); }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-100 text-gray-400 transition-opacity"
                  >
                    <IoEllipsisHorizontal className="text-sm" />
                  </button>
                  {isMenuOpen && (
                    <div className="absolute right-0 top-full mt-1 bg-white border border-gray-100 rounded-lg shadow-xl z-20 min-w-[160px] overflow-hidden">
                      <div className="px-3 py-1.5 text-[9px] font-bold text-gray-400 uppercase">Move to Section</div>
                      {sections.filter(sec => sec.id !== student.sectionId).map(sec => (
                        <button
                          key={sec.id}
                          className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 text-gray-700"
                          onClick={() => { onMoveStudent(student.id, sec.id); setMenuStudentId(null); }}
                        >
                          {sec.name}
                        </button>
                      ))}
                      <div className="border-t border-gray-100" />
                      <button
                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-red-50 text-red-600"
                        onClick={() => { onDeleteStudent(student.id); setMenuStudentId(null); }}
                      >
                        Delete Student
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Add Student card */}
          <button
            onClick={onAddStudent}
            className="flex flex-col items-center justify-center p-3 border-2 border-dashed border-gray-200 hover:border-teal-300 hover:text-teal-600 text-gray-300 rounded-xl transition-colors h-full min-h-[90px]"
          >
            <IoAddOutline className="text-xl mb-1" />
            <span className="text-[10px] font-bold">Add Student</span>
          </button>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 6.2: Verify TypeScript compiles**

```bash
cd /Volumes/Hanteck/Projects/readtrack && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

---

### Task 7: EssayPanel.tsx

**Files:**
- Create: `components/StudentGrading/EssayPanel.tsx`

Slides in when a student is selected. Shows their essays for the active subject.

- [ ] **Step 7.1: Write EssayPanel.tsx**

Create `components/StudentGrading/EssayPanel.tsx`:

```tsx
import React from 'react';
import { IoCloudUploadOutline, IoStar } from 'react-icons/io5';
import { Student, Subject } from './types';
import { ProficiencyLevel } from '../../types';

const profBadge: Record<string, string> = {
  [ProficiencyLevel.INDEPENDENT]:   'bg-green-100 text-green-700',
  [ProficiencyLevel.INSTRUCTIONAL]: 'bg-amber-100 text-amber-700',
  [ProficiencyLevel.FRUSTRATION]:   'bg-red-100 text-red-700',
};

interface EssayPanelProps {
  student: Student | null;
  selectedSubject: Subject | null;
  selectedEssayId: string | null;
  onSelectEssay: (essayId: string) => void;
  onUploadEssay: () => void;
}

export const EssayPanel: React.FC<EssayPanelProps> = ({
  student, selectedSubject, selectedEssayId, onSelectEssay, onUploadEssay,
}) => {
  const visible = !!student;

  const essays = student
    ? selectedSubject
      ? student.essays.filter(e => e.subjectId === selectedSubject.id)
      : student.essays
    : [];

  return (
    <div
      className={`flex-shrink-0 border-l border-gray-100 bg-white flex flex-col overflow-hidden transition-all duration-300 ease-in-out ${
        visible ? 'w-[210px]' : 'w-0'
      }`}
    >
      {student && (
        <>
          {/* Header */}
          <div className="px-3 pt-3 pb-2 border-b border-gray-100 bg-[#fafbff] flex-shrink-0">
            <div className="font-black text-xs text-gray-900 truncate">{student.name}</div>
            {selectedSubject && (
              <div className="text-[10px] text-gray-400 mt-0.5 truncate">
                {selectedSubject.name} ·{' '}
                <span className={selectedSubject.language === 'english' ? 'text-blue-500' : 'text-pink-500'}>
                  {selectedSubject.language === 'english' ? '🇺🇸 English' : '🇵🇭 Filipino'}
                </span>
              </div>
            )}
          </div>

          {/* Essay list */}
          <div className="flex-1 overflow-y-auto p-2">
            <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">
              Essays (Sanaysay) · {essays.length}
            </div>
            {essays.length === 0 ? (
              <div className="text-center py-6 text-gray-300">
                <p className="text-xs">No essays yet</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {essays.map(essay => {
                  const prof = essay.diagnosisResult?.proficiency;
                  const isActive = selectedEssayId === essay.id;
                  return (
                    <button
                      key={essay.id}
                      onClick={() => onSelectEssay(essay.id)}
                      className={`w-full text-left p-2.5 border-2 rounded-lg transition-all ${
                        isActive
                          ? 'border-indigo-400 bg-indigo-50'
                          : 'border-gray-100 hover:border-indigo-200 bg-gray-50 hover:bg-white'
                      }`}
                    >
                      <div className="text-[11px] font-bold text-gray-800 truncate mb-1">{essay.title}</div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {prof && (
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${profBadge[prof] ?? 'bg-gray-100 text-gray-600'}`}>
                            {prof}
                          </span>
                        )}
                        {essay.diagnosisResult?.natScore !== undefined && (
                          <span className="text-[9px] text-gray-500">{essay.diagnosisResult.natScore}%</span>
                        )}
                        {essay.teacherRating ? (
                          <span className="text-[9px] text-amber-500 flex items-center gap-0.5">
                            <IoStar className="text-[9px]" />{essay.teacherRating}
                          </span>
                        ) : null}
                      </div>
                      <div className="text-[9px] text-gray-400 mt-1">
                        {new Date(essay.uploadedAt).toLocaleDateString()}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Upload button */}
          <div className="p-2 border-t border-gray-100 flex-shrink-0">
            <button
              onClick={onUploadEssay}
              className="w-full flex items-center justify-center gap-1.5 py-2 border-2 border-dashed border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50 text-indigo-400 hover:text-indigo-600 rounded-xl text-[10px] font-bold transition-colors"
            >
              <IoCloudUploadOutline className="text-sm" />
              Upload for {student.name.split(' ')[0]}
            </button>
          </div>
        </>
      )}
    </div>
  );
};
```

- [ ] **Step 7.2: Verify TypeScript compiles**

```bash
cd /Volumes/Hanteck/Projects/readtrack && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 7.3: Commit**

```bash
cd /Volumes/Hanteck/Projects/readtrack
git add components/StudentGrading/StudentGrid.tsx components/StudentGrading/EssayPanel.tsx
git commit -m "feat: add StudentGrid and EssayPanel components"
```

---

## Chunk 5: Modals — SubjectManager, AddStudent, UploadModal

### Task 8: SubjectManager.tsx

**Files:**
- Create: `components/StudentGrading/SubjectManager.tsx`

- [ ] **Step 8.1: Write SubjectManager.tsx**

Create `components/StudentGrading/SubjectManager.tsx`:

```tsx
import React, { useState } from 'react';
import { IoCloseOutline, IoAddOutline, IoTrashOutline, IoPencilOutline, IoCheckmarkOutline } from 'react-icons/io5';
import { Subject, Student } from './types';

interface SubjectManagerProps {
  subjects: Subject[];
  students: Student[];
  onAdd: (subject: Subject) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export const SubjectManager: React.FC<SubjectManagerProps> = ({
  subjects, students, onAdd, onRename, onDelete, onClose,
}) => {
  const [newName, setNewName] = useState('');
  const [newLang, setNewLang] = useState<'english' | 'filipino' | ''>('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renamingValue, setRenamingValue] = useState('');

  const essayCountForSubject = (subjectId: string) =>
    students.reduce((acc, s) => acc + s.essays.filter(e => e.subjectId === subjectId).length, 0);

  const handleAdd = () => {
    if (!newName.trim() || !newLang) return;
    onAdd({ id: Date.now().toString(), name: newName.trim(), language: newLang });
    setNewName('');
    setNewLang('');
  };

  const handleRenameConfirm = () => {
    if (!renamingId || !renamingValue.trim()) return;
    onRename(renamingId, renamingValue.trim());
    setRenamingId(null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-black text-gray-900">Manage Subjects</h2>
            <p className="text-xs text-gray-400 mt-0.5">Pamamahala ng mga Paksa</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 text-gray-400">
            <IoCloseOutline className="text-lg" />
          </button>
        </div>

        {/* Subject list */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          {subjects.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-4">No subjects yet. Add one below.</p>
          )}
          {subjects.map(sub => {
            const count = essayCountForSubject(sub.id);
            const isRenaming = renamingId === sub.id;
            return (
              <div key={sub.id} className="flex items-center gap-2 px-3 py-2.5 border border-gray-100 rounded-xl bg-gray-50">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  sub.language === 'english' ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600'
                }`}>
                  {sub.language === 'english' ? '🇺🇸 EN' : '🇵🇭 FIL'}
                </span>
                {isRenaming ? (
                  <input
                    autoFocus
                    className="flex-1 text-sm border border-indigo-300 rounded px-2 py-0.5 outline-none"
                    value={renamingValue}
                    onChange={e => setRenamingValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleRenameConfirm(); if (e.key === 'Escape') setRenamingId(null); }}
                  />
                ) : (
                  <span className="flex-1 text-sm font-semibold text-gray-800">{sub.name}</span>
                )}
                <span className="text-[10px] text-gray-400">{count} essays</span>
                {isRenaming ? (
                  <button onClick={handleRenameConfirm} className="p-1 text-teal-600"><IoCheckmarkOutline /></button>
                ) : (
                  <button onClick={() => { setRenamingId(sub.id); setRenamingValue(sub.name); }} className="p-1 text-gray-400 hover:text-gray-600">
                    <IoPencilOutline className="text-sm" />
                  </button>
                )}
                <button
                  onClick={() => {
                    if (count > 0) {
                      alert(`${count} essay${count !== 1 ? 's' : ''} are tagged to "${sub.name}". Re-tag or delete those essays first.`);
                      return;
                    }
                    onDelete(sub.id);
                  }}
                  className={`p-1 ${count > 0 ? 'text-gray-200 cursor-not-allowed' : 'text-gray-400 hover:text-red-500'}`}
                  title={count > 0 ? 'Re-tag or delete essays first' : 'Delete subject'}
                >
                  <IoTrashOutline className="text-sm" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Add new subject */}
        <div className="px-6 pb-6 pt-4 border-t border-gray-100 space-y-2">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Add Subject (Magdagdag ng Paksa)</div>
          <input
            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-teal-400"
            placeholder="Subject name (e.g. English, AP, Math)"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
          <select
            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-teal-400 appearance-none"
            value={newLang}
            onChange={e => setNewLang(e.target.value as any)}
          >
            <option value="">Select grading language (Wika)…</option>
            <option value="english">🇺🇸 English</option>
            <option value="filipino">🇵🇭 Filipino</option>
          </select>
          <button
            onClick={handleAdd}
            disabled={!newName.trim() || !newLang}
            className="w-full py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 disabled:bg-gray-100 disabled:text-gray-400 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors"
          >
            <IoAddOutline /> Add Subject
          </button>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 8.2: Verify TypeScript compiles**

```bash
cd /Volumes/Hanteck/Projects/readtrack && npx tsc --noEmit 2>&1 | head -20
```

---

### Task 9: AddStudentModal.tsx

**Files:**
- Create: `components/StudentGrading/AddStudentModal.tsx`

- [ ] **Step 9.1: Write AddStudentModal.tsx**

Create `components/StudentGrading/AddStudentModal.tsx`:

```tsx
import React, { useState } from 'react';
import { IoCloseOutline } from 'react-icons/io5';
import { Section } from './types';

interface AddStudentModalProps {
  section: Section;
  onAdd: (name: string) => void;
  onClose: () => void;
}

export const AddStudentModal: React.FC<AddStudentModalProps> = ({ section, onAdd, onClose }) => {
  const [name, setName] = useState('');

  const handleSubmit = () => {
    if (!name.trim()) return;
    onAdd(name.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-black text-gray-900">Add Student (Magdagdag ng Mag-aaral)</h2>
            <p className="text-xs text-gray-400 mt-0.5">Section: <strong>{section.name}</strong></p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 text-gray-400">
            <IoCloseOutline className="text-lg" />
          </button>
        </div>
        <input
          autoFocus
          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-teal-400 mb-4"
          placeholder="Student full name…"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
        />
        <button
          onClick={handleSubmit}
          disabled={!name.trim()}
          className="w-full py-3 rounded-xl bg-teal-500 hover:bg-teal-600 disabled:bg-gray-100 disabled:text-gray-400 text-white font-bold text-sm transition-colors"
        >
          Add Student
        </button>
      </div>
    </div>
  );
};
```

---

### Task 10: UploadModal.tsx

**Files:**
- Create: `components/StudentGrading/UploadModal.tsx`

Replaces the upload section in the old `StudentGrading.tsx`. Pre-fills student and subject when opened from the essay panel.

- [ ] **Step 10.1: Write UploadModal.tsx**

Create `components/StudentGrading/UploadModal.tsx`:

```tsx
import React, { useState, useRef } from 'react';
import { IoCloseOutline, IoCloudUploadOutline } from 'react-icons/io5';
import { Student, Subject, Section } from './types';
import { extractTextFromImageAPI } from '../../services/pythonService';

interface UploadModalProps {
  students: Student[];
  sections: Section[];
  subjects: Subject[];
  prefilledStudentId?: string;
  prefilledSubjectId?: string;
  onUpload: (params: {
    studentId: string;
    subjectId: string;
    title: string;
    text: string;
    originalFile?: { base64: string; mimeType: string; name: string };
  }) => Promise<void>;
  onClose: () => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  students, sections, subjects,
  prefilledStudentId, prefilledSubjectId,
  onUpload, onClose,
}) => {
  const [studentId, setStudentId] = useState(prefilledStudentId ?? '');
  const [subjectId, setSubjectId] = useState(prefilledSubjectId ?? '');
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [originalFile, setOriginalFile] = useState<{ base64: string; mimeType: string; name: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const canSubmit = !!studentId && !!subjectId && (!!text.trim() || !!originalFile) && !isUploading;

  const handleFile = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) { setError('File exceeds 10MB limit.'); return; }
    setError(null);
    if (file.type === 'text/plain') {
      const reader = new FileReader();
      reader.onload = e => setText(e.target?.result as string);
      reader.readAsText(file);
    } else {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = (reader.result as string).split(',')[1];
        setOriginalFile({ base64, mimeType: file.type, name: file.name });
        try {
          const extracted = await extractTextFromImageAPI(base64, file.type);
          if (extracted) setText(extracted.text);
        } catch { /* OCR failure is non-fatal */ }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsUploading(true);
    setError(null);
    try {
      await onUpload({ studentId, subjectId, title: title.trim() || 'Untitled Essay', text: text.trim(), originalFile: originalFile ?? undefined });
      onClose();
    } catch (e: any) {
      setError(e.message ?? 'Upload failed.');
    } finally {
      setIsUploading(false);
    }
  };

  // Group students by section for the dropdown
  const studentsBySection = sections.map(sec => ({
    section: sec,
    students: students.filter(s => s.sectionId === sec.id),
  })).filter(g => g.students.length > 0);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="text-base font-black text-gray-900">Grade Essay (Markahan ang Sanaysay)</h2>
            <p className="text-xs text-gray-400 mt-0.5">Upload student work for instant analysis</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 text-gray-400">
            <IoCloseOutline className="text-lg" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* File drop zone */}
          <div
            className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center gap-2 cursor-pointer transition-colors ${
              isDragging ? 'border-teal-400 bg-teal-50' : 'border-gray-200 hover:border-teal-300 bg-gray-50'
            }`}
            onDragEnter={() => setIsDragging(true)}
            onDragOver={e => e.preventDefault()}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
          >
            <input ref={fileRef} type="file" className="hidden" accept=".txt,.pdf,image/*" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
            <IoCloudUploadOutline className={`text-3xl ${isDragging ? 'text-teal-500' : 'text-gray-300'}`} />
            <div className="text-center">
              <div className="text-xs font-bold text-gray-700">{originalFile ? originalFile.name : 'Click or drag a file'}</div>
              <div className="text-[10px] text-gray-400">PDF, Image, or TXT · Max 10MB</div>
            </div>
          </div>

          {error && <div className="bg-red-50 text-red-600 text-xs font-bold px-3 py-2 rounded-xl border border-red-100">{error}</div>}

          {/* Student selector grouped by section */}
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
              Student (Mag-aaral)
            </label>
            <select
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-teal-400 appearance-none"
              value={studentId}
              onChange={e => setStudentId(e.target.value)}
            >
              <option value="">Select student…</option>
              {studentsBySection.map(({ section, students: sStudents }) => (
                <optgroup key={section.id} label={section.name}>
                  {sStudents.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Subject selector */}
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
              Subject (Paksa)
            </label>
            <select
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-teal-400 appearance-none"
              value={subjectId}
              onChange={e => setSubjectId(e.target.value)}
            >
              <option value="">Select subject…</option>
              {subjects.map(sub => (
                <option key={sub.id} value={sub.id}>
                  {sub.name} ({sub.language === 'english' ? '🇺🇸 EN' : '🇵🇭 FIL'})
                </option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
              Title (Pamagat) — optional
            </label>
            <input
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-teal-400"
              placeholder="e.g. Narrative Essay #1"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </div>

          {/* Text */}
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
              Content (Nilalaman)
            </label>
            <textarea
              className="w-full px-3 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-teal-400 resize-none min-h-[120px]"
              placeholder="Paste essay text here, or upload a file above…"
              value={text}
              onChange={e => setText(e.target.value)}
            />
          </div>
        </div>

        <div className="px-6 pb-6 pt-2 flex-shrink-0">
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-3 rounded-xl bg-teal-500 hover:bg-teal-600 disabled:bg-gray-100 disabled:text-gray-400 text-white font-black text-sm transition-colors flex items-center justify-center gap-2"
          >
            {isUploading ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Analyzing…</>
            ) : 'Analyze & Grade →'}
          </button>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 10.2: Verify TypeScript compiles**

```bash
cd /Volumes/Hanteck/Projects/readtrack && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 10.3: Commit**

```bash
cd /Volumes/Hanteck/Projects/readtrack
git add components/StudentGrading/SubjectManager.tsx components/StudentGrading/AddStudentModal.tsx components/StudentGrading/UploadModal.tsx
git commit -m "feat: add SubjectManager, AddStudentModal, and UploadModal components"
```

---

## Chunk 6: Main Orchestrator + Cleanup

### Task 11: StudentGrading/index.tsx — the main orchestrator

**Files:**
- Create: `components/StudentGrading/index.tsx`
- Delete: `components/StudentGrading.tsx` (after index.tsx is wired up)

This component owns all state, loads/saves data, and wires together all sub-components.

- [ ] **Step 11.1: Write index.tsx**

Create `components/StudentGrading/index.tsx`:

```tsx
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { IoMenuOutline, IoCloudUploadOutline } from 'react-icons/io5';

import { Section, Subject, Student, StudentEssay } from './types';
import {
  loadSections, saveSections,
  loadSubjects, saveSubjects,
  loadStudents, saveStudents,
  needsMigration,
} from './storage';
import { SetupScreen } from './SetupScreen';
import { MigrationModal } from './MigrationModal';
import { Sidebar } from './Sidebar';
import { StudentGrid } from './StudentGrid';
import { EssayPanel } from './EssayPanel';
import { SubjectManager } from './SubjectManager';
import { AddStudentModal } from './AddStudentModal';
import { UploadModal } from './UploadModal';

import { ProficiencyLevel, CachedAnalysis } from '../../types';
import { analyzeStudentWorkAPI, classifyTextComplexityAPI } from '../../services/pythonService';
import { saveStudentGradingUpload, saveTeacherEvaluation } from '../../services/supabaseService';

// Re-export the essay modal from the old file's logic — we keep the viewer intact
import { EssayViewerModal } from './EssayViewerModal';

interface StudentGradingProps {
  onMenuClick?: () => void;
  onSaveAnalysis?: (analysis: CachedAnalysis) => void;
  selectedAnalysis?: CachedAnalysis | null;
}

export const StudentGrading: React.FC<StudentGradingProps> = ({
  onMenuClick, onSaveAnalysis, selectedAnalysis,
}) => {
  // ── Data ──────────────────────────────────────────────
  const [sections, setSections] = useState<Section[]>(loadSections);
  const [subjects, setSubjects] = useState<Subject[]>(loadSubjects);
  const [students, setStudents] = useState<Student[]>(loadStudents);

  // ── Navigation state ──────────────────────────────────
  const [selectedSectionId, setSelectedSectionId] = useState<string>(sections[0]?.id ?? '');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(subjects[0]?.id ?? '');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedEssayId, setSelectedEssayId] = useState<string | null>(null);

  // ── UI state ──────────────────────────────────────────
  const [proficiencyFilter, setProficiencyFilter] = useState<ProficiencyLevel | 'all'>('all');
  const [sortKey, setSortKey] = useState<'newest' | 'oldest' | 'name' | 'essays'>('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSubjectManager, setShowSubjectManager] = useState(false);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showMigration, setShowMigration] = useState(() => needsMigration(loadStudents()));

  // ── Derived ───────────────────────────────────────────
  const needsSetup = sections.length === 0 || subjects.length === 0;
  const selectedSection = useMemo(() => sections.find(s => s.id === selectedSectionId) ?? null, [sections, selectedSectionId]);
  const selectedSubject = useMemo(() => subjects.find(s => s.id === selectedSubjectId) ?? null, [subjects, selectedSubjectId]);
  const selectedStudent = useMemo(() => students.find(s => s.id === selectedStudentId) ?? null, [students, selectedStudentId]);
  const selectedEssay = useMemo(() => selectedStudent?.essays.find(e => e.id === selectedEssayId) ?? null, [selectedStudent, selectedEssayId]);

  // ── Persist helpers ───────────────────────────────────
  const updateSections = useCallback((next: Section[]) => { setSections(next); saveSections(next); }, []);
  const updateSubjects = useCallback((next: Subject[]) => { setSubjects(next); saveSubjects(next); }, []);
  const updateStudents = useCallback((next: Student[]) => { setStudents(next); saveStudents(next); }, []);

  // ── Setup completion ──────────────────────────────────
  const handleSetupComplete = (section: Section, newSubjects: Subject[]) => {
    updateSections([section]);
    updateSubjects(newSubjects);
    setSelectedSectionId(section.id);
    setSelectedSubjectId(newSubjects[0].id);
  };

  // ── Migration completion ───────────────────────────────
  const handleMigrationComplete = (migrated: Student[]) => {
    updateStudents(migrated);
    setShowMigration(false);
  };

  // ── Section actions ───────────────────────────────────
  const handleCreateSection = (name: string) => {
    const section: Section = { id: Date.now().toString(), name };
    const next = [...sections, section];
    updateSections(next);
    setSelectedSectionId(section.id);
    setSelectedSubjectId(subjects[0]?.id ?? '');
    setSelectedStudentId(null);
    setSelectedEssayId(null);
  };

  const handleRenameSection = (id: string, name: string) => {
    updateSections(sections.map(s => s.id === id ? { ...s, name } : s));
  };

  const handleDeleteSection = (id: string) => {
    const name = sections.find(s => s.id === id)?.name ?? 'this section';
    if (!confirm(`Delete "${name}"?`)) return;
    const next = sections.filter(s => s.id !== id);
    updateSections(next);
    if (selectedSectionId === id) {
      setSelectedSectionId(next[0]?.id ?? '');
      setSelectedStudentId(null);
      setSelectedEssayId(null);
    }
  };

  // ── Subject actions ───────────────────────────────────
  const handleAddSubject = (subject: Subject) => {
    const next = [...subjects, subject];
    updateSubjects(next);
  };

  const handleRenameSubject = (id: string, name: string) => {
    updateSubjects(subjects.map(s => s.id === id ? { ...s, name } : s));
  };

  const handleDeleteSubject = (id: string) => {
    updateSubjects(subjects.filter(s => s.id !== id));
    if (selectedSubjectId === id) setSelectedSubjectId(subjects.find(s => s.id !== id)?.id ?? '');
  };

  // ── Student actions ───────────────────────────────────
  const handleAddStudent = (name: string) => {
    if (!selectedSectionId) return;
    const student: Student = { id: Date.now().toString(), name, sectionId: selectedSectionId, essays: [] };
    updateStudents([...students, student]);
  };

  const handleMoveStudent = (studentId: string, targetSectionId: string) => {
    updateStudents(students.map(s => s.id === studentId ? { ...s, sectionId: targetSectionId } : s));
    if (selectedStudentId === studentId) { setSelectedStudentId(null); setSelectedEssayId(null); }
  };

  const handleDeleteStudent = (studentId: string) => {
    if (!confirm('Delete this student and all their essays?')) return;
    updateStudents(students.filter(s => s.id !== studentId));
    if (selectedStudentId === studentId) { setSelectedStudentId(null); setSelectedEssayId(null); }
  };

  // ── Navigation actions ────────────────────────────────
  const handleSelectSubject = (sectionId: string, subjectId: string) => {
    setSelectedSectionId(sectionId);
    setSelectedSubjectId(subjectId);
    setSelectedStudentId(null);
    setSelectedEssayId(null);
  };

  const handleSelectStudent = (studentId: string) => {
    setSelectedStudentId(prev => prev === studentId ? null : studentId);
    setSelectedEssayId(null);
  };

  // ── Essay upload ──────────────────────────────────────
  const handleUpload = async (params: {
    studentId: string; subjectId: string; title: string; text: string;
    originalFile?: { base64: string; mimeType: string; name: string };
  }) => {
    const [diag, comp] = await Promise.all([
      analyzeStudentWorkAPI(params.text, params.originalFile?.base64),
      classifyTextComplexityAPI(params.text, params.originalFile?.base64),
    ]);

    const essay: StudentEssay = {
      id: Date.now().toString(),
      title: params.title,
      text: params.text,
      subjectId: params.subjectId,
      uploadedAt: new Date(),
      diagnosisResult: diag,
      complexityResult: comp,
      originalFile: params.originalFile,
    };

    const next = students.map(s =>
      s.id === params.studentId
        ? { ...s, essays: [essay, ...s.essays] }
        : s
    );
    updateStudents(next);

    // Supabase logging (fire-and-forget)
    saveStudentGradingUpload({ studentId: params.studentId, essay }).catch(console.error);

    // Navigate to the new essay
    setSelectedStudentId(params.studentId);
    setSelectedEssayId(essay.id);
    const student = next.find(s => s.id === params.studentId);
    if (student) setSelectedSectionId(student.sectionId);
    setSelectedSubjectId(params.subjectId);

    if (onSaveAnalysis) {
      onSaveAnalysis({
        id: essay.id,
        timestamp: essay.uploadedAt,
        title: essay.title,
        studentText: essay.text,
        diagnosisResult: diag,
        complexityResult: comp,
      });
    }
  };

  // ── Teacher evaluation ────────────────────────────────
  const handleSaveEvaluation = async (essayId: string, rating: number, comment: string) => {
    const next = students.map(s => ({
      ...s,
      essays: s.essays.map(e =>
        e.id === essayId ? { ...e, teacherRating: rating, teacherComment: comment } : e
      ),
    }));
    updateStudents(next);
    const student = next.find(s => s.essays.some(e => e.id === essayId));
    if (student) saveTeacherEvaluation({ studentId: student.id, essayId, rating, comment }).catch(console.error);
  };

  // ── selectedAnalysis recovery ──────────────────────────
  useEffect(() => {
    if (!selectedAnalysis) return;
    setShowUpload(true);
  }, [selectedAnalysis]);

  // ── Render guards ─────────────────────────────────────
  if (needsSetup) return <SetupScreen onComplete={handleSetupComplete} />;

  return (
    <div className="flex flex-col h-full bg-[#F2F2F7]">
      {/* Migration modal (blocking overlay) */}
      {showMigration && sections.length > 0 && subjects.length > 0 && (
        <MigrationModal
          students={students}
          sections={sections}
          subjects={subjects}
          onComplete={handleMigrationComplete}
        />
      )}

      {/* Header */}
      <header className="h-14 flex items-center justify-between px-5 border-b border-gray-100 bg-white shadow-sm flex-shrink-0">
        <div className="flex items-center gap-2">
          {onMenuClick && (
            <button onClick={onMenuClick} className="md:hidden text-gray-500 hover:text-gray-700">
              <IoMenuOutline className="text-2xl" />
            </button>
          )}
          <span className="text-sm font-black text-gray-900">
            Student Grading <span className="text-gray-400 font-normal text-xs">(Pagmamarka ng Mag-aaral)</span>
          </span>
          <span className="text-[10px] font-semibold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
            {students.length}
          </span>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-xs font-bold transition-colors"
        >
          <IoCloudUploadOutline className="text-base" />
          Upload Essay
        </button>
      </header>

      {/* Three-panel body */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          sections={sections}
          subjects={subjects}
          students={students}
          selectedSectionId={selectedSectionId}
          selectedSubjectId={selectedSubjectId}
          onSelectSubject={handleSelectSubject}
          onCreateSection={handleCreateSection}
          onRenameSection={handleRenameSection}
          onDeleteSection={handleDeleteSection}
          onManageSubjects={() => setShowSubjectManager(true)}
        />

        <StudentGrid
          students={students}
          sections={sections}
          selectedSection={selectedSection}
          selectedSubject={selectedSubject}
          selectedStudentId={selectedStudentId}
          proficiencyFilter={proficiencyFilter}
          sortKey={sortKey}
          searchQuery={searchQuery}
          onSelectStudent={handleSelectStudent}
          onAddStudent={() => setShowAddStudent(true)}
          onMoveStudent={handleMoveStudent}
          onDeleteStudent={handleDeleteStudent}
          onProficiencyFilter={setProficiencyFilter}
          onSortChange={setSortKey}
          onSearchChange={setSearchQuery}
        />

        <EssayPanel
          student={selectedStudent}
          selectedSubject={selectedSubject}
          selectedEssayId={selectedEssayId}
          onSelectEssay={setSelectedEssayId}
          onUploadEssay={() => setShowUpload(true)}
        />
      </div>

      {/* Modals */}
      {showSubjectManager && (
        <SubjectManager
          subjects={subjects}
          students={students}
          onAdd={handleAddSubject}
          onRename={handleRenameSubject}
          onDelete={handleDeleteSubject}
          onClose={() => setShowSubjectManager(false)}
        />
      )}

      {showAddStudent && selectedSection && (
        <AddStudentModal
          section={selectedSection}
          onAdd={handleAddStudent}
          onClose={() => setShowAddStudent(false)}
        />
      )}

      {showUpload && (
        <UploadModal
          students={students}
          sections={sections}
          subjects={subjects}
          prefilledStudentId={selectedStudentId ?? undefined}
          prefilledSubjectId={selectedSubjectId ?? undefined}
          onUpload={handleUpload}
          onClose={() => setShowUpload(false)}
        />
      )}

      {selectedEssay && selectedStudent && (
        <EssayViewerModal
          student={selectedStudent}
          essay={selectedEssay}
          subject={selectedSubject}
          onSaveEvaluation={handleSaveEvaluation}
          onClose={() => setSelectedEssayId(null)}
        />
      )}
    </div>
  );
};
```

- [ ] **Step 11.2: Verify TypeScript compiles**

```bash
cd /Volumes/Hanteck/Projects/readtrack && npx tsc --noEmit 2>&1 | head -20
```

Expected: one error — `EssayViewerModal` not yet created. Proceed to Task 12.

---

### Task 12: EssayViewerModal.tsx — extract from old StudentGrading.tsx

**Files:**
- Create: `components/StudentGrading/EssayViewerModal.tsx`

This extracts the essay detail modal (analysis tabs, grammar, teacher rating, side-by-side view) from the existing `StudentGrading.tsx` with minimal changes. The interior is unchanged per spec.

- [ ] **Step 12.1: Identify the essay modal JSX in the old file**

Open `components/StudentGrading.tsx` and find the block that renders the full-screen essay viewer modal (the section with analysis tabs, grammar issues list, teacher rating stars, and side-by-side original/scanned view). It starts around the `selectedEssay &&` conditional render.

- [ ] **Step 12.2: Create EssayViewerModal.tsx**

Create `components/StudentGrading/EssayViewerModal.tsx` with the following shell, then move the relevant JSX from the old file into it:

```tsx
import React, { useState } from 'react';
import { Student, Subject, StudentEssay } from './types';
// import all icons and services that the old modal used

interface EssayViewerModalProps {
  student: Student;
  essay: StudentEssay;
  subject: Subject | null;
  onSaveEvaluation: (essayId: string, rating: number, comment: string) => Promise<void>;
  onClose: () => void;
}

export const EssayViewerModal: React.FC<EssayViewerModalProps> = ({
  student, essay, subject, onSaveEvaluation, onClose,
}) => {
  // Move all modal state and JSX from old StudentGrading.tsx here.
  // Keys to preserve:
  // - Tab switching: 'original' | 'analysis'
  // - Side-by-side view toggle (essayViewMode)
  // - Teacher rating stars + comment + save button (calls onSaveEvaluation)
  // - Grammar issues list with highlights
  // - Performance metrics grid (Result, Proficiency, Grammar Accuracy, etc.)
  // - Tagalog label translations already on each label

  return (
    <div className="fixed inset-0 z-50 ...">
      {/* modal content extracted from old StudentGrading.tsx */}
    </div>
  );
};
```

> **Note:** The full implementation of this modal already exists in `components/StudentGrading.tsx` (the old file). Extract it — do not rewrite it from scratch. Copy the modal JSX, adapt the props, and verify it renders.

- [ ] **Step 12.3: Verify TypeScript compiles cleanly**

```bash
cd /Volumes/Hanteck/Projects/readtrack && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 12.4: Start dev server and verify basic render**

```bash
cd /Volumes/Hanteck/Projects/readtrack && npm run dev
```

Open http://localhost:5173. Expected:
- If no sections/subjects exist: setup screen appears (Step 1 — Create Section).
- Complete setup: Step 2 — Add Subject with name + language dropdown.
- After setup: three-panel layout appears with sidebar, empty student grid, no essay panel.

- [ ] **Step 12.5: Verify section creation**

In the sidebar, click "+ New Section". Type a name, press Enter.
Expected: section appears in sidebar tree, expands to show subjects.

- [ ] **Step 12.6: Verify subject management**

Click "⚙ Subjects" in the sidebar header. Add a subject with name + language. Save.
Expected: subject appears under the section in the sidebar.

- [ ] **Step 12.7: Verify student add and selection**

Click the "+ Add Student" dashed card. Type a name, submit.
Expected: student card appears in the grid.
Click the student card.
Expected: essay panel slides in from the right showing the student's name.

- [ ] **Step 12.8: Verify essay upload**

Click "+ Upload for [student]" in the essay panel. Fill in subject, paste text, submit.
Expected: analysis runs, essay appears in the panel, clicking it opens the essay viewer modal.

- [ ] **Step 12.9: Delete old StudentGrading.tsx**

```bash
rm /Volumes/Hanteck/Projects/readtrack/components/StudentGrading.tsx
```

- [ ] **Step 12.10: Verify build succeeds**

```bash
cd /Volumes/Hanteck/Projects/readtrack && npm run build 2>&1 | tail -20
```

Expected: build completes with no errors.

- [ ] **Step 12.11: Commit everything**

```bash
cd /Volumes/Hanteck/Projects/readtrack
git add components/StudentGrading/
git rm components/StudentGrading.tsx
git commit -m "feat: StudentGrading redesign — Section › Subject › Student › Essays hierarchy"
```

---

## Final Checklist

- [ ] Setup screen blocks access until at least one section AND one subject are created
- [ ] Migration modal appears if any existing student lacks sectionId or essay lacks subjectId
- [ ] Sidebar shows sections with expandable subject lists; ⋯ menu renames/deletes (delete blocked if students exist)
- [ ] Switching section or subject closes the essay panel and clears selected student
- [ ] Student grid shows 2-col cards; ⋯ menu moves student to another section or deletes
- [ ] Essay panel slides in on student select, hidden when no student selected
- [ ] Subject manager blocks deletion if essays are tagged
- [ ] Upload modal groups students by section in the dropdown
- [ ] Essay viewer modal (extracted from old file) renders with all tabs intact
- [ ] `npm run build` passes with no errors
