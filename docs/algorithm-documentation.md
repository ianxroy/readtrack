# ReadTrack — Algorithm & Machine Learning Documentation
## Bilingual Reference: English / Filipino

---

## TABLE OF CONTENTS

1. [System Overview](#1-system-overview)
2. [Text Preprocessing Pipeline](#2-text-preprocessing-pipeline)
3. [Feature Extraction (24-Dimensional Vector)](#3-feature-extraction-24-dimensional-vector)
4. [SVM Classification — Text Complexity](#4-svm-classification--text-complexity)
5. [SVM Classification — Student Proficiency](#5-svm-classification--student-proficiency)
6. [Training Pipeline](#6-training-pipeline)
7. [Grammar & Spelling Checking](#7-grammar--spelling-checking)
8. [Filipino (Tagalog) NLP via calamanCy](#8-filipino-tagalog-nlp-via-calamancy)
9. [Gemini AI Layers (OCR, Rubric, Grammar)](#9-gemini-ai-layers-ocr-rubric-grammar)
10. [G7 Suitability Verdict Logic](#10-g7-suitability-verdict-logic)
11. [Readability Scores](#11-readability-scores)

---

## 1. System Overview

### English

ReadTrack uses a **two-layer NLP architecture**:

- **Layer 1 — Deterministic NLP**: Rule-based and statistical algorithms (spaCy, calamanCy, LanguageTool, SymSpellPy, SVM models). Fast, reproducible, no API cost.
- **Layer 2 — AI Enhancement**: Google Gemini 2.5 Flash for tasks that benefit from contextual language understanding (OCR, rubric scoring, grammar explanation).

Both layers work together: Layer 1 classifies the text; Layer 2 explains and enriches the results.

### Filipino

Gumagamit ang ReadTrack ng **dalawang-antas na NLP na arkitektura**:

- **Antas 1 — Deterministikong NLP**: Mga rule-based at estadistikal na algorithm (spaCy, calamanCy, LanguageTool, SymSpellPy, mga SVM model). Mabilis, paulit-ulit, walang gastos sa API.
- **Antas 2 — AI Enhancement**: Google Gemini 2.5 Flash para sa mga gawaing nangangailangan ng kontekstwal na pag-unawa sa wika (OCR, rubric scoring, paliwanag sa grammar).

Magkasama ang dalawang antas: Inuuri ng Antas 1 ang teksto; Pinapalawak at pinayayaman ng Antas 2 ang mga resulta.

---

## 2. Text Preprocessing Pipeline

### English

Before any analysis, all text goes through `clean_text()`:

1. **Unicode Normalization (NFC)** — Ensures consistent encoding of accented/special characters. Example: `café` (two code points) → `café` (one composed code point).
2. **Whitespace Collapse** — Multiple spaces, tabs, and newlines are reduced to a single space using `re.sub(r'\s+', ' ', text)`.
3. **Strip** — Leading and trailing whitespace removed.

After cleaning, spaCy (`en_core_web_sm`) tokenizes the text into a `Doc` object, producing:
- `doc.sents` — sentence boundaries
- `token.pos_` — Part-of-Speech tags (VERB, NOUN, ADJ, ADV)
- `token.dep_` — Dependency relation labels
- `token.head` — Syntactic head of each token

### Filipino

Bago mag-aral, ang lahat ng teksto ay dumadaan sa `clean_text()`:

1. **Unicode Normalization (NFC)** — Tinitiyak ang pantay na encoding ng mga espesyal na karakter.
2. **Whitespace Collapse** — Maraming espasyo, tab, at bagong linya ay pinagsama sa isang espasyo gamit ang `re.sub(r'\s+', ' ', text)`.
3. **Strip** — Tinatanggal ang mga espasyo sa simula at dulo.

Pagkatapos ng paglilinis, ginagamit ng spaCy (`en_core_web_sm`) ang tokenization upang makagawa ng `Doc` object:
- `doc.sents` — mga hangganan ng pangungusap
- `token.pos_` — mga Part-of-Speech tag (VERB, NOUN, ADJ, ADV)
- `token.dep_` — mga dependency relation label
- `token.head` — syntactic head ng bawat token

---

## 3. Feature Extraction (24-Dimensional Vector)

### English

The function `extract_features(text, language)` computes a **feature vector** — a list of 24 numbers that mathematically describe the text. This vector is what the SVM models learn from.

| # | Feature | Description |
|---|---------|-------------|
| 1 | **TTR** (Type-Token Ratio) | `unique words / total words`. High TTR = more varied vocabulary. |
| 2 | **Avg Sentence Length** | `total words / total sentences`. Longer sentences = more complex. |
| 3 | **Difficult Word Ratio** | % of words with 3+ syllables. Used in Gunning Fog. |
| 4 | **Advanced CEFR Ratio** | % of words at CEFR C1/C2 level (most advanced). |
| 5–10 | **CEFR Ratios (A1–C2)** | 6 features: fraction of words at each CEFR level (A1, A2, B1, B2, C1, C2). |
| 11 | **Verb Ratio** | `verb tokens / total tokens` |
| 12 | **Noun Ratio** | `noun tokens / total tokens` |
| 13 | **Adjective Ratio** | `adjective tokens / total tokens` |
| 14 | **Clause Density** | `verb count / sentence count`. High = more subordinate clauses. |
| 15 | **Structure Score** | Combined score: `(clause density × 10) + (avg sentence length × 2)`, capped at 100. |
| 16 | **Sentence Complexity Score** | `avg sentence length × 4`, capped at 100. |
| 17 | **Avg Dependency Distance** | Average distance between a token and its syntactic head. Higher = more complex syntax tree. |
| 18 | **Flesch-Kincaid Grade** | Readability formula (see §11). |
| 19 | **Gunning Fog Index** | Readability formula (see §11). |
| 20 | **Punctuation Density** | `punctuation tokens / total tokens` |
| 21 | **Sentence Length Std Dev** | Standard deviation of sentence lengths — measures "burstiness" (mix of short and long sentences). |
| 22 | **% Basic CEFR words** | Words at A1–A2 level as a fraction. |
| 23 | **% Independent CEFR words** | Words at B1–B2 level as a fraction. |
| 24 | **% Proficient CEFR words** | Words at C1–C2 level as a fraction. |

> **For Filipino text**: CEFR features (5–10, 22–24) default to 0, since cefrpy is English-only. All other features still apply.

### Filipino

Ang function na `extract_features(text, language)` ay nagkokompute ng **feature vector** — isang listahan ng 24 numero na matematikal na naglalarawan ng teksto. Ito ang ginagamit ng mga SVM model para matuto.

| # | Feature | Paliwanag |
|---|---------|-----------|
| 1 | **TTR** (Type-Token Ratio) | `natatanging salita / kabuuang salita`. Mataas na TTR = mas sari-saring bokabularyo. |
| 2 | **Avg Sentence Length** | `kabuuang salita / kabuuang pangungusap`. Mas mahaba = mas kumplikado. |
| 3 | **Difficult Word Ratio** | % ng mga salitang may 3+ pantig. Ginagamit sa Gunning Fog. |
| 4 | **Advanced CEFR Ratio** | % ng mga salitang nasa antas C1/C2 ng CEFR (pinaka-advanced). |
| 5–10 | **CEFR Ratios (A1–C2)** | 6 na feature: bahagi ng mga salita sa bawat antas ng CEFR. |
| 11 | **Verb Ratio** | `bilang ng pandiwa / kabuuang token` |
| 12 | **Noun Ratio** | `bilang ng pangngalan / kabuuang token` |
| 13 | **Adjective Ratio** | `bilang ng pang-uri / kabuuang token` |
| 14 | **Clause Density** | `bilang ng pandiwa / bilang ng pangungusap`. Mataas = mas maraming subordinate clause. |
| 15 | **Structure Score** | Pinagsama: `(clause density × 10) + (avg sentence length × 2)`, max 100. |
| 16 | **Sentence Complexity Score** | `avg sentence length × 4`, max 100. |
| 17 | **Avg Dependency Distance** | Avg distansya sa pagitan ng token at ng syntactic head nito. Mas mataas = mas kumplikadong syntax tree. |
| 18 | **Flesch-Kincaid Grade** | Formula ng readability (tingnan §11). |
| 19 | **Gunning Fog Index** | Formula ng readability (tingnan §11). |
| 20 | **Punctuation Density** | `bilang ng bantas / kabuuang token` |
| 21 | **Sentence Length Std Dev** | Standard deviation ng haba ng pangungusap — sinusukat ang "burstiness". |
| 22–24 | **% Basic / Independent / Proficient CEFR** | Bahagi ng mga salita sa A1–A2 / B1–B2 / C1–C2. |

> **Para sa Filipino na teksto**: Ang mga CEFR feature (5–10, 22–24) ay default na 0, dahil ang cefrpy ay para lamang sa Ingles.

---

## 4. SVM Classification — Text Complexity

### English

**Goal**: Classify a reading material or essay as `Literal`, `Inferential`, or `Evaluative`.

**Algorithm**: Support Vector Machine (SVM) with RBF kernel.

#### How SVM Works (Conceptually)

An SVM finds the **optimal decision boundary** (a hyperplane) that separates classes with the **maximum margin** — the widest possible gap between the boundary and the nearest data points of each class.

For non-linearly separable data, the **RBF (Radial Basis Function) kernel** maps data into a higher-dimensional space where a linear boundary can separate the classes.

#### Prediction Flow

```
Input Text
    │
    ▼
extract_features() → 24-dim vector
    │
    ▼
StandardScaler.transform() → normalize each feature to mean=0, std=1
    │
    ▼
SVC.predict() → index (0, 1, or 2)
    │
    ▼
labels[index] → "Literal" | "Inferential" | "Evaluative"
```

#### Heuristic Fallback (if no trained model)

If the `.pkl` model file is missing, a rule-based fallback is used:

```
complexity_score = (avg_sentence_length × 3) + (difficult_word_ratio × 4) + (advanced_CEFR_count × 3)

if complexity_score < 40  → "Literal"
if complexity_score < 75  → "Inferential"
else                       → "Evaluative"
```

#### Class Meanings

| Label | Meaning | Grade 7 Context |
|-------|---------|-----------------|
| **Literal** | Text conveys direct, surface-level meaning | Ready for Grade 7 use |
| **Inferential** | Requires reading between the lines | Use with teacher support |
| **Evaluative** | Requires critical judgment and synthesis | Above Grade 7 level |

### Filipino

**Layunin**: I-classify ang isang reading material o sanaysay bilang `Literal`, `Inferential`, o `Evaluative`.

**Algorithm**: Support Vector Machine (SVM) na may RBF kernel.

#### Paano Gumagana ang SVM (Konseptwal)

Hinahanap ng SVM ang **pinakamainam na decision boundary** (isang hyperplane) na naghihiwalay ng mga klase nang may **pinakamalaking margin** — ang pinakamalawak na agwat sa pagitan ng boundary at ng pinakamalapit na data points ng bawat klase.

Para sa data na hindi linearly separable, ginagamit ng **RBF (Radial Basis Function) kernel** ang pagmamapa ng data sa mas mataas na dimensyonal na espasyo kung saan maaaring maghiwalay ang isang linear na boundary.

#### Daloy ng Prediction

```
Input na Teksto
    │
    ▼
extract_features() → 24-dim vector
    │
    ▼
StandardScaler.transform() → i-normalize ang bawat feature sa mean=0, std=1
    │
    ▼
SVC.predict() → index (0, 1, o 2)
    │
    ▼
labels[index] → "Literal" | "Inferential" | "Evaluative"
```

#### Heuristic Fallback (kapag walang trained model)

Kapag nawawala ang `.pkl` model file, ginagamit ang rule-based fallback:

```
complexity_score = (avg_sentence_length × 3) + (difficult_word_ratio × 4) + (advanced_CEFR_count × 3)

kung complexity_score < 40  → "Literal"
kung complexity_score < 75  → "Inferential"
kung hindi                  → "Evaluative"
```

#### Kahulugan ng mga Klase

| Label | Kahulugan | Konteksto sa Grade 7 |
|-------|-----------|----------------------|
| **Literal** | Ang teksto ay direkta at mababaw ang kahulugan | Handa para sa Grade 7 |
| **Inferential** | Kailangang basahin ang nasa pagitan ng mga linya | Gamitin nang may gabay ng guro |
| **Evaluative** | Nangangailangan ng kritikal na paghuhukom | Nasa itaas ng antas ng Grade 7 |

---

## 5. SVM Classification — Student Proficiency

### English

**Goal**: Classify a student's written essay into one of three writing proficiency levels.

**Algorithm**: SVM with RBF kernel + RobustScaler (used during training, StandardScaler during inference).

#### Proficiency Labels

| Label | Meaning |
|-------|---------|
| **Nagsisimula** | Beginning writer — limited vocabulary, simple sentences |
| **Papaunlad** | Developing writer — emerging structure, growing vocabulary |
| **Mahusay** | Proficient writer — varied vocabulary, complex sentences, clear organization |

#### Prediction Flow

```
Student Essay Text
    │
    ▼
Language Detection (langdetect) → "en" or "fil"
    │
    ▼
extract_features(text, language) → 24-dim vector
    │
    ▼
Choose model:
  language=="en" → student_model_en  (proficiency_model_en.pkl)
  language=="fil"→ student_model_tl  (proficiency_model_tl.pkl)
    │
    ▼
StandardScaler.transform(vector)
    │
    ▼
SVC.predict() → "Nagsisimula" | "Papaunlad" | "Mahusay"
```

#### Heuristic Fallback

```
ttr = unique_words / total_words
avg_len = total_words / total_sentences
vocab_score = ttr * 50
length_score = min(avg_len * 2, 50)
combined = vocab_score + length_score

if combined < 30  → "Nagsisimula"
if combined < 60  → "Papaunlad"
else              → "Mahusay"
```

#### Dual-Model Strategy

Two separate models are trained — one for English (`en`) and one for Filipino/Tagalog (`tl`). Language is auto-detected before prediction so the correct model is used.

### Filipino

**Layunin**: I-classify ang isinulat na sanaysay ng mag-aaral sa isa sa tatlong antas ng kasanayan sa pagsulat.

**Algorithm**: SVM na may RBF kernel + RobustScaler (sa panahon ng training), StandardScaler (sa panahon ng inference).

#### Mga Label ng Proficiency

| Label | Kahulugan |
|-------|-----------|
| **Nagsisimula** | Nagsisimulang manunulat — limitadong bokabularyo, simpleng pangungusap |
| **Papaunlad** | Umuusbong na manunulat — lumalabas na istraktura, lumalaking bokabularyo |
| **Mahusay** | Bihasa nang manunulat — sari-saring bokabularyo, kumplikadong pangungusap, malinaw na organisasyon |

#### Daloy ng Prediction

```
Teksto ng Sanaysay ng Mag-aaral
    │
    ▼
Language Detection (langdetect) → "en" o "fil"
    │
    ▼
extract_features(text, language) → 24-dim vector
    │
    ▼
Pumili ng modelo:
  language=="en"  → student_model_en  (proficiency_model_en.pkl)
  language=="fil" → student_model_tl  (proficiency_model_tl.pkl)
    │
    ▼
StandardScaler.transform(vector)
    │
    ▼
SVC.predict() → "Nagsisimula" | "Papaunlad" | "Mahusay"
```

#### Heuristic Fallback

```
ttr = natatanging salita / kabuuang salita
avg_len = kabuuang salita / kabuuang pangungusap
vocab_score = ttr × 50
length_score = min(avg_len × 2, 50)
combined = vocab_score + length_score

kung combined < 30  → "Nagsisimula"
kung combined < 60  → "Papaunlad"
kung hindi          → "Mahusay"
```

---

## 6. Training Pipeline

### English

#### How Training Works

Training is triggered via `POST /train/proficiency` (for proficiency) or automatically at retrain events.

**Step 1 — Load Philippine Data from Supabase**

Essays already rated by teachers (with `teacher_rubric_scores` and `diagnosis_result` filled) are fetched from the `student_grading_uploads` table.

**Step 2 — Feature Extraction**

For each rated essay, `extract_features(text, language)` is called to produce a 24-dim vector.

```python
X_ph = [extract_features(essay.text, language)['vector'] for essay in rated_essays]
y_ph = [map_label(essay.diagnosis_result) for essay in rated_essays]
```

**Step 3 — Blend with ASAP2 Dataset (English only)**

For English, the Automated Student Assessment Prize 2 (ASAP2) dataset is loaded from `ASAP2_train_sourcetexts.csv`. Philippine samples are weighted **2×** (duplicated) to prioritize local context:

```python
X_train = np.vstack([X_asap, X_ph, X_ph])   # PH data counted twice
y_train = np.concatenate([y_asap, y_ph, y_ph])
```

For Filipino, only Philippine data is used (`X_train = X_ph`).

**Step 4 — Scaling**

A `RobustScaler` is fit on the training data. RobustScaler is preferred over StandardScaler for training because it uses **median and IQR** instead of mean and std, making it resistant to outliers in small datasets.

```python
scaler = RobustScaler()
X_scaled = scaler.fit_transform(X_train)
```

**Step 5 — SVM Training**

```python
model = SVC(
    kernel="rbf",       # Radial Basis Function — handles non-linear boundaries
    C=10,               # Regularization: higher C = tighter fit, less margin
    gamma="scale",      # gamma = 1 / (n_features × X.var()) — auto-calibrated
    class_weight="balanced",  # Compensates for unequal class sizes
    random_state=42     # Reproducible results
)
model.fit(X_scaled, y_train)
```

**Step 6 — Save as `.pkl`**

The trained model and scaler are serialized together:

```python
pickle.dump({"model": model, "scaler": scaler}, file)
# Saved as: proficiency_model_en.pkl or proficiency_model_tl.pkl
```

**Step 7 — Hot Reload**

Immediately after saving, the new model is loaded into memory so predictions use the updated model without restarting the server.

#### Complexity Model Training

The complexity SVM (`TextComplexitySVM`) follows the same pipeline but is trained on **reading materials** labeled `Literal`, `Inferential`, or `Evaluative` — not student essays.

### Filipino

#### Paano Gumagana ang Training

Nati-trigger ang training sa pamamagitan ng `POST /train/proficiency` o awtomatiko sa mga retrain event.

**Hakbang 1 — I-load ang Philippine Data mula sa Supabase**

Ang mga sanaysay na na-rate na ng mga guro (na may napunan na `teacher_rubric_scores` at `diagnosis_result`) ay kinukuha mula sa talahanayan na `student_grading_uploads`.

**Hakbang 2 — Feature Extraction**

Para sa bawat na-rate na sanaysay, tinatawag ang `extract_features(text, language)` upang makagawa ng 24-dim vector.

**Hakbang 3 — Pagsama sa ASAP2 Dataset (Para sa Ingles lamang)**

Para sa Ingles, ang Automated Student Assessment Prize 2 (ASAP2) dataset ay ino-load mula sa `ASAP2_train_sourcetexts.csv`. Ang mga Philippine sample ay **2× na binibigyang-timbang** (dinodon) upang unahin ang lokal na konteksto.

Para sa Filipino, Philippine data lamang ang ginagamit.

**Hakbang 4 — Scaling**

Ang `RobustScaler` ay ini-fit sa training data. Mas pinipili ito kaysa sa StandardScaler para sa training dahil gumagamit ito ng **median at IQR** sa halip na mean at std, na nagpapalaban sa mga outlier sa maliliit na dataset.

**Hakbang 5 — SVM Training**

```python
model = SVC(
    kernel="rbf",              # Radial Basis Function — kaya ng non-linear na hangganan
    C=10,                      # Regularization: mas mataas na C = mas mahigpit na fit
    gamma="scale",             # Awtomatikong kinakalkula batay sa bilang ng feature at variance
    class_weight="balanced",   # Kinukumpensar ang hindi pantay na laki ng klase
    random_state=42            # Para sa paulit-ulit na resulta
)
model.fit(X_scaled, y_train)
```

**Hakbang 6 — I-save bilang `.pkl`**

Ang trained model at scaler ay na-serialize nang magkasama at iniimbak bilang pickle file.

**Hakbang 7 — Hot Reload**

Kaagad pagkatapos ng pag-save, ang bagong model ay ini-load sa memorya upang ang mga prediction ay gumamit ng updated na modelo nang hindi kailangang i-restart ang server.

---

## 7. Grammar & Spelling Checking

### English

Grammar checking uses a **three-tool pipeline** in `grammar_service.py`:

#### Tool 1: LanguageTool (`language_tool_python`)

- Rule-based grammar engine with 6,000+ rules for English.
- Detects: subject-verb agreement, punctuation errors, comma splices, redundancy, wrong tense.
- Returns: `offset`, `length`, `message`, `replacements` for each issue.

#### Tool 2: SymSpellPy

- Uses a **pre-built frequency dictionary** (82,765 English words) with **Symmetric Delete Spelling Correction** algorithm.
- Works by pre-computing all deletions within `max_edit_distance=2`.
- For a query word, generates candidate corrections by finding matching deletions in O(1) time.
- Parameters: `max_dictionary_edit_distance=2`, `prefix_length=7`.
- Verbosity: `CLOSEST` — returns only the closest match.

#### Tool 3: Gemini AI Enhancement

For each flagged issue, Gemini is prompted with the error context:
- Provides a **context-aware correction** — not just a dictionary match.
- Provides an **explanation** the student can understand.
- For Filipino essays: accounts for Taglish code-switching and Filipino verb focus system (mag-, um-, -in, -an, i-).
- Overall AI feedback is generated if 3+ spelling issues are found.

#### Pipeline Flow

```
Input Text
    │
    ▼
langdetect → "en" or "tl/fil"
    │
    ├─ English:  LanguageTool(en-US) + SymSpellPy
    └─ Filipino: LanguageTool(tl) + SymSpellPy (fallback)
    │
    ▼
Merge & deduplicate issues
    │
    ▼
Gemini AI: enhance each issue with explanation
    │
    ▼
Gemini AI: generate overall feedback (if ≥3 issues)
    │
    ▼
Return: issues[], aiOverallFeedback
```

### Filipino

Gumagamit ang pagsusuri ng grammar ng **tatlong-tool na pipeline** sa `grammar_service.py`:

#### Tool 1: LanguageTool

- Rule-based na grammar engine na may 6,000+ na panuntunan para sa Ingles.
- Nakita: subject-verb agreement, mga error sa bantas, comma splices, pagtatanggal ng redundancy, maling tenses.

#### Tool 2: SymSpellPy

- Gumagamit ng **pre-built na frequency dictionary** (82,765 salitang Ingles) na may **Symmetric Delete Spelling Correction** na algorithm.
- Nagtatrabaho sa pamamagitan ng paunang pagkalkula ng lahat ng pagtanggal sa loob ng `max_edit_distance=2`.
- Para sa isang salitang query, nagge-generate ng mga kandidatong koreksyon sa pamamagitan ng paghanap ng mga katugmang pagtanggal sa O(1) na oras.

#### Tool 3: Gemini AI Enhancement

Para sa bawat na-flag na isyu, ang Gemini ay nipo-prompt na may konteksto ng error:
- Nagbibigay ng **konteksto-aware na koreksyon** — hindi lamang dictionary match.
- Nagbibigay ng **paliwanag** na mauunawaan ng mag-aaral.
- Para sa mga Filipino na sanaysay: isinasaalang-alang ang Taglish code-switching at Filipino verb focus system (mag-, um-, -in, -an, i-).

---

## 8. Filipino (Tagalog) NLP via calamanCy

### English

Filipino text is processed by **calamanCy** (`tl_calamancy_md`) — a spaCy-based NLP model specifically trained on Tagalog data.

#### What calamanCy Provides

| Output | Description |
|--------|-------------|
| `token.pos_` | Part-of-Speech (NOUN, VERB, ADJ, PROPN, etc.) |
| `token.lemma_` | Base form of the word |
| `token.dep_` | Dependency relation (subject, object, modifier) |
| `token.morph` | Morphological features (verb focus, number, etc.) |
| `doc.ents` | Named Entities (persons, locations, organizations) |

#### Integration Point

When the input language is detected as `"fil"` or `"filipino"`:
- `tagalog_service.py` routes the text to calamanCy.
- POS tags, NER entities, and morphology are returned to the frontend for display.
- The `extract_features()` function still runs spaCy English for the feature vector (since linguistic feature computation is language-model-independent at this level), but CEFR features are zeroed out.

#### Version Fallback

```python
model_versions = ["tl_calamancy_md-0.2.0", "tl_calamancy_md-0.1.0"]
for version in model_versions:
    nlp = calamancy.load(version)  # tries newer first, falls back to older
```

### Filipino

Ang teksto sa Filipino ay pinoproseso ng **calamanCy** (`tl_calamancy_md`) — isang NLP model na nakabase sa spaCy na espesyal na sinanay sa Tagalog na data.

#### Ano ang Ibinibigay ng calamanCy

| Output | Paliwanag |
|--------|-----------|
| `token.pos_` | Part-of-Speech (NOUN, VERB, ADJ, PROPN, atbp.) |
| `token.lemma_` | Pangunahing anyo ng salita |
| `token.dep_` | Dependency relation (paksa, bagay, modifier) |
| `token.morph` | Mga morfologikal na feature (verb focus, bilang, atbp.) |
| `doc.ents` | Mga Named Entity (tao, lugar, organisasyon) |

#### Punto ng Integrasyon

Kapag ang wika ng input ay na-detect bilang `"fil"` o `"filipino"`:
- Ini-route ng `tagalog_service.py` ang teksto sa calamanCy.
- Ibinabalik ang mga POS tag, NER entity, at morphology sa frontend para sa display.
- Ang `extract_features()` ay patuloy na nagpapatakbo ng spaCy English para sa feature vector, ngunit ang mga CEFR feature ay nili-zero out.

---

## 9. Gemini AI Layers (OCR, Rubric, Grammar)

### English

#### Layer A: OCR (Image → Text)

`ocr.py` sends the image as a base64-encoded payload to Gemini Vision:

```
Prompt: "Extract ALL text from this image..."
Input: base64 image (JPEG/PNG/WEBP) OR PDF pages
Output: JSON { "text": "...", "warning": null | "message" }
```

- Handles handwritten, printed, and mixed text.
- Post-processes the extracted text: normalizes whitespace, fixes OCR line-break artifacts.
- For PDFs: `pypdf` is tried first (faster for digital PDFs); Gemini Vision is the fallback for scanned PDFs.

#### Layer B: Rubric Scoring

`evaluate_rubric_with_gemini()` sends the essay + context to Gemini:

The rubric evaluates **5 dimensions**, each scored 1–4:

| Dimension | What is assessed |
|-----------|-----------------|
| **Content** | Relevance, depth of ideas, supporting details, topic development |
| **Organization** | Intro-body-conclusion structure, logical flow, paragraph transitions |
| **Language/Vocab** | Word choice, register appropriateness, formal vocabulary |
| **Grammar** | Verb forms, sentence construction, agreement |
| **Mechanics** | Capitalization, punctuation, spelling |

- For **Filipino essays**: the prompt adds notes about Taglish code-switching and the Filipino verb focus system being expected at Grade 7 level.
- Output: JSON with `score` (1–4) and `rationale` (one sentence) per dimension, plus `overall_feedback` (2–3 sentences in the essay's language).
- Temperature is set to a low value for consistency.

#### Layer C: Grammar AI Enhancement

For each grammar issue caught by LanguageTool/SymSpellPy, Gemini provides:
- `CORRECTION:` — the corrected word/phrase
- `EXPLANATION:` — why it's wrong and how to fix it

### Filipino

#### Layer A: OCR (Larawan → Teksto)

Pinapadala ng `ocr.py` ang larawan bilang base64-encoded payload sa Gemini Vision:
- Kayang hawakan ang sulat-kamay, nakalimbag, at pinaghalo na teksto.
- Post-processes ang na-extract na teksto: ino-normalize ang whitespace, niaayos ang mga artifact ng OCR line-break.
- Para sa PDF: `pypdf` ang unang sinusubukan (mas mabilis para sa digital na PDF); Gemini Vision ang fallback para sa scanned na PDF.

#### Layer B: Rubric Scoring

Nagpapadala ang `evaluate_rubric_with_gemini()` ng sanaysay + konteksto sa Gemini:

Sinusuri ng rubric ang **5 dimensyon**, na bawat isa ay may iskor na 1–4:

| Dimensyon | Ano ang Sinusuri |
|-----------|-----------------|
| **Content** | Kaugnayan, lalim ng ideya, mga sumusuportang detalye, pagpapaunlad ng paksa |
| **Organization** | Istraktura ng intro-body-conclusion, lohikal na daloy, mga transition ng talata |
| **Language/Vocab** | Pagpili ng salita, angkop na rehistro, pormal na bokabularyo |
| **Grammar** | Anyo ng pandiwa, pagbubuo ng pangungusap, kasunduan |
| **Mechanics** | Malalaking titik, bantas, spelling |

- Para sa **mga Filipino na sanaysay**: idinaragdag ng prompt ang mga tala tungkol sa Taglish code-switching at ang Filipino verb focus system bilang inaasahan sa antas ng Grade 7.

---

## 10. G7 Suitability Verdict Logic

### English

The G7 Suitability Panel determines if a reading material is appropriate for **Grade 7 Filipino students** per DepEd MELCs.

#### Verdict Rules

| Complexity Level | Verdict | Phil-IRI Level |
|-----------------|---------|----------------|
| Literal | "Ready for Grade 7" | Instructional |
| Inferential | "Use with Teacher Support" | Frustration |
| Evaluative | "Above Grade 7 Level" | Independent |

#### Phil-IRI Integration

Phil-IRI (Philippine Informal Reading Inventory) levels are assigned based on the complexity classification:
- **Independent** — student can read with minimal help
- **Instructional** — student can read with teacher guidance
- **Frustration** — text is too difficult even with support

#### Vocabulary Breakdown

If CEFR word group data is available:
- **% Basic** (A1–A2 words): should be high for Grade 7 readiness
- **% Intermediate** (B1–B2 words): appropriate challenge level
- **% Advanced** (C1–C2 words): if high, contributes to "Above Grade 7" verdict

### Filipino

Tinutukoy ng G7 Suitability Panel kung ang isang reading material ay angkop para sa **mga mag-aaral na Grade 7 ng Filipino** ayon sa DepEd MELCs.

#### Mga Panuntunan ng Verdict

| Antas ng Complexity | Verdict | Antas ng Phil-IRI |
|--------------------|---------|-------------------|
| Literal | "Handa para sa Grade 7" | Instructional |
| Inferential | "Gamitin nang may Suporta ng Guro" | Frustration |
| Evaluative | "Nasa itaas ng Antas ng Grade 7" | Independent |

#### Integrasyon ng Phil-IRI

Ang mga antas ng Phil-IRI (Philippine Informal Reading Inventory) ay itinalaga batay sa complexity classification:
- **Independent** — kayang basahin ng mag-aaral nang may kaunting tulong
- **Instructional** — kayang basahin ng mag-aaral nang may gabay ng guro
- **Frustration** — masyadong mahirap ang teksto kahit may suporta

---

## 11. Readability Scores

### English

Two standard readability formulas are computed in `calculate_readability()`:

#### Flesch-Kincaid Grade Level

```
FK = (0.39 × words/sentences) + (11.8 × syllables/words) − 15.59
```

- Output: approximate U.S. school grade level (e.g., 7.0 = Grade 7).
- Higher = harder to read.
- Syllable counting uses a vowel-transition algorithm.

#### Gunning Fog Index

```
Fog = 0.4 × (words/sentences + 100 × complex_words/words)
```

- `complex_words` = words with 3 or more syllables.
- Output: approximate years of education needed to understand the text.
- Grade 7 target ≈ Fog Index 7–8.

#### Syllable Counting Algorithm

```python
for each word:
    count vowels at word start
    for each subsequent character:
        if vowel AND previous character was NOT a vowel: count += 1
    if word ends with 'e': count -= 1
    if count == 0: count = 1  # every word has at least one syllable
```

### Filipino

Dalawang standard na formula ng readability ang kinakalkula sa `calculate_readability()`:

#### Flesch-Kincaid Grade Level

```
FK = (0.39 × salita/pangungusap) + (11.8 × pantig/salita) − 15.59
```

- Output: tinatayang antas ng paaralan sa US (hal., 7.0 = Grade 7).
- Mas mataas = mas mahirap basahin.

#### Gunning Fog Index

```
Fog = 0.4 × (salita/pangungusap + 100 × kumplikadong salita/salita)
```

- `kumplikadong salita` = mga salitang may 3 o higit pang pantig.
- Output: tinatayang taon ng edukasyon na kailangan upang maunawaan ang teksto.
- Target para sa Grade 7 ≈ Fog Index 7–8.

---

## Summary Table — All Algorithms at a Glance

| Component | Algorithm | Input | Output |
|-----------|-----------|-------|--------|
| Text Preprocessing | Unicode NFC + Regex | Raw text | Clean text |
| Feature Extraction | spaCy POS/DEP + cefrpy | Clean text | 24-dim vector |
| Complexity Classification | SVM (RBF, C=10) | 24-dim vector | Literal / Inferential / Evaluative |
| Proficiency Classification | SVM (RBF, C=10) | 24-dim vector | Nagsisimula / Papaunlad / Mahusay |
| Training | RobustScaler + SVC.fit() + pickle | Rated essays (Supabase) | .pkl model file |
| Grammar Check | LanguageTool | Clean text | Issue list (offset, message, replacement) |
| Spell Check | SymSpellPy (Symmetric Delete) | Tokens | Corrected words |
| Grammar AI | Gemini Flash Lite | Issue context | Explanation + correction |
| Filipino NLP | calamanCy tl_calamancy_md | Filipino text | POS, NER, morphology |
| Rubric Scoring | Gemini 2.5 Flash | Essay text | 5-dim JSON rubric (score 1–4) |
| OCR | Gemini Vision | Base64 image | Extracted text |
| Readability | Flesch-Kincaid + Gunning Fog | Word/sentence/syllable counts | Grade level numbers |
| G7 Verdict | Rule-based lookup | Complexity level | Phil-IRI verdict + badge |
| Language Detection | langdetect | Raw text | "en" or "fil/tl" |

---

*Generated: 2026-04-05 | ReadTrack v1 | For academic and internal documentation use.*
