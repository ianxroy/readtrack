# Algorithm Visualizer — Design Spec
**Date:** 2026-04-05
**Audience:** Thesis defense / academic panel
**Output:** `diagrams/algorithm-visualizer.html` (standalone, no build step)

---

## Overview

A single standalone HTML file that walks through the complete ReadTrack NLP pipeline step by step — from raw student essay text to SVM classification, DepEd verdict, and teacher-driven model retraining. Designed for live thesis defense demos. Opens directly in a browser; requires the FastAPI backend running at `http://localhost:8000`.

---

## Architecture

**Approach: Backend Analysis + JS Sliders**

| Action | How |
|--------|-----|
| Initial analysis | `POST /analyze/student` → proficiency label + natScore + metrics |
| Complexity classification | `POST /analyze/complexity` → SVM level + metrics (feature values for Section 2) |
| Live model stats | `GET /train/status` → EN + TL rated essay counts, last retrain, new_since_retrain |
| What-if sliders | JS heuristic formula (`CS = ASL×3 + DWR×4 + AdvCEFR×3`) — instant, no API call |
| Rubric submit + retrain | `POST /train/proficiency` → retrain; then re-call `GET /train/status` to refresh Section 5 |

`/train/performance` is **not used** by this page (it requires a `lang` param and only returns one language at a time; `/train/status` returns both in one call).

No framework. Vanilla HTML + CSS + JS only. Self-contained in one file.

---

## Page Structure — 6 Sections (Single Scroll)

### Section 1 — Student Essay Input
- Textarea (editable, pre-filled with sample essay)
- Language auto-detection badge (updates after analysis)
- **Analyze** button → fires `POST /analyze/student` and `POST /analyze/complexity` in parallel
- Loading spinner during API call
- API endpoints shown inline for transparency

### Section 2 — Feature Extraction (24-Dimensional Vector)
- Color-coded legend: Vocabulary (green) · Syntax/Structure (blue) · CEFR Levels (purple) · Readability (orange)
- 4-column chip grid showing all 24 features with name, computed value, and one-line description
- Features grouped visually by category using chip background color
- CEFR features show 0 for Filipino text (with a note explaining why)

**The 24 features (numbered):**

| # | Name | Source |
|---|------|--------|
| 1 | TTR (Type-Token Ratio) | `/analyze/complexity` → `metrics.vocabularyRichness` proxy |
| 2 | Avg Sentence Length | `/analyze/complexity` → `metrics.avgSentenceLength` |
| 3 | Difficult Word Ratio | `/analyze/complexity` → `metrics.difficultWordRatio` |
| 4 | Advanced CEFR Ratio | `/analyze/complexity` → `metrics.advancedWordCount / wordCount` |
| 5 | CEFR A1 ratio | `/analyze/complexity` → `metrics.cefrDistribution.A1 / wordCount` |
| 6 | CEFR A2 ratio | same |
| 7 | CEFR B1 ratio | same |
| 8 | CEFR B2 ratio | same |
| 9 | CEFR C1 ratio | same |
| 10 | CEFR C2 ratio | same |
| 11 | Verb Ratio | spaCy POS — not in API response; chip shows "server-side (spaCy)" |
| 12 | Noun Ratio | same |
| 13 | Adjective Ratio | same |
| 14 | Clause Density | same |
| 15 | Structure Score | same |
| 16 | Sentence Complexity Score | same |
| 17 | Avg Dependency Distance | same |
| 18 | Flesch-Kincaid Grade | `/analyze/complexity` → `metrics.readabilityIndices.flesch_kincaid` |
| 19 | Gunning Fog Index | `/analyze/complexity` → `metrics.readabilityIndices.gunning_fog` |
| 20 | Punctuation Density | spaCy — not in API response; chip shows "server-side (spaCy)" |
| 21 | Sentence Length StdDev | same |
| 22 | % Basic CEFR (A1–A2) | computed from `cefrDistribution.(A1+A2) / wordCount` |
| 23 | % Independent CEFR (B1–B2) | computed from `cefrDistribution.(B1+B2) / wordCount` |
| 24 | % Proficient CEFR (C1–C2) | computed from `cefrDistribution.(C1+C2) / wordCount` |

