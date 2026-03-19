# Student Grading Split-Pane Workspace Design

Date: 2026-03-17
Project: ReadTrack
Scope: Student grading desktop workspace redesign
Process: superpowers brainstorming

## 1. Context And Goal

ReadTrack needs a major UI redesign for the student grading experience with these priorities:

- Primary goal: make teacher workflows faster and easier to scan.
- Target flow to optimize first: student grading and essay review.
- Required outcomes: clearer step-by-step grading flow and stronger student organization.
- Redesign level: major redesign (new app-like workspace experience).

## 2. Chosen Product Direction

### 2.1 Workspace model

The grading screen will use a desktop-first split-pane teacher workspace.

- Left pane: organization and navigation
- Center pane: essay reading and analysis tabs
- Right pane: insight-first grading actions

### 2.2 Key choices confirmed

- Approach selected: progressive shell-first redesign (not a big-bang rewrite).
- Left pane priority: organization-first (section/subject filters first).
- Center default tab: original essay text.
- Right pane mode: insight-first (key metrics at top, grading actions below).
- Device strategy: desktop-first now, mobile simplification later.

## 3. Alternative Approaches Considered

### A. Full page rewrite

Pros:
- Cleanest architecture
- Strongest single-step UX shift

Cons:
- Highest risk and regression surface
- Longer stabilization window

### B. Progressive shell-first redesign (selected)

Pros:
- Lower delivery risk
- Easier incremental validation
- Better continuity with existing backend and data logic

Cons:
- Temporary mixed old/new internals during migration

### C. Hybrid overlay redesign

Pros:
- Fastest first visual change

Cons:
- Accumulates UI debt
- Fragile long-term maintainability

Recommendation rationale:
Approach B balances major UX improvement with controlled rollout and reduced regression risk.

## 4. Interaction And Layout Design

### 4.1 Global workspace shell

- Three-pane desktop layout.
- Left and right panes remain visible while center content scrolls.
- No modal-heavy flow for core grading actions.

### 4.2 Left pane (organization-first)

Order and behavior:

1. Section and subject filters (primary controls)
2. Student list scoped by active filters
3. Essay history for the selected student

Supporting behavior:

- Search control stays visible for jump-to-student workflows.
- Selected student and selected essay have clear active visual state.
- Switching filters preserves context where possible.

### 4.3 Center pane (reading-first)

Tab model:

- Default: Original Essay
- Secondary: Extracted Text
- Secondary: Analysis

Flow intent:

- Teacher opens essay and reads source first.
- Teacher can compare extraction quality as needed.
- Teacher can move to analysis tab without losing context.

### 4.4 Right pane (insight-first actions)

Vertical stack:

1. Key metrics summary (proficiency, complexity, important indicators)
2. Grading controls (rating and structured notes)
3. Save actions (including optional save-and-next)

Design objective:

- Put decision-support data above manual grading actions.

## 5. Technical Design And Migration Plan

### Phase 1: Layout shell extraction

- Create stable three-pane structure in student grading screen.
- Keep existing data logic and API wiring unchanged.
- Relocate existing UI blocks into pane containers.

### Phase 2: Left pane refactor

- Reorder controls to organization-first model.
- Preserve existing organization CRUD behavior.
- Improve selected state styling for student and essay focus.

### Phase 3: Center tab standardization

- Implement deterministic tab model.
- Ensure original essay is default on open.
- Preserve upload and analysis actions near content area.

### Phase 4: Right pane insight-first actions

- Move metrics summary to top.
- Keep existing rating/comment save logic.
- Add explicit save feedback and optional save-and-next.

### Phase 5: Stabilization and polish

- Improve keyboard and focus flow for rapid grading.
- Add pane-scoped loading and empty states.
- Keep desktop-first behavior as the current target.

## 6. Error Handling And Validation Design

### 6.1 Pane-scoped resilience

- Left pane failures show inline retry without collapsing workspace.
- Center pane failures preserve current essay visibility.
- Right pane save failures preserve teacher input and offer retry.

### 6.2 Unsaved state protections

- Prevent silent loss of rating/comment edits.
- Prompt before student or essay switch when unsaved edits exist.
- Disable conflicting actions during in-flight save/analyze operations.

### 6.3 Feedback model

- Action-local success and error feedback.
- Explicit save confirmation with time/context signal.
- Actionable error messages with direct next step.

### 6.4 Validation

- Frontend pre-checks for required grading inputs.
- Backend remains source of truth for payload validation.
- Graceful handling for partial or missing analysis payloads.

## 7. Testing Strategy

### 7.1 Component tests

- Pane rendering and state transitions.
- Active student and essay selection behavior.
- Tab default behavior and persistence rules.

### 7.2 Interaction tests

- Select student -> open essay -> analyze -> rate -> save.
- Unsaved edit protection on navigation.
- Filter persistence and scoped list updates.

### 7.3 Regression tests

- Existing API workflows still function under new shell.
- Save and history behaviors remain correct.
- No data-loss regressions for comments or ratings.

### 7.4 Visual checks

- Desktop split-pane layout at key breakpoints.
- Empty/loading/error states per pane.

## 8. Out Of Scope (This Cycle)

- Full mobile redesign.
- Material library redesign.
- Dashboard redesign.
- Deep backend model logic changes.

## 9. Success Criteria

- Teacher can complete grading without leaving one workspace screen.
- Organization flow is filter-first and visibly faster to navigate.
- Original essay remains primary reading context by default.
- Key insights are available before grading actions.
- No regression in existing save/history logic.

## 10. Implementation Transition Gate

Next required step after final spec approval:

- Invoke writing-plans skill to produce a detailed, testable implementation plan.
