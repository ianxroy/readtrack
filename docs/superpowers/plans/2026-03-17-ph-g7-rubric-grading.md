# PH G7 DepEd Rubric Grading Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the inaccurate single-score grading with a DepEd-aligned 5-dimension rubric system calibrated for Philippine Grade 7 students, supporting both English and Filipino essays.

**Architecture:** New Gemini-powered rubric endpoint in the backend returns a 5-dimension score. The frontend passes subject language and grade level to the analyzer and displays the rubric breakdown in the Analysis tab of the EssayViewerModal. The SVM model's natScore is replaced by the rubric total as the primary displayed score.

**Tech Stack:** FastAPI (Python backend), Google Gemini 2.5 Flash (rubric evaluation), React + TypeScript (frontend), Tailwind CSS (UI)

**Research reference:** `docs/research/2026-03-17-ph-g7-essay-grading-standards.md`

---

## Chunk 1: Types and Backend Endpoint

### Task 1: Add `DepEdRubricScore` to `types.ts`

**Files:**
- Modify: `types.ts`

The DepEd 5-dimension rubric must be a first-class type so the frontend and backend contract is clear.

- [ ] **Step 1: Add the type to `types.ts`**

Add after the `LinguisticMetrics` interface (line 48):

```typescript
export interface DepEdRubricDimension {
  score: number;       // 1–5
  rationale: string;   // one-sentence explanation
}

export interface DepEdRubricScore {
  content: DepEdRubricDimension;
  organization: DepEdRubricDimension;
  language: DepEdRubricDimension;
  grammar: DepEdRubricDimension;
  mechanics: DepEdRubricDimension;
  overallScore: number;   // average of 5 dimensions, 1–5
  overallFeedback: string; // 2–3 sentence teacher-facing summary in Filipino or English
  gradeLevel: string;     // e.g. "Grade 7"
  language: 'english' | 'filipino';
}
```

- [ ] **Step 2: Add optional `rubricScore` field to `StudentDiagnosisResult`**

In `types.ts`, inside the `StudentDiagnosisResult` interface, add:
```typescript
rubricScore?: DepEdRubricScore;
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Volumes/Hanteck/Projects/readtrack && npx tsc --noEmit
```

Expected: No errors related to the new types.

- [ ] **Step 4: Commit**

```bash
git add types.ts
git commit -m "feat(types): add DepEdRubricScore type for PH G7 5-dimension grading"
```

---

### Task 2: Add `POST /analyze/rubric` endpoint to `backend/main.py`

**Files:**
- Modify: `backend/main.py`

This endpoint calls Gemini with a PH G7-specific prompt and returns structured rubric scores. It is separate from `/analyze/student` so it can be called independently (e.g., on already-uploaded essays without re-running the SVM).

- [ ] **Step 1: Add the request/response models to `main.py`**

Add after the existing `TextRequest` model (around line 74):

```python
class RubricRequest(BaseModel):
    text: str
    language: str = "filipino"  # "english" or "filipino"
    grade_level: str = "Grade 7"

class RubricDimension(BaseModel):
    score: int  # 1-5
    rationale: str

class RubricResponse(BaseModel):
    content: RubricDimension
    organization: RubricDimension
    language: RubricDimension
    grammar: RubricDimension
    mechanics: RubricDimension
    overall_score: float
    overall_feedback: str
    grade_level: str
    language: str
```

- [ ] **Step 2: Add the Gemini rubric function to `main.py`**

Add this helper function before the route definitions:

