# Model Performance Page — Design Spec

**Date:** 2026-03-18
**Project:** ReadTrack — Philippine Grade 7 Essay Grading
**Feature:** Live model performance page showing F1 score, per-class metrics, confusion matrix, and per-rubric-dimension comparison between system Gemini scores and teacher scores.

---

## Goal

Give teachers a full-page view of how accurately the SVM model classifies essay proficiency, compared to their own rubric ratings. The page shows:
1. Macro F1 + precision/recall summary
2. Per-class (Mahusay/Papaunlad/Nagsisimula) F1 bars
3. A color-coded confusion matrix
4. Per-dimension (Content/Organization/Language/Grammar/Mechanics) mean absolute error comparing system Gemini scores vs teacher scores

One language at a time (English / Filipino toggle).

---

## Data Sources

### Proficiency comparison (for F1 + confusion matrix)
- **System label**: `diagnosis_result['proficiency']` — string stored in Supabase
- **Teacher label**: `_score_to_label(teacher_rubric_scores['overall'])` — derived from teacher's average rubric score

### Dimension comparison (for per-dimension MAE section)
- **System score per dim**: `diagnosis_result['rubricScore']['content']['score']` (1–4 int) — Gemini evaluation stored inside `diagnosis_result` JSON
- **Teacher score per dim**: `teacher_rubric_scores['content']` (1–4 int) — stored in `teacher_rubric_scores` column

`rubricScore` is saved inside `diagnosis_result` in Supabase because `index.tsx` merges them: `{ ...diagnosisResult, rubricScore }` before saving.

---

## Architecture

```
Teacher saves rubric scores
        ↓
Supabase: student_grading_uploads
  - diagnosis_result.proficiency       → system proficiency label
  - diagnosis_result.rubricScore.*     → system per-dimension Gemini scores (1-4)
  - teacher_rubric_scores.overall      → teacher overall (1-4 avg)
  - teacher_rubric_scores.{dim}        → teacher per-dimension scores (1-4)
        ↓
GET /train/performance?lang=en|tl
  - New dedicated Supabase query (NOT _get_training_rows)
  - Normalizes legacy proficiency labels
  - sklearn: classification_report + confusion_matrix for F1
  - Per-dimension MAE computation
        ↓
ModelPerformancePage.tsx
  - Language toggle (en/tl) → refetch
  - Renders metric cards, per-class bars, confusion matrix, dimension MAE table
```

---

## Backend: `GET /train/performance?lang=en|tl`

### Query

Write a **new dedicated query** (do NOT reuse `_get_training_rows` — it only fetches `essay_text, teacher_rubric_scores, subject_language`). Select:
```python
supabase
  .from_("student_grading_uploads")
  .select("diagnosis_result, teacher_rubric_scores, subject_language")
  .eq("subject_language", lang)
  .not_.is_("teacher_rubric_scores", "null")
  .not_.is_("diagnosis_result", "null")
  .execute()
```

### Label extraction

For each row, extract labels:
```python
VALID_LABELS = {"Mahusay", "Papaunlad", "Nagsisimula"}
LEGACY_MAP = {"Independent": "Mahusay", "Instructional": "Papaunlad", "Frustration": "Nagsisimula"}

sys_raw = row["diagnosis_result"].get("proficiency", "")
sys_label = LEGACY_MAP.get(sys_raw, sys_raw)  # normalize legacy labels
if sys_label not in VALID_LABELS:
    continue  # skip rows with unknown/missing labels

teacher_overall = row["teacher_rubric_scores"].get("overall", 0)
teacher_label = _score_to_label(teacher_overall)
```

### F1 / confusion matrix computation

```python
from sklearn.metrics import classification_report, confusion_matrix

LABELS = ["Mahusay", "Papaunlad", "Nagsisimula"]

# y_true = teacher labels, y_pred = system labels
report = classification_report(teacher_labels, system_labels, labels=LABELS, output_dict=True, zero_division=0)
cm = confusion_matrix(teacher_labels, system_labels, labels=LABELS).tolist()

# Extract macro averages from sklearn's "macro avg" key (note: space, not underscore)
macro = report["macro avg"]
macro_f1        = round(macro["f1-score"], 3)
macro_precision = round(macro["precision"], 3)
macro_recall    = round(macro["recall"], 3)
```

