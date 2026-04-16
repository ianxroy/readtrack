# ReadTrack — Thesis Defense Preparation Document

**Project:** ReadTrack — Grade 7 Reading Complexity and Proficiency Tracker
**Date:** April 2026

---

## Opening Statement (All Members)

Our group will divide the defense into three major areas.

- **Member 1 — Technicality:** covers machine learning concepts, the models used, feature engineering, training, and evaluation metrics.
- **Member 2 — Data Reliability and Relevance:** focuses on the source, quality, preprocessing, and suitability of the data used in the system.
- **Member 3 — System Design and Workflow:** explains how the frontend, backend, AI services, and database work together to produce and store results.

---

## Member 1 — Technicality

### What the system learns and predicts

ReadTrack uses **Support Vector Machine (SVM)** models to solve two classification tasks:

1. **Student Proficiency** — classifies a student essay into one of three levels based on Phil-IRI standards:
   - *Nagsisimula* (Beginning)
   - *Papaunlad* (Developing)
   - *Mahusay* (Independent)

2. **Text Complexity** — classifies a reading material or passage into one of three DepEd-aligned levels:
   - *Literal* — concrete facts, surface-level recall (Grade 1–3)
   - *Inferential* — implied meaning, cause-effect, prediction (Grade 4–6)
   - *Evaluative* — critical thinking, author purpose, judgment (Grade 7–10)

### Why SVM and not a more complex model

SVM was chosen because:
- The feature set is structured and numeric (30 dimensions), making it ideal for SVM.
- SVM with an RBF kernel handles non-linear boundaries between classes without needing deep learning.
- The dataset is small and domain-specific — deep learning needs much larger data to outperform SVM on structured features.
- SVM is interpretable and has stable, repeatable outputs that teachers can trust.
- It is computationally lightweight, fast at inference time, and easy to retrain in the classroom.

### The 30-Dimensional Feature Vector

Every essay or passage is converted by `preprocessing.py` into a 30-dimensional numeric vector. These features fall into five groups:

| Group | Features |
|---|---|
| Vocabulary | Type-Token Ratio (TTR), Difficult Word Ratio, Average Word Length |
| Readability | Flesch-Kincaid Grade Level, Gunning Fog Index |
| Syntax | Average Sentence Length, Clause Density, Dependency Distance, Verb/Noun/Adj Ratios, Sentence Length Std Dev |
| CEFR | Ratios for A1, A2, B1, B2, C1, C2 words; Advanced Word Ratio |
| Discriminating | Discourse Connector Ratio, Passive Voice Ratio, Modal Verb Ratio, Subordination Ratio, Negation Ratio, Abstract Noun Ratio |

**Why these features?** Each feature was chosen because it captures a linguistically meaningful signal that distinguishes between complexity or proficiency levels. For example, discourse connectors ("however," "therefore," "because") signal inferential/evaluative reasoning; abstract nouns (-tion, -ness, -ity) signal academic register; CEFR ratios directly measure vocabulary sophistication.

### Training Pipeline

1. Text is cleaned and passed to `extract_features()` in `preprocessing.py`.
2. spaCy tokenizes the text, providing POS tags, dependency labels, and sentence boundaries.
3. CEFRpy assigns vocabulary levels (A1–C2) to each word.
4. The 30-dim vector is normalized using **RobustScaler** (resistant to outliers).
5. The scaled vector is passed to `SVC(kernel='rbf', C=10)` from scikit-learn.
6. Hyperparameters were found using **GridSearchCV** across C, gamma, and kernel combinations.
7. The trained model and scaler are saved as `.pkl` files.

### Why Phil-IRI data gives 98%+ in-sample accuracy

The complexity model is trained on **Phil-IRI passages**, which are the Philippine government's official reading inventory materials. These passages were professionally authored and labeled to specific complexity levels. Because they are the ground-truth standard, high in-sample accuracy is expected and correct — it means the model has learned the official standard. Generalization to new teacher-uploaded passages is evaluated separately.

### Evaluation Metrics

The system reports:

- **Accuracy** — overall proportion correct
- **Precision** — of all passages predicted as class X, how many truly are X
- **Recall** — of all true class X passages, how many were found
- **F1-Score** — harmonic mean of precision and recall; balances both
- **Macro F1** — equal weight per class, tests fairness across all levels
- **Weighted F1** — weighted by class size, shows overall system performance
- **Confusion Matrix** — shows exactly which classes are being confused

---

### Member 1 Q&A Reference

**A. ML and NLP Foundations**

