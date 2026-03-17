# Grammar Highlight Visualization Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat issues grid in `EssayViewerModal` with inline Grammarly-style background highlights and hover tooltips directly in the essay text.

**Architecture:** A new self-contained `GrammarHighlightedText` component segments `essay.text` into plain and highlighted spans by matching `GrammarIssue.original` strings against the text, using `issue.context` to disambiguate multiple occurrences. Tooltips use `position: fixed` with `getBoundingClientRect()` to avoid clipping by the scroll container. `EssayViewerModal` is updated to use the new component and the old issues grid is removed.

**Tech Stack:** React 19, TypeScript, Tailwind CSS. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-03-17-grammar-highlight-visualization-design.md`

---

## Chunk 1: GrammarHighlightedText component

### Task 1: Create `GrammarHighlightedText.tsx`

**Files:**
- Create: `components/StudentGrading/GrammarHighlightedText.tsx`

#### Context

`GrammarIssue` comes from `../../types`:
```ts
export enum IssueCategory {
  GRAMMAR = "Grammar",
  CLARITY = "Clarity",
  VOCABULARY = "Vocabulary",
  STYLE = "Style"
}
export interface GrammarIssue {
  id?: string;
  original: string;       // the wrong phrase to highlight
  suggestion: string;     // the replacement
  type: string;
  category: IssueCategory;
  context: string;        // surrounding text for disambiguation
  explanation?: string;   // optional extra detail
}
```

The component renders essay text with colored background highlights on matched phrases. Hovering a highlight shows a dark tooltip (position: fixed) with:
1. Colored category badge
2. Strikethrough original → green suggestion
3. Optional explanation

**Color map by `IssueCategory` string value:**

| Category | bg class | text class |
|---|---|---|
| `"Grammar"` | `bg-red-100` | `text-red-800` |
| `"Style"` | `bg-amber-100` | `text-amber-800` |
| `"Vocabulary"` | `bg-blue-100` | `text-blue-800` |
| `"Clarity"` | `bg-violet-100` | `text-violet-800` |
| other | `bg-slate-100` | `text-slate-600` |

**Badge colors (inside dark tooltip):**

| Category | badge bg | badge text |
|---|---|---|
| `"Grammar"` | `bg-red-900` | `text-red-300` |
| `"Style"` | `bg-amber-900` | `text-amber-300` |
| `"Vocabulary"` | `bg-blue-900` | `text-blue-300` |
| `"Clarity"` | `bg-violet-900` | `text-violet-300` |
| other | `bg-slate-700` | `text-slate-300` |

**`segmentText` algorithm:**

```
segmentText(text: string, issues: GrammarIssue[]): Segment[]

type Segment = { text: string; issue?: GrammarIssue }

1. For each issue where issue.original is non-empty:
   a. Find all case-sensitive occurrences of issue.original in text → list of startIndex values
   b. If none found, retry case-insensitive → list of startIndex values
   c. If still none, skip this issue entirely
   d. For each candidate startIndex, compute a context window:
        window = text.slice(Math.max(0, startIndex - 20), startIndex + issue.original.length + 20)
      Count characters in common between window and issue.context (multiset intersection).
   e. Pick the candidate startIndex with the highest overlap count.
      On a tie, pick the lowest startIndex (first occurrence).
   f. Record { issue, startIndex } for this issue.

2. Sort all recorded { issue, startIndex } pairs by startIndex ascending.

3. Walk the sorted list with cursor = 0 and matched: Array<[number, number]> = []:
   For each { issue, startIndex }:
     end = startIndex + issue.original.length
     If any range in matched overlaps [startIndex, end) (i.e., startIndex < existingEnd && end > existingStart), skip.
     Otherwise:
       If cursor < startIndex: push { text: text.slice(cursor, startIndex) }  (plain segment)
       Push { text: text.slice(startIndex, end), issue }                      (issue segment)
       matched.push([startIndex, end])
       cursor = end

4. If cursor < text.length: push { text: text.slice(cursor) }  (trailing plain segment)

