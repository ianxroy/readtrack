# Teacher Feedback Learning System Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 1–5 star teacher rating with a per-dimension DepEd 4-star rubric UI, align all proficiency badges to DepEd labels, and surface the model retrain widget in the Sidebar so teachers can improve the SVM over time.

**Architecture:** Four layers of change: (1) rename proficiency labels app-wide to DepEd Filipino terms, (2) switch the Gemini rubric evaluation and teacher input from 1–5 to 1–4 scale, (3) replace the EssayViewerModal star-rating section with a side-by-side system-vs-teacher 5-dimension rubric input, (4) add a Sidebar retrain widget that polls `/train/status` and triggers `/train/retrain`. The backend endpoints and Supabase schema are already complete; this plan is entirely frontend + minor backend label corrections.

**Tech Stack:** React + TypeScript, Tailwind CSS, FastAPI (Python), Google Gemini 2.5 Flash

**Spec reference:** `docs/superpowers/specs/2026-03-17-teacher-feedback-learning-system-design.md`

---

## File Map

| File | Change |
|------|--------|
| `types.ts` | Rename `ProficiencyLevel` enum values to DepEd labels; update `DepEdRubricDimension.score` comment to 1–4 |
| `backend/svm_models.py` | Update `self.labels` and `band_map` to DepEd labels |
| `backend/main.py` | Update `_score_to_label`; update Gemini prompt to 1–4 scale |
| `components/MaterialChecker.tsx` | Update `ProficiencyLevel` enum references |
| `components/Analyzer.tsx` | Update `ProficiencyLevel` enum references |
| `components/StudentGrading/EssayViewerModal.tsx` | Fix `onSaveEvaluation` prop type; replace star rating with per-dimension 4-star rubric; update proficiency badge meta; update ScorePips/SCORE_LABEL to 4 levels |
| `components/StudentGrading/EssayPanel.tsx` | Update `profBadge` keys; add system pips; add ⚠️ for unrated/Natututo pa |
| `components/StudentGrading/Sidebar.tsx` | Add `trainStatus` + `onRetrain` props; add confidence indicator + retrain widget |
| `components/StudentGrading/index.tsx` | Fetch train status; pass to Sidebar + EssayPanel; handle retrain |

---

## Chunk 1: DepEd Label Alignment

### Task 1: Update `ProficiencyLevel` and `PhilIriLevel` enums in `types.ts`

**Files:**
- Modify: `types.ts`

The app currently shows "Independent / Instructional / Frustration" (Phil-IRI reading labels). The spec requires these to change to DepEd writing labels: Mahusay / Papaunlad / Nagsisimula. This change cascades through every component that renders a proficiency badge.

- [ ] **Step 1: Update `ProficiencyLevel` enum values**

In `types.ts`, replace lines 2–5:

```typescript
export enum ProficiencyLevel {
  NAGSISIMULA  = "Nagsisimula",
  PAPAUNLAD    = "Papaunlad",
  MAHUSAY      = "Mahusay",
}
```

**Do NOT rename `PhilIriLevel`** — it is a separate enum used internally by Analyzer and MaterialChecker for reading-level classification. Only `ProficiencyLevel` changes here.

- [ ] **Step 2: Update score comment on `DepEdRubricDimension`** (1–5 → 1–4)

Change:
```typescript
  score: number;       // 1–5
```
to:
```typescript
  score: number;       // 1–4
```

- [ ] **Step 3: Check TypeScript compiles (errors expected — fix in next steps)**

```bash
cd /Volumes/Hanteck/Projects/readtrack && npx tsc --noEmit 2>&1 | grep "ProficiencyLevel"
```

Expected: errors listing files that use the old enum keys — confirms which files need updating next.

- [ ] **Step 4: Commit partial (types only — will break TS until cascade is done)**

```bash
git add types.ts
git commit -m "chore(types): update ProficiencyLevel values to DepEd writing labels (Mahusay/Papaunlad/Nagsisimula)"
```

---

### Task 2: Update all `ProficiencyLevel` references in non-StudentGrading components

**Files:**
- Modify: `components/MaterialChecker.tsx`
- Modify: `components/Analyzer.tsx`

- [ ] **Step 1: Update `MaterialChecker.tsx`**

Find (line ~231):
```typescript
result.proficiency === ProficiencyLevel.INSTRUCTIONAL ||
result.proficiency === ProficiencyLevel.INDEPENDENT
```
Replace with:
```typescript
result.proficiency === ProficiencyLevel.PAPAUNLAD ||
result.proficiency === ProficiencyLevel.MAHUSAY
```

- [ ] **Step 2: Update `Analyzer.tsx`**

