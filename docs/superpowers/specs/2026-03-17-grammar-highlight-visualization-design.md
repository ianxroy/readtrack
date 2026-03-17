# Grammar Highlight Visualization — Design Spec

**Date:** 2026-03-17
**Feature:** Grammarly-style inline grammar issue visualization in EssayViewerModal
**Scope:** Visualization only — no corrections applied, no new backend calls

---

## Overview

When a student essay has been analyzed (`diagnosisResult.issues[]` is non-empty), the Original Submission tab in `EssayViewerModal` highlights problematic phrases inline with colored background spans and hover tooltips. The existing issues grid at the bottom of the Analysis tab is removed, as the inline highlighting makes it redundant.

---

## Visual Design

**Highlight style:** Background color fill (Option B from brainstorm)

| Issue category | Background | Text color |
|---|---|---|
| Grammar | `#fee2e2` (red-100) | `#991b1b` (red-800) |
| Style | `#fef3c7` (amber-100) | `#92400e` (amber-800) |
| Vocabulary | `#dbeafe` (blue-100) | `#1e40af` (blue-800) |
| Other / unknown | `#f1f5f9` (slate-100) | `#475569` (slate-600) |

**Tooltip** (appears on hover, dark background `#1e293b`):
1. Colored category badge (uppercase, small)
2. Strikethrough original → green suggestion (`#4ade80`)
3. Explanation text in muted color (shown only if `issue.explanation` is present)
4. Tooltip arrow points down to the highlighted word

No click behavior — hover only.

---

## Architecture

### New file: `components/StudentGrading/GrammarHighlightedText.tsx`

Self-contained component. No external dependencies beyond React.

**Props:**
```ts
interface GrammarHighlightedTextProps {
  text: string;
  issues: GrammarIssue[];
}
```

**Behavior:**
- Segments `text` into an array of `Segment` objects:
  `{ text: string; issue?: GrammarIssue }`
- Renders plain segments as text nodes and issue segments as colored `<span>` wrappers with a tooltip `<span>` inside.
- Preserves whitespace/newlines via `whitespace-pre-wrap` on the container.
- If `issues` is empty or `text` is empty, renders plain text unchanged.

**Matching algorithm (`segmentText`):**
1. Start with `remaining = text`, `segments = []`, `cursor = 0`
2. For each `issue` in `issues` (in order of appearance in text):
   a. Search for `issue.original` starting from `cursor`
   b. If multiple matches exist, pick the one whose surrounding ±20 chars best match `issue.context` (Levenshtein or simple substring overlap)
   c. If no match found, skip this issue silently
   d. Push plain segment for text before match, push issue segment for the match
   e. Advance cursor past the match
3. Push remaining plain text after last match
4. Return segments array

**Edge cases:**
- Case sensitivity: match case-sensitively first; fall back to case-insensitive if no match found
- Overlapping issues: skip an issue if its match range overlaps an already-matched range
- Empty `issue.original`: skip silently

### Changes to `components/StudentGrading/EssayViewerModal.tsx`

**Original Submission tab** (currently lines ~165–191):
- Plain text path (`essay.text` with no `originalFile`): replace `<div className="... whitespace-pre-wrap">{essay.text}</div>` with `<GrammarHighlightedText text={essay.text} issues={dr?.issues ?? []} />`
- Side-by-side path (extracted text column): same replacement in the right column

**Analysis tab** (currently lines ~358–388):
- Remove the entire "Mga Isyung Pangwika na Natagpuan" issues grid block

No other files change.

---

## Out of Scope

- Correcting or applying suggestions to the essay text
- Clicking a highlight to navigate to an issues list
- Mobile / touch tap support (hover-only tooltips)
- Re-running analysis or re-fetching issues
- Showing issues when `diagnosisResult` is absent

---

## Acceptance Criteria

1. Essay with `diagnosisResult.issues` non-empty shows colored background highlights on matching phrases in the Original Submission tab
2. Hovering a highlight shows a tooltip with category badge, original → suggestion, and explanation (if present)
3. Essay with no issues renders plain text identically to the current behavior
4. The Analysis tab no longer shows the issues grid
5. No TypeScript errors introduced
6. Matching is resilient: unmatched issues are skipped without throwing
