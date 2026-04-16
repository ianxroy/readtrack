# ReadTrack User Manual

**Version:** 1.0  
**System:** ReadTrack — AI-Assisted Reading Material and Student Writing Analysis System  
**Audience:** Junior High School Teachers, Reading Coordinators

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Dashboard](#2-dashboard)
3. [Student Grading](#3-student-grading)
   - 3.1 [Setup: Sections and Subjects](#31-setup-sections-and-subjects)
   - 3.2 [Adding Students](#32-adding-students)
   - 3.3 [Uploading an Essay](#33-uploading-an-essay)
   - 3.4 [Reading the Analysis Results](#34-reading-the-analysis-results)
   - 3.5 [Teacher Rubric Rating](#35-teacher-rubric-rating)
   - 3.6 [Verify & Train](#36-verify--train)
   - 3.7 [Model Performance](#37-model-performance)
4. [Material Library](#4-material-library)
5. [Grammar Checker](#5-grammar-checker)
6. [About (System Info)](#6-about-system-info)
7. [Input Formats](#7-input-formats)
8. [Understanding the Labels](#8-understanding-the-labels)
9. [Frequently Asked Questions](#9-frequently-asked-questions)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Getting Started

### Logging In

1. Open ReadTrack in your browser.
2. Enter your school email and password on the login screen.
3. Click **Sign In**. ReadTrack uses secure JWT sessions through Supabase — your data is isolated to your account.

> **First time?** Contact your system administrator to create an account for your school.

### Navigation

The left sidebar (or top hamburger menu on mobile) contains five sections:

| Icon | Section | Purpose |
|------|---------|---------|
| Grid | **Dashboard** | Overview of class trends |
| School | **Student Grading** | Analyze student essays |
| Library | **Material Library** | Rate and store reading passages |
| Checkmark | **Grammar Checker** | Standalone grammar tool |
| Info | **About** | System info and model metrics |

---

## 2. Dashboard

The Dashboard gives you a bird's-eye view of all student analyses performed in your account.

### What You See

- **Proficiency Distribution** — bar chart showing how many students fall in each level (Independent, Instructional, Frustration)
- **Complexity Distribution** — breakdown of uploaded materials by Literal / Inferential / Evaluative
- **Recent Activity** — latest essay uploads and their results

### How to Use It

Use the Dashboard at the start of a class planning session to quickly spot which students may need intervention, and which reading materials match your target complexity level.

---

## 3. Student Grading

This is the main workspace. It organizes students by **Section → Subject → Essay**.

### 3.1 Setup: Sections and Subjects

Before adding students you need at least one **Section** and one **Subject**.

**Creating a Section:**
1. On the left panel, click **+ Add Section**.
2. Enter the section name (e.g., "Grade 7 — Aguinaldo").
3. Click **Save**.

**Creating a Subject:**
1. With a section selected, click **+ Add Subject**.
2. Enter the subject name (e.g., "English 7" or "Filipino 7").
3. Choose the **language** — English or Filipino. This controls which NLP pipeline is used.
4. Click **Save**.

> **Important:** Language selection affects grammar checking, feature extraction, and which NLP model processes the text. Set it correctly per subject.

**Deleting a Section:**
A warning will appear if students are enrolled in the section — deleting it will also delete all associated students and their essays. Confirm only if intended.

---

### 3.2 Adding Students

1. Select a section from the left panel.
2. Click **+ Add Student**.
3. Enter the student's name (and optional ID/LRN).
4. Click **Save**.

Students appear as cards in the main grid. Click a student card to open their essay panel.

---

### 3.3 Uploading an Essay

1. Click a student card to open their panel.
2. Select the target **Subject** from the dropdown.
3. Click **+ Upload Essay**.

The upload modal accepts three input types:

#### Text Input
- Paste or type the essay directly into the text box.
- Add a **title** for the essay.

#### Image Upload (OCR)
- Click **Choose Image** and select a JPG or PNG file of a handwritten or printed essay.
- ReadTrack uses **Gemini Vision OCR** to extract the text automatically.
- You can upload multiple images for a multi-page essay.
- After OCR, the extracted text is shown for your review before analysis.

> **Tip:** For best OCR results, use a flat, well-lit scan or photo. Avoid shadows and skewed angles.

#### PDF Upload
- Click **Choose PDF** to upload a PDF document.
- Text is extracted automatically using pypdf.

4. Once text is ready, click **Analyze**.

The system runs the full pipeline:
- Language detection
- Grammar check
- Feature extraction (NLP)
- Proficiency classification
- Text complexity classification
- DepEd rubric scoring

---

### 3.4 Reading the Analysis Results

After analysis, clicking an essay opens the **Detail View** with several tabs.

#### Overview Tab

| Field | What It Means |
|-------|--------------|
| **Proficiency Level** | Independent / Instructional / Frustration (or Filipino equivalent: Mahusay / Papaunlad / Nagsisimula) |
| **Learning Band** | Enhancement / Consolidation / Intervention — the instructional action recommended |
| **Phil-IRI Level** | Estimated grade-level reading equivalent |
| **NAT Score** | National Achievement Test score estimate |
| **Complexity** | Literal / Inferential / Evaluative — the detected difficulty level of the student's writing |

#### Analysis Tab

Detailed breakdown including:
- **Grammar Accuracy** — percentage of text free of detected errors
- **Vocabulary Richness** (Type-Token Ratio)
- **Sentence Complexity**
- **Structure & Cohesion**
- **CEFR Word Distribution** — vocabulary level breakdown from A1 to C2
- **Readability Indices** — Flesch-Kincaid and Gunning Fog scores
- **Advanced Words** — highlighted list of C1/C2 level vocabulary used

#### Grammar Tab

- Highlighted text with color-coded issues (errors in red, warnings in yellow)
- Click any highlight to see the suggestion and correction
- Issues are sorted by severity

#### DepEd Rubric Tab

Automated scoring against the official DepEd 5-dimension writing rubric:

| Dimension | What Is Scored |
|-----------|---------------|
| **Content** | Relevance, development of ideas |
| **Organization** | Structure, coherence, flow |
| **Language & Vocabulary** | Word choice, register |
| **Grammar** | Grammatical correctness |
| **Mechanics** | Spelling, punctuation, capitalization |

Score: 1–4 scale per dimension. Overall score and transmuted grade are shown.

> **Note:** The AI rubric score is a starting point. Always review and override with your own professional judgment using the Teacher Rubric panel.

---

### 3.5 Teacher Rubric Rating

Below the AI rubric, you can enter your own scores:

1. In the **Marka ng Guro — DepEd Rubrik** panel, adjust each dimension slider (1–4).
2. Add an optional comment in the text box.
3. Click **Save Evaluation**.

Teacher scores are saved to the database and will appear on future views of the essay. They are also used to train the model when you run Verify & Train.

---

### 3.6 Verify & Train

ReadTrack improves over time using your corrections. When your manual rubric scores differ significantly from the AI prediction, those samples can be used to retrain the model.

**To run Verify & Train:**
1. In the **Analysis** tab of the Detail View, scroll to the **Verify & Train** section.
2. Review the pending samples shown (essays where teacher scores are available).
3. Click **Train Model** to start retraining.
4. A status indicator shows training progress. This typically takes 30–60 seconds.

> **Best practice:** Accumulate at least 10–20 verified samples before retraining for meaningful improvement.

---

### 3.7 Model Performance

Access the **Model Performance** page from within Student Grading to see:

- **Macro F1, Precision, Recall** — overall model health indicators
- **Per-class F1 bars** — which proficiency levels the model handles best
- **Confusion matrix** — visual breakdown of correct vs incorrect predictions

This page helps you judge how much to rely on AI predictions at any given time.

---

## 4. Material Library

The Material Library stores and rates reading passages for classroom use.

### Uploading a Material

1. Go to **Material Library** from the sidebar.
2. Click **+ Add Material**.
3. Paste or upload the passage (text, image, or PDF).
4. Enter a **title** and optional notes.
5. Click **Analyze & Save**.

ReadTrack will:
- Classify the passage as **Literal**, **Inferential**, or **Evaluative**
- Rate its **Grade 7 suitability**:
  - Literal → Ready for independent use
  - Inferential → Use with teacher support
  - Evaluative → Above Grade 7 level

### Filtering and Browsing

- Filter by **Language** (English / Filipino)
- Filter by **Complexity Level**
- Search by title

Use this library to quickly find passages appropriate for your current instructional objective.

---

## 5. Grammar Checker

The Grammar Checker is a standalone tool for checking any piece of text — not necessarily a student essay.

### How to Use

1. Go to **Grammar Checker** from the sidebar.
2. Paste or type text into the input box.
3. Select the language (English or Filipino).
4. Click **Check Grammar**.

### Results

- The text is displayed with highlighted issues
- **Red highlights** = errors (spelling, agreement, syntax)
- **Yellow highlights** = warnings (style, punctuation)
- Click any highlight to see the correction suggestion and explanation
- A summary shows total issue count by severity

### Grammar Engine

ReadTrack uses a hybrid approach:
- **LanguageTool** — rule-based detection (fast, consistent)
- **SymSpellPy** — fast spelling correction
- **Gemini AI** — contextual suggestions for complex or ambiguous cases

---

## 6. About (System Info)

The About page shows technical information about ReadTrack's models and pipeline.

### Current Metrics

Two metric cards show live model performance (fetched from the backend):

**Proficiency Model**
- Accuracy, F1, Precision, Recall on held-out test data
- Click the **(i)** button to see how these are calculated

**Complexity Model**
- Scores on Phil-IRI standard passages (in-sample calibration = expected 100%)
- Trained on 66 Phil-IRI labeled passages across three levels

> **Note on Complexity 100%:** The complexity model is intentionally calibrated to Phil-IRI ground-truth passages (the official DepEd standard). 100% on those passages is expected. When rating new, unseen passages, the model uses 30 linguistic features — including discourse connectors, modal verbs, and abstract noun ratios — to generalize beyond the standard set.

### Processing Pipeline

Shows the full text-to-result flow: Input → OCR → Language Detection → NLP → Feature Extraction → Model Classification → Fallback Heuristic → Output.

---

## 7. Input Formats

| Format | Supported | Notes |
|--------|-----------|-------|
| Plain text | Yes | Paste directly |
| JPG / PNG image | Yes | OCR via Gemini Vision (~3.5s) |
| PDF | Yes | Text extracted via pypdf |
| DOCX | No | Planned for future version |

**Minimum text length:** At least 3 sentences recommended. Very short texts will show a stability warning.

**Maximum text length:** Very long submissions are chunked automatically.

---

## 8. Understanding the Labels

### Student Proficiency

| Label | Filipino | Meaning | Recommended Action |
|-------|----------|---------|-------------------|
| **Independent** | Mahusay | Student reads/writes with ease | Enhancement activities |
| **Instructional** | Papaunlad | Student needs guided support | Consolidation / guided practice |
| **Frustration** | Nagsisimula | Student struggles significantly | Intervention / remediation |

These map to **Phil-IRI** oral and silent reading level designations.

### Text Complexity

| Level | Phil-IRI Grade | Meaning |
|-------|---------------|---------|
| **Literal** | G4–G6 | Direct recall; concrete, straightforward language |
| **Inferential** | G7 | Reading between the lines; causal connectors present |
| **Evaluative** | G8–G10 | Critical thinking; abstract nouns, modal verbs, argumentation |

### Learning Bands

| Band | Maps From | Teacher Response |
|------|-----------|-----------------|
| **Enhancement** | Independent | Extend with enrichment tasks |
| **Consolidation** | Instructional | Reinforce with guided reading |
| **Intervention** | Frustration | Provide remedial support |

---

## 9. Frequently Asked Questions

**Q: The proficiency result doesn't match my observation of the student. What should I do?**  
A: Use the Teacher Rubric panel to enter your own score. This both records your judgment and — once enough corrections accumulate — helps retrain the model to better align with your class context.

**Q: Why does OCR sometimes miss handwritten text?**  
A: Handwriting recognition is handled by Gemini Vision. Neat, upright, well-lit writing gives best results. Cursive or very light pencil text may have lower accuracy.

**Q: Can I use ReadTrack in Filipino-only classrooms?**  
A: Yes. Set your Subject language to **Filipino** and the system routes text through the calamanCy Filipino NLP pipeline. Some linguistic features are still being improved for Filipino.

**Q: The backend is unavailable and I see "Using cached metrics." What does that mean?**  
A: The About page fell back to saved default metrics because the backend server is not reachable. Core analysis functions also depend on the backend — ensure the server is running.

**Q: How do I know when to retrain the model?**  
A: Check the Model Performance page. If Macro F1 starts declining or you have 10+ verified teacher corrections, running Verify & Train is recommended.

**Q: Are student essays stored permanently?**  
A: Yes, in your Supabase database. Access is protected by your login session and Row-Level Security. Only your account can read your data.

**Q: Can two teachers share a section?**  
A: Not in the current version. Each account manages its own sections independently. Multi-teacher access is planned for a future release.

---

## 10. Troubleshooting

| Problem | Likely Cause | Fix |
|---------|-------------|-----|
| Analysis takes very long | Gemini API latency (OCR) | Wait up to 10s; retry if it times out |
| "Backend unavailable" banner | Server not running | Start the backend: `cd backend && uvicorn main:app` |
| OCR returns blank text | Poor image quality | Re-upload with better lighting / higher resolution |
| Grammar check shows no issues | Language mismatch | Verify the subject language is set correctly |
| Proficiency always returns same label | Model fallback heuristic | Backend may not be running; check server status |
| Section delete warning appears | Students exist in section | Intentionally requires confirmation to prevent accidental data loss |
| Login fails | Expired session or wrong credentials | Refresh the page or contact your administrator |

---

## Appendix: Feature Reference

ReadTrack extracts the following 30 linguistic features from each text for ML classification:

**Surface Features**
- Type-Token Ratio (lexical diversity)
- Average sentence length
- Difficult word ratio (words > 9 characters)
- Clause density (verbs per sentence)
- Sentence length standard deviation

**Readability**
- Flesch-Kincaid Grade Level
- Gunning Fog Index

**POS & Syntactic**
- Verb, Noun, Adjective ratios
- Average dependency distance
- Word count, sentence count

**Surface Stats**
- Punctuation density, stopword ratio
- Average word length, syllables per word

**CEFR Vocabulary**
- A1, A2, B1, B2, C1, C2 word ratios
- Advanced word ratio (C1+C2)

**Passage-Level Discriminating Factors** *(added to distinguish Literal / Inferential / Evaluative)*
- Discourse connector ratio (however, therefore, because, although…)
- Passive voice ratio
- Modal verb ratio (can, should, might, would…)
- Subordination ratio (subordinating conjunctions)
- Negation ratio
- Abstract noun ratio (-tion, -ness, -ity, -ment, -ance, -ence suffixes)

---

*ReadTrack is a decision-support tool. All AI outputs should be reviewed by a qualified teacher before instructional action is taken.*