1. Q: What is machine learning?
   A: Machine learning is when a computer learns patterns from examples.

2. Q: What is NLP?
   A: NLP means using computers to process and understand human language.

3. Q: What is an algorithm?
   A: An algorithm is a step-by-step way to solve a problem.

4. Q: What is a model?
   A: A model is the part of the system that gives predictions.

5. Q: What is training?
   A: Training is teaching the model using labeled data.

6. Q: What is inference?
   A: Inference is using the trained model on new input.

7. Q: What is a feature?
   A: A feature is a measurable text value used by the model.

8. Q: What is a label?
   A: A label is the correct class for each training sample.

9. Q: What is classification?
   A: Classification means assigning an input to a category.

10. Q: Why is ReadTrack a classification system?
    A: It predicts classes like proficiency level and complexity level.

11. Q: What are ReadTrack proficiency labels?
    A: Nagsisimula, Papaunlad, and Mahusay — based on Phil-IRI standards.

12. Q: What are ReadTrack complexity labels?
    A: Literal, Inferential, and Evaluative — aligned to DepEd Grade 7 MELCs.

13. Q: Why use NLP before ML?
    A: NLP converts raw text into numeric features for the model.

14. Q: What is tokenization?
    A: Tokenization splits text into words or tokens.

15. Q: What is sentence segmentation?
    A: It splits text into sentences.

16. Q: What is POS tagging?
    A: POS tagging marks words as noun, verb, adjective, and so on.

17. Q: Why is POS tagging useful?
    A: It helps measure grammar and sentence patterns.

18. Q: What is readability?
    A: Readability is how easy or hard a text is to read.

19. Q: What readability scores are used?
    A: Flesch-Kincaid and Gunning Fog.

20. Q: What is lexical diversity?
    A: Lexical diversity means variety of words in the text.

**C. Algorithms and Model Choice**

36. Q: What is SVM in simple terms?
    A: SVM draws boundaries that separate classes.

37. Q: Why use SVM for text features?
    A: It is strong and stable for structured numeric features.

38. Q: What is a linear kernel?
    A: It uses a straight boundary between classes.

39. Q: What is an RBF kernel?
    A: It uses curved boundaries for complex class patterns.

40. Q: What is hyperparameter tuning?
    A: It is finding the best model settings.

41. Q: What is Grid Search?
    A: It tries many setting combinations and picks the best.

42. Q: Why not rely only on one metric during tuning?
    A: One metric can hide weaknesses in some classes.

43. Q: What is a baseline model?
    A: A simple reference model for comparison.

44. Q: Why compare with baseline?
    A: To prove the final model is actually better.

45. Q: What is feature scaling?
    A: It makes features comparable in numeric range.

46. Q: Why scale features for SVM?
    A: SVM performs better when scales are consistent.

47. Q: What is overfitting?
    A: The model memorizes training data and performs poorly on new data.

48. Q: What is underfitting?
    A: The model is too simple to learn key patterns.

49. Q: How can overfitting be reduced?
    A: Better validation, tuning, and cleaner feature design.

50. Q: What is generalization?
    A: Good performance on unseen real-world data.

**D. Metrics and Evaluation**

51. Q: What is accuracy?
    A: Ratio of correct predictions over total predictions.

52. Q: What is precision?
    A: Out of predicted positives, how many are correct.

53. Q: What is recall?
    A: Out of actual positives, how many are found.

54. Q: What is F1-score?
    A: A single score balancing precision and recall.

55. Q: How is precision computed?
    A: Precision = TP / (TP + FP).

56. Q: How is recall computed?
    A: Recall = TP / (TP + FN).

57. Q: How is F1 computed?
    A: F1 = 2 × (Precision × Recall) / (Precision + Recall).

58. Q: Why is F1 important?
    A: It balances false alarms and missed cases.

59. Q: Why is accuracy not enough?
    A: It can look high even if one class is weak.

60. Q: What is macro F1?
    A: Average F1 across classes with equal weight.

61. Q: What is weighted F1?
    A: Average F1 weighted by class size.

62. Q: Why report both macro and weighted F1?
    A: They show fairness and overall performance together.

63. Q: What is a confusion matrix?
    A: A table showing predicted class versus true class.

64. Q: Why use a confusion matrix?
    A: It shows exactly where the model makes mistakes.

65. Q: What is support in a report?
    A: Number of samples in each class.

66. Q: What is TP?
    A: True Positive, a correct positive prediction.

67. Q: What is FP?
    A: False Positive, predicted positive but actually negative.

68. Q: What is FN?
    A: False Negative, predicted negative but actually positive.

