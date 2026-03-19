# Word Definition Popup Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clicking any word in essay text opens a bilingual (English + Filipino) definition popup near that word, with EN/FIL tab switching and independent grammar hover tooltips.

**Architecture:** A self-contained `WordDefinitionPopup` component owns all fetch logic (parallel `dictionaryapi.dev` + Gemini calls, cached in state). `GrammarHighlightedText` extracts the clicked word via `caretRangeFromPoint`/`caretPositionFromPoint` + manual text-node walk, then renders the popup positioned with `position: fixed`.

**Tech Stack:** React 19 + TypeScript + Tailwind CSS, `@google/genai` (already in project), `dictionaryapi.dev` (free, no key), `process.env.API_KEY` for Gemini

---

## Chunk 1: WordDefinitionPopup Component

### Task 1: Create `WordDefinitionPopup.tsx`

**Files:**
- Create: `components/StudentGrading/WordDefinitionPopup.tsx`

- [ ] **Step 1: Create the component file**

```tsx
// components/StudentGrading/WordDefinitionPopup.tsx
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from '@google/genai';

interface WordDefinitionPopupProps {
  word: string;
  anchorRect: {
    top: number;
    bottom: number;
    left: number;
    width: number;
  };
  onClose: () => void;
}

type DefResult =
  | { pos: string; meaning: string; example?: string; source: 'dictionary' | 'ai' }
  | 'loading'
  | 'not_found';

export const WordDefinitionPopup: React.FC<WordDefinitionPopupProps> = ({
  word,
  anchorRect,
  onClose,
}) => {
  const [lang, setLang] = useState<'en' | 'fil'>('en');
  const [enDef, setEnDef] = useState<DefResult>('loading');
  const [filDef, setFilDef] = useState<DefResult>('loading');
  const popupRef = useRef<HTMLDivElement>(null);

  // ── Parallel fetches on mount ──────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    // English fetch
    (async () => {
      try {
        const res = await fetch(
          `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`
        );
        if (cancelled) return;
        if (!res.ok) { setEnDef('not_found'); return; }
        const data = await res.json();
        if (cancelled) return;
        const meaning = data[0]?.meanings?.[0];
        if (!meaning) { setEnDef('not_found'); return; }
        setEnDef({
          pos: meaning.partOfSpeech ?? '',
          meaning: meaning.definitions?.[0]?.definition ?? '',
          example: meaning.definitions?.[0]?.example ?? undefined,
          source: 'dictionary',
        });
      } catch {
        if (!cancelled) setEnDef('not_found');
      }
    })();

    // Filipino fetch via Gemini
    (async () => {
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
        const result = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: `Give a brief Tagalog/Filipino definition of the word "${word}".