```python
import google.generativeai as genai

async def evaluate_rubric_with_gemini(text: str, language: str, grade_level: str) -> dict:
    """
    Evaluate an essay using the DepEd 5-dimension rubric calibrated for PH Grade 7.
    Returns a dict matching RubricResponse fields.
    """
    if not GEMINI_API_KEY:
        raise ValueError("Gemini API key not configured")

    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel("gemini-2.5-flash")

    lang_label = "Filipino (Tagalog)" if language == "filipino" else "English"

    prompt = f"""You are a DepEd-trained Philippine {grade_level} teacher grading a student essay.

Use the official DepEd 5-dimension analytic rubric. Each dimension is scored 1–5:
- 5: Excellent — exceeds {grade_level} expectations
- 4: Proficient — meets {grade_level} expectations
- 3: Developing — partially meets expectations (this is the PASSING threshold for PH G7)
- 2: Beginning — minimally meets expectations
- 1: Poor — does not meet expectations

IMPORTANT CALIBRATION FOR PHILIPPINE GRADE 7:
- The average PH G7 student scores ~2.3/5 on Organization nationally (research baseline)
- Mechanical errors (punctuation, spelling) are the MOST COMMON error type in PH G7 — do not heavily penalize them
- Filipino essays may use narrative/anecdote-heavy structure, collective experience references, and faith/family themes — this is culturally appropriate and should NOT be penalized
- For Filipino-language essays: Taglish code-switching is the main vocabulary concern; minor verb focus errors are expected at G7
- An essay that sustains a topic, has a clear 3-part structure, and communicates effectively is performing AT OR ABOVE the Philippine national average for G7

ESSAY LANGUAGE: {lang_label}

ESSAY TEXT:
\"\"\"
{text}
\"\"\"

Evaluate on these 5 dimensions:

1. CONTENT — Relevance, depth of ideas, supporting details, topic development
2. ORGANIZATION — Clear intro-body-conclusion structure, logical flow, paragraph transitions
3. LANGUAGE — Word choice, register appropriateness, formal vocabulary{' (no Taglish)' if language == 'filipino' else ''}
4. GRAMMAR — Verb forms, sentence construction, agreement{', Filipino verb focus system (mag-, um-, -in, -an, i-)' if language == 'filipino' else ', tense consistency, articles'}
5. MECHANICS — Capitalization, punctuation, spelling

Respond ONLY with valid JSON in this exact format:
{{
  "content": {{"score": <1-5>, "rationale": "<one sentence>"}},
  "organization": {{"score": <1-5>, "rationale": "<one sentence>"}},
  "language": {{"score": <1-5>, "rationale": "<one sentence>"}},
  "grammar": {{"score": <1-5>, "rationale": "<one sentence>"}},
  "mechanics": {{"score": <1-5>, "rationale": "<one sentence>"}},
  "overall_feedback": "<2-3 sentence teacher-facing feedback in {lang_label}>"
}}"""

    response = model.generate_content(
        prompt,
        generation_config=genai.types.GenerationConfig(
            response_mime_type="application/json",
            temperature=0.2,
        )
    )

    import json
    data = json.loads(response.text)

    scores = [
        data["content"]["score"],
        data["organization"]["score"],
        data["language"]["score"],
        data["grammar"]["score"],
        data["mechanics"]["score"],
    ]
    data["overall_score"] = round(sum(scores) / len(scores), 2)
    data["grade_level"] = grade_level
    data["language"] = language
    return data
```

- [ ] **Step 3: Add the route to `main.py`**

Add after the `/analyze/student` route (around line 183):

```python
@app.post("/analyze/rubric")
async def analyze_rubric(request: RubricRequest):
    """
    Evaluate a student essay using the DepEd 5-dimension rubric for PH Grade 7.
    Uses Gemini 2.5 Flash with PH-calibrated grading context.
    """
    try:
        result = await evaluate_rubric_with_gemini(
            text=request.text,
            language=request.language,
            grade_level=request.grade_level
        )
        return result
    except ValueError as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"error": str(e)}
```

- [ ] **Step 4: Test the endpoint manually**

Start the backend and send a test request:

```bash
cd /Volumes/Hanteck/Projects/readtrack/backend
python main.py &
sleep 3
curl -s -X POST http://localhost:8000/analyze/rubric \
  -H "Content-Type: application/json" \
  -d '{"text": "Sa lahat nang pagsubok na nagdaan at dinadanas ko parin hanggang ngayon, ay patuloy ko itong nalalampasan.", "language": "filipino", "grade_level": "Grade 7"}' | python -m json.tool
```

