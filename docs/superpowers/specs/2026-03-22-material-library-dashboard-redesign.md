# Material Library & Dashboard Redesign Spec
**Date:** 2026-03-22
**Status:** Approved
**Scope:** Frontend-only (one new backend endpoint for language detection)

---

## Overview

Improve the Material Library and Dashboard for better teacher usability, targeting Grade 7 comprehension context in the Philippine DepEd setting. Changes span three areas: language categorization, result readability, and dashboard polish.

---

## 1. Language Detection & Categorization

### Goal
Tag each material as `English` or `Filipino` so teachers can filter by subject language.

### Approach

**Backend:** Add `POST /detect-language` endpoint to `backend/main.py`.
- Accepts `{ text: string }`
- Uses existing `langdetect` import (already in `grammar_service.py` and `requirements.txt`)
- Maps `"en"` → `"eng"`, everything else → `"fil"` (PH context default)
- Returns `{ language: "eng" | "fil" }`
- Error handling: wrap in try/except `LangDetectException` (already imported in `grammar_service.py`); on failure return `{ language: "fil" }` as the safe default
- Also catch generic exceptions and return `{ language: "fil" }` — very short or numeric-only text may throw

**Frontend service:** Add `detectLanguageAPI(text: string): Promise<'eng' | 'fil'>` to `services/pythonService.ts`.
- On network error or unexpected response, default to `'fil'`

### Type

Add `language: 'eng' | 'fil'` to `LibraryMaterial` in `types.ts`.

> **Note on format:** The existing codebase has a `Language` enum with values `"English"` / `"Filipino"` and a separate `'english' | 'filipino'` string union on `DepEdRubricScore`. The new `'eng' | 'fil'` values are ISO-style codes returned by the `/detect-language` API and are intentionally distinct — they are not interchangeable with the existing enum. Add a comment in `types.ts` to document this.

### State & Reload Behavior