Find (line ~330):
```typescript
const isGood = result.proficiency === ProficiencyLevel.INSTRUCTIONAL || result.proficiency === ProficiencyLevel.INDEPENDENT;
```
Replace with:
```typescript
const isGood = result.proficiency === ProficiencyLevel.PAPAUNLAD || result.proficiency === ProficiencyLevel.MAHUSAY;
```

- [ ] **Step 3: Verify TypeScript compiles (errors should now be only StudentGrading files)**

```bash
npx tsc --noEmit 2>&1 | grep "error" | head -20
```

- [ ] **Step 4: Commit**

```bash
git add components/MaterialChecker.tsx components/Analyzer.tsx
git commit -m "fix(labels): update MaterialChecker and Analyzer to use DepEd ProficiencyLevel labels (Mahusay/Papaunlad/Nagsisimula)"
```

---

### Task 3: Update `svm_models.py` and `main.py` labels

**Files:**
- Modify: `backend/svm_models.py`
- Modify: `backend/main.py`

- [ ] **Step 1: Update `StudentProficiencySVM.labels` and `band_map` in `svm_models.py`**

In `svm_models.py` line 72, change:
```python
self.labels = ["Independent", "Instructional", "Frustration"]
```
to:
```python
self.labels = ["Mahusay", "Papaunlad", "Nagsisimula"]
```

In the `predict` method, update **both `band_map` occurrences** (the initial one at line ~133 and the duplicate inside the `rubric_score` blend block at line ~151). Keep the `iri` tuple element as the legacy Phil-IRI string for backward compatibility with `philIriLevel` consumers (Analyzer, MaterialChecker):
```python
band_map = {
    "Mahusay":     ("Enhancement",    "Independent"),
    "Papaunlad":   ("Consolidation",  "Instructional"),
    "Nagsisimula": ("Intervention",   "Frustration"),
}
```

Update the heuristic thresholds that set `proficiency` directly (lines ~118–130 and ~145–150). There are **two places**:

First block (inside `if ml_result:`, lines ~116–131) — replace inline string comparisons:
```python
if ml_result:
    proficiency = ml_result
    if proficiency == "Mahusay":
        nat = max(70, calculated_score)
    elif proficiency == "Papaunlad":
        nat = max(35, min(74, calculated_score))
    else:
        nat = min(34, calculated_score)
else:
    if calculated_score >= 70:
        proficiency = "Mahusay"
    elif calculated_score >= 35:
        proficiency = "Papaunlad"
    else:
        proficiency = "Nagsisimula"
    nat = calculated_score
```

Second block (rubric-blend re-classification, lines ~145–150):
```python
    if nat >= 70:
        proficiency = "Mahusay"
    elif nat >= 35:
        proficiency = "Papaunlad"
    else:
        proficiency = "Nagsisimula"
```

Also update the **rubric-blend divisor** on line ~143: the Gemini rubric now returns 1–4 (not 1–5). Change:
```python
rubric_nat = round((rubric_score / 5.0) * 100, 2)
```
to:
```python
rubric_nat = round((rubric_score / 4.0) * 100, 2)
```

- [ ] **Step 2: Update `_score_to_label` in `backend/main.py`**