Expected: JSON with 5 dimension scores (each 1–5) and overall_feedback.

- [ ] **Step 5: Commit**

```bash
git add backend/main.py
git commit -m "feat(backend): add /analyze/rubric endpoint with DepEd G7 PH Gemini rubric evaluation"
```

---

## Chunk 2: Frontend Service and Analysis Flow

### Task 3: Add `evaluateDepEdRubric` to `services/pythonService.ts`

**Files:**
- Modify: `services/pythonService.ts`

- [ ] **Step 1: Import the new type**

At the top of `services/pythonService.ts`, add `DepEdRubricScore` to the import:

```typescript
import {
    StudentDiagnosisResult,
    TextComplexityResult,
    DepEdRubricScore,
} from "../types";
```

- [ ] **Step 2: Add the function**

Add after `analyzeStudentWorkAPI`:

```typescript
export const evaluateDepEdRubricAPI = async (
    text: string,
    language: 'english' | 'filipino' = 'filipino',
    gradeLevel: string = 'Grade 7'
): Promise<DepEdRubricScore> => {
    const response = await fetch('http://localhost:8000/analyze/rubric', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'accept': 'application/json',
        },
        body: JSON.stringify({ text, language, grade_level: gradeLevel }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    if (data?.error) throw new Error(data.error);

    // Map snake_case backend response to camelCase frontend type
    return {
        content: data.content,
        organization: data.organization,
        language: data.language_dim ?? data.language,
        grammar: data.grammar,
        mechanics: data.mechanics,
        overallScore: data.overall_score,
        overallFeedback: data.overall_feedback,
        gradeLevel: data.grade_level,
        language: language,
    } as DepEdRubricScore;
};
```

> **Note:** The backend returns `language` as both the essay language string and a rubric dimension. Since the Gemini prompt uses `"language"` as a key for the vocabulary/language dimension, we map it carefully here. If there's a key collision, update the backend to name the dimension key `"language_dim"` instead.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Volumes/Hanteck/Projects/readtrack && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add services/pythonService.ts
git commit -m "feat(service): add evaluateDepEdRubricAPI for DepEd 5-dimension essay grading"
```

---

### Task 4: Wire rubric evaluation into the essay upload flow

**Files:**
- Explore first: `components/StudentGrading/UploadModal.tsx` — find where `analyzeStudentWorkAPI` is called
- Modify: `components/StudentGrading/UploadModal.tsx`
- Modify: `components/StudentGrading/types.ts` — if `StudentEssay` needs updating

The rubric evaluation should run after the SVM analysis completes, using the subject's language.

- [ ] **Step 1: Read `UploadModal.tsx` to understand the analysis flow**

```bash
# In the IDE, open components/StudentGrading/UploadModal.tsx
```

Find where `analyzeStudentWorkAPI` is called and where `diagnosisResult` is set on the essay.

- [ ] **Step 2: Import the new API function and call it after SVM analysis**

In `UploadModal.tsx`, after `analyzeStudentWorkAPI` resolves, add:

```typescript
import { analyzeStudentWorkAPI, evaluateDepEdRubricAPI } from '../../services/pythonService';

// After getting diagnosisResult:
const diagnosisResult = await analyzeStudentWorkAPI(text, base64Image, mimeType);

// Run rubric evaluation in parallel or sequentially
let rubricScore: DepEdRubricScore | undefined;
try {
    rubricScore = await evaluateDepEdRubricAPI(
        text,
        selectedSubject?.language ?? 'filipino',
        'Grade 7'
    );
} catch (err) {
    console.warn('Rubric evaluation failed (non-blocking):', err);
}