69. Q: What is TN?
    A: True Negative, a correct negative prediction.

70. Q: What does high precision but low recall mean?
    A: Few false alarms, but many real cases are missed.

71. Q: What does high recall but low precision mean?
    A: Many real cases found, but more false alarms.

72. Q: How do confidence scores help evaluation?
    A: Low confidence predictions can be flagged for review.

73. Q: How often should metrics be checked?
    A: Regularly, especially after retraining.

74. Q: What is model drift?
    A: Model quality drops as real-world data changes.

75. Q: How is drift handled?
    A: Monitor metrics and retrain with new verified data.

---

## Member 2 — Data Reliability and Relevance

### Data Sources

| Dataset | Purpose | Why appropriate |
|---|---|---|
| **Phil-IRI passages** | Train the complexity model (Literal / Inferential / Evaluative) | Official DepEd-published reading inventory; labels are expert-authored and aligned to Grade 1–10 standards |
| **ASAP2 (Automated Student Assessment Prize 2)** | Train the proficiency model (Nagsisimula / Papaunlad / Mahusay) | Large-scale student essay dataset with human-scored proficiency levels |
| **Teacher-labeled samples** | Ongoing model improvement via Verify and Train | Ground truth from actual Grade 7 classroom context; most directly relevant |

### Why the data is appropriate

- **Phil-IRI is the national standard.** Passages were written and graded by Philippine reading specialists to target specific complexity levels. Using Phil-IRI as training data means the system is calibrated to the exact standard teachers use in practice.
- **ASAP2 provides broad essay coverage.** It contains essays across diverse topics and grade levels, giving the proficiency model enough variety to generalize.
- **Teacher corrections are domain-specific.** When teachers flag predictions as wrong, the system saves those corrections. Retraining with these samples makes the model more accurate for the actual local classroom population.

### Data Cleaning and Preprocessing

All text goes through the following pipeline before training or inference:

1. **Unicode normalization (NFC)** — ensures consistent character encoding, especially for Filipino diacritics.
2. **Whitespace collapse** — removes extra spaces, tabs, and newlines.
3. **spaCy tokenization** — produces consistent token and sentence boundaries.
4. **RobustScaler normalization** — scales the 30-dim vector to comparable ranges. RobustScaler is used instead of StandardScaler because it is resistant to outlier essays (e.g., very short or very long texts).
5. **Language detection** — English and Filipino texts are routed to different NLP paths. CEFR features are zeroed out for Filipino since CEFRpy is English-only.

### Data Reliability Measures

- **Label consistency:** Phil-IRI labels come directly from the published materials, not human annotators. This removes inter-annotator disagreement.
- **Train-test split:** The complexity model is evaluated on held-out data to measure generalization. In-sample accuracy on Phil-IRI is 98.48%, which is expected because it is the ground truth standard.
- **Reproducibility:** Fixed random seeds and versioned scripts ensure training can be repeated and produces stable results.
- **Teacher override tracking:** When teachers override a model prediction, both the original prediction and the correction are stored. This creates a growing dataset of edge cases.
- **Class balance strategy:** The complexity model uses `class_weight='balanced'` to prevent the model from favoring the majority class.

### Possible Limitations and Honest Answers

- **Filipino NLP is less mature.** calamanCy is used for Filipino POS tagging but CEFR features (vocabulary level) are not available for Filipino. This means Filipino essays have 6 fewer informative features.
- **Phil-IRI data volume is limited.** The official dataset is not large by ML standards. This is why the model is trained in overfit mode on Phil-IRI — the labels are authoritative, not statistical estimates.
- **ASAP2 is English-centric.** The proficiency model may need Filipino-specific retraining as teacher-labeled Filipino essays accumulate.
- **Bias risk:** If Phil-IRI passages skew toward certain topics or styles, the complexity model may perform differently on very topic-specific classroom materials. Teacher review and the confirmation modal address this.

---

### Member 2 Q&A Reference

**E. Data Reliability and Validity**

76. Q: Is the data reliable?
    A: Reliability is supported through cleaning, checks, and repeatable evaluation.

77. Q: How can we tell data is reliable?
    A: Check source quality, label consistency, and stable test performance.

78. Q: What is data quality checking?
    A: Checking missing values, duplicates, outliers, and label errors.

79. Q: Why are labels important for reliability?
    A: Wrong labels produce wrong model behavior.

80. Q: What is train-test split?
    A: Divide data into training and testing sets.

81. Q: Why do we need unseen test data?
    A: To estimate real-world performance honestly.