Features 11–17, 20–21 display as grey chips with tooltip: "Computed server-side by spaCy — value not returned by current API." Their value cells show "—". No client-side JS is required to compute them.

### Section 3 — Score Computation (Formula Walkthrough)
- 2-column grid of formula blocks
- Each block shows: formula name, equation, substituted values (step-by-step), final result
- Formulas covered:
  - TTR (Type-Token Ratio)
  - Average Sentence Length
  - Difficult Word Ratio
  - Flesch-Kincaid Grade Level: `FK = (0.39 × ASL) + (11.8 × Syl/W) − 15.59`
  - Gunning Fog Index: `Fog = 0.4 × (ASL + 100 × CW/W)`
  - Clause Density
  - Structure Score: `min(100, (CD×10) + (ASL×2))`
  - Heuristic Complexity Score: `CS = (ASL×3) + (DWR×4) + (AdvCEFR×3)`
- SVM verdict box: shows `vector → StandardScaler → SVC(rbf, C=10) → predict() → label` with confidence

### Section 4 — DepEd Scale, Verdict & What-if Sliders
**Left column — Classification Bands:**
- Three verdict bands (Literal / Inferential / Evaluative), active one highlighted with border
- Each band shows: label, description, Phil-IRI level, DepEd G7 verdict
- Proficiency bands (Nagsisimula / Papaunlad / Mahusay), active one highlighted

**Right column — What-if Sliders:**
- 5 sliders: Avg Sentence Length, Difficult Word %, Advanced CEFR count, TTR, Clause Density
- Each slider has label, range input, live value display, and one-line hint
- **Only 3 sliders feed the CS heuristic formula:** ASL, DWR, AdvCEFR
  - On change: JS recomputes `CS = ASL×3 + DWR×4 + AdvCEFR×3`, updates verdict bands + live formula box
- **TTR and Clause Density are informational/educational** — they display updated values and a brief note (e.g. "Higher TTR = richer vocabulary") but do NOT affect the CS formula or classification output. Their chips in Section 2 animate to show the new value, but no classification shift occurs.
- Live formula box always shows the 3-term substitution and current threshold crossing

### Section 5 — Teacher Feedback Loop (Live Stats + Pipeline)
**Left column — Live Model Performance** (`GET /train/status` — single call, returns both EN + TL):
- Stats boxes: Rated Essays EN, Rated Essays TL, New Since Retrain EN, New Since Retrain TL
- Model metadata: last retrain date (from `en.last_retrain`), confidence level, pkl filename, scaler type, algorithm params, ASAP2 blend note

**Right column — Retraining Pipeline (static diagram):**
Six numbered steps:
1. Teacher rates student essay in ReadTrack app
2. Rubric scores + diagnosis stored in Supabase (`student_grading_uploads`)
3. `POST /train/proficiency` fetches all rated essays + re-extracts feature vectors
4. `RobustScaler.fit_transform(X)` — normalizes using median + IQR
5. `SVC.fit(X_scaled, y)` — trains with rbf, C=10, class_weight="balanced"
6. Save `.pkl` + hot-reload — model active immediately, no restart

### Section 6 — Teacher Rubric Scorer
- 5 rubric dimensions in a grid: Content, Organization, Language/Vocab, Grammar, Mechanics
- Each dimension has 4 clickable score buttons (1–4), one selectable at a time
- Score descriptions per level shown on hover/focus (e.g., "4 = Excellent, fully developed ideas")
- Running total: `X / 20` displayed live
- DepEd proficiency mapping: `≤8 → Nagsisimula · 9–14 → Papaunlad · 15–20 → Mahusay`
- Verdict comparison box: SVM says ___ · Teacher rubric says ___ · Match/Mismatch indicator
- Language selector (EN / TL) for rubric calibration note
- **Submit Score & Retrain** button:
  - Calls `POST /train/proficiency` with language param
  - Shows loading state during training
  - On success: show inline result box below the Submit button:
    - `accuracy` → "New model accuracy: 87.3%"
    - `samples_used` → "Trained on 44 rated essays"
    - `asap2_samples` → shown only if > 0: "+ 200 ASAP2 benchmark samples (EN only)"
  - Then re-call `GET /train/status` and refresh Section 5 stats panel

