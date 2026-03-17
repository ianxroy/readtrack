# Teacher Feedback Learning System — Design Spec

> Created: 2026-03-17
> Status: Approved by user

---

## Overview

A human-in-the-loop learning system where teacher rubric ratings improve the SVM proficiency models over time. Teachers rate each DepEd rubric dimension individually, that data is stored in Supabase, and the backend retrains the models on demand using accumulated Philippine student data blended with the ASAP2 baseline.

---

## Goals

1. Replace the inaccurate ASAP2-trained proficiency model with one trained on real Philippine G7 data
2. Replace the simple 1–5 star teacher rating with a per-dimension DepEd rubric rating
3. Show teachers a confidence indicator so they know how much to trust the system score
4. Two separate models — one for English, one for Filipino — trained independently

---

## Architecture

```
Teacher rates essay dimensions (1–4 per dimension)
        ↓
Frontend updates Supabase student_grading_uploads
(teacher_rubric_scores JSONB column — new)
        ↓
Admin clicks "Retrain Model" in Sidebar
        ↓
Frontend → POST /train/retrain?language=en|tl
        ↓
Backend pulls rated essays from Supabase (service key)
Filters by language, teacher_rubric_scores IS NOT NULL
        ↓
Extracts features from essay_text (preprocessing.py)
Maps avg teacher score → DepEd proficiency label
Blends with ASAP2 (English only, PH data weighted 2×)
        ↓
Retrains SVM → saves proficiency_model_en.pkl or proficiency_model_tl.pkl
Updates evaluation_metrics.json
        ↓
Returns { samples_used, accuracy, confidence_level, language }
```

---

## DepEd Rubric Scale Change: 1–5 → 1–4

Replace current 1–5 Gemini rubric scoring with the official DepEd 4-level performance task scale.

### Score Descriptors (Language-Aware)

| Score | Filipino Label | English Label |
|---|---|---|
| 4 | Mahusay | Proficient |
| 3 | Papalapit sa Kahusayan | Approaching Proficiency |
| 2 | Papaunlad | Developing |
| 1 | Nagsisimula | Beginning |

**Passing threshold:** Score 2 (Papaunlad / Developing) — aligns with DepEd minimum passing.

### Overall Score Display

Show three values derived from the 5-dimension average:
```
Kabuuan / Overall:   3.0/4  →  75%  →  Transmuted: 87.5
```

- **Raw score:** average of 5 dimensions (1 decimal place)
- **Percentage:** `(score / 4) × 100`
- **Transmuted grade:** `((percentage - 60) / 40) × 25 + 75` (DepEd Order 8, s. 2015)

---

## Replace Phil-IRI Labels with DepEd Writing Labels

The proficiency badge throughout the app changes from Phil-IRI reading levels to DepEd writing assessment levels.

| Old (Phil-IRI) | New (DepEd Writing) | Trigger |
|---|---|---|
| Independent | **Mahusay** | avg teacher score 3.5–4.0 |
| Instructional | **Papaunlad** | avg teacher score 2.0–3.4 |
| Frustration | **Nagsisimula** | avg teacher score 1.0–1.9 |

> Note: "Papalapit sa Kahusayan" is used in the rubric display but maps to Mahusay for the badge to keep 3 simple levels.

**Files affected:** `types.ts`, `svm_models.py`, `EssayViewerModal.tsx`, `EssayPanel.tsx`, `evaluation_metrics.json`, Supabase data migration.

---

## Per-Dimension Teacher Rubric Rating

### Replaces the 1–5 star rating entirely.

Teachers rate each of the 5 DepEd dimensions using 4 stars. The UI shows the system suggestion alongside the teacher's input side by side.

### Rubric Dimension Labels (Language-Aware)

| Dimension | Filipino Label | English Label |
|---|---|---|
| Content | Nilalaman | Content |
| Organization | Organisasyon | Organization |
| Language/Vocab | Wika/Talasalitaan | Language/Vocabulary |
| Grammar | Gramatika | Grammar |
| Mechanics | Mekanika | Mechanics |

### UI Layout (EssayViewerModal — Analysis Tab)

```
                    Mungkahi ng Sistema    Marka ng Guro
                    (System Suggestion)    (Teacher Score)

Nilalaman                ●●●○               ★★★☆   (3/4)
Organisasyon             ●●○○               ★★☆☆   (2/4)
Gramatika                ●●●●               ★★★★   (4/4)
Wika/Talasalitaan        ●●●○               ★★★☆   (3/4)
Mekanika                 ●●○○               ★★★☆   (3/4)

Kabuuan        2.8/4 → 70% → T:87.5    3.0/4 → 75% → T:87.5

[ I-save ang Marka ng Guro ]
```

- **System pips (●):** filled circles, teal, read-only
- **Teacher stars (★):** clickable 4-star rating per dimension
- Teacher can agree with system or adjust any dimension independently
- Save button persists all 5 dimension scores to Supabase

### Supabase Schema Change

Add `teacher_rubric_scores` JSONB column to `student_grading_uploads`:

```sql
ALTER TABLE student_grading_uploads
  ADD COLUMN IF NOT EXISTS teacher_rubric_scores JSONB;

-- Example value:
-- {
--   "content": 3,
--   "organization": 2,
--   "grammar": 4,
--   "languageVocab": 3,
--   "mechanics": 3,
--   "overall": 3.0,
--   "percentage": 75.0,
--   "transmuted": 87.5
-- }
```

Remove `teacher_rating` integer column usage from the rating flow (keep column for backwards compatibility, stop writing to it from the rubric flow).

---

## Two SVM Models (English + Filipino)

