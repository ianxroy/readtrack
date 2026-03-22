# Material Checker — Grade 7 Fix & Reliability Spec
**Date:** 2026-03-23
**Status:** Approved
**Scope:** Frontend-only (`components/MaterialChecker.tsx`). No backend changes.

---

## Overview

MaterialChecker is the interactive material-checking tool at the `/material` route. Teachers paste or upload a reading passage and get an instant complexity verdict. It is **not** the same as Essay Scoring — it checks reading materials for Grade 7 appropriateness, not student writing quality.

The component is currently broken due to an incomplete refactor: student essay analysis code (`analyzeStudentWorkAPI`, grammar checking, `InteractiveEditor`) was partially removed but left behind dead state, imports, and broken type references — causing 4 TypeScript errors and a non-functional results panel.

This spec covers:
1. Surgical removal of all dead student-diagnosis code
2. Fixing all 4 TypeScript errors
3. Adding a **G7 Suitability Panel** that gives teachers a clear Phil-IRI–aligned recommendation

---

## 1. Dead Code Removal

Remove all of the following from `MaterialChecker.tsx`. Nothing from this list should remain after the fix.

### Imports to remove
- `analyzeStudentWorkAPI` from `'../services/pythonService'`
- `checkGrammar` from wherever it is imported
- Any Gemini-service imports used only for grammar or reference validation

### State to remove
- `diagnosisResult` / `setDiagnosisResult`
- `currentIssues` / `setCurrentIssues`
- `grammarResult` / `setGrammarResult`
- `geminiApiKey` / `setGeminiApiKey`
- `useReferenceValidation` / `setUseReferenceValidation`
- `referenceFiles` / `setReferenceFiles`
- `showReferenceInput` / `setShowReferenceInput`
- `referenceText` / `setReferenceText`

### Components to remove (inline or local)
- `VerdictCard` — was displaying broken student proficiency score (`result.score` does not exist on `StudentDiagnosisResult`)
- `InteractiveEditor` — grammar-highlighting text editor, replaced by plain `<textarea>`

### Props to remove from `MaterialProps` and component destructuring
- `referenceFileName`
- `onSaveReference`

### Logic to remove from `handleAnalyze`
- `checkGrammar(...)` call
- The fake `diag` stub object (`const diag: any = { analyzed_text, issues: [], contentValidation: null }`)
- `setDiagnosisResult(diag)`
- `setCurrentIssues(diag.issues)`
- Reference validation block (`if (useReferenceValidation && showReferenceInput) { ... }`)
- Any reference to `analyzeStudentWorkAPI`

### Reference validation UI to remove
- Toggle checkbox for "Use Reference Validation"
- Reference file upload section
- Any UI that shows `contentValidation` results

---

## 2. TypeScript Error Fixes

After removal, all 4 pre-existing errors resolve:

| Line | Error | Resolution |
|------|-------|------------|
| 291 | `Property 'score' does not exist on type 'StudentDiagnosisResult'` | `VerdictCard` removed |
| 822 | `Property 'referenceFileName' does not exist on type 'MaterialProps'` | Prop removed from destructuring |
| 823 | `Property 'onSaveReference' does not exist on type 'MaterialProps'` | Prop removed from destructuring |
| 1266 | `Type 'TextComplexityResult' is missing properties from type 'StudentDiagnosisResult'` | `diagnosisResult` removed; only `complexityResult` flows through |

**Verify after changes:** `npx tsc --noEmit` should produce zero errors from `MaterialChecker.tsx`.

---

## 3. Simplified `handleAnalyze`

After removal, `handleAnalyze` does one thing:

```typescript
const handleAnalyze = async () => {
  setErrorMessage(null);
  const textToAnalyze = inputText || currentText;
  if (!textToAnalyze.trim() && !selectedFile) {
    setErrorMessage("Please enter text or upload a document to analyze.");
    return;
  }
  if (!selectedFile && textToAnalyze.trim().length < 15) {
    setErrorMessage("Text is too short to analyze. Please enter at least a sentence.");
    return;
  }
  setIsLoading(true);
  try {
    const comp = await classifyTextComplexityAPI(textToAnalyze, selectedFile?.base64, selectedFile?.mimeType);
    setComplexityResult(comp);
    if (onSaveAnalysis) {
      onSaveAnalysis({ /* CachedAnalysis shape */ complexityResult: comp, ... });
    }
  } catch (err) {
    setErrorMessage("Analysis failed. Please try again.");
  } finally {
    setIsLoading(false);
  }
};
```

`hasResults = !!complexityResult` (no longer requires `diagnosisResult`).

---

## 4. Text Input — Plain Textarea

Replace `InteractiveEditor` with a plain `<textarea>`:
- Controlled by `inputText` state (existing)
- Same placeholder and sizing as before
- No grammar highlighting (removed)
- File upload drag-and-drop stays (existing `handleFileUpload` / `handleDrop` logic)