5. Return segments.
```

**Tooltip state:**
```ts
const [tooltipIssue, setTooltipIssue] = useState<GrammarIssue | null>(null);
const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number; above: boolean }>({ top: 0, left: 0, above: true });
```

On `mouseenter` of a highlighted span:
```ts
const rect = e.currentTarget.getBoundingClientRect();
const above = rect.top > 80;
setTooltipPos({
  top: above ? rect.top - 8 : rect.bottom + 8,
  left: rect.left + rect.width / 2,
  above,
});
setTooltipIssue(issue);
```

On `mouseleave`: `setTooltipIssue(null)`

Tooltip renders as a single overlay at the bottom of the JSX (outside the text container) via `position: fixed`. When `above` is true, the tooltip's bottom edge aligns to `tooltipPos.top` (use `bottom: window.innerHeight - tooltipPos.top` in inline style). When `above` is false, the top edge aligns to `tooltipPos.top`. Horizontally centered at `tooltipPos.left`.

- [ ] **Step 1: Write the component**

Create `components/StudentGrading/GrammarHighlightedText.tsx`:

```tsx
import React, { useState } from 'react';
import { GrammarIssue, IssueCategory } from '../../types';

interface GrammarHighlightedTextProps {
  text: string;
  issues: GrammarIssue[];
}

type Segment = { text: string; issue?: GrammarIssue };

const HIGHLIGHT: Record<string, { bg: string; text: string }> = {
  [IssueCategory.GRAMMAR]:    { bg: 'bg-red-100',    text: 'text-red-800' },
  [IssueCategory.STYLE]:      { bg: 'bg-amber-100',  text: 'text-amber-800' },
  [IssueCategory.VOCABULARY]: { bg: 'bg-blue-100',   text: 'text-blue-800' },
  [IssueCategory.CLARITY]:    { bg: 'bg-violet-100', text: 'text-violet-800' },
};
const BADGE: Record<string, { bg: string; text: string }> = {
  [IssueCategory.GRAMMAR]:    { bg: 'bg-red-900',    text: 'text-red-300' },
  [IssueCategory.STYLE]:      { bg: 'bg-amber-900',  text: 'text-amber-300' },
  [IssueCategory.VOCABULARY]: { bg: 'bg-blue-900',   text: 'text-blue-300' },
  [IssueCategory.CLARITY]:    { bg: 'bg-violet-900', text: 'text-violet-300' },
};
const FALLBACK_HIGHLIGHT = { bg: 'bg-slate-100', text: 'text-slate-600' };
const FALLBACK_BADGE     = { bg: 'bg-slate-700', text: 'text-slate-300' };

function charOverlap(a: string, b: string): number {
  const freq: Record<string, number> = {};
  for (const c of a) freq[c] = (freq[c] ?? 0) + 1;
  let count = 0;
  const used: Record<string, number> = {};
  for (const c of b) {
    used[c] = (used[c] ?? 0) + 1;
    if ((used[c]) <= (freq[c] ?? 0)) count++;
  }
  return count;
}

function findAllOccurrences(haystack: string, needle: string): number[] {
  const indices: number[] = [];
  let idx = haystack.indexOf(needle);
  while (idx !== -1) {
    indices.push(idx);
    idx = haystack.indexOf(needle, idx + 1);
  }
  return indices;
}