Return ONLY valid JSON with exactly this shape:
{"pos":"<bahagi ng pananalita>","meaning":"<1-2 sentence Tagalog definition>","example":"<short Tagalog example sentence or empty string>"}
If the word has no meaningful Filipino definition, return: {"pos":"","meaning":"","example":""}`,
          config: { responseMimeType: 'application/json' },
        });
        if (cancelled) return;
        const text = result.text ?? '';
        const parsed = JSON.parse(text.trim());
        if (!parsed.meaning) { setFilDef('not_found'); return; }
        setFilDef({
          pos: parsed.pos,
          meaning: parsed.meaning,
          example: parsed.example || undefined,
          source: 'ai',
        });
      } catch {
        if (!cancelled) setFilDef('not_found');
      }
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // [] intentional: both fetches run once on mount for the given `word` prop

  // ── Outside-click and Escape handlers ─────────────────────────────────────
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Element;
      // Skip if click is inside the popup itself.
      if (popupRef.current && popupRef.current.contains(target)) return;
      // Skip if click is inside the GrammarHighlightedText container —
      // that component's own onClick (with stopPropagation) handles toggle/move.
      if (target.closest('[data-grammar-container]')) return;
      onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  // ── Positioning ────────────────────────────────────────────────────────────
  const POPUP_HEIGHT = 320;
  const POPUP_WIDTH = 300;
  const below = anchorRect.bottom + 10 + POPUP_HEIGHT <= window.innerHeight;
  const popupLeft = Math.max(
    8,
    Math.min(
      anchorRect.left + anchorRect.width / 2 - POPUP_WIDTH / 2,
      window.innerWidth - POPUP_WIDTH - 8
    )
  );
  const arrowLeft = Math.max(
    20,
    Math.min(anchorRect.left + anchorRect.width / 2 - popupLeft, 280)
  );

  const posStyle: React.CSSProperties = {
    position: 'fixed',
    width: POPUP_WIDTH,
    left: popupLeft,
    zIndex: 10000,
    ...(below
      ? { top: anchorRect.bottom + 10 }
      : { bottom: window.innerHeight - anchorRect.top + 10 }),
  };

  // ── Render helpers ─────────────────────────────────────────────────────────
  const currentDef = lang === 'en' ? enDef : filDef;

  const renderBody = () => {
    if (currentDef === 'loading') {
      return (
        <div className="flex items-center gap-2 px-4 py-3 text-[11px] text-slate-400">
          <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-200 border-t-indigo-500 animate-spin flex-shrink-0" />
          Looking up…
        </div>
      );
    }
    if (currentDef === 'not_found') {
      return (
        <p className="px-4 py-3 text-[11px] text-slate-400 italic">
          No {lang === 'en' ? 'English' : 'Filipino'} definition found.
        </p>
      );
    }
    return (
      <div className="px-4 pb-3">
        {currentDef.pos && (
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
            {currentDef.pos}
          </p>
        )}
        <div className="h-px bg-slate-100 mb-2" />
        <p className="text-[12px] text-slate-600 leading-relaxed mb-1.5">
          {currentDef.meaning}
        </p>
        {currentDef.example && (
          <p className="text-[11px] text-slate-400 italic leading-relaxed mb-2">
            "{currentDef.example}"
          </p>
        )}
        <p className={`text-[9px] font-bold uppercase tracking-widest ${
          currentDef.source === 'ai' ? 'text-violet-400' : 'text-slate-300'
        }`}>
          {currentDef.source === 'ai' ? '✦ AI generated' : '📖 Dictionary'}
        </p>
      </div>
    );
  };

  return (
    <div ref={popupRef} style={posStyle} className="bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden">
      {/* Arrow */}
      {below ? (
        // Arrow at top pointing up
        <div
          className="absolute"
          style={{
            top: -7,
            left: arrowLeft,
            transform: 'translateX(-50%)',
            width: 0,
            height: 0,
            borderLeft: '8px solid transparent',
            borderRight: '8px solid transparent',
            borderBottom: '8px solid #e2e8f0',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 2,
              left: -7,
              width: 0,
              height: 0,
              borderLeft: '7px solid transparent',
              borderRight: '7px solid transparent',
              borderBottom: '7px solid white',
            }}
          />
        </div>
      ) : (
        // Arrow at bottom pointing down
        <div
          className="absolute"
          style={{
            bottom: -7,
            left: arrowLeft,
            transform: 'translateX(-50%)',
            width: 0,
            height: 0,
            borderLeft: '8px solid transparent',
            borderRight: '8px solid transparent',
            borderTop: '8px solid #e2e8f0',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              position: 'absolute',
              bottom: 2,
              left: -7,
              width: 0,
              height: 0,
              borderLeft: '7px solid transparent',
              borderRight: '7px solid transparent',
              borderTop: '7px solid white',
            }}
          />
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between px-4 pt-3.5 pb-0">
        <span className="text-[16px] font-black text-slate-900">{word}</span>
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="w-5 h-5 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 text-[10px] flex-shrink-0 mt-0.5"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      {/* Language tabs */}
      <div className="flex gap-1 px-4 pt-2.5 pb-0">
        {(['en', 'fil'] as const).map((l) => (
          <button
            key={l}
            onClick={(e) => { e.stopPropagation(); setLang(l); }}
            className={`flex-1 py-1.5 px-2 rounded-lg border text-[11px] font-bold transition-all ${
              lang === l
                ? 'bg-slate-900 border-slate-900 text-white'
                : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-500'
            }`}
          >
            {l === 'en' ? '🇺🇸 English' : '🇵🇭 Filipino'}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="mt-2 min-h-[72px]">{renderBody()}</div>
    </div>
  );
};
```

- [ ] **Step 2: Verify TypeScript compiles without errors**

Run: `npx tsc --noEmit 2>&1 | head -40`
Expected: no errors related to `WordDefinitionPopup.tsx`

---

## Chunk 2: GrammarHighlightedText Click Handler

### Task 2: Add word-click handling to `GrammarHighlightedText.tsx`

**Files:**
- Modify: `components/StudentGrading/GrammarHighlightedText.tsx`

- [ ] **Step 1: Add `useRef` to imports and new state**

In `GrammarHighlightedText.tsx`, update the import line and add state inside the component:

```tsx
// Change top import from:
import React, { useState, useMemo } from 'react';
// To:
import React, { useState, useMemo, useRef } from 'react';
```