Find (line ~182):
```python
def _score_to_label(avg: float) -> str:
    if avg >= 3.5:
        return "Independent"
    if avg >= 2.0:
        return "Instructional"
    return "Frustration"
```
Replace with (note: mid-band threshold is 2.5 per the spec's label mapping table):
```python
def _score_to_label(avg: float) -> str:
    """Map average teacher rubric score (1–4 scale) to DepEd 3-band badge."""
    if avg >= 3.5:
        return "Mahusay"
    if avg >= 2.5:
        return "Papaunlad"
    return "Nagsisimula"
```

- [ ] **Step 3: Verify Python syntax**

```bash
cd /Volumes/Hanteck/Projects/readtrack/backend && python -c "import svm_models, main; print('OK')"
```

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add backend/svm_models.py backend/main.py
git commit -m "fix(grading): rename SVM labels and _score_to_label to DepEd-aligned labels (Mahusay/Papaunlad/Nagsisimula)"
```

---

### Task 4: Update StudentGrading badge display components

**Files:**
- Modify: `components/StudentGrading/EssayViewerModal.tsx`
- Modify: `components/StudentGrading/EssayPanel.tsx`

- [ ] **Step 1: Update `proficiencyMeta` in `EssayViewerModal.tsx`**

Find (lines 27–45):
```typescript
const proficiencyMeta = {
  [ProficiencyLevel.FRUSTRATION]: {
    ...
  [ProficiencyLevel.INSTRUCTIONAL]: {
    ...
  [ProficiencyLevel.INDEPENDENT]: {
```
Replace with:
```typescript
const proficiencyMeta = {
  [ProficiencyLevel.NAGSISIMULA]: {
    color: 'text-red-600',
    bg: 'bg-red-50',
    border: 'border-red-100',
    dot: 'bg-red-500',
  },
  [ProficiencyLevel.PAPAUNLAD]: {
    color: 'text-orange-600',
    bg: 'bg-orange-50',
    border: 'border-orange-100',
    dot: 'bg-orange-500',
  },
  [ProficiencyLevel.MAHUSAY]: {
    color: 'text-teal-600',
    bg: 'bg-teal-50',
    border: 'border-teal-100',
    dot: 'bg-teal-500',
  },
};
```

- [ ] **Step 2: Update the proficiency definition ternary in `EssayViewerModal.tsx`**

Find (lines 307–311, inside the scoring-grid array):
```typescript
definition:
  dr.proficiency === ProficiencyLevel.FRUSTRATION
    ? 'Nangangailangan ng matinding suporta at gabay ng guro.'
    : dr.proficiency === ProficiencyLevel.INSTRUCTIONAL
      ? 'Maaaring sumulong sa tulong ng guro at pagsasanay.'
      : 'Kaya niyang magtrabaho nang mag-isa sa mga gawaing angkop sa kanyang antas.',
```
Replace with:
```typescript
definition:
  dr.proficiency === ProficiencyLevel.NAGSISIMULA
    ? 'Nangangailangan ng matinding suporta at gabay ng guro.'
    : dr.proficiency === ProficiencyLevel.PAPAUNLAD
      ? 'Maaaring sumulong sa tulong ng guro at pagsasanay.'
      : 'Kaya niyang magtrabaho nang mag-isa sa mga gawaing angkop sa kanyang antas.',
```

- [ ] **Step 3: Update `profBadge` in `EssayPanel.tsx`**

Find (lines 6–10):
```typescript
const profBadge: Record<string, string> = {
  [ProficiencyLevel.INDEPENDENT]:   'bg-green-100 text-green-700',
  [ProficiencyLevel.INSTRUCTIONAL]: 'bg-amber-100 text-amber-700',
  [ProficiencyLevel.FRUSTRATION]:   'bg-red-100 text-red-700',
};
```
Replace with:
```typescript
const profBadge: Record<string, string> = {
  [ProficiencyLevel.MAHUSAY]:     'bg-green-100 text-green-700',
  [ProficiencyLevel.PAPAUNLAD]:   'bg-amber-100 text-amber-700',
  [ProficiencyLevel.NAGSISIMULA]: 'bg-red-100 text-red-700',
};
```

- [ ] **Step 4: Verify TypeScript compiles clean**

```bash
cd /Volumes/Hanteck/Projects/readtrack && npx tsc --noEmit 2>&1 | grep "error"
```

Expected: No errors related to ProficiencyLevel (other pre-existing errors in MaterialChecker.tsx are OK for now — they're unrelated).

- [ ] **Step 5: Commit**

```bash
git add components/StudentGrading/EssayViewerModal.tsx components/StudentGrading/EssayPanel.tsx
git commit -m "fix(ui): update proficiency badge keys to DepEd labels in EssayViewerModal and EssayPanel"
```

---

## Chunk 2: Gemini Rubric 1-5 → 1-4 Scale

### Task 5: Update Gemini prompt and frontend display to 1–4 scale

**Files:**
- Modify: `backend/main.py`
- Modify: `components/StudentGrading/EssayViewerModal.tsx`

The Gemini evaluation currently uses a 1–5 scale (implemented in the previous rubric grading plan). The DepEd scale is 1–4. This task updates the prompt and display to use the official 4-level scale.

- [ ] **Step 1: Update Gemini prompt in `backend/main.py` to 1–4 scale**

In `evaluate_rubric_with_gemini` (line ~284), find the scoring legend. The actual text in the file starts with (use hyphens exactly as shown — the file uses plain hyphens, not em-dashes):
```
Use the official DepEd 5-dimension analytic rubric. Each dimension is scored 1-5:
- 5: Excellent
- 4: Proficient
- 3: Developing — partially meets expectations (this is the PASSING threshold for PH G7)
- 2: Beginning
- 1: Poor
```

In `evaluate_rubric_with_gemini`, find this exact block (lines ~321–326 — copy text exactly, all plain ASCII hyphens):

```
Use the official DepEd 5-dimension analytic rubric. Each dimension is scored 1-5:
- 5: Excellent - exceeds {grade_level} expectations
- 4: Proficient - meets {grade_level} expectations
- 3: Developing - partially meets expectations (PASSING threshold for PH G7)
- 2: Beginning - minimally meets expectations
- 1: Poor - does not meet expectations
```

Replace with:
```
Use the official DepEd 4-level performance task rubric. Each dimension is scored 1-4:
- 4: Mahusay (Proficient) - fully meets {grade_level} expectations
- 3: Papalapit sa Kahusayan (Approaching Proficiency) - mostly meets expectations (above the passing threshold)
- 2: Papaunlad (Developing) - partially meets expectations (minimum passing for a single dimension)
- 1: Nagsisimula (Beginning) - does not yet meet expectations
```

Also update the five JSON format lines in the prompt body that say `<1-5>` (lines ~351–355). Change each from:
```
"content": {{"score": <1-5>, "rationale": "<one sentence>"}},
```
to:
```
"content": {{"score": <1-4>, "rationale": "<one sentence>"}},
```
(Repeat for organization, language_vocab, grammar, mechanics.)

Also update the calibration note on line ~329:
```
- The average PH G7 student scores ~2.3/5 on Organization nationally (research baseline)
```
to:
```
- The average PH G7 student scores ~2.3/4 on Organization nationally (research baseline)
```

- [ ] **Step 2: Update `ScorePips` and `SCORE_LABEL` in `EssayViewerModal.tsx`**

Find and replace `SCORE_LABEL` (lines 57–63). Old value (exact):
```typescript
const SCORE_LABEL: Record<number, string> = {
  1: 'Hindi pa naaabot',
  2: 'Nagsisimula',
  3: 'Papaunlad',
  4: 'Mahusay',
  5: 'Napakahusay',
};
```
New value (4-level DepEd scale):
```typescript
const SCORE_LABEL: Record<number, string> = {
  1: 'Nagsisimula',
  2: 'Papaunlad',
  3: 'Papalapit sa Kahusayan',
  4: 'Mahusay',
};
```

Replace `ScorePips` to use 4 pips instead of 5:
```typescript
function ScorePips({ score }: { score: number }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4].map(n => (
        <div
          key={n}
          className={`w-2.5 h-2.5 rounded-full transition-colors ${
            n <= score ? 'bg-teal-500' : 'bg-gray-200'
          }`}
        />
      ))}
    </div>
  );
}
```

Update the display in `DepEdRubricPanel`:
- Change `{d.score}/5` to `{d.score}/4` (line ~112)
- Change `{rubric.overallScore.toFixed(1)}/5` to `{rubric.overallScore.toFixed(1)}/4` (line ~95)

Also update line ~292 where the Mungkahing Marka card shows the rubric score:
```typescript
value: dr.rubricScore
  ? `${dr.rubricScore.overallScore.toFixed(1)}/4`
  : `${dr.natScore}%`,
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep "error" | head -10
```

- [ ] **Step 4: Commit**

```bash
git add backend/main.py components/StudentGrading/EssayViewerModal.tsx
git commit -m "feat(rubric): change Gemini evaluation and display scale from 1-5 to DepEd 1-4"
```

---

## Chunk 3: Per-Dimension Teacher Rubric UI

### Task 6: Replace star rating section with per-dimension 4-star rubric in `EssayViewerModal`

**Files:**
- Modify: `components/StudentGrading/EssayViewerModal.tsx`

This is the core UI change. Replace the current 1–5 single-star rating with a side-by-side table showing system suggestion (read-only pips) next to teacher stars (clickable 1–4 per dimension). Also fixes the TypeScript error in the `onSaveEvaluation` prop.

- [ ] **Step 1: Update the `EssayViewerModalProps` interface and state**

**Step 1a: Add `TeacherRubricScores` to the existing `'./types'` import on line 12** (do NOT add a second import statement — `TeacherRubricScores` is defined in `components/StudentGrading/types.ts`, which is the local `'./types'` path, same file as `Student`/`Subject`/`StudentEssay`):

Find line 12:
```typescript
import { Student, Subject, StudentEssay } from './types';
```
Change to:
```typescript
import { Student, Subject, StudentEssay, TeacherRubricScores } from './types';
```

**Step 1b: Update `EssayViewerModalProps` interface** (line 23):

Change:
```typescript
  onSaveEvaluation: (essayId: string, rating: number, comment: string) => Promise<void>;
```
to:
```typescript
  onSaveEvaluation: (essayId: string, rubricScores: TeacherRubricScores, comment: string) => Promise<void>;
```

- [ ] **Step 2: Replace teacher rating state**

Remove:
```typescript
const [teacherRating, setTeacherRating] = useState(essay.teacherRating ?? 0);
```

Replace with:
```typescript
const defaultDims = { content: 0, organization: 0, languageVocab: 0, grammar: 0, mechanics: 0 };

const [teacherDims, setTeacherDims] = useState<typeof defaultDims>(
  essay.teacherRubricScores
    ? {
        content:      essay.teacherRubricScores.content,
        organization: essay.teacherRubricScores.organization,
        languageVocab:essay.teacherRubricScores.languageVocab,
        grammar:      essay.teacherRubricScores.grammar,
        mechanics:    essay.teacherRubricScores.mechanics,
      }
    : { ...defaultDims }
);
```

Also update the `useEffect` that resets state on essay change — replace `setTeacherRating(essay.teacherRating ?? 0)` with:
```typescript
setTeacherDims(
  essay.teacherRubricScores
    ? {
        content:      essay.teacherRubricScores.content,
        organization: essay.teacherRubricScores.organization,
        languageVocab:essay.teacherRubricScores.languageVocab,
        grammar:      essay.teacherRubricScores.grammar,
        mechanics:    essay.teacherRubricScores.mechanics,
      }
    : { ...defaultDims }
);
```

- [ ] **Step 3: Replace `handleSaveTeacherEvaluation`**

Replace the entire function:
```typescript
const handleSaveTeacherEvaluation = async () => {
  const dims = ['content', 'organization', 'languageVocab', 'grammar', 'mechanics'] as const;
  const allSet = dims.every(d => teacherDims[d] >= 1 && teacherDims[d] <= 4);
  if (!allSet) {
    setEvaluationError(true);
    setEvaluationMessage('I-rate ang lahat ng 5 dimensyon bago i-save.');
    return;
  }
  setIsSavingEvaluation(true);
  setEvaluationMessage(null);
  try {
    const overall = parseFloat(
      (dims.reduce((sum, d) => sum + teacherDims[d], 0) / 5).toFixed(2)
    );
    const percentage = parseFloat(((overall / 4) * 100).toFixed(2));
    const transmuted = percentage >= 60
      ? parseFloat((((percentage - 60) / 40) * 25 + 75).toFixed(2))
      : parseFloat((((percentage) / 60) * 74).toFixed(2));

    const rubricScores: TeacherRubricScores = {
      ...teacherDims,
      overall,
      percentage,
      transmuted,
    };
    await onSaveEvaluation(essay.id, rubricScores, teacherComment.trim());
    setEvaluationError(false);
    setEvaluationMessage('Nai-save ang marka ng guro.');
  } catch {
    setEvaluationError(true);
    setEvaluationMessage('Hindi nai-save. Subukan muli.');
  } finally {
    setIsSavingEvaluation(false);
  }
};
```

- [ ] **Step 4: Replace the "Teacher Rating" JSX section**

Find the entire "Teacher Rating" block (from the comment `{/* Teacher Rating */}` through its closing `</div>`), and replace with:

```tsx
{/* Teacher Rubric Rating */}
<div className="bg-white border border-gray-100 rounded-[24px] p-6 space-y-4">
  <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400">
    Marka ng Guro — DepEd Rubrik
  </h4>

  {/* Column headers */}
  <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 items-center mb-1">
    <span />
    <span className="text-[9px] font-bold text-gray-400 text-center">Sistema</span>
    <span className="text-[9px] font-bold text-gray-400 text-center">Guro</span>
  </div>

  {/* 5 dimension rows */}
  {(['content', 'organization', 'languageVocab', 'grammar', 'mechanics'] as const).map(dim => {
    const meta = DIMENSION_META[dim];
    // TypeScript note: DepEdRubricScore uses named fields (not an index signature), so bracket
    // access needs a cast. Use a helper to avoid TS error:
    const rubricDim = dr?.rubricScore ? (dr.rubricScore as Record<string, any>)[dim] : undefined;
    const sysScore: number = rubricDim?.score ?? 0;
    const teacherScore = teacherDims[dim];
    return (
      <div key={dim} className="grid grid-cols-[1fr_auto_auto] gap-x-4 items-center">
        {/* Label */}
        <div>
          <span className="text-xs font-semibold text-gray-700">{meta.labelFil}</span>
          <span className="text-[9px] text-gray-400 ml-1">({meta.label})</span>
        </div>

        {/* System pips (read-only) */}
        <div className="flex gap-0.5">
          {[1, 2, 3, 4].map(n => (
            <div
              key={n}
              className={`w-2 h-2 rounded-full ${n <= sysScore ? 'bg-teal-500' : 'bg-gray-200'}`}
            />
          ))}
        </div>

        {/* Teacher stars (clickable) */}
        <div className="flex gap-0.5">
          {[1, 2, 3, 4].map(n => (
            <button
              key={n}
              onClick={() => setTeacherDims(prev => ({ ...prev, [dim]: n }))}
              className={`text-base transition-colors ${
                n <= teacherScore ? 'text-amber-400' : 'text-gray-200 hover:text-amber-300'
              }`}
              aria-label={`${meta.labelFil} ${n}/4`}
            >
              {n <= teacherScore ? <IoStar /> : <IoStarOutline />}
            </button>
          ))}
        </div>
      </div>
    );
  })}

  {/* Overall row */}
  {(() => {
    const dims = ['content', 'organization', 'languageVocab', 'grammar', 'mechanics'] as const;
    const sysAvg = dr?.rubricScore
      ? parseFloat(
          (dims.reduce((s, d) => s + ((dr.rubricScore as Record<string, any>)[d]?.score ?? 0), 0) / 5).toFixed(1)
        )
      : null;
    const teacherAvg = dims.every(d => teacherDims[d] > 0)
      ? parseFloat((dims.reduce((s, d) => s + teacherDims[d], 0) / 5).toFixed(1))
      : null;
    return (
      <div className="pt-2 border-t border-gray-100 grid grid-cols-[1fr_auto_auto] gap-x-4 items-center">
        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Kabuuan</span>
        <span className="text-xs font-bold text-teal-600 text-center">
          {sysAvg !== null ? `${sysAvg}/4` : '—'}
        </span>
        <span className="text-xs font-bold text-amber-500 text-center">
          {teacherAvg !== null ? `${teacherAvg}/4` : '—'}
        </span>
      </div>
    );
  })()}

  {/* Comment */}
  <textarea
    className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs text-gray-700 leading-relaxed min-h-[70px] outline-none focus:ring-1 focus:ring-teal-500"
    placeholder="Opsyonal na komento ng guro…"
    value={teacherComment}
    onChange={e => setTeacherComment(e.target.value)}
  />

  {/* Save */}
  <div className="flex items-center justify-between gap-3">
    <button
      onClick={handleSaveTeacherEvaluation}
      disabled={isSavingEvaluation}
      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
        isSavingEvaluation
          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
          : 'bg-teal-600 text-white hover:bg-teal-700'
      }`}
    >
      {isSavingEvaluation ? 'Nag-iimbak…' : 'I-save ang Marka ng Guro'}
    </button>
    {evaluationMessage && (
      <p className={`text-[10px] font-medium ${evaluationError ? 'text-red-500' : 'text-green-600'}`}>
        {evaluationMessage}
      </p>
    )}
  </div>
</div>
```

- [ ] **Step 5: Verify TypeScript compiles clean for StudentGrading**

```bash
cd /Volumes/Hanteck/Projects/readtrack && npx tsc --noEmit 2>&1 | grep "StudentGrading"
```

Expected: No errors.

- [ ] **Step 6: Check app renders**

```bash
npm run dev
```

Open an essay in EssayViewerModal → scroll to the bottom of Analysis tab. Verify:
- 5 rows appear with system pips on the left and teacher stars on the right
- Clicking a teacher star selects it
- Overall row updates when all 5 dims are rated
- Save button saves without TypeScript error in console

- [ ] **Step 7: Commit**

```bash
git add components/StudentGrading/EssayViewerModal.tsx
git commit -m "feat(ui): replace star rating with per-dimension 4-star DepEd rubric in EssayViewerModal"
```

---

## Chunk 4: Sidebar Retrain Widget

### Task 7: Add train status props and retrain widget to `Sidebar.tsx`

**Files:**
- Modify: `components/StudentGrading/Sidebar.tsx`

Add a compact widget at the bottom of the Sidebar that shows:
- Confidence level for English and Filipino models
- A "Retrain" button when `new_since_retrain >= 5` for either language

- [ ] **Step 1: Add new imports to `Sidebar.tsx`**

```typescript
import { IoRefreshOutline } from 'react-icons/io5';
import { TrainStatusResponse } from '../../services/pythonService';
```

- [ ] **Step 2: Add new props to `SidebarProps`**

```typescript
interface SidebarProps {
  // ... existing props ...
  trainStatus?: TrainStatusResponse | null;
  isRetraining?: boolean;
  onRetrain?: (lang: 'en' | 'tl') => void;
}
```

Update the component signature to destructure the new props:
```typescript
export const Sidebar: React.FC<SidebarProps> = ({
  sections, subjects, students,
  selectedSectionId, selectedSubjectId,
  onSelectSubject, onCreateSection, onRenameSection, onDeleteSection,
  onManageSubjects,
  trainStatus, isRetraining, onRetrain,
}) => {
```

- [ ] **Step 3: Add a confidence pill helper function inside the component**

Add before the `return`:

```typescript
  const confidenceDot = (level: string) => {
    if (level === 'Kumpiyansa' || level === 'Kalibrado') return 'bg-green-400';
    if (level === 'Papaunlad') return 'bg-yellow-400';
    return 'bg-red-400';
  };
```

- [ ] **Step 4: Add the retrain widget JSX at the bottom of Sidebar (before the closing `</div>`)**

Add after the `{/* Add section button */}` block, just before the final closing `</div>`:

```tsx
{/* Model confidence + retrain */}
{trainStatus && (
  <div className="p-2 border-t border-gray-100 space-y-1.5">
    <div className="text-[8px] font-bold text-gray-400 uppercase tracking-widest px-1">
      Katumpakan ng Modelo
    </div>

    {/* English */}
    <div className="flex items-center justify-between px-1">
      <div className="flex items-center gap-1.5">
        <span className={`w-2 h-2 rounded-full ${confidenceDot(trainStatus.english.confidence_level)}`} />
        <span className="text-[10px] text-gray-600">🇺🇸 {trainStatus.english.confidence_level}</span>
      </div>
      <span className="text-[9px] text-gray-400">{trainStatus.english.rated_essays} rated</span>
    </div>

    {/* Filipino */}
    <div className="flex items-center justify-between px-1">
      <div className="flex items-center gap-1.5">
        <span className={`w-2 h-2 rounded-full ${confidenceDot(trainStatus.filipino.confidence_level)}`} />
        <span className="text-[10px] text-gray-600">🇵🇭 {trainStatus.filipino.confidence_level}</span>
      </div>
      <span className="text-[9px] text-gray-400">{trainStatus.filipino.rated_essays} rated</span>
    </div>

    {/* Retrain buttons */}
    {onRetrain && (
      <>
        {trainStatus.english.new_since_retrain >= 5 && (
          <button
            onClick={() => onRetrain('en')}
            disabled={isRetraining}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50 transition-colors"
          >
            <IoRefreshOutline className={isRetraining ? 'animate-spin' : ''} />
            I-retrain English ({trainStatus.english.new_since_retrain} bago)
          </button>
        )}
        {trainStatus.filipino.new_since_retrain >= 5 && (
          <button
            onClick={() => onRetrain('tl')}
            disabled={isRetraining}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-bold bg-pink-50 text-pink-700 hover:bg-pink-100 disabled:opacity-50 transition-colors"
          >
            <IoRefreshOutline className={isRetraining ? 'animate-spin' : ''} />
            I-retrain Filipino ({trainStatus.filipino.new_since_retrain} bago)
          </button>
        )}
      </>
    )}
  </div>
)}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep "Sidebar"
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add components/StudentGrading/Sidebar.tsx
git commit -m "feat(sidebar): add train status confidence indicator and retrain buttons"
```

---

### Task 8: Wire train status and retrain in `index.tsx`

**Files:**
- Modify: `components/StudentGrading/index.tsx`

- [ ] **Step 1: Add imports**

```typescript
import { getTrainStatusAPI, triggerRetrainAPI, TrainStatusResponse } from '../../services/pythonService';
```

- [ ] **Step 2: Add train status state**

Add after the existing state declarations:
```typescript
const [trainStatus, setTrainStatus] = useState<TrainStatusResponse | null>(null);
const [isRetraining, setIsRetraining] = useState(false);
```

- [ ] **Step 3: Fetch train status on mount**

Add a `useEffect`:
```typescript
useEffect(() => {
  getTrainStatusAPI()
    .then(setTrainStatus)
    .catch(() => {}); // non-blocking — backend may be offline
}, []);
```

- [ ] **Step 4: Add `handleRetrain` function**

```typescript
const handleRetrain = async (lang: 'en' | 'tl') => {
  setIsRetraining(true);
  try {
    await triggerRetrainAPI(lang);
    const updated = await getTrainStatusAPI();
    setTrainStatus(updated);
  } catch (err) {
    console.error('Retrain failed:', err);
  } finally {
    setIsRetraining(false);
  }
};
```

- [ ] **Step 5: Pass new props to `<Sidebar />`**

Find the `<Sidebar` JSX and add the new props:
```tsx
<Sidebar
  sections={sections}
  subjects={subjects}
  students={students}
  selectedSectionId={selectedSectionId}
  selectedSubjectId={selectedSubjectId}
  onSelectSubject={handleSelectSubject}
  onCreateSection={handleCreateSection}
  onRenameSection={handleRenameSection}
  onDeleteSection={handleDeleteSection}
  onManageSubjects={() => setShowSubjectManager(true)}
  trainStatus={trainStatus}
  isRetraining={isRetraining}
  onRetrain={handleRetrain}
/>
```

- [ ] **Step 6: Verify TypeScript compiles clean**

```bash
npx tsc --noEmit 2>&1 | grep "error" | head -10
```

Expected: No StudentGrading errors.

- [ ] **Step 7: Commit**

```bash
git add components/StudentGrading/index.tsx
git commit -m "feat(grading): fetch train status and wire retrain action to Sidebar"
```

---

## Chunk 5: EssayPanel Display Update

### Task 9: Add system pips and confidence warning to `EssayPanel`

**Files:**
- Modify: `components/StudentGrading/EssayPanel.tsx`
- Modify: `components/StudentGrading/index.tsx`

The spec says to show system rubric pips and a ⚠️ warning for essays in languages where the model is still "Natututo pa".

- [ ] **Step 1: Add `trainStatus` prop to `EssayPanelProps`**

```typescript
import { TrainStatusResponse } from '../../services/pythonService';

interface EssayPanelProps {
  student: Student | null;
  selectedSubject: Subject | null;
  selectedEssayId: string | null;
  onSelectEssay: (essayId: string) => void;
  onUploadEssay: () => void;
  trainStatus?: TrainStatusResponse | null;
}
```

Update the component signature to destructure `trainStatus`.

- [ ] **Step 2: Add system pips mini-component inside `EssayPanel.tsx`**

Add before the component:
```typescript
function MiniPips({ score, max = 4 }: { score: number; max?: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }, (_, i) => (
        <div
          key={i}
          className={`w-1.5 h-1.5 rounded-full ${i < score ? 'bg-teal-400' : 'bg-gray-200'}`}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Update essay card to show system pips and confidence warning**

In the essay list, find the section that renders the badge row (lines ~77–91). Add the system pips and warning after the proficiency badge:

```tsx
<div className="flex items-center gap-1.5 flex-wrap">
  {prof && (
    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${profBadge[prof] ?? 'bg-gray-100 text-gray-600'}`}>
      {prof}
    </span>
  )}

  {/* System rubric pips */}
  {essay.diagnosisResult?.rubricScore && (
    <MiniPips score={Math.round(essay.diagnosisResult.rubricScore.overallScore)} />
  )}

  {/* Natututo pa warning */}
  {!essay.teacherRubricScores && (() => {
    const lang = selectedSubject?.language;
    const langStatus = lang === 'english' ? trainStatus?.english : trainStatus?.filipino;
    return langStatus?.confidence_level === 'Natututo pa' ? (
      <span className="text-[9px] text-amber-500" title="Ang sistema ay natututo pa">⚠️</span>
    ) : null;
  })()}

  {/* Teacher rubric score if rated */}
  {essay.teacherRubricScores ? (
    <span className="text-[9px] text-amber-500 flex items-center gap-0.5">
      <IoStar className="text-[9px]" />{essay.teacherRubricScores.overall.toFixed(1)}/4
    </span>
  ) : null}
</div>
```

- [ ] **Step 4: Pass `trainStatus` to `EssayPanel` in `index.tsx`**

Find `<EssayPanel` and add:
```tsx
<EssayPanel
  student={selectedStudent}
  selectedSubject={selectedSubject}
  selectedEssayId={selectedEssayId}
  onSelectEssay={setSelectedEssayId}
  onUploadEssay={() => setShowUpload(true)}
  trainStatus={trainStatus}
/>
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep "error" | head -10
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add components/StudentGrading/EssayPanel.tsx components/StudentGrading/index.tsx
git commit -m "feat(panel): add system pips and Natututo pa warning to EssayPanel essay cards"
```

---

## Final Verification

- [ ] Run `npx tsc --noEmit` — expect zero StudentGrading errors

- [ ] Start the app: `npm run dev`

- [ ] Upload a Filipino essay → check Analysis tab:
  - DepEd Rubric panel shows 4 pips per dimension (not 5)
  - Scores show `/4` not `/5`
  - Score labels use Nagsisimula/Papaunlad/Papalapit sa Kahusayan/Mahusay

- [ ] Open an essay in EssayViewerModal → scroll to bottom:
  - Per-dimension rubric table shows 5 rows
  - System pips (teal) show the Gemini suggestion for each dimension
  - Teacher stars (amber) are clickable — clicking one fills stars
  - Overall row updates after all 5 are rated
  - Save button stores `TeacherRubricScores` object (not a number)

- [ ] Check Sidebar:
  - If backend is running, confidence indicator shows for English and Filipino
  - Retrain button appears when new_since_retrain >= 5

- [ ] Check EssayPanel:
  - Essay cards show small teal pips if rubricScore is present
  - ⚠️ appears on unrated essays when that language is "Natututo pa"
  - Rated essays show amber star + `X.X/4`

- [ ] Check proficiency badges show "Mahusay", "Papaunlad", or "Nagsisimula" (not Independent/etc.)

```bash
git add types.ts backend/svm_models.py backend/main.py \
  components/MaterialChecker.tsx components/Analyzer.tsx \
  components/StudentGrading/EssayViewerModal.tsx \
  components/StudentGrading/EssayPanel.tsx \
  components/StudentGrading/Sidebar.tsx \
  components/StudentGrading/index.tsx
git commit -m "feat: teacher feedback learning system — end-to-end verification complete"
```
