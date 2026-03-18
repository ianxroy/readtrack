# Model Performance Page Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full-page Model Performance view showing live F1 score, confusion matrix, per-class metrics, and per-rubric-dimension MAE comparing Gemini system scores vs teacher scores, toggled per language.

**Architecture:** New `GET /train/performance?lang=en|tl` backend endpoint queries Supabase for `diagnosis_result` + `teacher_rubric_scores`, computes sklearn classification metrics and per-dimension MAE, and returns a structured JSON response. A new `ModelPerformancePage.tsx` renders this data as metric cards, F1 bars, confusion matrix, and dimension MAE table. The existing `index.tsx` gains a stats button in the header that swaps the layout for the performance page.

**Tech Stack:** Python/FastAPI (sklearn, supabase-py), React/TypeScript, Tailwind CSS, react-icons/io5

---

## Chunk 1: Backend endpoint + TypeScript API client

### Task 1: Add `GET /train/performance` endpoint to `backend/main.py`

**Files:**
- Modify: `backend/main.py` (after the `/train/status` endpoint, around line 510)

- [ ] **Step 1: Read the current end of the train section in main.py**

Read `backend/main.py` lines 480–560 to confirm exact insertion point after `/train/status`.

- [ ] **Step 2: Add the endpoint**

Insert the following after the `/train/status` endpoint (after line ~511):

```python
@app.get("/train/performance")
def train_performance(lang: str = "en"):
    if lang not in {"en", "tl"}:
        return {"error": "lang must be 'en' or 'tl'"}

    try:
        if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
            return {"insufficient_data": True, "rated_essays": 0, "lang": lang}

        client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        response = (
            client
            .table("student_grading_uploads")
            .select("diagnosis_result, teacher_rubric_scores, subject_language")
            .eq("subject_language", lang)
            .not_.is_("teacher_rubric_scores", "null")
            .not_.is_("diagnosis_result", "null")
            .execute()
        )
        rows = response.data or []

        VALID_LABELS = {"Mahusay", "Papaunlad", "Nagsisimula"}
        LEGACY_MAP = {"Independent": "Mahusay", "Instructional": "Papaunlad", "Frustration": "Nagsisimula"}

        teacher_labels = []
        system_labels = []

        for row in rows:
            dr = row.get("diagnosis_result") or {}
            tr = row.get("teacher_rubric_scores") or {}

            sys_raw = dr.get("proficiency", "")
            sys_label = LEGACY_MAP.get(sys_raw, sys_raw)
            if sys_label not in VALID_LABELS:
                continue

            teacher_overall = tr.get("overall")
            if teacher_overall is None:
                continue
            try:
                teacher_label = _score_to_label(float(teacher_overall))
            except (TypeError, ValueError):
                continue

            teacher_labels.append(teacher_label)
            system_labels.append(sys_label)

        total_compared = len(teacher_labels)
        if total_compared < 5:
            return {"insufficient_data": True, "rated_essays": total_compared, "lang": lang}

        from sklearn.metrics import classification_report, confusion_matrix as sklearn_cm

        LABELS = ["Mahusay", "Papaunlad", "Nagsisimula"]
        report = classification_report(
            teacher_labels, system_labels,
            labels=LABELS, output_dict=True, zero_division=0
        )
        cm = sklearn_cm(teacher_labels, system_labels, labels=LABELS).tolist()

        macro = report["macro avg"]
        macro_f1        = round(macro["f1-score"], 3)
        macro_precision = round(macro["precision"], 3)
        macro_recall    = round(macro["recall"], 3)

        per_class = {}
        for label in LABELS:
            cls = report.get(label, {})
            per_class[label] = {
                "precision": round(cls.get("precision", 0), 3),
                "recall":    round(cls.get("recall", 0), 3),
                "f1":        round(cls.get("f1-score", 0), 3),
                "support":   int(cls.get("support", 0)),
            }

        # Per-dimension MAE
        DIMS = ["content", "organization", "languageVocab", "grammar", "mechanics"]
        dim_sys_scores  = {d: [] for d in DIMS}
        dim_tea_scores  = {d: [] for d in DIMS}

        for row in rows:
            dr = row.get("diagnosis_result") or {}
            tr = row.get("teacher_rubric_scores") or {}
            rubric = dr.get("rubricScore")
            if not rubric or not tr:
                continue
            for dim in DIMS:
                sys_score = (rubric.get(dim) or {}).get("score")
                tea_score = tr.get(dim)
                if sys_score is not None and tea_score is not None:
                    try:
                        dim_sys_scores[dim].append(float(sys_score))
                        dim_tea_scores[dim].append(float(tea_score))
                    except (TypeError, ValueError):
                        pass

        per_dimension = {}
        for dim in DIMS:
            s_list = dim_sys_scores[dim]
            t_list = dim_tea_scores[dim]
            n = len(s_list)
            if n == 0:
                per_dimension[dim] = {"mae": None, "samples": 0, "avg_system": None, "avg_teacher": None}
            else:
                mae = round(sum(abs(s - t) for s, t in zip(s_list, t_list)) / n, 2)
                per_dimension[dim] = {
                    "mae":        mae,
                    "samples":    n,
                    "avg_system":  round(sum(s_list) / n, 2),
                    "avg_teacher": round(sum(t_list) / n, 2),
                }

        status_meta = _read_retrain_status()
        last_retrain = status_meta.get(lang, {}).get("last_retrain")

        return {
            "lang":             lang,
            "total_compared":   total_compared,
            "macro_f1":         macro_f1,
            "macro_precision":  macro_precision,
            "macro_recall":     macro_recall,
            "per_class":        per_class,
            "confusion_matrix": {
                "labels":    LABELS,
                "matrix":    cm,
                "row_label": "Guro (Tunay)",
                "col_label": "Sistema (Hula)",
            },
            "per_dimension":    per_dimension,
            "confidence_level": _confidence_level(total_compared),
            "rated_essays":     total_compared,
            "last_retrain":     last_retrain,
        }

    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"error": str(e)}
```

