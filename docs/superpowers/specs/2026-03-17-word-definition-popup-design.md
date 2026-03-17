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
| Click outside `GrammarHighlightedText` container | Popup closes |
| Press Escape | Popup closes |

---

## Visual Design

**Popup:** White card, `border-radius: 16px`, soft shadow, `position: fixed`, width 300px.

**Arrow:** Points toward the clicked word. When popup is **below** the word — arrow at top of popup pointing up. When popup is **above** the word — arrow at bottom of popup pointing down.

**Header:** Word title (bold, 16px) + close button (top right).

**Language tabs:** Two pill tabs — `🇺🇸 English` and `🇵🇭 Filipino`. Active tab: `bg-slate-900 text-white`. Inactive: outlined. Switching tabs never closes the popup.

**Body:**
- Part of speech (small uppercase label)
- Divider
- Definition text (12px)
- Example sentence (11px, italic, muted) — only if available
- Source badge: `📖 Dictionary` (muted) or `✦ AI generated` (violet)

**Loading state:** Spinner + "Looking up…"

**Not found state:** "No English/Filipino definition found."

---

## Architecture

### New file: `components/StudentGrading/WordDefinitionPopup.tsx`

Self-contained component. Owns all fetch logic and tab state.

**Props:**
```ts
interface WordDefinitionPopupProps {
  word: string;         // clicked word, stripped of punctuation
  anchorRect: {         // from getBoundingClientRect() of the clicked element
    top: number;
    bottom: number;
    left: number;
    width: number;
  };
  onClose: () => void;
}
```

**Internal state:**
```ts
type DefResult =
  | { pos: string; meaning: string; example?: string; source: 'dictionary' | 'ai' }
  | 'loading'
  | 'not_found';

const [lang, setLang] = useState<'en' | 'fil'>('en');
const [enDef, setEnDef] = useState<DefResult>('loading');
const [filDef, setFilDef] = useState<DefResult>('loading');
```

**Fetch behavior:**
- Both English and Filipino fetches start in parallel on mount via `useEffect([], [])`.
- Results are stored in component state — switching tabs does NOT re-fetch.
- Use a `let cancelled = false` flag per fetch; on cleanup set `cancelled = true` and ignore results if `cancelled`.

**English fetch (`fetchEnglish`):**
```
GET https://api.dictionaryapi.dev/api/v2/entries/en/{word}
```
- On 200: extract `data[0].meanings[0]` → `{ pos: partOfSpeech, meaning: definitions[0].definition, example: definitions[0].example ?? undefined, source: 'dictionary' }`
- On any error or non-200 → `setEnDef('not_found')`

**Filipino fetch (`fetchFilipino`):**
Use `@google/genai` — `new GoogleGenAI({ apiKey: process.env.API_KEY })`.

```ts
const result = await ai.models.generateContent({
  model: 'gemini-2.5-flash',
  contents: `Give a brief Tagalog/Filipino definition of the word "${word}".
Return ONLY valid JSON with exactly this shape:
{"pos":"<bahagi ng pananalita>","meaning":"<1-2 sentence Tagalog definition>","example":"<short Tagalog example sentence or empty string>"}
If the word has no meaningful Filipino definition, return: {"pos":"","meaning":"","example":""}`,
  config: { responseMimeType: 'application/json' },
});
const text = result.text ?? '';
const parsed = JSON.parse(text.trim()); // responseMimeType forces raw JSON — no markdown fence
if (!parsed.meaning) { setFilDef('not_found'); return; }
setFilDef({ pos: parsed.pos, meaning: parsed.meaning, example: parsed.example || undefined, source: 'ai' });
```
On any error (network, parse failure) → `setFilDef('not_found')`.

