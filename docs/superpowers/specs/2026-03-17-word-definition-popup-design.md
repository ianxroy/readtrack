# Word Definition Popup — Design Spec

**Date:** 2026-03-17
**Feature:** Click any word in the essay text to see its English and Filipino definition
**Scope:** Read-only lookup — no text modification, no new analysis calls

---

## Overview

In `GrammarHighlightedText`, clicking any word opens a `WordDefinitionPopup` showing the word's English definition (from `dictionaryapi.dev`) and Filipino/Tagalog definition (from Gemini AI). The user can switch between EN and FIL tabs without closing the popup. Hovering highlighted words continues to show the existing grammar tooltip — hover and click are independent interactions.

---

## Interaction Model

| Interaction | Behavior |
|---|---|
| **Hover** highlighted span | Grammar tooltip appears (existing, unchanged) |
| **Click** any word | Definition popup opens |
| Click same word again | Popup closes |
| Click different word | Popup moves to new word |
| Switch EN ↔ FIL tab | Content swaps in place — popup stays open |
| Click outside popup | Popup closes |
| Press Escape | Popup closes |

---

## Visual Design

**Popup:** White card, `border-radius: 16px`, `box-shadow` with soft shadow, `position: fixed`, width 300px. Arrow at top pointing up toward the clicked word.

**Header:** Word title (bold, 16px) + close button (top right).

**Language tabs:** Two pill tabs side by side — `🇺🇸 English` and `🇵🇭 Filipino`. Active tab is dark (`bg-slate-900 text-white`). Inactive is outlined. Switching tabs never closes the popup.

**Body:**
- Part of speech (small uppercase label)
- Divider
- Definition text (12px, readable)
- Example sentence (11px, italic, muted) — shown only if available
- Source badge: `📖 Dictionary` (muted) or `✦ AI generated` (violet)

**Loading state:** Spinner + "Looking up…" text while fetching.

**Not found state:** "No English/Filipino definition found for this word."

---

## Architecture

### New file: `components/StudentGrading/WordDefinitionPopup.tsx`

Self-contained component. Owns all fetch logic and tab state.

**Props:**
```ts
interface WordDefinitionPopupProps {
  word: string;                                    // the clicked word, stripped of punctuation
  anchorRect: { top: number; left: number; width: number; bottom: number }; // from getBoundingClientRect()
  onClose: () => void;
}
```

**Internal state:**
```ts
type DefResult = { pos: string; meaning: string; example?: string; source: 'dictionary' | 'ai' } | 'loading' | 'not_found';

const [lang, setLang] = useState<'en' | 'fil'>('en');
const [enDef, setEnDef] = useState<DefResult>('loading');
const [filDef, setFilDef] = useState<DefResult>('loading');
```

**Fetch behavior:**
- On mount: fetch English immediately. Fetch Filipino immediately (both in parallel via two `useEffect` calls or one combined).
- Results are cached in component state — switching tabs does NOT re-fetch.
- If component unmounts before fetch completes, ignore result (use `isMounted` ref or AbortController).

**English fetch (`fetchEnglish`):**
```
GET https://api.dictionaryapi.dev/api/v2/entries/en/{word}
```
- On 200: extract first meaning from `data[0].meanings[0]` → `{ pos: partOfSpeech, meaning: definitions[0].definition, example: definitions[0].example, source: 'dictionary' }`
- On 404 or network error: set `enDef = 'not_found'`

**Filipino fetch (`fetchFilipino`):**
Call Gemini via `@google/genai` (same SDK already used in `services/geminiService.ts`). Use `process.env.API_KEY`.

Prompt:
```
Give a brief Tagalog/Filipino definition of the word "${word}".
Respond in JSON with exactly this shape:
{ "pos": "<bahagi ng pananalita in Filipino>", "meaning": "<1-2 sentence Tagalog definition>", "example": "<short example sentence in Tagalog, optional>" }
If the word has no meaningful Filipino definition, return: { "pos": "", "meaning": "", "example": "" }
```

