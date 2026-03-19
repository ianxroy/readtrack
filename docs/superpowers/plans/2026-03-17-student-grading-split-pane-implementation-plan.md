# Student Grading Split-Pane Implementation Plan

Date: 2026-03-17
Project: ReadTrack
Input Spec: docs/superpowers/specs/2026-03-17-student-grading-split-pane-workspace-design.md
Scope: Frontend-first rollout for the student grading screen with no backend schema changes.

## 1. Delivery Strategy

Implementation mode: progressive shell-first migration.

Principles:

- Keep existing Supabase and Python service contracts stable.
- Move UI into a new three-pane shell before changing deeper interaction behavior.
- Deliver one reversible phase at a time with explicit acceptance checks.

## 2. Target Files And Responsibilities

Primary edit targets:

- components/StudentGrading.tsx
  - Split into pane-oriented layout and orchestrator state.
  - Introduce center tab default = original essay.
  - Add pane-scoped loading/error/empty states.
  - Add unsaved-change guard when switching student/essay.
- services/supabaseService.ts
  - Keep existing APIs; optionally add small helper wrappers for status-rich returns if needed by pane feedback.
  - Preserve updateEssayTeacherRating and loadStudentUploads signatures unless unavoidable.
- services/pythonService.ts
  - Keep existing API methods; ensure caller-side timeout/error display behavior is standardized in StudentGrading.
- types.ts
  - Add optional UI-focused types if needed (view state unions, tab ids, async status type).

Optional extraction targets (recommended during phase 2+):

- components/student-grading/StudentFiltersPane.tsx
- components/student-grading/EssayContentPane.tsx
- components/student-grading/InsightsGradingPane.tsx
- components/student-grading/types.ts

## 3. State And Data-Flow Blueprint

## 3.1 View state model

Introduce explicit local UI state groups in StudentGrading:

- Selection state:
  - selectedSection
  - selectedSubject
  - selectedStudentId
  - selectedEssayId
- Center state:
  - activeCenterTab: 'original' | 'extracted' | 'analysis'
  - rule: reset to 'original' on essay selection change
- Grading draft state:
  - draftRating
  - draftComment
  - isDirty
- Async status state:
  - leftPaneStatus, centerPaneStatus, rightPaneStatus
  - shape: 'idle' | 'loading' | 'ready' | 'error'
  - error messages tracked per pane

## 3.2 Derived data pipeline

Derived selectors (useMemo):

- filteredStudents from org filters + search + optional proficiency filter
- selectedStudent from filtered/global students
- selectedEssay from selectedStudent.essays
- metricsSummary from selectedEssay diagnosis/complexity payloads

Rules:

- Selection precedence: filters -> student -> essay.
- If selected student disappears after filter change, move to first visible student.
- If selected essay disappears, select most recent essay of the selected student.

## 3.3 Action flows

### Open essay flow

1. User selects student in left pane.
2. System resolves essay list and active essay.
3. System sets activeCenterTab = 'original'.
4. Right pane loads metric summary and grading draft.

### Save grading flow

1. User updates rating/comment in right pane.
2. Set isDirty = true.
3. User clicks Save (or Save and Next).
4. Call updateEssayTeacherRating.
5. On success: set isDirty = false and show local success indicator.
6. On failure: preserve draft and show retry error in right pane.

### Navigation guard flow

1. User tries switching student/essay while isDirty.
2. Show confirm dialog with options: Discard, Cancel, Save then Continue.
3. Resolve based on user choice.

## 4. Phase Plan

## Phase 1: Shell And Selection Stability

Goal: ship three-pane shell with stable selection behavior and no functional regressions.

Implementation tasks:

- Reorganize JSX in StudentGrading into left/center/right panes.
- Replace modal-centric essay navigation with persistent pane layout.
- Introduce selectedEssayId and activeCenterTab with default 'original'.
- Keep existing analyze/save handlers functional through the new layout.

Acceptance checks:

- Teacher can select a student and essay without modals.
- Original essay tab is the default every time essay changes.
- Existing data loads from Supabase exactly as before.

## Phase 2: Organization-First Left Pane

Goal: optimize discovery and routing with section/subject-first controls.

Implementation tasks:

- Place section/subject filters at top of left pane.
- Keep searchable, scrollable student list below filters.
- Keep essay history for selected student visible in left pane.
- Add strong selected states and count badges where useful.

Acceptance checks:

- Filtering updates visible student list and keeps deterministic selection behavior.
- Search combines correctly with active filters.
- Teachers can jump from filter to target student in two interactions.

## Phase 3: Reading-First Center Pane

Goal: make source reading primary while preserving extraction and analysis access.

Implementation tasks:

- Implement fixed tab set: Original, Extracted, Analysis.
- Render original text as default content pane.
- Keep upload/analyze triggers adjacent to center content actions.
- Add pane-specific loading and error wrappers.

Acceptance checks:

- Tab switching is instant and preserves selection context.
- Original tab is always default on essay open.
- Center pane errors do not collapse left or right panes.

## Phase 4: Insight-First Right Pane And Save Flow

Goal: present decision-support metrics before grading controls.

Implementation tasks:

- Move summary metrics block to top of right pane.
- Place rating + comment editor beneath metrics.
- Add Save and optional Save and Next action row.
- Add unsaved-change guard for cross-essay and cross-student navigation.
- Add optimistic pending state for save actions.

Acceptance checks:

- Save preserves user input on failures.
- Success/failure feedback appears near action controls.
- Save and Next advances to next essay or next student deterministically.

## Phase 5: Stabilization, Accessibility, And Performance

Goal: polish interaction quality for high-volume teacher workflows.

Implementation tasks:

- Keyboard support for pane traversal and essay selection.
- Focus management after save/navigation/dialog close.
- Debounce search input in left pane.
- Reduce unnecessary re-renders with memoization and stable callbacks.
- Add empty-state and retry affordances per pane.

Acceptance checks:

- No visible lag on large student lists.
- Keyboard-only grading is practical for core flow.
- Pane-level failures recover without full-screen resets.

## 5. Test Checklist By Phase

## Phase 1 Tests

- Unit: selected student/essay reducer or handlers
- Unit: center tab reset to original on essay switch
- Integration: loadStudentUploads -> render three panes
- Manual: smoke test existing upload/analyze/save actions in new shell

## Phase 2 Tests

- Unit: filter + search combined selector correctness
- Integration: section/subject changes recalc visible students
- Manual: switch filters rapidly while preserving valid selection

## Phase 3 Tests

- Unit: tab rendering and fallback content rules
- Integration: extract/analyze responses render in the proper tab panels
- Manual: center-pane error fallback does not break left/right operations

## Phase 4 Tests

- Unit: dirty-state transitions for rating/comment edits
- Integration: save success + save failure + retry behavior
- Integration: unsaved-change guard branching (discard/cancel/save)
- Manual: Save and Next across end-of-list edge cases

## Phase 5 Tests

- Unit: keyboard navigation handlers and focus targets
- Integration: pane loading/error/empty states
- Manual: performance spot-check with high student/essay volume

## 6. Risks And Mitigations

- Risk: selection bugs during refactor.
  - Mitigation: isolate selection logic and test with deterministic fixtures.
- Risk: data loss from unsaved grading edits.
  - Mitigation: enforce dirty guard on all selection-changing actions.
- Risk: runtime errors from partially missing diagnosis/complexity payloads.
  - Mitigation: null-safe metric selectors with fallback labels.
- Risk: regressions in Supabase update path.
  - Mitigation: keep service contract stable and verify end-to-end save path each phase.

## 7. Definition Of Done

- Three-pane grading workspace is the default desktop experience.
- Left pane is organization-first and supports fast student targeting.
- Original essay is the default center context on essay open.
- Right pane surfaces metrics before grading inputs.
- Unsaved edits are never silently lost.
- Existing backend service contracts remain compatible.
- Phase test checklist passes, including manual regression verification.

## 8. Suggested Commit Sequence

1. feat(student-grading): add split-pane shell and stable selection model
2. feat(student-grading): refactor organization-first left pane
3. feat(student-grading): add center tab standardization and defaults
4. feat(student-grading): add insight-first right pane and guarded save flow
5. chore(student-grading): polish a11y, performance, and pane fallbacks