**Popup positioning:**
- Default (below): `top = anchorRect.bottom + 10`, popup top edge aligns here.
- If not enough space below (`anchorRect.bottom + 10 + 320 > window.innerHeight`) → above: `bottom = window.innerHeight - anchorRect.top + 10` (CSS `bottom` property; popup bottom edge is 10px above the word's top).
- Horizontal: `left = clamp(anchorRect.left + anchorRect.width / 2 - 150, 8, window.innerWidth - 308)`
- Arrow horizontal position: `anchorRect.left + anchorRect.width / 2 - popupLeft`, clamped to `[20, 280]` within the popup.
- Arrow is at the **top** of the popup (pointing up) when below; at the **bottom** (pointing down) when above. Implement as two conditional `::before`/`::after` borders or inline style div.

**Outside-click handler:**
- Attach `document.addEventListener('click', handler)` on mount, remove on unmount.
- `handler`: if `event.target` is not inside the popup element AND not inside the `GrammarHighlightedText` container (passed as a ref or detected via a container class), call `onClose()`. Closing when clicking within the container is handled by `GrammarHighlightedText`'s own `onClick` (which toggles or moves the popup).
- Escape key: `document.addEventListener('keydown', escHandler)` — if `e.key === 'Escape'` call `onClose()`.

---

### Changes to `GrammarHighlightedText.tsx`

Add three pieces:

**1. State:**
```ts
const [defWord, setDefWord] = useState<string | null>(null);
const [defAnchor, setDefAnchor] = useState<{ top: number; bottom: number; left: number; width: number } | null>(null);
const containerRef = useRef<HTMLDivElement>(null);
```

**2. Click handler — word extraction via `caretRangeFromPoint` (primary, no fallback):**

`caretRangeFromPoint` is the only reliable way to identify a word within a plain text node. It is supported in Chrome, Safari, and Firefox (as `document.caretRangeFromPoint` in Chrome/Safari and `document.caretPositionFromPoint` in Firefox). Implement with both:

```ts
const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
  e.stopPropagation(); // prevent document click handler from firing on same event

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

  // Expand range to word boundaries manually (range.expand is non-standard)
  const textNode = range.startContainer as Text;
  const offset = range.startOffset;
  const text = textNode.textContent ?? '';

  // Find word start: walk left while character is a word character (letters + hyphen between letters)
  let start = offset;
  while (start > 0 && isWordChar(text[start - 1])) start--;

  // Find word end: walk right while character is a word character
  let end = offset;
  while (end < text.length && isWordChar(text[end])) end++;

  const word = text.slice(start, end).replace(/^-+|-+$/g, ''); // trim leading/trailing hyphens
  if (!word || word.length < 2) return;

  // Get bounding rect of the word range for popup positioning
  const wordRange = document.createRange();
  wordRange.setStart(textNode, start);
  wordRange.setEnd(textNode, end);
  const rect = wordRange.getBoundingClientRect();

  if (defWord === word) {
    setDefWord(null); setDefAnchor(null);
  } else {
    setDefWord(word);
    setDefAnchor({ top: rect.top, bottom: rect.bottom, left: rect.left, width: rect.width });
  }
};

// Word character: Unicode letters and hyphens between word characters
function isWordChar(ch: string): boolean {
  return /[\p{L}\p{M}-]/u.test(ch);
}
```

Add `onClick={handleContainerClick}` and `ref={containerRef}` to the outer container `<div>`.

**3. Render popup:**
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

## Conflict Avoidance: Grammar Hover vs Definition Click

The grammar tooltip uses `onMouseEnter`/`onMouseLeave` on `<span>` elements. The definition popup uses `document.addEventListener('click')`. These events are fully independent:

- `mouseenter`/`mouseleave` fire on hover — definition popup state is unaffected.
- `click` fires after `mouseup` — grammar tooltip state is unaffected.
- `e.stopPropagation()` in `handleContainerClick` prevents the `document click` outside-handler from seeing the same event that opened the popup, avoiding an immediate re-close.
- The `WordDefinitionPopup` outside-click handler skips close when click is inside the `GrammarHighlightedText` container, deferring to `handleContainerClick`'s own toggle logic.

---

## API Notes

- **`dictionaryapi.dev`:** Free, no API key, ~1000 req/hour per IP.
- **Gemini:** `process.env.API_KEY`, model `gemini-2.5-flash`, `responseMimeType: 'application/json'` forces raw JSON response (no markdown fences to strip).
- Both fetches are parallel on mount; no retry logic.

---

## Out of Scope

- Caching definitions across sessions
- Audio pronunciation
- Multiple definitions / synonyms / antonyms
- Clicking text outside `GrammarHighlightedText`

---

## Acceptance Criteria

1. Clicking any word in the essay (plain or highlighted) opens the popup positioned near that word
2. English tab shows definition from `dictionaryapi.dev`; Filipino tab shows Gemini Tagalog definition
3. Switching EN ↔ FIL tab does not close or reposition the popup
4. Clicking the same word again closes the popup; clicking a different word moves it
5. Clicking outside the `GrammarHighlightedText` container or pressing Escape closes the popup
6. Hovering a grammar-highlighted span still shows the grammar tooltip independently of the definition popup state
7. Words with no dictionary/AI match show "not found" gracefully with no crash
8. No TypeScript errors introduced
9. Filipino compound words with hyphens (e.g., `kahanga-hanga`) are treated as single words