Parse the JSON response. If `meaning` is empty string → set `filDef = 'not_found'`. Otherwise set `filDef = { pos, meaning, example, source: 'ai' }`.

On any Gemini error → set `filDef = 'not_found'`.

**Positioning:**
- Default: popup appears **below** the word — `top = anchorRect.bottom + 10`
- If not enough space below (`anchorRect.bottom + 10 + 320 > window.innerHeight`) → appear above: `bottom = window.innerHeight - anchorRect.top + 10`
- Horizontally centered on word: `left = anchorRect.left + anchorRect.width / 2 - 150`, clamped to `[8, window.innerWidth - 308]`
- Arrow position adjusts to always point at the word center

**Outside click / Escape:**
Component adds `document.addEventListener('mousedown', handler)` and `document.addEventListener('keydown', escHandler)` on mount, removes on unmount. Handler calls `onClose()` if click target is outside the popup element.

---

### Changes to `GrammarHighlightedText.tsx`

Add three pieces:

**1. State for the definition popup:**
```ts
const [defWord, setDefWord] = useState<string | null>(null);
const [defAnchor, setDefAnchor] = useState<{ top: number; left: number; width: number; bottom: number } | null>(null);
```

**2. Click handler on the container div:**
```ts
const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
  // Get the word under the cursor from the selection API
  const selection = window.getSelection();
  // Temporarily select word at click point
  if (document.caretRangeFromPoint) {
    const range = document.caretRangeFromPoint(e.clientX, e.clientY);
    if (range) {
      range.expand('word');
      const word = range.toString().trim().replace(/[^a-zA-ZÀ-ÿ\u0100-\u017F\u1E00-\u1EFF\u0080-\u00FF\u0900-\u097F\u0000-\uFFFF]/g, '').trim();
      // Simpler: just get the clicked element's text if it's a word span
    }
  }
  // Fallback: use event target text content
  const target = e.target as HTMLElement;
  const rawWord = target.textContent?.trim().replace(/[.,!?;:'"()\[\]]/g, '').trim() ?? '';
  if (!rawWord || rawWord.length < 2) return;

  const rect = (e.target as HTMLElement).getBoundingClientRect();
  if (defWord === rawWord) {
    setDefWord(null); setDefAnchor(null); // toggle off
  } else {
    setDefWord(rawWord);
    setDefAnchor({ top: rect.top, left: rect.left, width: rect.width, bottom: rect.bottom });
  }
};
```

Add `onClick={handleContainerClick}` to the outer container `<div>`.

**3. Render `WordDefinitionPopup` when `defWord` is set:**
```tsx
{defWord && defAnchor && (
  <WordDefinitionPopup
    word={defWord}
    anchorRect={defAnchor}
    onClose={() => { setDefWord(null); setDefAnchor(null); }}
  />
)}
```

**No changes to hover/grammar tooltip logic.**

---

## API Notes

- **`dictionaryapi.dev`:** Free, no API key, ~1000 req/hour per IP. Returns array of entries; use `data[0].meanings[0].definitions[0]`.
- **Gemini:** Use `process.env.API_KEY` (already set in the app). Model: `gemini-2.5-flash`. Parse JSON from response text — use `JSON.parse(text.trim())` with a try/catch.
- Both fetches are fire-and-forget on mount; no retry logic needed.

---

## Out of Scope

- Caching definitions across sessions (localStorage)
- Audio pronunciation
- Multiple definitions / all meanings
- Synonyms / antonyms
- Clicking non-essay text (outside `GrammarHighlightedText`)

---

## Acceptance Criteria

1. Clicking any word in the essay opens the popup below (or above if near screen bottom) that word
2. English tab shows definition from `dictionaryapi.dev`; Filipino tab shows Gemini-generated Tagalog definition
3. Switching tabs does not close or re-position the popup
4. Clicking same word again closes the popup
5. Clicking outside or pressing Escape closes the popup
6. Hovering a grammar-highlighted span still shows the grammar tooltip — click and hover are independent
7. Words with no English definition show "not found" gracefully
8. No TypeScript errors introduced
