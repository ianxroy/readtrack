# Student Grading Redesign — Section › Subject › Student › Essays

**Date:** 2026-03-17
**Status:** Approved by user

---

## Overview

Redesign the Student Grading component to organize data and navigation around a clear four-level hierarchy: **Section → Subject → Student → Essays**. The current flat student list with no section or subject grouping makes it hard to manage a full class roster across multiple subjects.

**Core rule: every student must belong to a section. Sectionless students are not allowed.**

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

No sentinel values. Sections are always real, teacher-created entries.

### New: `Subject`
Global — shared across all sections. Stored in localStorage under `readtrack_subjects`.

```ts
interface Subject {
  id: string;
  name: string;                     // e.g. "English", "AP", "Filipino", "Math"
  language: 'english' | 'filipino'; // which grammar model to use for essay analysis
}
```

`language` controls which LanguageTool grammar model is invoked during analysis — `'english'` for English-language essays, `'filipino'` for Filipino-language essays. It does **not** refer to the subject's teaching language.

Default subjects seeded on first load (if `readtrack_subjects` is empty):

| Name     | language   | Rationale |
|----------|-----------|-----------|
| English  | english   | Essays written in English |
| Filipino | filipino  | Essays written in Filipino |
| AP       | filipino  | Araling Panlipunan essays typically in Filipino |
| Math     | english   | Math written responses typically in English |

No sentinel values.

### Modified: `Student`
Add `sectionId` field. Stored in `readtrack_student_essays` (existing key).

```ts
interface Student {
  id: string;
  name: string;
  sectionId: string;  // required — must reference a valid Section.id
  essays: StudentEssay[];
}
```

`sectionId` is always set and always references a real section. There is no optional or unassigned state.

### Modified: `StudentEssay`
Add `subjectId` field. `uploadedAt` is stored as ISO 8601 string in localStorage and parsed to `Date` on load.

```ts
interface StudentEssay {
  id: string;
  title: string;
  text: string;
  subjectId: string;           // required — must reference a valid Subject.id
  uploadedAt: Date;            // stored as ISO string, parsed on load
  diagnosisResult?: StudentDiagnosisResult;
  complexityResult?: TextComplexityResult;
  teacherRating?: number;
  teacherComment?: string;
  originalFile?: { base64: string; mimeType: string; name: string };
}
```

---

## App Startup Sequence

On first launch (no sections exist yet):

1. App shows a **blocking "Create your first section" screen** before anything else is accessible.
2. Teacher types a section name and clicks Create.
3. App proceeds to the main three-panel view with that section selected.

This ensures no student can ever be created without a section.

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
- Clicking a subject row selects it — updates the center grid.
- Each section row has a `⋯` context menu (appears on hover) with:
  - **Rename** — inline edit → Enter to save.
  - **Delete** — only allowed if the section has **zero students**. If students exist, the option is disabled with tooltip: "Move or delete all students first."
- "+ New Section" button at the bottom of the sidebar.
- "⚙ Manage Subjects" button in the page header.

### Student Grid (center)
- Breadcrumb at top: `Section Name › Subject Name [lang pill] · N students`
- Proficiency filter pills: All / Independent / Instructional / Frustration
- Sort dropdown: Newest / Oldest / Name A–Z / Most essays
- Student cards in a 2-column responsive grid. Each card shows:
  - Student name
  - Essay count for the selected subject · avg teacher rating
  - Latest proficiency badge (Independent / Instructional / Frustration)
  - `⋯` menu (hover): **Move to section** (opens section picker — shows all sections except current), **Delete student**
- Selected card has indigo border + highlight.
- Last card in grid is a "+ Add Student" dashed card that opens the add-student modal.
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
1. Click "+ New Section" at the bottom of the sidebar.
2. Inline input appears — type name, press Enter or click ✓ to save, Escape to cancel.
3. Section saved to `readtrack_sections`, sidebar updates. New section auto-selected.

### Renaming a Section
- Click `⋯` on the section row → Rename → inline edit → Enter to save.

### Deleting a Section
- Click `⋯` → Delete.
- **Blocked if the section has any students.** A tooltip/message reads: "Move or delete all students in this section before deleting it."
- If section is empty: confirmation dialog "Delete [name]?" → confirm → section removed.

### Managing Subjects
1. Click "⚙ Manage Subjects" in page header.
2. Modal lists all global subjects with their language tag.
3. Teacher can:
   - **Add** a new subject: name field + language dropdown (English 🇺🇸 / Filipino 🇵🇭).
   - **Rename** an existing subject inline.
   - **Delete** a subject:
     - If no essays are tagged to it: delete immediately.
     - If essays are tagged: blocked. Message: "X essays are tagged to this subject. Re-tag or delete those essays first."

### Adding a Student
1. Click the "+ Add Student" dashed card in the student grid.
2. Modal: name field. Section is pre-set to the currently selected section (shown read-only).
3. Student saved with the correct `sectionId`. Section is required and always set.

### Moving a Student to Another Section
- Student card `⋯` menu → "Move to section" → dropdown of all sections (excluding current) → confirm.
- Updates `student.sectionId`. Student disappears from the current grid and appears in the target section.

### Uploading an Essay
1. Click "+ Upload Essay for [student]" in the essay panel (pre-fills student + subject from context), OR click the global "＋ Upload Essay" button in the header.
2. Upload modal fields:
   - Student (dropdown showing all students; grouped by section; pre-filled if coming from panel)
   - Subject (dropdown of all global subjects; pre-filled if coming from panel)
   - Essay title
   - File upload zone (PDF, image, TXT) or text paste area
3. After upload + analysis, essay appears in the panel.

### Selecting Section / Subject / Student
- Clicking a section row expands it (collapses all others) and auto-selects the first subject. The essay panel closes and selected student is cleared.
- Switching subject updates the student grid immediately (in-memory filter, no loading state). The essay panel closes and selected student is cleared.
- Clicking a student selects them and slides in the essay panel; clicking the same student again deselects and hides the panel.

---

## Backward Compatibility

On load, `loadStudents()` checks for students missing `sectionId` or essays missing `subjectId`. If any are found:

- A **one-time migration modal** appears before the main UI, listing all affected students/essays.
- The teacher must assign each orphaned student to a section and each untagged essay to a subject before proceeding.
- The modal cannot be dismissed without completing all assignments.
- Once complete, the data is saved to localStorage and the main UI loads normally.

This ensures the invariant (every student has a section, every essay has a subject) is enforced from the very first load after the upgrade.

---

## What Does NOT Change

- The essay viewer modal interior (analysis tabs, grammar highlights, teacher rating, side-by-side original/scanned view).
- The backend API calls (`analyzeStudentWorkAPI`, `classifyTextComplexityAPI`, `checkGrammar`).
- Supabase save functions (`saveStudentGradingUpload`, `saveTeacherEvaluation`).
- Tagalog label translations already added.
- The "Result (Resulta)" score label rename.

---

## Out of Scope

- Subject-level analytics or class averages dashboard (separate feature).
- Server-side persistence of sections/subjects (currently localStorage only).