function segmentText(text: string, issues: GrammarIssue[]): Segment[] {
  if (!text || !issues.length) return [{ text }];

  const candidates: Array<{ issue: GrammarIssue; startIndex: number }> = [];

  for (const issue of issues) {
    if (!issue.original) continue;

    let positions = findAllOccurrences(text, issue.original);
    if (!positions.length) {
      positions = findAllOccurrences(text.toLowerCase(), issue.original.toLowerCase());
    }
    if (!positions.length) continue;

    let best = positions[0];
    let bestScore = -1;
    for (const pos of positions) {
      const window = text.slice(Math.max(0, pos - 20), pos + issue.original.length + 20);
      const score = charOverlap(window, issue.context);
      if (score > bestScore) { bestScore = score; best = pos; }
    }
    candidates.push({ issue, startIndex: best });
  }

  candidates.sort((a, b) => a.startIndex - b.startIndex);

  const segments: Segment[] = [];
  let cursor = 0;
  const matched: Array<[number, number]> = [];

  for (const { issue, startIndex } of candidates) {
    const end = startIndex + issue.original.length;
    const overlaps = matched.some(([s, e]) => startIndex < e && end > s);
    if (overlaps) continue;

    if (cursor < startIndex) segments.push({ text: text.slice(cursor, startIndex) });
    segments.push({ text: text.slice(startIndex, end), issue });
    matched.push([startIndex, end]);
    cursor = end;
  }

  if (cursor < text.length) segments.push({ text: text.slice(cursor) });
  return segments;
}

export const GrammarHighlightedText: React.FC<GrammarHighlightedTextProps> = ({ text, issues }) => {
  const [tooltipIssue, setTooltipIssue] = useState<GrammarIssue | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number; above: boolean }>({
    top: 0, left: 0, above: true,
  });

  const segments = segmentText(text, issues);

  const handleEnter = (e: React.MouseEvent<HTMLSpanElement>, issue: GrammarIssue) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const above = rect.top > 80;
    setTooltipPos({ top: above ? rect.top - 8 : rect.bottom + 8, left: rect.left + rect.width / 2, above });
    setTooltipIssue(issue);
  };

  return (
    <div className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap relative">
      {segments.map((seg, i) => {
        if (!seg.issue) return <React.Fragment key={i}>{seg.text}</React.Fragment>;
        const h = HIGHLIGHT[seg.issue.category] ?? FALLBACK_HIGHLIGHT;
        return (
          <span
            key={i}
            className={`rounded px-0.5 cursor-pointer ${h.bg} ${h.text}`}
            onMouseEnter={(e) => handleEnter(e, seg.issue!)}
            onMouseLeave={() => setTooltipIssue(null)}
          >
            {seg.text}
          </span>
        );
      })}

      {tooltipIssue && (() => {
        const b = BADGE[tooltipIssue.category] ?? FALLBACK_BADGE;
        const style: React.CSSProperties = {
          position: 'fixed',
          left: tooltipPos.left,
          transform: 'translateX(-50%)',
          zIndex: 9999,
          width: 240,
          ...(tooltipPos.above
            ? { bottom: window.innerHeight - tooltipPos.top }
            : { top: tooltipPos.top }),
        };
        return (
          <div
            style={style}
            className="bg-[#1e293b] rounded-xl px-3 py-2.5 shadow-2xl pointer-events-none"
          >
            <span className={`inline-block text-[9px] font-black uppercase tracking-wider rounded-full px-2 py-0.5 mb-2 ${b.bg} ${b.text}`}>
              {tooltipIssue.category}
            </span>
            <div className="text-[11px] text-slate-100 mb-1">
              <span className="line-through text-slate-400">{tooltipIssue.original}</span>
              <span className="text-slate-500 mx-1">→</span>
              <span className="text-green-400 font-semibold">{tooltipIssue.suggestion}</span>
            </div>
            {tooltipIssue.explanation && (
              <p className="text-[10px] text-slate-400 leading-relaxed border-t border-slate-700 pt-1.5 mt-1">
                {tooltipIssue.explanation}
              </p>
            )}
            {/* Arrow */}
            <div
              className="absolute left-1/2 -translate-x-1/2"
              style={tooltipPos.above
                ? { top: '100%', borderTop: '6px solid #1e293b', borderLeft: '6px solid transparent', borderRight: '6px solid transparent', width: 0, height: 0 }
                : { bottom: '100%', borderBottom: '6px solid #1e293b', borderLeft: '6px solid transparent', borderRight: '6px solid transparent', width: 0, height: 0 }
              }
            />
          </div>
        );
      })()}
    </div>
  );
};
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Volumes/Hanteck/Projects/readtrack
npx tsc --noEmit 2>&1 | grep GrammarHighlightedText
```

Expected: no output (no errors in this file).

- [ ] **Step 3: Commit**

```bash
git add components/StudentGrading/GrammarHighlightedText.tsx
git commit -m "feat: add GrammarHighlightedText component with segmentation and fixed tooltips"
```

---

## Chunk 2: Wire into EssayViewerModal + remove issues grid

### Task 2: Update `EssayViewerModal.tsx`

**Files:**
- Modify: `components/StudentGrading/EssayViewerModal.tsx`

Two changes:
1. Replace both plain `{essay.text}` divs in the Original Submission tab with `<GrammarHighlightedText>`
2. Remove the issues grid block from the Analysis tab

#### Change A — Import

- [ ] **Step 1: Add import for GrammarHighlightedText**

In `EssayViewerModal.tsx`, after the existing local imports (around line 13), add:

```tsx
import { GrammarHighlightedText } from './GrammarHighlightedText';
```

Also remove the now-unused `IoAlertCircleOutline` import from the `react-icons/io5` import block (line 7) since it was only used by the issues grid.

The import block at the top becomes:
```tsx
import {
  IoPersonCircleOutline,
  IoCloseOutline,
  IoStatsChartOutline,
  IoCheckmarkCircleOutline,
  IoBookOutline,
  IoStar,
  IoStarOutline,
} from 'react-icons/io5';
```

#### Change B — Original Submission tab (lines 185 and 189)

- [ ] **Step 2: Replace plain text divs with GrammarHighlightedText**

Find and replace line 185 (side-by-side extracted text column):
```tsx
// BEFORE
<div className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{essay.text}</div>