- Language is derived **at upload time** via `detectLanguageAPI()` and stored in local React state as part of the `LibraryMaterial` object.
- Language is **NOT persisted to Supabase** (see Out of Scope). On page reload, `loadMaterialUploads()` returns materials without a `language` field.
- **Re-detection on load:** After `loadMaterialUploads()` resolves, call `detectLanguageAPI()` for each material in parallel (`Promise.all`) using the stored `material_text`. Assign results to the loaded materials before setting state. Show a brief loading state (the existing spinner is sufficient) until this resolves.
- **Performance note:** This is N API calls on every load. Acceptable for the expected library size (< 50 materials). If the library grows, a future optimization can store language in the `complexity_result` JSON blob (no schema change needed since it's a JSONB column).

### UI
- Each material card shows a language tag: `🇬🇧 EN` or `🇵🇭 FIL` (Unicode flag emoji — intentional, approved in design review; consistent rendering across modern browsers/OS)
- Filter tabs get two new options inserted before the complexity tabs: `🇬🇧 English (n)` and `🇵🇭 Filipino (n)`
- A thin vertical rule (1px, gray) separates language filters from complexity filters

---

## 2. Material Library Result Optimization

### 2a. Model Reasoning — Plain Language + Reason Tags

**Problem:** The current `cr.reasoning` is raw model output text — opaque to teachers.

**Solution:** Add a `parseReasoning(reasoning: string, level: ComplexityLevel): { summary: string; tags: string[] }` utility function inline in `MaterialLibrary.tsx`.

**Summary** — one plain-language sentence, derived from the complexity level (not from parsing the raw text):
- Literal: *"This material uses simple words and short sentences that Grade 7 students can read on their own."*
- Inferential: *"This material requires students to read between the lines — some teacher support may be needed."*
- Evaluative: *"This material uses complex ideas and language that are above Grade 7 level — scaffolding is recommended."*

**Tags** — keyword-matched from the raw `reasoning` string (case-insensitive):
- Literal keywords → tags: `"short sentence"` → `Short sentences`, `"common word"` / `"simple word"` / `"basic word"` → `Common words`, `"direct"` / `"explicit"` → `Direct ideas`, `"low readab"` / `"easy"` → `Easy to read`
- Inferential keywords → tags: `"implied"` / `"infer"` → `Implied meaning`, `"moderate"` → `Moderate vocabulary`, `"context clue"` → `Context clues needed`
- Evaluative keywords → tags: `"abstract"` → `Abstract concepts`, `"complex"` → `Complex structure`, `"advanced"` / `"difficult"` → `Advanced vocabulary`
- **If no keywords match, render no tags (summary sentence only).** This is the expected fallback and is not an error state.
- **If `cr.reasoning` is empty or null, render the summary sentence only with no tags.**
- Maximum tags to display: 4 (take first 4 matched).

**Rendering (replaces existing teal `bg-teal-50` reasoning box):**
```
[Why is this Literal?]         ← heading, colored to match level (meta.text)
This material uses simple...   ← summary sentence
[✓ Short sentences] [✓ ...]   ← pill tags, colored to match level
```

### 2b. Side-by-Side Comparison — Default Open

**Problem:** The comparison view is hidden behind a "Compare Original" button and only shown for images.

**Solution:**
- In `DetailModal`, change the `viewMode` state initializer to: `useState<'text' | 'sideBySide'>(material.originalFile ? 'sideBySide' : 'text')`
- This uses the initializer form of `useState` so the default is derived from the material at mount time (the modal re-mounts per material, so no `useEffect` needed)
- Applies to both images (existing) and PDFs (existing iframe rendering)
- Panel labels updated: `Original File` → `📄 Uploaded Material`, `Scanned Text` → `📝 Extracted Text`
- The toggle button stays so teachers can switch to "Text Only"

### 2c. Grade 7 Context Banner — More Prominent

**Problem:** The info note is small blue text, easy to miss.

**Solution:** Keep the existing blue banner but add a bold heading above the description:
```
Grade 7 Readability Check (Philippines DepEd)   ← bold heading, uppercase, small
Literal = Easy, students can read independently.
Inferential = Borderline, may need teacher support.
Evaluative = Above G7, not recommended without scaffolding.
```

---

## 3. Dashboard Improvements

### 3a. Subtitle on Hero Section
Add a subtitle below "Dashboard Overview":
> *Grade 7 Reading Complexity & Proficiency Tracker*

### 3b. Metric Card Subtitles
- **Essays** → subtitle: `submitted for scoring`
- **Materials** → subtitle: `uploaded to library`
- Students and Avg Teacher Rating → no subtitle needed

### 3c. Chart Section Labels with Subtitles
`DistributionChart` is defined **inline in `Dashboard.tsx`** (not a separate file). Add a `subtitle?: string` prop to its interface and render it below the title label.

- Essay Proficiency → subtitle: `How well are your students writing?`
- Material Complexity → subtitle: `Are your materials right for Grade 7 students?`

### 3d. Consistent Label Pattern — English Bold, Filipino Light
All row labels in both `DistributionChart` instances use the same inline pattern:
```tsx
<span style={{ fontWeight: 700 }}>Beginning</span>
<span style={{ color: '#b0b7c3', fontSize: '10px' }}> · Nagsisimula</span>
```

Mapping:
| English (bold) | Filipino (light) |
|---|---|
| Beginning | Nagsisimula |
| Developing | Papaunlad |
| Proficient | Mahusay |
| Literal | · Easy, G7 Readable |
| Inferential | · Moderate, Borderline |
| Evaluative | · Difficult, Above G7 |

The `DistributionRow` interface's `label` field changes from a plain string to a React node (`label: React.ReactNode`) to support the bilingual inline pattern.

### 3e. Quick-Action Cards (replace ToolCard grid)
Two cards replacing the existing `ToolCard` grid section:
- **Upload a Material** (📚, blue `Complexity` badge) → `navigate("/material")`
- **Grade an Essay** (📝, teal `Proficiency` badge) → `navigate("/student")`

Each card: emoji icon, badge, bold title, one-line description, teal primary button. The existing `ToolCard` component can be reused with updated styling, or replaced inline — either is acceptable.

### 3f. "How to Read This Dashboard" Legend
Replace the current small bottom legend with:
- Heading: `How to read this dashboard` (small bold)
- Body: *"Complexity measures if a reading material is G7-readable. Proficiency measures a student's writing quality. These are two separate AI models."*
- `Complexity` in blue, `Proficiency` in teal — same as current.

---

## Files to Change

| File | Change |
|------|--------|
| `backend/main.py` | Add `POST /detect-language` endpoint with LangDetectException handling |
| `services/pythonService.ts` | Add `detectLanguageAPI()` with error fallback |
| `types.ts` | Add `language: 'eng' \| 'fil'` to `LibraryMaterial`; add clarifying comment |
| `components/MaterialLibrary.tsx` | Language detection on upload + bulk re-detect on load; language filter tabs; `parseReasoning()` utility; side-by-side default via useState initializer; G7 banner heading |
| `components/Dashboard.tsx` | Hero subtitle; metric subtitles; `DistributionChart` subtitle prop + bilingual labels; quick-action cards; legend section |

**No new files. No DB migration.**

---

## Out of Scope
- Upload flow changes
- Complexity scoring logic
- Persisting the `language` field to Supabase (language is re-derived from `material_text` on each page load — intentional)
- DB schema changes
- Navigation or auth changes
- Essay Scoring / Grammar Checker pages