- [ ] **Step 3: Verify server starts without syntax errors**

```bash
cd /Volumes/Hanteck/Projects/readtrack/backend
python -c "import main; print('OK')"
```
Expected: `OK` (no exceptions)

- [ ] **Step 4: Test endpoint manually**

```bash
curl "http://localhost:8000/train/performance?lang=en"
```
Expected: JSON with either `insufficient_data: true` or full metrics object.

- [ ] **Step 5: Commit**

```bash
git add backend/main.py
git commit -m "feat(backend): add GET /train/performance endpoint with F1, confusion matrix, per-dimension MAE"
```

---

### Task 2: Add TypeScript interfaces and API function to `services/pythonService.ts`

**Files:**
- Modify: `services/pythonService.ts` (append after line 189)

- [ ] **Step 1: Append interfaces and API function**

Add the following to the end of `services/pythonService.ts`:

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
  const res = await fetch(`http://localhost:8000/train/performance?lang=${lang}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP error! status: ${res.status}`);
  }
  return res.json();
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Volumes/Hanteck/Projects/readtrack
npx tsc --noEmit 2>&1 | head -30
```
Expected: No errors related to `pythonService.ts`.

- [ ] **Step 3: Commit**

```bash
git add services/pythonService.ts
git commit -m "feat(types): add ModelPerformanceData interfaces and getModelPerformanceAPI"
```

---

## Chunk 2: Frontend component + navigation wiring

### Task 3: Create `components/StudentGrading/ModelPerformancePage.tsx`

**Files:**
- Create: `components/StudentGrading/ModelPerformancePage.tsx`

- [ ] **Step 1: Create the component file**

```tsx
import React, { useState, useEffect } from 'react';
import { IoArrowBackOutline } from 'react-icons/io5';
import { getModelPerformanceAPI, ModelPerformanceData, DimensionMetrics } from '../../services/pythonService';