// Merge into the result
const finalResult: StudentDiagnosisResult = {
    ...diagnosisResult,
    rubricScore,
};
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add components/StudentGrading/UploadModal.tsx
git commit -m "feat(upload): run DepEd rubric evaluation after SVM analysis on essay upload"
```

---

## Chunk 3: UI — Display Rubric in EssayViewerModal

### Task 5: Add DepEd Rubric section to the Analysis tab

**Files:**
- Modify: `components/StudentGrading/EssayViewerModal.tsx`

Replace or supplement the current 4-metric bar chart with the 5-dimension DepEd rubric. The old metrics (grammar accuracy %, vocabulary richness % etc.) can remain as a secondary "Technical Metrics" section. The rubric becomes the primary evaluation display.

- [ ] **Step 1: Import the type**

In `EssayViewerModal.tsx`, add to existing imports:
```typescript
import { DepEdRubricScore } from '../../types';
```

- [ ] **Step 2: Add the `RubricCard` component inside the file (above `EssayViewerModal`)**

```typescript
const DIMENSION_META: Record<
  keyof Pick<DepEdRubricScore, 'content' | 'organization' | 'language' | 'grammar' | 'mechanics'>,
  { label: string; labelFil: string; color: string }
> = {
  content:      { label: 'Content',      labelFil: 'Nilalaman',      color: 'indigo'  },
  organization: { label: 'Organization', labelFil: 'Organisasyon',   color: 'teal'    },
  language:     { label: 'Language',     labelFil: 'Wika/Talasalitaan', color: 'violet' },
  grammar:      { label: 'Grammar',      labelFil: 'Gramatika',      color: 'amber'   },
  mechanics:    { label: 'Mechanics',    labelFil: 'Mekanika',       color: 'rose'    },
};

const SCORE_LABEL: Record<number, string> = {
  1: 'Hindi pa naaabot',   // Poor
  2: 'Nagsisimula',        // Beginning
  3: 'Papaunlad',          // Developing — passing threshold
  4: 'Mahusay',            // Proficient
  5: 'Napakahusay',        // Excellent
};

function ScorePip({ score }: { score: number }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <div
          key={n}
          className={`w-3 h-3 rounded-full ${n <= score ? 'bg-teal-500' : 'bg-gray-200'}`}
        />
      ))}
    </div>
  );
}