82. Q: What is cross-validation?
    A: Repeating train-test cycles on different data splits.

83. Q: Why use cross-validation?
    A: It gives more stable and trustworthy performance estimates.

84. Q: What is data leakage?
    A: Test information accidentally entering training.

85. Q: Why is leakage dangerous?
    A: It gives fake high scores that do not hold in practice.

86. Q: How is leakage prevented?
    A: Keep train and test separate and fit preprocessors on train only.

87. Q: What is reproducibility?
    A: Getting similar results when repeating the same process.

88. Q: How do we improve reproducibility?
    A: Fixed seeds, versioned scripts, and consistent pipelines.

89. Q: What is class imbalance?
    A: Some classes have far fewer samples than others.

90. Q: Why is class imbalance risky?
    A: The model may ignore smaller classes.

91. Q: How is class imbalance addressed?
    A: Balanced class weight strategy and class-aware metrics like macro F1.

92. Q: What does reliable evaluation look like?
    A: Good test design, clear metrics, and transparent error analysis.

93. Q: What is error analysis?
    A: Studying wrong predictions to improve the system.

94. Q: What should be shown in error analysis?
    A: Common mistakes and what changes were made to fix them.

95. Q: What is a practical reliability statement?
    A: The system is reliable for support, but teacher review is still required.

---

## Member 3 — System Design and Workflow

### Architecture Overview

ReadTrack has four layers:

| Layer | Technology | Role |
|---|---|---|
| Frontend | React 19 + TypeScript + Vite 6 | User interface — input, display results, upload materials, view dashboard |
| Backend | FastAPI + Python + Uvicorn | NLP processing, ML inference, OCR, grammar check, training endpoints |
| AI Services | Google Gemini 2.5 Flash | OCR from images, rubric feedback generation, context-aware grammar corrections |
| Database | Supabase (PostgreSQL + Auth) | Store essays, materials, teacher evaluations, and grading history |

### End-to-End Flow: Student Essay

```
Teacher submits essay (text / image / PDF)
        |
        v
[Frontend] POST /analyze/student + POST /analyze/complexity
        |
        v
[Backend] clean_text() → extract_features() → 30-dim vector
        |
        +---> [SVM Proficiency Model] → Nagsisimula / Papaunlad / Mahusay
        +---> [SVM Complexity Model] → Literal / Inferential / Evaluative
        +---> [LanguageTool + SymSpellPy] → grammar issues list
        |
        v
[Gemini 2.5 Flash] → AI rubric feedback (content, organization, language, grammar, mechanics)
        |
        v
[Frontend] Display results panel
        |
        v
Teacher saves → [Supabase] student_grading_uploads table
```

### End-to-End Flow: Material Upload

```
Teacher uploads reading material
        |
        v
[Backend] Extract text → extract_features() → SVM Complexity → level prediction
        |
        v
[Frontend] Confirmation modal — "Is this recommendation good?"
        Teacher: Accept (use model level) OR Override (pick manually)
        |
        v
[Supabase] material_uploads table — stored with language tag and assigned level
```

### Key Backend Endpoints

| Endpoint | Purpose |
|---|---|
| `POST /analyze/student` | Proficiency SVM prediction + grammar check |
| `POST /analyze/complexity` | Complexity SVM prediction + 30 features |
| `POST /analyze/rubric` | Gemini rubric scoring |
| `POST /ocr/extract` | Gemini Vision OCR from image |
| `POST /reference/ingest` | Material upload + complexity classification |
| `POST /train/proficiency` | Retrain proficiency model with teacher-rated essays |
| `GET /api/evaluation` | Return model accuracy, F1, and metrics |

### Why This Architecture

- **FastAPI** was chosen for the backend because it is fast, async-compatible, and has automatic API documentation. It runs well on a single server alongside Python ML libraries.
- **Supabase** gives PostgreSQL with built-in authentication and row-level security without needing to build a separate auth system.
- **Gemini 2.5 Flash** handles tasks that require contextual language understanding (OCR, rubric generation) where rule-based systems would be inadequate.
- **The two-layer model** (deterministic NLP + AI enhancement) separates stable, reproducible outputs (SVM predictions) from contextual AI outputs (rubric feedback). Teachers always see the SVM result first, then AI explanation as supporting detail.

### Why the System Uses a Confirmation Modal for Materials

When a teacher uploads a material, the SVM gives a complexity prediction. Instead of silently auto-saving that prediction, a confirmation modal asks "Is this recommendation good?" This:
- Keeps the teacher as the final decision-maker.
- Collects disagreement data (teacher overrides) that can be used to retrain and improve the model.
- Prevents systematic errors from propagating quietly into the material library.