interface Props {
  onBack: () => void;
}

const DIM_LABELS: Record<string, string> = {
  content:       'Nilalaman',
  organization:  'Organisasyon',
  languageVocab: 'Wika/Bokab.',
  grammar:       'Gramatika',
  mechanics:     'Mekaniks',
};

const DIMS = ['content', 'organization', 'languageVocab', 'grammar', 'mechanics'];

function f1Color(f1: number): string {
  if (f1 >= 0.8) return 'text-teal-600';
  if (f1 >= 0.6) return 'text-amber-600';
  return 'text-red-600';
}

function maeColor(mae: number): string {
  if (mae <= 0.4) return 'bg-teal-400';
  if (mae <= 0.7) return 'bg-amber-400';
  return 'bg-red-400';
}

function macroCardColor(f1: number): string {
  if (f1 >= 0.8) return 'border-teal-200 bg-teal-50';
  if (f1 >= 0.6) return 'border-amber-200 bg-amber-50';
  return 'border-red-200 bg-red-50';
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return iso;
  }
}

function SkeletonLoader() {
  return (
    <div className="space-y-4 animate-pulse">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="h-16 bg-gray-100 rounded-xl" />
      ))}
    </div>
  );
}

export function ModelPerformancePage({ onBack }: Props) {
  const [lang, setLang] = useState<'en' | 'tl'>('en');
  const [data, setData] = useState<ModelPerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getModelPerformanceAPI(lang)
      .then(d => {
        setData(d);
        setError(d.error ?? null);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [lang]);

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <header className="h-14 flex items-center justify-between px-5 border-b border-gray-100 bg-white shadow-sm flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-gray-500 hover:text-gray-800 transition-colors">
            <IoArrowBackOutline className="text-xl" />
          </button>
          <span className="text-sm font-black text-gray-900 uppercase tracking-wide">
            Katumpakan ng Modelo
          </span>
        </div>
        {/* Language toggle */}
        <div className="flex items-center bg-gray-100 rounded-lg p-0.5 text-xs font-bold">
          <button
            onClick={() => setLang('en')}
            className={`px-3 py-1 rounded-md transition-colors ${lang === 'en' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            🇺🇸 English
          </button>
          <button
            onClick={() => setLang('tl')}
            className={`px-3 py-1 rounded-md transition-colors ${lang === 'tl' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            🇵🇭 Filipino
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {loading && <SkeletonLoader />}

        {!loading && error && (
          <div className="text-center text-red-500 text-sm py-8">{error}</div>
        )}

        {!loading && !error && data?.insufficient_data && (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
            <div className="text-4xl">📊</div>
            <p className="text-gray-700 font-semibold text-sm max-w-xs">
              Hindi pa sapat ang datos para makalkula ang katumpakan. Kailangan ng hindi bababa sa 5 na na-rate na essay.
            </p>
            <p className="text-gray-400 text-xs">
              Na-rate na: <span className="font-bold">{data.rated_essays}</span> / 5
            </p>
          </div>
        )}

        {!loading && !error && data && !data.insufficient_data && (
          <>
            {/* Status bar */}
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span className="inline-flex items-center gap-1.5 font-semibold text-teal-700 bg-teal-50 border border-teal-200 px-2.5 py-1 rounded-full">
                <span className="w-2 h-2 rounded-full bg-teal-500 inline-block" />
                {data.confidence_level}
              </span>
              <span>{data.rated_essays} na na-rate</span>
              <span>·</span>
              <span>Huling retrain: {formatDate(data.last_retrain)}</span>
            </div>

            {/* Summary metric cards */}
            <div className={`grid grid-cols-4 gap-3`}>
              {[
                { label: 'Macro F1', value: data.macro_f1, color: macroCardColor(data.macro_f1), valueColor: f1Color(data.macro_f1) },
                { label: 'Precision', value: data.macro_precision, color: 'border-gray-200 bg-white', valueColor: 'text-gray-800' },
                { label: 'Recall', value: data.macro_recall, color: 'border-gray-200 bg-white', valueColor: 'text-gray-800' },
                { label: 'Mga Ikinumpara', value: data.total_compared, color: 'border-gray-200 bg-white', valueColor: 'text-gray-800', isInt: true },
              ].map(({ label, value, color, valueColor, isInt }) => (
                <div key={label} className={`border rounded-xl p-3 text-center ${color}`}>
                  <div className={`text-2xl font-black ${valueColor}`}>
                    {isInt ? value : (value as number).toFixed(2)}
                  </div>
                  <div className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide mt-0.5">{label}</div>
                </div>
              ))}
            </div>

            {/* Per-class F1 bars */}
            <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-3">
              <h3 className="text-xs font-black text-gray-500 uppercase tracking-wide">Bawat Antas (F1)</h3>
              {['Mahusay', 'Papaunlad', 'Nagsisimula'].map(label => {
                const cls = data.per_class[label];
                if (!cls) return null;
                const pct = Math.round(cls.f1 * 100);
                return (
                  <div key={label} className="flex items-center gap-3">
                    <span className="w-28 text-xs font-semibold text-gray-700 shrink-0">{label}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${cls.f1 >= 0.8 ? 'bg-teal-400' : cls.f1 >= 0.6 ? 'bg-amber-400' : 'bg-red-400'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className={`text-xs font-bold w-10 text-right ${f1Color(cls.f1)}`}>{cls.f1.toFixed(2)}</span>
                    <span className="text-[10px] text-gray-400 w-8 text-right">({cls.support})</span>
                  </div>
                );
              })}
            </div>

            {/* Confusion Matrix */}
            <div className="bg-white border border-gray-100 rounded-2xl p-4">
              <h3 className="text-xs font-black text-gray-500 uppercase tracking-wide mb-3">Confusion Matrix</h3>
              <p className="text-[10px] text-gray-400 mb-3">
                Rows = {data.confusion_matrix.row_label} &nbsp;·&nbsp; Cols = {data.confusion_matrix.col_label}
              </p>
              <div className="overflow-x-auto">
                <table className="text-xs w-full">
                  <thead>
                    <tr>
                      <th className="w-24" />
                      {data.confusion_matrix.labels.map(l => (
                        <th key={l} className="text-center font-semibold text-gray-500 pb-2 px-1">{l}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.confusion_matrix.matrix.map((row, ri) => {
                      const rowTotal = row.reduce((a, b) => a + b, 0) || 1;
                      return (
                        <tr key={ri}>
                          <td className="font-semibold text-gray-700 pr-2 py-1">{data.confusion_matrix.labels[ri]}</td>
                          {row.map((cell, ci) => {
                            const isDiag = ri === ci;
                            const intensity = isDiag ? '' : `opacity-${Math.min(100, Math.round((cell / rowTotal) * 100))}`;
                            const bg = isDiag
                              ? 'bg-teal-100 text-teal-800'
                              : cell === 0
                                ? 'bg-white text-gray-300'
                                : 'bg-red-100 text-red-700';
                            return (
                              <td key={ci} className={`text-center font-bold px-3 py-2 rounded ${bg}`} style={!isDiag && cell > 0 ? { opacity: 0.4 + 0.6 * (cell / rowTotal) } : {}}>
                                {cell}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Per-dimension MAE */}
            <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-3">
              <h3 className="text-xs font-black text-gray-500 uppercase tracking-wide">
                Bawat Dimensyon — MAE (mas mababa = mas tumpak)
              </h3>
              <div className="grid grid-cols-4 gap-1 text-[10px] text-gray-400 font-semibold uppercase pb-1 border-b border-gray-100">
                <span>Dimensyon</span>
                <span className="text-center">Sistema</span>
                <span className="text-center">Guro</span>
                <span>MAE</span>
              </div>
              {DIMS.map(dim => {
                const d: DimensionMetrics | undefined = data.per_dimension[dim];
                if (!d) return null;
                return (
                  <div key={dim} className="grid grid-cols-4 gap-1 items-center text-xs">
                    <span className="font-semibold text-gray-700">{DIM_LABELS[dim]}</span>
                    <span className="text-center text-gray-500">{d.avg_system != null ? d.avg_system.toFixed(1) : '—'}</span>
                    <span className="text-center text-gray-500">{d.avg_teacher != null ? d.avg_teacher.toFixed(1) : '—'}</span>
                    <div className="flex items-center gap-2">
                      {d.mae != null ? (
                        <>
                          <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${maeColor(d.mae)}`}
                              style={{ width: `${Math.min(100, d.mae * 100)}%` }}
                            />
                          </div>
                          <span className={`font-bold w-8 text-right ${d.mae <= 0.4 ? 'text-teal-600' : d.mae <= 0.7 ? 'text-amber-600' : 'text-red-600'}`}>
                            {d.mae.toFixed(2)}
                          </span>
                        </>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Volumes/Hanteck/Projects/readtrack
npx tsc --noEmit 2>&1 | head -30
```
Expected: No errors related to `ModelPerformancePage.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/StudentGrading/ModelPerformancePage.tsx
git commit -m "feat(ui): add ModelPerformancePage with F1, confusion matrix, per-dimension MAE"
```

---

### Task 4: Wire `ModelPerformancePage` into `components/StudentGrading/index.tsx`

**Files:**
- Modify: `components/StudentGrading/index.tsx`

- [ ] **Step 1: Read current imports and state area**

Read `components/StudentGrading/index.tsx` lines 1–60 to see the current import block and state declarations.

- [ ] **Step 2: Add import for ModelPerformancePage and IoStatsChartOutline**

In the existing `import { IoMenuOutline, IoCloudUploadOutline } from 'react-icons/io5';` line, add `IoStatsChartOutline`:

```typescript
import { IoMenuOutline, IoCloudUploadOutline, IoStatsChartOutline } from 'react-icons/io5';
```

Add a new import for the ModelPerformancePage component (add after the EssayViewerModal import):

```typescript
import { ModelPerformancePage } from './ModelPerformancePage';
```

- [ ] **Step 3: Add `showPerformance` state**

In the component's state declarations (near the other `useState` calls), add:

```typescript
const [showPerformance, setShowPerformance] = useState(false);
```

- [ ] **Step 4: Add performance page gate before the return**

Read index.tsx to find the main return statement (starts with `return (`). Immediately before it, add:

```tsx
if (showPerformance) {
  return <ModelPerformancePage onBack={() => setShowPerformance(false)} />;
}
```

- [ ] **Step 5: Add stats button to the header**

In the header JSX, the Upload button is the right-side action. Add the stats button next to it. Find the existing Upload button:

```tsx
        <button
          onClick={() => setShowUpload(true)}
          disabled={showMigration}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
            showMigration
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-teal-500 hover:bg-teal-600 text-white'
          }`}
        >
          <IoCloudUploadOutline className="text-base" />
          Upload Essay
        </button>
```

Wrap it plus a new stats button in a flex div:

```tsx
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPerformance(true)}
            className="p-2 text-gray-500 hover:text-teal-600 hover:bg-teal-50 rounded-xl transition-colors"
            title="Katumpakan ng Modelo"
          >
            <IoStatsChartOutline className="text-lg" />
          </button>
          <button
            onClick={() => setShowUpload(true)}
            disabled={showMigration}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
              showMigration
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-teal-500 hover:bg-teal-600 text-white'
            }`}
          >
            <IoCloudUploadOutline className="text-base" />
            Upload Essay
          </button>
        </div>
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd /Volumes/Hanteck/Projects/readtrack
npx tsc --noEmit 2>&1 | head -30
```
Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add components/StudentGrading/index.tsx
git commit -m "feat(nav): add stats button and showPerformance state to StudentGrading header"
```
