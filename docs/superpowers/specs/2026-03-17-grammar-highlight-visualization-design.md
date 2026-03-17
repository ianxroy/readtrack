# Grammar Highlight Visualization — Design Spec

**Date:** 2026-03-17
**Feature:** Grammarly-style inline grammar issue visualization in EssayViewerModal
**Scope:** Visualization only — no corrections applied, no new backend calls

---

## Overview

When a student essay has been analyzed (`diagnosisResult.issues[]` is non-empty), the Original Submission tab in `EssayViewerModal` highlights problematic phrases inline with colored background spans and hover tooltips. The existing issues grid at the bottom of the Analysis tab is removed, as the inline highlighting makes it redundant.

---

## Visual Design

**Highlight style:** Background color fill

| Issue category (`IssueCategory` enum value) | Background | Text color |
|---|---|---|
| `Grammar` | `#fee2e2` (red-100) | `#991b1b` (red-800) |
| `Style` | `#fef3c7` (amber-100) | `#92400e` (amber-800) |
| `Vocabulary` | `#dbeafe` (blue-100) | `#1e40af` (blue-800) |
| `Clarity` | `#ede9fe` (violet-100) | `#5b21b6` (violet-800) |
| Other / unknown | `#f1f5f9` (slate-100) | `#475569` (slate-600) |

The `IssueCategory` enum (`types.ts`) has four values: `GRAMMAR`, `CLARITY`, `VOCABULARY`, `STYLE`. All four have explicit color mappings above; unrecognized values fall back to slate.

**Tooltip** (appears on hover, dark background `#1e293b`, `position: fixed` to avoid clipping by scroll containers):
1. Colored category badge (uppercase, small)
2. Strikethrough original → green suggestion (`#4ade80`)
3. Explanation text in muted color (shown only if `issue.explanation` is present)
4. Tooltip arrow points down to the highlighted word

No click behavior — hover only.

**Tooltip positioning:** Use `position: fixed` with coordinates derived from `onMouseEnter` event's `getBoundingClientRect()`. This avoids clipping by the `overflow-y-auto` scroll container in `EssayViewerModal` (line 158). The highlighted `<span>` stores tooltip state (`tooltipIssue`, `tooltipPos`) in the parent `GrammarHighlightedText` component via `onMouseEnter`/`onMouseLeave` handlers. The tooltip is rendered as a single overlay at the bottom of the component tree.

Default placement: **above** the highlighted span — tooltip bottom aligns to `rect.top - 8px`. If `rect.top < 80` (not enough room above), render **below** instead — tooltip top aligns to `rect.bottom + 8px` and the arrow points up. The tooltip arrow always points toward the highlighted span.

---

## Architecture

### New file: `components/StudentGrading/GrammarHighlightedText.tsx`

Depends on: React, `GrammarIssue` imported from `../../types`.

**Props:**
```ts
import { GrammarIssue } from '../../types';

interface GrammarHighlightedTextProps {
  text: string;
  issues: GrammarIssue[];
}
```

**Internal type:**
```ts
type Segment = { text: string; issue?: GrammarIssue };
```

**Behavior:**
- Segments `text` into an array of `Segment` objects
- Renders plain segments as text nodes and issue segments as colored `<span>` wrappers
- A single tooltip overlay is rendered at the end of the component; hovering a span shows it via `tooltipIssue` + `tooltipPos` state
- Preserves whitespace/newlines via `whitespace-pre-wrap` on the container
- If `issues` is empty or `text` is empty, renders plain text as a single unsegmented text node with no wrapping `<span>` elements

**Matching algorithm (`segmentText(text, issues) → Segment[]`):**

1. For each issue in `issues`, find all case-sensitive occurrences of `issue.original` in `text`. Record `{ issue, startIndex }` for each match. If no case-sensitive match exists, retry case-insensitively and record those matches instead. If still no match, skip this issue.

2. From all recorded `{ issue, startIndex }` pairs, where the same `issue` has multiple candidate positions, select the candidate whose surrounding context window best matches `issue.context`: extract `text.slice(Math.max(0, startIndex - 20), startIndex + issue.original.length + 20)` and pick the candidate with the most characters in common with `issue.context` (simple character overlap count — count characters that appear in both strings, not positional). On a tie, pick the candidate with the lowest `startIndex` (first occurrence).

3. Collect the selected `{ issue, startIndex }` pairs and **sort by `startIndex` ascending**.

4. Walk the sorted list. Maintain a `cursor` (starts at 0) and a `matched` set of `[start, end]` ranges already used:
   - Skip any candidate whose `[startIndex, startIndex + issue.original.length]` overlaps (any shared character) with a range already in `matched`.
   - For each accepted candidate: push a plain segment for `text.slice(cursor, startIndex)` (if non-empty), push an issue segment for `text.slice(startIndex, startIndex + issue.original.length)`, advance `cursor` to `startIndex + issue.original.length`, add range to `matched`.

5. Push a final plain segment for `text.slice(cursor)` (if non-empty).

6. Return the segments array.

**Edge cases:**
- Empty `issue.original`: skip silently (do not attempt to match)
- No issues matched: return a single plain segment containing the full text
- Fully overlapping matches: second match is skipped; no crash

### Changes to `components/StudentGrading/EssayViewerModal.tsx`

**Original Submission tab:**
- Line 185 (side-by-side extracted text column): replace `<div className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{essay.text}</div>` with `<GrammarHighlightedText text={essay.text} issues={dr?.issues ?? []} />`
- Line 189 (plain text path, no `originalFile`): same replacement

**Analysis tab** (lines 358–388):
- Remove the entire `{dr?.issues && dr.issues.length > 0 && ( ... )}` block (the "Mga Isyung Pangwika na Natagpuan" grid)

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

1. Essay with `diagnosisResult.issues` non-empty shows colored background highlights on matching phrases in the Original Submission tab (both plain and side-by-side layout)
2. Hovering a highlight shows a tooltip with category badge, strikethrough original → green suggestion, and explanation (if present); tooltip is not clipped by the scroll container
3. Essay with no issues (or `diagnosisResult` absent) renders `essay.text` as a single unsegmented text node with no wrapping `<span>` elements, preserving `whitespace-pre-wrap` formatting
4. The Analysis tab no longer shows the issues grid
5. No TypeScript errors introduced
6. Matching is resilient: unmatched issues are skipped without throwing; overlapping matches do not crash or duplicate highlights