Then inside the component body, after the existing `tooltipIssue` / `tooltipPos` state declarations, add:

```tsx
const [defWord, setDefWord] = useState<string | null>(null);
const [defAnchor, setDefAnchor] = useState<{
  top: number; bottom: number; left: number; width: number;
} | null>(null);
const containerRef = useRef<HTMLDivElement>(null);
```

- [ ] **Step 2: Add `isWordChar` helper and `handleContainerClick`**

Add these two functions after `segmentText` (before the component function, or inside the component — either works; add as module-level functions after `segmentText`):

```tsx
function isWordChar(ch: string): boolean {
  return /[\p{L}\p{M}-]/u.test(ch);
}
```

Then inside the component body, after the `segments` useMemo, add:

```tsx
const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
  e.stopPropagation(); // prevent document click handler from closing popup immediately

  let range: Range | null = null;
  if (document.caretRangeFromPoint) {
    range = document.caretRangeFromPoint(e.clientX, e.clientY);
  } else if ((document as any).caretPositionFromPoint) {
    const pos = (document as any).caretPositionFromPoint(e.clientX, e.clientY);
    if (pos) {
      range = document.createRange();
      range.setStart(pos.offsetNode, pos.offset);
      range.setEnd(pos.offsetNode, pos.offset);
    }
  }

  if (!range || range.startContainer.nodeType !== Node.TEXT_NODE) return;

  const textNode = range.startContainer as Text;
  const offset = range.startOffset;
  const nodeText = textNode.textContent ?? '';

  let start = offset;
  while (start > 0 && isWordChar(nodeText[start - 1])) start--;
  let end = offset;
  while (end < nodeText.length && isWordChar(nodeText[end])) end++;

  const word = nodeText.slice(start, end).replace(/^-+|-+$/g, '');
  if (!word || word.length < 2) return;

  const wordRange = document.createRange();
  wordRange.setStart(textNode, start);
  wordRange.setEnd(textNode, end);
  const rect = wordRange.getBoundingClientRect();

  if (defWord === word) {
    setDefWord(null);
    setDefAnchor(null);
  } else {
    setDefWord(word);
    setDefAnchor({ top: rect.top, bottom: rect.bottom, left: rect.left, width: rect.width });
  }
};
```

- [ ] **Step 3: Add `WordDefinitionPopup` import**

At the top of `GrammarHighlightedText.tsx`, add:

```tsx
import { WordDefinitionPopup } from './WordDefinitionPopup';
```

- [ ] **Step 4: Update the outer `<div>` to attach click handler and ref**

Find the return statement's outer `<div>`:

```tsx
<div className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap relative">
```

Change to:

```tsx
<div
  ref={containerRef}
  data-grammar-container
  className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap relative"
  onClick={handleContainerClick}
>
```

The `data-grammar-container` attribute lets `WordDefinitionPopup`'s outside-click handler identify this container and skip closing when the click is inside it, complementing `e.stopPropagation()` as a defense-in-depth guard.

- [ ] **Step 5: Render `WordDefinitionPopup` inside the component**

Add the popup render just before the closing `</div>` of the outer container (after the tooltip render block):

```tsx
{defWord && defAnchor && (
  <WordDefinitionPopup
    word={defWord}
    anchorRect={defAnchor}
    onClose={() => { setDefWord(null); setDefAnchor(null); }}
  />
)}
```

- [ ] **Step 6: Verify TypeScript compiles without errors**

Run: `npx tsc --noEmit 2>&1 | head -40`
Expected: zero errors

- [ ] **Step 7: Verify in browser**

Start dev server: `npm run dev`

Manual checks:
1. Open an essay in EssayViewerModal → Original Submission tab
2. Click any plain word → popup appears near it with "🇺🇸 English" tab active and spinner
3. After ~1s, English definition appears with source badge "📖 Dictionary"
4. Click "🇵🇭 Filipino" tab → Filipino definition loads (spinner, then result); popup stays open and in same position
5. Click EN tab again → shows cached English result (no re-fetch, instant)
6. Click the same word → popup closes
7. Click a different word → popup moves to new word
8. Press Escape → popup closes
9. Click outside the essay box → popup closes
10. Hover a grammar-highlighted span → grammar tooltip appears; definition popup is unaffected
11. Click `kahanga-hanga` (hyphenated compound word) → popup opens for "kahanga-hanga" as a single word, not "kahanga"
12. Click a word not in any dictionary (e.g. a proper noun) → "No English definition found." shown without crash
