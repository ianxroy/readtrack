# Student Grading Redesign — Section › Subject › Student › Essays

**Date:** 2026-03-17
**Status:** Approved by user

---

## Overview

Redesign the Student Grading component to organize data and navigation around a clear four-level hierarchy: **Section → Subject → Student → Essays**. The current flat student list with no section or subject grouping makes it hard to manage a full class roster across multiple subjects.

---

## Data Model

### New: `Section`
Stored in localStorage under `readtrack_sections`.

```ts
interface Section {
  id: string;       // timestamp-based uid
  name: string;     // e.g. "Grade 7 – Rizal"
}
```

### New: `Subject`
Global — shared across all sections. Stored in localStorage under `readtrack_subjects`.

```ts
interface Subject {
  id: string;
  name: string;                    // e.g. "English", "AP", "Filipino", "Math"
  language: 'english' | 'filipino'; // grading language tag
}
```

Default subjects seeded on first load: English (english), Filipino (filipino), AP (filipino), Math (english).

### Modified: `Student`
Add `sectionId` field. Stored in `readtrack_student_essays` (existing key, no migration needed beyond adding the field).

```ts
interface Student {
  id: string;
  name: string;
  sectionId: string;  // NEW — references a Section.id
  essays: StudentEssay[];
}
```

A student belongs to exactly one section.

### Modified: `StudentEssay`
Add `subjectId` field.

```ts
interface StudentEssay {
  id: string;
  title: string;
  text: string;
  subjectId: string;           // NEW — references a Subject.id
  uploadedAt: Date;
  diagnosisResult?: StudentDiagnosisResult;
  complexityResult?: TextComplexityResult;
  teacherRating?: number;
  teacherComment?: string;
  originalFile?: { base64: string; mimeType: string; name: string };
}
```

---

## UI Layout

Three-area layout inside the existing page shell:

```
┌──────────────┬──────────────────────────┬──────────────┐
│   SIDEBAR    │      STUDENT GRID        │ ESSAY PANEL  │
│   ~200px     │      flex: 1             │   ~210px     │
│              │                          │              │
│  Sections    │  Gr. 7–Rizal › English   │  Juan D.C.   │
│  ▾ Gr7 Rizal │  [proficiency filters]   │  ─────────   │
│    🇺🇸 English│  ┌──────┐ ┌──────┐     │  Essay 1     │
│    🇵🇭 Filipino│  │ Juan │ │Maria│     │  Essay 2     │
│    🇵🇭 AP    │  └──────┘ └──────┘     │  Essay 3     │
│    🇺🇸 Math  │  ┌──────┐ ┌──────┐     │  ──────────  │
│  ▸ Gr7 Bon.  │  │Pedro │ │ Ana  │     │  + Upload    │
│  ▸ Gr8 Luna  │  └──────┘ └──────┘     │              │
│  ──────────  │  ┌──────┐              │              │
│  + New Sec.  │  │  +   │              │              │
└──────────────┴──────────────────────────┴──────────────┘
```

### Sidebar
- Lists all sections; each is expandable/collapsible (chevron toggle).
- Expanded section shows the global subject list beneath it, indented, each with a language pill (🇺🇸 / 🇵🇭).
- Clicking a subject row selects it — updates the center grid to show students in that section who have essays for that subject.
- "+ New Section" button at the bottom.
- "Manage Subjects" button in the page header (opens a modal to add/rename/delete subjects globally and set their language tag).

### Student Grid (center)
- Breadcrumb at top: `Section Name › Subject Name [lang pill] · N students`
- Proficiency filter pills: All / Independent / Instructional / Frustration
- Sort dropdown: Newest / Oldest / Name A–Z / Most essays
- Student cards in a 2-column responsive grid. Each card shows:
  - Student name
  - Essay count for the selected subject · avg teacher rating
  - Latest proficiency badge (Independent / Instructional / Frustration)
- Selected card has indigo border + highlight.
- Last card in grid is an "+ Add Student" dashed card that opens the add-student modal.
- Empty state when no students in section: prompt to add students.

### Essay Panel (right, slides in on student select)
- Header: student name + section · subject
- Scrollable essay list. Each item shows:
  - Essay title
  - Proficiency badge, result score %, teacher star rating
  - Upload date
- Active essay highlighted with indigo border.
- "+ Upload Essay for [student name]" button at the bottom.
- Panel is hidden (zero-width) when no student is selected; slides in with CSS transition when a student is clicked.

### Essay Viewer (full-screen modal)
- Opens when an essay is clicked from the essay panel.
- Unchanged from the current implementation: tabs for Original Submission, Analysis, Grammar Issues, Teacher Rating.
- Header shows: essay title · student name · subject name.
- Close button returns to the three-panel view (no state is lost).

---

## Interactions

### Creating a Section
1. Click "+ New Section" in sidebar or "+ Add" label.
2. Inline input appears in sidebar — type name, press Enter or click ✓.
3. Section saved to localStorage, sidebar updates.

### Managing Subjects
1. Click "⚙ Manage Subjects" in page header.
2. Modal lists all global subjects with their language tag.
3. Teacher can add new subject (name + language dropdown: English 🇺🇸 / Filipino 🇵🇭), rename, or delete.
4. Deleting a subject that has essays attached shows a warning: "X essays are tagged to this subject. Deleting it will remove the subject tag from those essays."

### Adding a Student
1. Click the "+ Add Student" dashed card in the student grid.
2. Modal: name field + section pre-selected to the current sidebar selection.
3. Student saved with `sectionId` set.

### Uploading an Essay
1. Click "+ Upload Essay" in the essay panel (pre-fills student and subject from context), OR click the global "＋ Upload Essay" button in the header (requires selecting student and subject manually).
2. Upload modal fields:
   - Student (dropdown, pre-filled if coming from panel)
   - Subject (dropdown of all global subjects, pre-filled if coming from panel)
   - Essay title
   - File upload zone (PDF, image, TXT) or text paste area
3. After upload + analysis, essay appears in the panel.

### Selecting Section/Subject/Student
- Selecting a section collapses all others and expands the clicked one; defaults to the first subject.
- Switching subject updates the student grid immediately (no loading state — purely filtered from in-memory data).
- Clicking a student selects them and slides in the essay panel; clicking again deselects and hides the panel.

---

## Backward Compatibility

Existing students in localStorage have no `sectionId`. On load, any student missing `sectionId` is placed into an auto-created "Unassigned" section. The teacher can then reassign them via the student card menu (⋯ → Move to section).

Existing essays have no `subjectId`. They are treated as having `subjectId: null` and shown under an "Unassigned" pseudo-subject in the sidebar. Teacher can re-tag them.

---

## What Does NOT Change

- The essay viewer modal interior (analysis tabs, grammar highlights, teacher rating, side-by-side original/scanned view).
- The backend API calls (`analyzeStudentWorkAPI`, `classifyTextComplexityAPI`, `checkGrammar`).
- Supabase save functions (`saveStudentGradingUpload`, `saveTeacherEvaluation`).
- Tagalog label translations already added in the previous session.
- The "Result (Resulta)" score label rename.

---

## Out of Scope

- Cross-section student transfers (can be added later).
- Subject-level analytics or class averages dashboard (separate feature).
- Server-side persistence of sections/subjects (currently localStorage only).