```
backend/models/
├── proficiency_model_en.pkl    ← English essays
├── proficiency_model_tl.pkl    ← Filipino essays
├── complexity_model.pkl        ← unchanged
└── evaluation_metrics.json     ← metrics keyed by "proficiency_en", "proficiency_tl"
```

### Model Loading at Inference

```python
detected_lang = detect_language(text)
model = student_model_en if detected_lang == 'en' else student_model_tl
result = model.predict(features, text, grammar_data=..., language=detected_lang)
```

### Training Data per Model

| | English Model (`_en`) | Filipino Model (`_tl`) |
|---|---|---|
| Baseline | ASAP2 (American essays) | None — PH data only |
| PH data | Teacher ratings, English subject essays | Teacher ratings, Filipino subject essays |
| Cold start | ASAP2 fallback | Heuristic until 5+ PH ratings |
| Blend ratio | ASAP2 × 1 + PH × 2 weight | PH data only |

### Label Mapping for Retraining

Teacher avg score → SVM training label:
```
3.5–4.0 → "Mahusay"
2.5–3.4 → "Papaunlad"
1.0–2.4 → "Nagsisimula"
```

---

## Confidence Threshold System

### Per-Language Confidence

Confidence is tracked independently for English and Filipino models based on count of essays with `teacher_rubric_scores IS NOT NULL` per language.

```
0–4 rated essays    → 🔴 Natututo pa    (Still Learning)
                       Proficiency badge shows ⚠️ disclaimer
                       "Ang sistema ay natututo pa. Kailangan ng review ng guro."

5–29 rated essays   → 🟡 Papaunlad      (Developing)
                       Disclaimer removed
                       Light suggestions enabled

30–99 rated essays  → 🟢 Kalibrado      (Calibrated)
                       School-specific recommendations enabled

100+ rated essays   → 🟢 Kumpiyansa     (Confident)
                       Full recommendations, ASAP2 mostly diluted
```

### Backend Endpoint: GET /train/status

Returns:
```json
{
  "english": {
    "rated_essays": 47,
    "confidence_level": "Kalibrado",
    "last_retrain": "2026-03-10T08:00:00Z",
    "new_since_retrain": 12
  },
  "filipino": {
    "rated_essays": 8,
    "confidence_level": "Papaunlad",
    "last_retrain": null,
    "new_since_retrain": 8
  }
}
```

---

## Retrain Endpoint

### POST /train/retrain

Request:
```json
{ "language": "en" }   // or "tl"
```

Response:
```json
{
  "language": "en",
  "samples_used": 47,
  "asap2_samples": 19776,
  "accuracy": "86.2%",
  "confidence_level": "Kalibrado",
  "model_saved": "proficiency_model_en.pkl"
}
```

Backend uses Supabase **service key** (not anon key) stored in `.env` to read across all teachers. Only pulls `essay_text`, `teacher_rubric_scores`, `subject_name` (for language) — no student names.

---

## Rubric Visibility in Essay List Panel

The essay list panel (EssayPanel.tsx) shows a compact rubric summary per essay:

```
My Essay Title
●●●○  3.0/4  75%     ← system suggestion pips + score
★★★☆  Marka ng Guro  ← teacher score if rated
```

If not yet rated by teacher: shows system pips only with ⚠️ if in "Natututo pa" mode.

---

## Retrain Button in Sidebar

Shown when `new_since_retrain >= 5` for either language:

```
┌─────────────────────────────┐
│  🔄 I-update ang Modelo     │
│  English:  12 bagong essays │
│  Filipino:  5 bagong essays │
│  [ I-retrain Ngayon ]       │
└─────────────────────────────┘
```

Retrain runs per language. Progress shown inline. On complete, confidence level badge updates.

---

## Privacy

- **Student names:** Protected by Supabase RLS — only the uploading teacher can see names
- **Training data:** Backend pulls only `essay_text + teacher_rubric_scores + subject_name` — no names, no teacher identity
- **SHA hashing:** `student_name_sha` remains for record linkage within one teacher's account
- **Cross-teacher:** Essays are anonymous in the training pool — no teacher can see another teacher's student names

---

## Files to Create or Modify

### Backend
| File | Change |
|---|---|
| `backend/main.py` | Add `/train/status` and `/train/retrain` endpoints; load two SVM models |
| `backend/svm_models.py` | Update labels to DepEd 4-level; update `predict()` per language |
| `backend/train_proficiency.py` | Split into `train_proficiency_en.py` and `train_proficiency_tl.py` |
| `backend/train_proficiency_tl.py` | New — trains Filipino model from PH teacher data only |
| `backend/.env` | Add `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` |

### Frontend
| File | Change |
|---|---|
| `types.ts` | Update `ProficiencyLevel` enum to DepEd labels; update `DepEdRubricScore` to 1–4 scale; add `TeacherRubricScore` type |
| `services/supabaseService.ts` | Add `saveTeacherRubricScores()`, update `updateEssayTeacherRating()` |
| `services/pythonService.ts` | Add `getTrainStatus()`, `triggerRetrain()` |
| `components/StudentGrading/EssayViewerModal.tsx` | Replace star rating with per-dimension 4-star rubric; add language-aware labels; add overall % and transmuted grade |
| `components/StudentGrading/EssayPanel.tsx` | Add compact rubric summary with pips + score |
| `components/StudentGrading/Sidebar.tsx` | Add retrain button + confidence indicator |
| `components/StudentGrading/GrammarHighlightedText.tsx` | No change |
| `supabase_sql.txt` | Add `teacher_rubric_scores` JSONB column migration |

---

## Out of Scope

- Automatic retraining (manual retrain button only)
- Per-teacher models (one shared model per language)
- Filipino baseline dataset (cold start uses heuristics)
- Retraining the complexity model (CommonLit, 98.9% accurate, universal)