---

## Visual Design

- **Color palette:** Deep blue (#1a237e → #1565c0 gradient) header; section accent colors per section number
- **Typography:** System font stack (Segoe UI / sans-serif); monospace for all formulas and code
- **Section cards:** White background, 12px border-radius, subtle shadow, left color border per section
- **Section numbers:** Colored circles (1=blue, 2=green, 3=purple, 4=orange, 5=teal, 6=indigo)
- **Formula blocks:** Light blue-grey background, monospace font, orange result text
- **Feature chips:** Colored by category (green/blue/purple/orange backgrounds)
- **Backend status badge:** Top-right in header — "● Connected" (green) / "✕ Backend offline" (red)

---

## Error Handling

- If backend is unreachable: show inline error banner with `http://localhost:8000` and instructions to start the backend
- If `/train/status` fails: show "—" in stats cells with a retry button
- If `/train/proficiency` fails: show error message below Submit button, keep scores intact

---

## File Location

`diagrams/algorithm-visualizer.html`

Single file, no dependencies, no build step. Open directly with any browser while backend is running.

---

## API Endpoints — Full Contracts

### `POST /analyze/student`
**Request:** `{ "text": string }`
**Response:**
```json
{
  "proficiency": "Nagsisimula" | "Papaunlad" | "Mahusay",
  "natScore": 0–100,
  "learningBand": "Intervention" | "Kumpiyansa" | "Kalibrado",
  "philIriLevel": "Frustration" | "Instructional" | "Independent",
  "metrics": {
    "vocabularyRichness": float,
    "sentenceComplexity": float,
    "grammarAccuracy": float,
    "structureCohesion": float,
    "cefrDistribution": { "A1":n, "A2":n, "B1":n, "B2":n, "C1":n, "C2":n },
    "advancedWords": string[],
    "readability": { "flesch_kincaid": float, "gunning_fog": float }
  },
  "grammarIssues": GrammarIssue[],
  "analyzed_text": string
}
```
Section 2 feature chips source: `metrics.cefrDistribution`, `metrics.readability`, `metrics.vocabularyRichness`, `metrics.sentenceComplexity`, `metrics.structureCohesion`. Remaining raw features (verb ratio, noun ratio, clause density, dep distance, etc.) are computed client-side from the essay text using the same JS formulas shown in Section 3.

### `POST /analyze/complexity`
**Request:** `{ "text": string }`
**Response:**
```json
{
  "level": "Literal" | "Inferential" | "Evaluative",
  "score": 0–100,
  "reasoning": string,
  "readabilityScore": float,
  "wordCount": int,
  "keywords": string[],
  "metrics": {
    "avgSentenceLength": float,
    "difficultWordRatio": float,
    "vocabularyRichness": float,
    "sentenceComplexity": float,
    "structureCohesion": float,
    "cefrDistribution": {...},
    "advancedWords": string[],
    "readabilityIndices": { "flesch_kincaid": float, "gunning_fog": float },
    "wordCount": int,
    "advancedWordCount": int
  },
  "natScore": float,
  "learningBand": string,
  "philIriLevel": string
}
```
Section 2 raw feature values (avgSentenceLength, difficultWordRatio, advancedWordCount) come from this response's `metrics` object.

### `GET /train/performance?lang=en` and `GET /train/performance?lang=tl`
Two separate calls — one per language. Each returns:
```json
{
  "lang": "en" | "tl",
  "rated_essays": int,
  "insufficient_data": bool,
  "accuracy_report": string | null
}
```
Section 5 shows EN + TL stats side by side from both calls.

### `GET /train/status`
Returns combined EN + TL stats including last_retrain date and new_since_retrain:
```json
{
  "en": { "rated_essays": int, "confidence_level": string, "last_retrain": string|null, "new_since_retrain": int },
  "tl": { "rated_essays": int, "confidence_level": string, "last_retrain": string|null, "new_since_retrain": int }
}
```
Use `/train/status` for Section 5 stats panel (single call, returns both languages + last_retrain).

### `POST /train/proficiency`
**Request:** `{ "language": "en" | "tl" }`
**Response:**
```json
{
  "language": "en" | "tl",
  "samples_used": int,
  "asap2_samples": int,
  "accuracy": "87.3%",
  "confidence_level": string
}
```
On success: refresh Section 5 stats by re-calling `/train/status`.

---

## Slider Ranges (Section 4 What-if)

| Slider | Min | Max | Step | Default (from analysis) |
|--------|-----|-----|------|--------------------------|
| Avg Sentence Length | 3 | 40 | 0.5 | `metrics.avgSentenceLength` |
| Difficult Word % | 0 | 60 | 1 | `metrics.difficultWordRatio` |
| Advanced CEFR count | 0 | 30 | 1 | `metrics.advancedWordCount` |
| TTR | 0.10 | 1.00 | 0.01 | JS: `const words = text.toLowerCase().match(/\b\w+\b/g); new Set(words).size / words.length` |
| Clause Density | 0.5 | 5.0 | 0.1 | API does not return verb count. Initialize to `1.8` (fixed midpoint default). Slider is informational only — does not affect CS formula. |

Sliders initialize to the values returned from the analysis. Slider changes recompute `CS = ASL×3 + DWR×4 + AdvCEFR×3` locally and highlight the matching verdict band.

---

## Rubric Score Descriptions (Section 6 — hover text)

Each dimension scored 1–4 per DepEd 4-level performance task rubric:

| Score | Label | Meaning (all dimensions) |
|-------|-------|--------------------------|
| 4 | Mahusay | Fully meets Grade 7 expectations |
| 3 | Magaling | Mostly meets expectations with minor gaps |
| 2 | Papaunlad | Partially meets; noticeable gaps |
| 1 | Nagsisimula | Does not yet meet; significant gaps |

Per-dimension tooltip text:
- **Content (1)** Does not develop ideas · **(2)** Partial ideas, little support · **(3)** Clear ideas, some support · **(4)** Fully developed, strong support
- **Organization (1)** No structure · **(2)** Weak intro/body/conclusion · **(3)** Clear structure, some transitions · **(4)** Strong structure, smooth flow
- **Language/Vocab (1)** Very limited, inappropriate · **(2)** Simple, some errors · **(3)** Adequate, mostly appropriate · **(4)** Varied, precise, register-appropriate
- **Grammar (1)** Many errors impede understanding · **(2)** Frequent errors, meaning mostly clear · **(3)** Some errors, meaning clear · **(4)** Few/no errors
- **Mechanics (1)** Pervasive errors · **(2)** Many errors · **(3)** Some errors · **(4)** Correct punctuation, capitalization, spelling

---

## Verdict Comparison Logic (Section 6)

SVM proficiency labels are exactly `"Nagsisimula"`, `"Papaunlad"`, `"Mahusay"` (string match, case-sensitive).
Teacher rubric total → DepEd proficiency:
- 5–8 → `"Nagsisimula"`
- 9–14 → `"Papaunlad"`
- 15–20 → `"Mahusay"`

Match if `svm_proficiency === rubric_proficiency`. Mismatch shows both labels in amber with a note: "Teacher rating differs from SVM — this essay will help improve the model."

---

## Partial API Failure Handling

- If `/analyze/student` succeeds but `/analyze/complexity` fails: show Section 2 (proficiency features) and Section 6 (rubric scorer) but replace Section 3 complexity formula block with an inline error: "Complexity analysis unavailable — backend error."
- If `/analyze/complexity` succeeds but `/analyze/student` fails: show Section 3 complexity formulas but replace proficiency verdict in Section 4 with "—".
- Either full failure: show full error banner across Sections 2–4.
