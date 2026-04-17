# ReadTrack Glossary of Terms

A plain-language reference for technical words used in the ReadTrack system. Terms are grouped by topic.

---

## Reading & Curriculum Terms

**Phil-IRI**
Philippine Informal Reading Inventory. A DepEd-standard tool that measures how well a student can read a given text. ReadTrack uses its three levels to label both materials and student essays.

**Independent (Madali)**
The student can read the text on their own without help. The material is at the right level or easier than the student's ability.

**Instructional (Katamtaman)**
The student can read the text but needs some teacher guidance. The material is slightly above the student's comfortable level — good for learning with support.

**Frustration (Mahirap)**
The text is too difficult for the student to read on their own. It causes confusion and discourages reading without strong teacher intervention.

**Phil-IRI Grade Level**
The estimated U.S. or Philippine grade level at which a text can be read comfortably. Grade 7 is the target level in ReadTrack.

**DepEd Rubric**
The Department of Education grading scale used to score student essay writing across five dimensions: Content, Organization, Language/Vocabulary, Grammar, and Mechanics.

**Mahusay / Papaunlad / Nagsisimula**
The DepEd writing proficiency labels used in the essay grading rubric:
- **Mahusay** — Proficient (score 4): fully meets Grade 7 expectations
- **Papaunlad** — Developing (score 2–3): partially meets expectations
- **Nagsisimula** — Beginning (score 1): does not yet meet expectations

---

## Text Measurement Terms

**CEFR (Common European Framework of Reference)**
An international scale that classifies vocabulary difficulty from A1 (very basic) to C2 (mastery level). ReadTrack uses CEFR levels to measure how advanced the words in a passage are.
- A1–A2: everyday basic words ("cat", "go", "house")
- B1–B2: intermediate words ("investigate", "consequence")
- C1–C2: advanced/academic words ("ambiguity", "juxtaposition")

**CEFR Ratio**
The percentage of words in a text that are at the B2, C1, or C2 level. A high CEFR ratio means the text uses many advanced words and is likely harder to read.

**TTR (Type-Token Ratio)**
A measure of vocabulary variety. It divides the number of unique words by the total number of words. A high TTR means the writer uses many different words rather than repeating the same ones — a sign of a richer vocabulary.

**FKGL (Flesch-Kincaid Grade Level)**
A formula that estimates the U.S. school grade level needed to understand a text. It is based on average sentence length and average number of syllables per word. A score of 7 means a typical Grade 7 student can read it.

**Flesch Reading Ease**
A related score (0–100) where higher means easier to read. A score of 60–70 is suitable for most general readers.

**Gunning Fog Index**
Another readability formula that estimates grade level based on sentence length and the proportion of long (complex) words. Higher scores mean harder reading.

**Complexity Score**
ReadTrack's own 0–100 score that combines multiple features (FKGL, TTR, CEFR ratios, sentence length, syntax depth). Scores below 40 are Independent, 40–74 are Instructional, 75+ are Frustration.

**Dependency Depth / Syntactic Complexity**
How deeply nested the grammar of a sentence is. A simple sentence like "The dog ran" has low depth. A sentence like "The report that the committee, which was formed last year, submitted was rejected" has high depth. More depth = harder to read.

**Subordination Ratio**
How often a text uses dependent clauses (phrases that start with "because", "although", "while", etc.). More subordinate clauses indicate more complex sentence structure.

**Passive Voice Ratio**
The proportion of sentences written in passive voice ("The book was read by the student" instead of "The student read the book"). Formal and academic texts tend to use more passive voice.

**Modal Ratio**
The proportion of modal verbs used (could, should, would, might, must). Texts with many modals often deal with possibilities, obligations, or hypotheticals — adding complexity.

**Discourse Connector Ratio**
How often the text uses linking words like "however", "therefore", "furthermore", "in contrast". High use of discourse connectors signals a more structured and academically organized text.

**Abstract Noun Ratio**
The proportion of nouns that refer to ideas or concepts rather than physical things (e.g., "freedom", "justice", "complexity" vs. "table", "dog", "pen"). More abstract nouns generally mean a harder text.

**Average Sentence Length**
The average number of words per sentence. Longer sentences tend to be harder to read.

**Average Word Length**
The average number of characters per word. Longer words are generally more complex.

---

## Machine Learning Terms

**SVM (Support Vector Machine)**
The core algorithm ReadTrack uses to classify text. An SVM learns to draw boundaries between categories (like Independent vs. Instructional) by finding the best dividing line through a set of example data.

**SVC (Support Vector Classifier)**
The specific type of SVM used for classification tasks. In ReadTrack: `SVC(kernel='rbf', C=10)`.

**TextComplexitySVM**
ReadTrack's trained model that classifies a reading material as Independent, Instructional, or Frustration based on its text features.

**StudentProficiencySVM**
ReadTrack's trained model that classifies a student essay as Mahusay, Papaunlad, or Nagsisimula based on the student's writing features.

**RBF Kernel (Radial Basis Function)**
A mathematical technique used inside the SVM that allows it to find non-linear decision boundaries — meaning it can separate categories that are not simply divided by a straight line.

**Feature Vector**
A list of numbers that describes a text. ReadTrack extracts 24–30 numbers per text (sentence length, CEFR ratios, TTR, etc.) and feeds this list to the SVM for classification.