### Limitations of the Architecture

- **Single-server backend** — the FastAPI server handles NLP, ML inference, and AI calls. Under high concurrent load, spaCy processing could become a bottleneck.
- **Gemini API dependency** — OCR and rubric feedback require internet connectivity and an active Gemini API key. Offline use is not supported for those features.
- **Model retraining is manual** — teachers must trigger retraining through the interface. Automated scheduled retraining is not yet implemented.
- **Filipino NLP gap** — calamanCy provides POS tagging but CEFR vocabulary features are unavailable for Filipino, reducing feature richness for Filipino essays.

---

### Member 3 Q&A Reference

**B. Pipeline and System Flow**

21. Q: What is the basic ReadTrack flow?
    A: Input text → NLP processing → feature extraction → model prediction → output labels.

22. Q: What inputs are supported?
    A: Plain text, image (OCR), and PDF.

23. Q: How is image text handled?
    A: OCR extracts text first, then normal NLP and ML steps run.

24. Q: Why is language selection important?
    A: It chooses the correct NLP processing path.

25. Q: What English NLP tools are used?
    A: spaCy, LanguageTool, SymSpellPy, and CEFRpy.

26. Q: What Filipino NLP tool is used?
    A: calamanCy.

27. Q: What does CEFR-based feature mean?
    A: It measures vocabulary levels like A1 to C2.

28. Q: Why do we need feature extraction?
    A: Models cannot use raw text directly in this setup.

29. Q: What does the model output aside from class?
    A: It can also output confidence information.

30. Q: Why use confidence?
    A: It helps identify predictions that need teacher review.

31. Q: What is deterministic processing?
    A: Same input gives same output every time.

32. Q: Why include deterministic parts?
    A: They give stable baseline results.

33. Q: Why include AI enhancement?
    A: It improves contextual suggestions for complex cases.

34. Q: Is AI output final?
    A: No, teacher judgment remains final.

35. Q: What is human-in-the-loop?
    A: Humans review and correct system outputs.

**F. ReadTrack-Specific Defense Points**

96. Q: What is the main ML contribution of ReadTrack?
    A: It predicts proficiency and complexity from text features in one workflow.

97. Q: What is the main NLP contribution of ReadTrack?
    A: It converts multilingual text into structured features usable by ML.

98. Q: Why is hybrid design useful here?
    A: It combines speed, consistency, and richer feedback.

99. Q: What does Verify and Train do in simple terms?
    A: It uses teacher-corrected data to improve future predictions.

100. Q: Why is teacher correction valuable for ML?
     A: It aligns model behavior with real classroom judgment.

101. Q: What role does confidence play in classroom use?
     A: It helps teachers decide which outputs need extra checking.

102. Q: Can the system replace teacher grading?
     A: No, it supports grading and planning but does not replace teachers.

103. Q: What is a safe way to present model accuracy?
     A: Present with F1, precision, recall, and class-level details.

104. Q: Why highlight limitations in defense?
     A: It shows scientific honesty and realistic deployment thinking.

105. Q: What limitation should be stated for Filipino NLP?
     A: Some feature paths still need further Filipino-specific refinement.

106. Q: What is the next ML improvement step?
     A: Retrain with more high-quality teacher-labeled data.

107. Q: What is the next NLP improvement step?
     A: Strengthen Filipino feature extraction and validation.

108. Q: What should you say if asked about trust?
     A: Trust comes from clear metrics, clean data, and teacher oversight.

109. Q: What should you say if asked about fairness?
     A: Check per-class performance and monitor subgroup gaps.

110. Q: What is your short final defense line?
     A: ReadTrack uses practical NLP and ML to give fast, useful support while keeping teachers in control.

---

## Closing Defense Statement (All Members)

ReadTrack is a classroom decision-support tool, not an autonomous grading system. It uses:

- **Practical NLP** — 30 linguistically grounded features extracted from text using spaCy, CEFRpy, and rule-based heuristics.
- **Principled ML** — SVM with RBF kernel, RobustScaler normalization, and GridSearchCV tuning, calibrated to Phil-IRI and DepEd MELCs standards.
- **Honest evaluation** — F1, precision, recall, confusion matrix, and class-level reporting.
- **Human oversight** — teachers confirm material levels, override predictions, and their corrections feed back into retraining.

The system is reliable as a support tool. It is not a replacement for teacher expertise — it is a tool that gives teachers faster, more structured information to make better decisions.
