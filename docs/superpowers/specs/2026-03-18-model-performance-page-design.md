# Model Performance Page — Design Spec

**Date:** 2026-03-18
**Project:** ReadTrack — Philippine Grade 7 Essay Grading
**Feature:** Live model performance page showing F1 score, per-class metrics, and confusion matrix comparing system predictions against teacher rubric scores.

---

## Goal

Give teachers a full-page view of how accurately the SVM model is classifying essay proficiency, compared to their own rubric ratings. The page surfaces macro F1, per-class precision/recall/F1, and a color-coded confusion matrix — one language at a time (English or Filipino).

---

## Architecture

### Data flow

```
Teacher saves rubric scores
        ↓
Supabase: student_grading_uploads
  - diagnosis_result.proficiency  (system prediction)
  - teacher_rubric_scores.overall (teacher label, via _score_to_label)
        ↓
GET /train/performance?lang=en|tl
  - Queries Supabase for rows with BOTH fields populated
  - Maps teacher overall → Mahusay/Papaunlad/Nagsisimula via _score_to_label
  - sklearn: classification_report + confusion_matrix
        ↓
ModelPerformancePage.tsx
  - Language toggle → refetch
  - Renders metric cards, per-class bars, confusion matrix heatmap
```

### Layers

| Layer | Responsibility |
|---|---|
| `backend/main.py` | `/train/performance` endpoint — query, compute, return JSON |
| `services/pythonService.ts` | `getModelPerformanceAPI(lang)` — typed fetch wrapper |
| `components/StudentGrading/ModelPerformancePage.tsx` | Full-page UI component |
| `components/StudentGrading/index.tsx` | Header button + `showPerformance` state toggle |

---

## Backend: `GET /train/performance?lang=en|tl`

### Query

Fetch all rows from `student_grading_uploads` where:
- `teacher_rubric_scores IS NOT NULL`
- `diagnosis_result IS NOT NULL`
- `subject_language = lang` (use the `en`/`tl` value stored in the column)

### Computation

For each row:
- **System label**: `row['diagnosis_result']['proficiency']` — already normalized to Mahusay/Papaunlad/Nagsisimula
- **Teacher label**: `_score_to_label(row['teacher_rubric_scores']['overall'])`

Use `sklearn.metrics.classification_report` and `confusion_matrix` with `labels = ["Mahusay", "Papaunlad", "Nagsisimula"]`.

### Response (success)

```json
{
  "lang": "en",
  "total_compared": 34,
  "macro_f1": 0.71,
  "per_class": {
    "Mahusay":     { "precision": 0.80, "recall": 0.75, "f1": 0.77, "support": 14 },
    "Papaunlad":   { "precision": 0.65, "recall": 0.70, "f1": 0.67, "support": 12 },
    "Nagsisimula": { "precision": 0.72, "recall": 0.67, "f1": 0.69, "support": 8 }
  },
  "confusion_matrix": {
    "labels": ["Mahusay", "Papaunlad", "Nagsisimula"],
    "matrix": [[10, 3, 1], [2, 8, 2], [1, 2, 5]]
  },
  "confidence_level": "Kalibrado",
  "rated_essays": 34
}
```

### Response (insufficient data)

When fewer than 3 teacher-rated essays exist (not enough to compute meaningful metrics):
```json
{ "insufficient_data": true, "rated_essays": 2, "lang": "en" }
```

### Error handling

- Missing Supabase credentials → return `{ "insufficient_data": true, "rated_essays": 0 }` (never 503)
- Any exception → log + return `{ "error": "..." }`

---

## Frontend: `ModelPerformancePage.tsx`

### State

```typescript
const [lang, setLang] = useState<'en' | 'tl'>('en');
const [data, setData] = useState<ModelPerformanceData | null>(null);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);
```

Refetch on `lang` change via `useEffect([lang])`.

### TypeScript interface (in `pythonService.ts`)

```typescript
export interface PerClassMetrics {
  precision: number;
  recall: number;
  f1: number;
  support: number;
}

export interface ModelPerformanceData {
  lang: string;
  total_compared: number;
  macro_f1: number;
  per_class: Record<string, PerClassMetrics>;
  confusion_matrix: {
    labels: string[];
    matrix: number[][];
  };
  confidence_level: string;
  rated_essays: number;
  insufficient_data?: boolean;
}
```

### Layout

```
┌─────────────────────────────────────────────────────┐
│  ← Bumalik    KATUMPAKAN NG MODELO                  │
│                                    [🇺🇸 EN] [🇵🇭 TL] │
├─────────────────────────────────────────────────────┤
│  ● Kalibrado   34 essays rated   Last retrain: 3d   │
├──────────┬──────────┬────────────┬───────────────────┤
│ Macro F1 │ Precision│   Recall   │  Total Compared   │
│   0.71   │   0.72   │    0.71    │       34          │
├─────────────────────────────────────────────────────┤
│  PER-CLASS BREAKDOWN                                │
│  Mahusay     ████████████████░  0.77  (14 essays)  │
│  Papaunlad   █████████████░░░░  0.67  (12 essays)  │
│  Nagsisimula ██████████████░░░  0.69  ( 8 essays)  │
├─────────────────────────────────────────────────────┤
│  CONFUSION MATRIX                                   │
│  Rows = System Prediction, Cols = Teacher Label     │
│               Mahusay  Papaunlad  Nagsisimula       │
│  Mahusay      [10]      [ 3]       [ 1]  ← teal    │
│  Papaunlad    [ 2]      [ 8]       [ 2]             │
│  Nagsisimula  [ 1]      [ 2]       [ 5]             │
└─────────────────────────────────────────────────────┘
```

### Visual details

- **Confusion matrix cells**: diagonal = `bg-teal-100` (correct), off-diagonal = `bg-red-50` to `bg-red-300` scaled by count relative to row total
- **Per-class bars**: teal fill, width = `f1 * 100%`
- **Macro F1 card**: color-coded — ≥0.80 teal, ≥0.60 amber, <0.60 red
- **Skeleton loader**: gray placeholder cards while `loading`
- **Empty state**: "Hindi pa sapat ang datos" with count when `insufficient_data: true`

---

## Navigation integration (`index.tsx`)

Add a `📊` icon button to the existing header bar (right side, before any existing header actions). Clicking it sets `showPerformance = true`. The `ModelPerformancePage` renders a `← Bumalik` button that sets it back to `false`.

```tsx
// In header:
<button onClick={() => setShowPerformance(true)}>
  <IoStatsChartOutline />
</button>

// In render:
if (showPerformance) return <ModelPerformancePage onBack={() => setShowPerformance(false)} />;
```

No routing changes needed — simple boolean gate.

---

## Files

| File | Action |
|---|---|
| `backend/main.py` | Add `GET /train/performance` endpoint |
| `services/pythonService.ts` | Add `PerClassMetrics`, `ModelPerformanceData` interfaces + `getModelPerformanceAPI` |
| `components/StudentGrading/ModelPerformancePage.tsx` | Create new full-page component |
| `components/StudentGrading/index.tsx` | Add header button + `showPerformance` state |

---

## Out of scope

- Historical performance tracking over time
- Per-student or per-section breakdown
- Exporting metrics as PDF/CSV