---

## 5. G7 Suitability Panel (new)

Rendered **above** the existing readability card in the results column. Derived entirely from `complexityResult` — no new API call.

### 5a. Verdict derivation (frontend logic)

```typescript
type G7Verdict = 'ready' | 'support' | 'above';

function deriveG7Verdict(
  level: ComplexityLevel,
  fkGradeLevel: number
): G7Verdict {
  if (level === ComplexityLevel.EVALUATIVE) return 'above';
  if (level === ComplexityLevel.INFERENTIAL) return 'support';
  // Literal:
  if (fkGradeLevel >= 9) return 'support';
  return 'ready';
}
```

### 5b. Phil-IRI level derivation

```typescript
type PhilIriReadingLevel = 'independent' | 'instructional' | 'frustration';

function derivePhilIriLevel(fkGradeLevel: number): PhilIriReadingLevel {
  if (fkGradeLevel <= 5) return 'independent';   // below grade level
  if (fkGradeLevel <= 8) return 'instructional'; // on grade level (ideal for G7)
  return 'frustration';                           // above grade level
}
```

> **Note:** `fkGradeLevel` comes from `complexityResult.readability.flesch_kincaid`. This value is the FK Grade Level score (a number like 6.4), not the Reading Ease score. Verify the field name matches the backend response — if the backend returns a reading ease score instead, use the mapping: ease ≥ 70 → independent, 60–69 → instructional, < 60 → frustration.

### 5c. Vocabulary percentage breakdown

```typescript
const cefr = complexityResult.metrics?.cefrWordGroups; // { basic, independent, proficient }
const totalCefrWords = (cefr?.basic.length ?? 0) + (cefr?.independent.length ?? 0) + (cefr?.proficient.length ?? 0);
const basicPct   = totalCefrWords > 0 ? Math.round((cefr.basic.length / totalCefrWords) * 100) : null;
const midPct     = totalCefrWords > 0 ? Math.round((cefr.independent.length / totalCefrWords) * 100) : null;
const advPct     = totalCefrWords > 0 ? Math.round((cefr.proficient.length / totalCefrWords) * 100) : null;
```

If `totalCefrWords === 0` (e.g. Filipino text where CEFR is unavailable), omit the vocabulary row entirely.

### 5d. UI rendering

```
┌──────────────────────────────────────────────────────┐
│  GRADE 7 SUITABILITY (DepEd / Phil-IRI)              │  ← 10px bold uppercase teal-600
│                                                      │
│  ✅ Ready for Grade 7                                │  ← verdict badge
│  Students can read this independently.               │  ← plain sentence
│                                                      │
│  Phil-IRI Reading Level: Instructional               │  ← label: value
│  Vocabulary Mix:  72% basic · 21% intermediate       │
│                    · 7% advanced                     │  ← omit if no CEFR data
└──────────────────────────────────────────────────────┘
```

**Verdict display values:**

| Verdict | Badge | Sentence |
|---------|-------|---------|
| `ready` | ✅ Ready for Grade 7 | "Students can read this material independently at Grade 7 level." |
| `support` | ⚠️ Use with Teacher Support | "This material may challenge some Grade 7 students — teacher guidance is recommended." |
| `above` | ❌ Above Grade 7 Level | "This material is above Grade 7 readability — scaffolding or simplification is recommended before use." |

**Phil-IRI level display values:**

| Level | Display |
|-------|---------|
| `independent` | Independent (below G7 — may be too easy) |
| `instructional` | Instructional (on G7 level — ideal) |
| `frustration` | Frustration (above G7 — too difficult) |

**Styling:**
- Panel background: same teal-50 / blue-50 card style as the G7 banner in Material Library
- Verdict badge: green for `ready`, amber for `support`, red for `above`
- Phil-IRI and vocabulary rows: small (text-xs), label in gray-500, value in gray-700

---

## 6. Results Layout After Fix

Left panel: plain `<textarea>` with file upload zone (no grammar highlighting).

Right panel (top to bottom):
1. **G7 Suitability Panel** ← new
2. Complexity verdict (Literal / Inferential / Evaluative) ← existing
3. Readability scores (Flesch-Kincaid + Gunning Fog) ← existing
4. `ComplexityMetricsCard` (CEFR word groups, keywords) ← existing

---

## 7. What Is NOT Changed

- File upload logic (drag-and-drop, image OCR, PDF extraction)
- `CachedAnalysis` / `onSaveAnalysis` / `selectedAnalysis` props
- Backend — no new endpoints, no changes to `classifyTextComplexityAPI`
- Navigation or routing
- Material Library (`MaterialLibrary.tsx`) — separate component, untouched

---

## Files to Change

| File | Change |
|------|--------|
| `components/MaterialChecker.tsx` | Remove dead code, fix TS errors, replace InteractiveEditor with textarea, add G7 Suitability Panel |

**No new files. No backend changes. No DB migration.**