**Confusion matrix convention**: rows = teacher (true), columns = system (predicted). Match sklearn default. UI labels rows as "Guro (Tunay)" and columns as "Sistema (Hula)".

### Per-dimension MAE computation

Only include essays where `diagnosis_result.rubricScore` is present AND all 5 teacher dim scores are present.

```python
DIMS = ["content", "organization", "languageVocab", "grammar", "mechanics"]

dim_errors = {d: [] for d in DIMS}
for row in rows:
    rubric = row["diagnosis_result"].get("rubricScore")
    teacher = row["teacher_rubric_scores"]
    if not rubric or not teacher:
        continue
    for dim in DIMS:
        sys_score = (rubric.get(dim) or {}).get("score")
        tea_score = teacher.get(dim)
        if sys_score is not None and tea_score is not None:
            dim_errors[dim].append(abs(sys_score - tea_score))

per_dimension = {
    dim: {
        "mae": round(sum(errs)/len(errs), 2) if errs else None,
        "samples": len(errs),
        "avg_system": round(sum(...)/len(...), 2),   # avg system score
        "avg_teacher": round(sum(...)/len(...), 2),  # avg teacher score
    }
    for dim, errs in dim_errors.items()
}
```

### Insufficient data threshold

Return `insufficient_data: true` when `total_compared < 5` (consistent with the retrain minimum of 5). Do not run sklearn on fewer than 5 samples.

### Response (success)

```json
{
  "lang": "en",
  "total_compared": 34,
  "macro_f1": 0.71,
  "macro_precision": 0.72,
  "macro_recall": 0.71,
  "per_class": {
    "Mahusay":     { "precision": 0.80, "recall": 0.75, "f1": 0.77, "support": 14 },
    "Papaunlad":   { "precision": 0.65, "recall": 0.70, "f1": 0.67, "support": 12 },
    "Nagsisimula": { "precision": 0.72, "recall": 0.67, "f1": 0.69, "support": 8 }
  },
  "confusion_matrix": {
    "labels": ["Mahusay", "Papaunlad", "Nagsisimula"],
    "matrix": [[10, 3, 1], [2, 8, 2], [1, 2, 5]],
    "row_label": "Guro (Tunay)",
    "col_label": "Sistema (Hula)"
  },
  "per_dimension": {
    "content":      { "mae": 0.45, "samples": 28, "avg_system": 2.8, "avg_teacher": 2.5 },
    "organization": { "mae": 0.52, "samples": 28, "avg_system": 2.6, "avg_teacher": 2.3 },
    "languageVocab":{ "mae": 0.61, "samples": 28, "avg_system": 2.4, "avg_teacher": 2.1 },
    "grammar":      { "mae": 0.38, "samples": 28, "avg_system": 2.9, "avg_teacher": 2.7 },
    "mechanics":    { "mae": 0.43, "samples": 28, "avg_system": 2.7, "avg_teacher": 2.5 }
  },
  "confidence_level": "Kalibrado",
  "rated_essays": 34,
  "last_retrain": "2026-03-15T08:00:00Z"
}
```

`last_retrain` is read from `_read_retrain_status()[lang]["last_retrain"]`.

### Response (insufficient data)

```json
{ "insufficient_data": true, "rated_essays": 2, "lang": "en" }
```

### Error handling

- Missing Supabase credentials → return `{ "insufficient_data": true, "rated_essays": 0, "lang": lang }` (never 503)
- Any other exception → log traceback + return `{ "error": "..." }`

---

## Frontend

### TypeScript interfaces (add to `services/pythonService.ts`)

```typescript
export interface PerClassMetrics {
  precision: number;
  recall: number;
  f1: number;
  support: number;
}

export interface DimensionMetrics {
  mae: number | null;
  samples: number;
  avg_system: number;
  avg_teacher: number;
}

export interface ModelPerformanceData {
  lang: string;
  total_compared: number;
  macro_f1: number;
  macro_precision: number;
  macro_recall: number;
  per_class: Record<string, PerClassMetrics>;
  confusion_matrix: {
    labels: string[];
    matrix: number[][];
    row_label: string;
    col_label: string;
  };
  per_dimension: Record<string, DimensionMetrics>;
  confidence_level: string;
  rated_essays: number;
  last_retrain: string | null;
  insufficient_data?: boolean;
  error?: string;
}

export async function getModelPerformanceAPI(lang: 'en' | 'tl'): Promise<ModelPerformanceData> {
  const res = await fetch(`${PYTHON_API_BASE}/train/performance?lang=${lang}`);
  return res.json();
}
```