// AFTER
<GrammarHighlightedText text={essay.text} issues={dr?.issues ?? []} />
```

Find and replace line 189 (plain text path, no originalFile):
```tsx
// BEFORE
<div className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{essay.text}</div>

// AFTER
<GrammarHighlightedText text={essay.text} issues={dr?.issues ?? []} />
```

Both lines are identical in content — there are exactly two of them in the file. Replace both.

#### Change C — Remove issues grid (lines 357–388)

- [ ] **Step 3: Remove the issues grid block**

Delete the entire block from line 357 to line 388 inclusive:
```tsx
              {/* Grammar / Linguistic Issues */}
              {dr?.issues && dr.issues.length > 0 && (
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 ml-1 flex items-center gap-2">
                    <IoAlertCircleOutline className="text-red-500" />{' '}
                    Mga Isyung Pangwika na Natagpuan ({dr.issues.length}) {/* Linguistic Issues Found */}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {dr.issues.map((issue, i) => (
                      <div
                        key={i}
                        className="p-4 bg-white border border-gray-100 rounded-2xl shadow-sm flex items-start gap-3"
                      >
                        <div className="w-2 h-2 rounded-full bg-red-400 mt-1.5 shrink-0" />
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-black text-red-500 line-through opacity-50">
                              {issue.original}
                            </span>
                            <span className="text-[10px] font-black text-teal-600">
                              → {issue.suggestion}
                            </span>
                          </div>
                          <p className="text-[10px] text-gray-500 font-medium">
                            {issue.context}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
```

After deletion, the Analysis tab's `<div className="space-y-8">` ends at the closing `</div>` after the Teacher Rating section.

- [ ] **Step 4: Verify TypeScript compiles cleanly**

```bash
cd /Volumes/Hanteck/Projects/readtrack
npx tsc --noEmit 2>&1
```

Expected: no new errors (there are pre-existing errors in `MaterialChecker.tsx` — those are unrelated and should be ignored). Confirm no errors mentioning `EssayViewerModal` or `GrammarHighlightedText`.

- [ ] **Step 5: Verify dev build succeeds**

```bash
npm run build 2>&1 | tail -5
```

Expected: `✓ built in ...` with no errors.

- [ ] **Step 6: Commit**

```bash
git add components/StudentGrading/EssayViewerModal.tsx
git commit -m "feat: wire GrammarHighlightedText into EssayViewerModal, remove issues grid"
```