**Feature Extraction**
The process of turning raw text into the numbered feature vector. This is done by `preprocessing.py` using spaCy.

**StandardScaler**
A preprocessing step that rescales all feature values so they have a mean of 0 and a standard deviation of 1. This prevents features with large numbers (like word count) from overpowering features with small numbers (like CEFR ratio). Think of it as converting all measurements to the same unit before comparing.

**RobustScaler**
Similar to StandardScaler, but uses the median and percentile range instead of the mean and standard deviation. This makes it less sensitive to extreme outliers — useful when some essays are very unusual compared to the rest.

**Training**
Teaching the model by showing it many labeled examples (texts with known correct labels) so it learns to predict labels on new, unseen texts.

**Retraining**
Updating the model with new examples (e.g., teacher-verified materials) so it improves over time.

**Confidence Level**
How reliable the model's predictions are, based on how many rated examples it has been trained on:
- **Papaunlad** (Developing) — fewer than 30 examples
- **Mahusay** (Proficient) — 30 or more examples

**Accuracy**
The percentage of test examples the model classified correctly. Example: 80% accuracy means 8 out of every 10 predictions were correct.

**Precision**
Of all the texts the model predicted as class X, how many actually were class X? High precision means few false alarms.

**Recall**
Of all the texts that truly belong to class X, how many did the model correctly identify? High recall means few missed cases.

**F1 Score**
The harmonic mean of Precision and Recall. It balances both — a high F1 means the model is both precise and catches most true cases. Ranges from 0 (worst) to 1 (best).

**Macro F1**
The average F1 score across all classes, treating each class equally regardless of how many examples it has.

**Confusion Matrix**
A table showing how often the model confused one label for another. The diagonal (top-left to bottom-right) shows correct predictions; off-diagonal cells show mistakes.

**Cross-Validation (CV)**
A technique for testing how well a model generalizes. The data is split into multiple groups; the model is trained on some groups and tested on others, rotating each time. This gives a more reliable accuracy estimate than a single train/test split.

**GridSearchCV**
An automated method that tries many combinations of model settings (hyperparameters) to find the best-performing configuration.

**Hyperparameter**
A setting that controls how the model learns, chosen before training begins. Examples in ReadTrack: `C=10` (how strictly the SVM draws boundaries), `kernel='rbf'` (the boundary shape).

**HistGradientBoostingClassifier**
An alternative tree-based algorithm (available in scikit-learn) that builds many decision trees in sequence, each correcting the errors of the previous one. Faster and often more accurate than a standard decision tree, especially on tabular feature data.

**LinearSVC**
A faster variant of SVC that uses a straight-line (linear) boundary instead of a curved one. Suitable when data is already well-separated without needing complex curves. Used for simpler classification tasks.

---

## NLP (Natural Language Processing) Terms

**spaCy**
The Python library ReadTrack uses to analyze text. It handles tokenization, part-of-speech tagging, dependency parsing, and more.

**Tokenization**
Breaking a text into individual words and punctuation marks (tokens). "The dog ran." → ["The", "dog", "ran", "."]

**Lemmatization**
Reducing a word to its base (root) form. "running" → "run", "better" → "good". Helps the system treat different forms of the same word as one.

**Part-of-Speech (POS) Tagging**
Labeling each word with its grammatical role: noun, verb, adjective, modal, etc. ReadTrack uses POS tags to count modals, passive constructions, and subordinating conjunctions.

**Dependency Parsing**
Analyzing the grammatical relationships between words in a sentence — which word is the subject, which is the object, and how clauses relate. Used to measure syntactic complexity.

**Named Entity Recognition (NER)**
Identifying proper names of people, places, and organizations in text. ReadTrack disables this step during feature extraction (it is not needed for complexity scoring).

**n-gram**
A sequence of n consecutive words. A "bigram" is 2 words ("reading comprehension"), a "trigram" is 3. Used in some language models to capture common word patterns.

**Langdetect**
A Python library that detects whether text is written in English, Filipino, or another language. ReadTrack uses it as a fallback when the Gemini AI language detector is unavailable.

---

## System & API Terms

**OCR (Optical Character Recognition)**
Converting an image of text into actual readable text. ReadTrack uses Gemini AI to OCR scanned PDFs and photo uploads.

**Gemini AI**
Google's large language model used in ReadTrack for OCR, language detection, and rubric scoring.

**Base64**
A way of encoding binary files (images, PDFs) as plain text so they can be sent over the internet in a JSON request. ReadTrack converts uploaded files to base64 before sending them to the backend.

**PyPDF / PdfReader**
A Python library that extracts text from digital (non-scanned) PDFs. If the PDF has no text layer (it is a scanned image), ReadTrack falls back to Gemini OCR.

**FastAPI**
The Python web framework that powers ReadTrack's backend API. It receives requests from the frontend and returns analysis results.

**Supabase**
The cloud database ReadTrack uses to store student records, essays, materials, and grading data.

**JSONL (JSON Lines)**
A file format where each line is a separate JSON object. ReadTrack stores teacher-verified training samples in a `.jsonl` file.

**Fire-and-forget**
A pattern where a background task (like model retraining) is started but the system does not wait for it to finish before responding to the user. This keeps the UI fast and responsive.