### `ModelPerformancePage.tsx` — state

```typescript
const [lang, setLang] = useState<'en' | 'tl'>('en');
const [data, setData] = useState<ModelPerformanceData | null>(null);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

useEffect(() => {
  setLoading(true);
  getModelPerformanceAPI(lang)
    .then(d => { setData(d); setError(d.error ?? null); })
    .catch(e => setError(e.message))
    .finally(() => setLoading(false));
}, [lang]);
```

### Layout

```
┌──────────────────────────────────────────────────────────┐
│  ← Bumalik     KATUMPAKAN NG MODELO         [🇺🇸][🇵🇭]   │
├──────────────────────────────────────────────────────────┤
│  ● Kalibrado   34 rated   Last retrain: Mar 15           │
├──────────┬───────────┬────────────┬──────────────────────┤
│ Macro F1 │ Precision │   Recall   │   Total Compared     │
│   0.71   │   0.72    │    0.71    │        34            │
├──────────────────────────────────────────────────────────┤
│  BAWAT ANTAS (Per-class F1)                              │
│  Mahusay     ████████████████░  0.77  (14)              │
│  Papaunlad   █████████████░░░░  0.67  (12)              │
│  Nagsisimula ██████████████░░░  0.69  ( 8)              │
├──────────────────────────────────────────────────────────┤
│  CONFUSION MATRIX                                        │
│  Rows = Guro (Tunay), Cols = Sistema (Hula)              │
│                  Mahusay  Papaunlad  Nagsisimula          │
│  Mahusay          [10]      [ 3]       [ 1]              │
│  Papaunlad        [ 2]      [ 8]       [ 2]              │
│  Nagsisimula      [ 1]      [ 2]       [ 5]              │
├──────────────────────────────────────────────────────────┤
│  BAWAT DIMENSYON (Per-dimension MAE, lower = better)     │
│                Sistema  Guro   MAE                       │
│  Nilalaman      2.8     2.5   ████░ 0.45                 │
│  Organisasyon   2.6     2.3   █████░ 0.52                │
│  Wika/Bokab.    2.4     2.1   ██████░ 0.61               │
│  Gramatika      2.9     2.7   ████░ 0.38                 │
│  Mekaniks       2.7     2.5   ████░ 0.43                 │
└──────────────────────────────────────────────────────────┘
```

### Visual details

**Macro F1 card**: `≥ 0.80` teal, `≥ 0.60` amber, `< 0.60` red

**Confusion matrix**:
- Diagonal cells: `bg-teal-100 text-teal-800` (correct predictions)
- Off-diagonal cells: white → `bg-red-50` → `bg-red-200` scaled by `cell / row_total`

**Per-dimension MAE bars**: max bar width = MAE of 1.0. Color: `≤ 0.4` teal, `≤ 0.7` amber, `> 0.7` red

**Skeleton loader**: 4 gray placeholder card rows while `loading = true`

**Empty state** (when `insufficient_data`):
> "Hindi pa sapat ang datos para makalkula ang katumpakan. Kailangan ng hindi bababa sa 5 na na-rate na essay."
> Shows `rated_essays` count.

---

## Navigation (`index.tsx`)

Add `showPerformance` boolean state initialized to `false`.

In the header, add a stats button (right side):
```tsx
<button onClick={() => setShowPerformance(true)}>
  <IoStatsChartOutline />
</button>
```

Gate the render before the three-column layout:
```tsx
if (showPerformance) {
  return <ModelPerformancePage onBack={() => setShowPerformance(false)} />;
}
```

**Do not modify** `selectedStudentId`, `selectedEssayId`, or any other state when opening. Returning via `onBack` restores the prior view exactly.

---

## Files

| File | Action |
|---|---|
| `backend/main.py` | Add `GET /train/performance` endpoint |
| `services/pythonService.ts` | Add interfaces + `getModelPerformanceAPI` |
| `components/StudentGrading/ModelPerformancePage.tsx` | New full-page component |
| `components/StudentGrading/index.tsx` | Header button + `showPerformance` state |

---

## Out of scope

- Historical performance tracking over time
- Per-student or per-section breakdown
- Exporting metrics as PDF/CSV
- Weighted F1 (macro only)