function DepEdRubricPanel({ rubric }: { rubric: DepEdRubricScore }) {
  const dims = (['content', 'organization', 'language', 'grammar', 'mechanics'] as const);
  const langLabel = rubric.language === 'filipino' ? 'Filipino' : 'English';

  return (
    <div className="bg-white border border-gray-100 rounded-[24px] p-6 shadow-sm space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
          <IoStatsChartOutline className="text-indigo-400" />
          DepEd Rubric · {rubric.gradeLevel} · {langLabel}
        </h4>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 font-medium">Kabuuan</span>
          <span className="text-lg font-black text-indigo-600">
            {rubric.overallScore.toFixed(1)}<span className="text-xs text-gray-400">/5</span>
          </span>
        </div>
      </div>

      {/* 5 Dimensions */}
      <div className="space-y-4">
        {dims.map(dim => {
          const meta = DIMENSION_META[dim];
          const d = rubric[dim];
          return (
            <div key={dim}>
              <div className="flex items-center justify-between mb-1">
                <div>
                  <span className="text-xs font-bold text-gray-700">{meta.labelFil}</span>
                  <span className="text-[10px] text-gray-400 ml-1">({meta.label})</span>
                </div>
                <span className="text-[10px] font-bold text-gray-500">
                  {d.score}/5 · {SCORE_LABEL[d.score]}
                </span>
              </div>
              <ScorePip score={d.score} />
              <p className="text-[10px] text-gray-500 mt-1 leading-relaxed">{d.rationale}</p>
            </div>
          );
        })}
      </div>

      {/* Overall Feedback */}
      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
        <p className="text-[11px] text-indigo-900 leading-relaxed font-medium">
          {rubric.overallFeedback}
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Use `DepEdRubricPanel` in the Analysis tab**

In `EssayViewerModal.tsx`, find the Analysis tab section (around line 195). Add `DepEdRubricPanel` **before** the existing Performance Metrics section:

```typescript
{/* DepEd Rubric — primary evaluation */}
{dr?.rubricScore && (
  <DepEdRubricPanel rubric={dr.rubricScore} />
)}
```

Also update the "Mungkahing Marka" (Suggested Score) card to show the rubric overall score when available:

```typescript
value: dr.rubricScore
  ? `${dr.rubricScore.overallScore.toFixed(1)}/5`
  : `${dr.natScore}%`,
```

- [ ] **Step 4: Verify the app compiles and renders**

```bash
cd /Volumes/Hanteck/Projects/readtrack && npm run dev
```

Open an essay with a completed analysis and check the Analysis tab. Verify:
- Rubric panel appears with 5 dimensions
- Each dimension shows pips and rationale
- Overall feedback text renders

- [ ] **Step 5: Commit**

```bash
git add components/StudentGrading/EssayViewerModal.tsx
git commit -m "feat(ui): add DepEd 5-dimension rubric panel to EssayViewerModal Analysis tab"
```

---

## Chunk 4: Backend — Fix the JSON Key Collision

> The Gemini response uses `"language"` as a rubric dimension key, but the response object also needs `"language"` to mean the essay language. This chunk resolves that cleanly.

### Task 6: Rename rubric dimension key in backend and frontend

**Files:**
- Modify: `backend/main.py` — change prompt to use `"language_vocab"` for the language/vocabulary dimension
- Modify: `services/pythonService.ts` — update the mapping

- [ ] **Step 1: Update the Gemini prompt in `main.py`**

In `evaluate_rubric_with_gemini`, change:
```python
  "language": {{"score": <1-5>, "rationale": "<one sentence>"}},
```
to:
```python
  "language_vocab": {{"score": <1-5>, "rationale": "<one sentence>"}},
```

Also update the JSON format description in the prompt:
```
3. LANGUAGE — Word choice, register appropriateness...
→ key: "language_vocab"
```

- [ ] **Step 2: Update the mapping in `pythonService.ts`**

Change:
```typescript
language: data.language_dim ?? data.language,
```
to:
```typescript
language: data.language_vocab,
```

- [ ] **Step 3: Update `DepEdRubricScore` type in `types.ts`**

The field in the type interface should match. Since `language` is already used for the essay language, rename the dimension:

```typescript
export interface DepEdRubricScore {
  content: DepEdRubricDimension;
  organization: DepEdRubricDimension;
  languageVocab: DepEdRubricDimension;   // renamed from "language" to avoid collision
  grammar: DepEdRubricDimension;
  mechanics: DepEdRubricDimension;
  overallScore: number;
  overallFeedback: string;
  gradeLevel: string;
  language: 'english' | 'filipino';      // essay language, not a dimension
}
```

Update `DIMENSION_META` in `EssayViewerModal.tsx` accordingly:
```typescript
const DIMENSION_META: Record<
  'content' | 'organization' | 'languageVocab' | 'grammar' | 'mechanics',
  ...
> = {
  ...
  languageVocab: { label: 'Language', labelFil: 'Wika/Talasalitaan', color: 'violet' },
  ...
};
const dims = (['content', 'organization', 'languageVocab', 'grammar', 'mechanics'] as const);
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add types.ts backend/main.py services/pythonService.ts components/StudentGrading/EssayViewerModal.tsx
git commit -m "fix(rubric): rename language dimension key to languageVocab to avoid JSON collision"
```

---

## Chunk 5: Fix `natScore` Calibration for Filipino Essays

### Task 7: Update `svm_models.py` to use rubric-informed natScore when available

**Files:**
- Modify: `backend/svm_models.py`
- Modify: `backend/main.py` — pass rubric score to `student_model.predict` when available

Currently the `natScore` is computed with grammar at 40% weight, which unfairly penalizes Filipino essays with valid Filipino grammar structures flagged as English grammar errors.

- [ ] **Step 1: Update `StudentProficiencySVM.predict` to accept optional `rubric_score`**

In `svm_models.py`, update the method signature:

```python
def predict(self, features_data, text_content, grammar_data=None, rubric_score=None):
```

Add at the end of the method, before the final `return`:

```python
# If we have a rubric score, use it to inform natScore more accurately
# rubric_score is 1–5; convert to 0–100 for natScore field
if rubric_score is not None:
    rubric_nat = round((rubric_score / 5.0) * 100, 2)
    # Blend: 60% rubric (context-aware), 40% heuristic (structural features)
    nat = round((rubric_nat * 0.6) + (nat * 0.4), 2)
    # Re-classify proficiency based on blended score
    if nat >= 70:
        proficiency = "Independent"
    elif nat >= 35:
        proficiency = "Instructional"
    else:
        proficiency = "Frustration"
```

- [ ] **Step 2: Run a quick sanity-check test**

The essay from the user's screenshot ("Sa lahat nang pagsubok...") — when graded with the new rubric — should score at minimum Instructional (35–69) if not Independent (70+).

```bash
cd /Volumes/Hanteck/Projects/readtrack/backend
python -c "
from svm_models import StudentProficiencySVM
from preprocessing import extract_features

text = 'Sa lahat nang pagsubok na nagdaan at dinadanas ko parin hanggang ngayon, ay patuloy ko itong nalalampasan.'
features = extract_features(text, language='tl')
model = StudentProficiencySVM()
result = model.predict(features, text, rubric_score=3.6)  # simulated rubric avg
print(result['proficiency'], result['natScore'])
"
```

Expected: Proficiency is `Independent` or `Instructional`, natScore is 50+.

- [ ] **Step 3: Commit**

```bash
git add backend/svm_models.py
git commit -m "fix(grading): blend rubric score into natScore to reduce grammar over-weighting for Filipino essays"
```

---

## Chunk 6: Feedback Quality

### Task 8: Replace the generic feedback string

**Files:**
- Modify: `backend/svm_models.py`

Currently: `"Rated as {proficiency}. Grammar Accuracy: {round(grammar_score, 1)}%."`

This is not useful for teachers grading Filipino essays. Update to a structured template:

- [ ] **Step 1: Update the feedback in `svm_models.py`**

Replace:
```python
"feedback": f"Rated as {proficiency}. Grammar Accuracy: {round(grammar_score, 1)}%.",
```

With:
```python
"feedback": (
    f"Antas: {proficiency}. "
    f"Katumpakan ng Gramatika: {round(grammar_score, 1)}%. "
    f"Kayamanan ng Talasalitaan: {round(vocab_rich, 1)}%. "
    f"Istruktura at Pagkakaisa: {round(struct_coh, 1)}%. "
    f"Para sa detalyadong rubrik ng DepEd, tingnan ang Analysis tab."
),
```

> The DepEd rubric panel in the Analysis tab provides the real teacher feedback. This field is a brief summary only.

- [ ] **Step 2: Commit**

```bash
git add backend/svm_models.py
git commit -m "fix(feedback): replace generic proficiency string with structured metric summary"
```

---

## Final: End-to-End Verification

- [ ] Upload the essay from the screenshot ("Sa lahat nang pagsubok...") as a Filipino essay

- [ ] Open the Analysis tab and verify:
  - DepEd rubric panel appears with 5 dimensions scored 1–5
  - Overall score is displayed (expected: 3.0–4.0 for this essay)
  - Overall feedback is in Filipino
  - Content score is 3–4 (strong narrative, culturally appropriate)
  - Organization score is 3–4 (clear 3-part structure)
  - Grammar score is 3 (some minor issues expected at G7)
  - Mechanics score is 2–3 (punctuation issues expected)
  - Proficiency shows `Independent` or `Instructional` (NOT `Frustration`)
  - natScore is 50–80

- [ ] Verify the old 4-metric bar chart still appears below as "Technical Metrics" (not replaced)

- [ ] Commit any final fixes

```bash
git add -A
git commit -m "feat: PH G7 DepEd rubric grading system — end-to-end verification complete"
```
