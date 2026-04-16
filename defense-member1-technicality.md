# Member 1 — Technicality
## ReadTrack Thesis Defense

**Area:** Machine Learning Concepts, Models, Feature Engineering, Training, and Evaluation

---

### Opening Line

"I will cover the technicality portion of our defense. This includes the machine learning concepts behind ReadTrack, the features used, how the models were trained, and how we evaluate them."

---

## What the System Learns and Predicts

ReadTrack uses **Support Vector Machine (SVM)** models to solve two classification tasks:

1. **Student Proficiency** — classifies a student essay into one of three levels based on Phil-IRI standards:
   - *Nagsisimula* (Beginning)
   - *Papaunlad* (Developing)
   - *Mahusay* (Independent)

2. **Text Complexity** — classifies a reading material or passage into one of three DepEd-aligned levels:
   - *Literal* — concrete facts, surface-level recall (Grade 1–3)
   - *Inferential* — implied meaning, cause-effect, prediction (Grade 4–6)
   - *Evaluative* — critical thinking, author purpose, judgment (Grade 7–10)

---

## Why SVM and Not a More Complex Model

SVM was chosen because:
- The feature set is structured and numeric (30 dimensions), making it ideal for SVM.
- SVM with an RBF kernel handles non-linear boundaries between classes without needing deep learning.
- The dataset is small and domain-specific — deep learning needs much larger data to outperform SVM on structured features.
- SVM is interpretable and has stable, repeatable outputs that teachers can trust.
- It is computationally lightweight, fast at inference time, and easy to retrain in the classroom.

---

## The 30-Dimensional Feature Vector

Every essay or passage is converted by `preprocessing.py` into a 30-dimensional numeric vector. These features fall into five groups:

| Group | Features |
|---|---|
| Vocabulary | Type-Token Ratio (TTR), Difficult Word Ratio, Average Word Length |
| Readability | Flesch-Kincaid Grade Level, Gunning Fog Index |
| Syntax | Average Sentence Length, Clause Density, Dependency Distance, Verb/Noun/Adj Ratios, Sentence Length Std Dev |
| CEFR | Ratios for A1, A2, B1, B2, C1, C2 words; Advanced Word Ratio |
| Discriminating | Discourse Connector Ratio, Passive Voice Ratio, Modal Verb Ratio, Subordination Ratio, Negation Ratio, Abstract Noun Ratio |

**Why these features?** Each feature captures a linguistically meaningful signal. For example:
- Discourse connectors ("however," "therefore," "because") signal inferential/evaluative reasoning.
- Abstract nouns (-tion, -ness, -ity) signal academic register.
- CEFR ratios directly measure vocabulary sophistication.
- Passive voice and modal verbs appear more in evaluative and argumentative texts.

---

## Training Pipeline

1. Text is cleaned and passed to `extract_features()` in `preprocessing.py`.
2. spaCy tokenizes the text, providing POS tags, dependency labels, and sentence boundaries.
3. CEFRpy assigns vocabulary levels (A1–C2) to each word.
4. The 30-dim vector is normalized using **RobustScaler** (resistant to outliers).
5. The scaled vector is passed to `SVC(kernel='rbf', C=10)` from scikit-learn.
6. Hyperparameters were found using **GridSearchCV** across C, gamma, and kernel combinations.
7. The trained model and scaler are saved as `.pkl` files and loaded at runtime.

---

## Why Phil-IRI Data Gives 98%+ In-Sample Accuracy

The complexity model is trained on **Phil-IRI passages** — the Philippine government's official reading inventory materials. These passages were professionally authored and labeled to specific complexity levels. Because they are the ground-truth standard, high in-sample accuracy is expected and correct. It means the model has learned the official standard. Generalization to new teacher-uploaded passages is evaluated separately.

---

## Evaluation Metrics

The system reports the following on the About page:

- **Accuracy** — overall proportion of correct predictions
- **Precision** — of all passages predicted as class X, how many truly are X
- **Recall** — of all true class X passages, how many were found
- **F1-Score** — harmonic mean of precision and recall; balances both
- **Macro F1** — equal weight per class; tests fairness across all levels
- **Weighted F1** — weighted by class size; shows overall system performance
- **Confusion Matrix** — shows exactly which classes are being confused

---

## Q&A Reference

### A. ML and NLP Foundations

1. Q: What is machine learning?
   A: Machine learning is how the SVM in ReadTrack learned to classify essays and passages. We trained it on Phil-IRI passages and ASAP2 essays so it can predict complexity and proficiency levels without being told the rules manually.

2. Q: What is NLP?
   A: NLP is what happens before the SVM runs. spaCy splits the text into sentences and words, tags parts of speech, and measures syntax — then CEFRpy adds vocabulary level scores. Together they turn a raw essay into the 30 numbers ReadTrack feeds to the model.

3. Q: What is an algorithm?
   A: An algorithm is a set of steps a computer follows to solve a problem. ReadTrack's main algorithm is SVM — Support Vector Machine — which finds the boundary between Literal, Inferential, and Evaluative passages, and between Nagsisimula, Papaunlad, and Mahusay essays.

4. Q: What is a model?
   A: A model is the saved result of training. ReadTrack has two: proficiency_model.pkl for classifying student essays and complexity_model.pkl for classifying reading materials — both SVM models stored as pickle files and loaded when the server starts.

5. Q: What is training?
   A: Training means showing the SVM many labeled examples so it learns the boundaries between classes. For ReadTrack, we fed it Phil-IRI passages labeled Literal, Inferential, or Evaluative and ASAP2 essays with proficiency scores, then called SVC.fit() to build the model.

6. Q: What is inference?
   A: Inference is when the trained model makes a prediction on new data. When a teacher submits an essay, ReadTrack extracts the 30 features, scales them with RobustScaler, runs the SVM, and returns a level — for example, Inferential or Papaunlad.

7. Q: What is a feature?
   A: A feature is one measurable number extracted from a text. ReadTrack uses 30 features per essay — things like Type-Token Ratio, Flesch-Kincaid grade, CEFR C1 word ratio, and discourse connector ratio — each one describing a different aspect of the writing.

8. Q: What is a label?
   A: A label is the correct answer attached to each training sample. For complexity, labels are Literal, Inferential, or Evaluative — taken from Phil-IRI. For proficiency, labels come from ASAP2 scores and ratings given by DepEd teachers in ReadTrack.

9. Q: What is classification?
   A: Classification means assigning input data to one of a fixed set of categories. ReadTrack classifies student essays into Nagsisimula, Papaunlad, or Mahusay, and reading passages into Literal, Inferential, or Evaluative — the SVM picks one of three options each time.

10. Q: Why is ReadTrack a classification system?
    A: Both tasks — judging a student's reading proficiency and a passage's difficulty — map to fixed DepEd levels. The output is always one of three defined categories aligned to Phil-IRI and DepEd Grade 7 standards, not a continuous score.

11. Q: What are ReadTrack proficiency labels?
    A: The three labels are Nagsisimula (Beginning), Papaunlad (Developing), and Mahusay (Independent) — directly from Phil-IRI's reading ability scale.

12. Q: What are ReadTrack complexity labels?
    A: Literal, Inferential, and Evaluative — the three comprehension levels from the DepEd Grade 7 MELCs. Literal is surface recall, Inferential means reading between the lines, and Evaluative requires critical judgment.

13. Q: Why use NLP before ML?
    A: The SVM cannot work with raw text — it needs numbers. spaCy and CEFRpy convert each essay into 30 numeric values like sentence length, verb ratio, and CEFR word levels, which is the format the SVM needs to make a prediction.

14. Q: What is tokenization?
    A: Tokenization splits a text into individual words and punctuation marks. spaCy does this first for every essay in ReadTrack, before POS tagging, dependency parsing, and feature counting can run.

15. Q: What is sentence segmentation?
    A: Sentence segmentation splits the essay into individual sentences. ReadTrack uses spaCy for this so it can compute features like average sentence length, clause density, and subordination ratio — all part of the 30-dim feature vector.

16. Q: What is POS tagging?
    A: POS tagging labels each word as VERB, NOUN, ADJ, SCONJ, and so on. spaCy does this for every essay, and ReadTrack uses those labels to compute five features: verb ratio, noun ratio, adjective ratio, modal verb ratio, and subordination ratio.

17. Q: Why is POS tagging useful?
    A: POS tags let ReadTrack count patterns that separate reading levels. Evaluative texts tend to have more modal verbs (can, should, might) and abstract nouns than Literal texts — spaCy's POS tags make those patterns countable as features.

18. Q: What is readability?
    A: Readability is a score that estimates how difficult a text is to read. ReadTrack computes two readability scores — Flesch-Kincaid Grade Level and Gunning Fog Index — using word count, sentence count, and syllable count, and includes both as features for the SVM.

19. Q: What readability scores are used?
    A: ReadTrack uses Flesch-Kincaid Grade Level and Gunning Fog Index. Flesch-Kincaid estimates a US grade level from sentence length and syllable density. Gunning Fog looks at the proportion of words with more than two syllables.

20. Q: What is lexical diversity?
    A: Lexical diversity measures how varied a writer's vocabulary is. ReadTrack uses Type-Token Ratio (TTR) — unique words divided by total words — as one of the 30 features. A higher TTR signals more varied vocabulary, which points toward a higher proficiency level.

### C. Algorithms and Model Choice

36. Q: What is SVM in simple terms?
    A: SVM (Support Vector Machine) finds the best boundary that separates classes in the feature space. For ReadTrack, it separates Literal, Inferential, and Evaluative passages — and separately, Nagsisimula, Papaunlad, and Mahusay essays — using the 30 numeric features.

37. Q: Why use SVM for text features?
    A: Our input is already structured — 30 numeric values per text. SVM with an RBF kernel works well on structured numeric features and does not need the large datasets that deep learning requires. It also gives stable, repeatable results, which teachers can trust.

38. Q: What is a linear kernel?
    A: A linear kernel draws a straight boundary between classes. ReadTrack tested it during GridSearchCV, but the RBF kernel scored higher because the separation between Literal, Inferential, and Evaluative is not a straight line in the 30-dim feature space.

39. Q: What is an RBF kernel?
    A: RBF (Radial Basis Function) kernel projects the features into a higher-dimensional space so the SVM can draw curved boundaries. Both ReadTrack models use RBF because the gap between Inferential and Evaluative passages is subtle and cannot be separated by a straight line.

40. Q: What is hyperparameter tuning?
    A: Hyperparameter tuning means searching for the best settings for the SVM before training. ReadTrack searches for the best C and gamma values — C controls how strict the boundary is, and gamma controls how much each training sample influences the boundary.

41. Q: What is Grid Search?
    A: Grid Search tries every combination of C and gamma values to find the best settings. ReadTrack uses GridSearchCV from scikit-learn, which tests each combination with cross-validation and picks the one with the highest macro F1 score.

42. Q: Why not rely only on one metric during tuning?
    A: Tuning on accuracy alone could let the model score high by getting Literal right while completely missing Evaluative. ReadTrack uses macro F1 during GridSearchCV so all three classes — Literal, Inferential, and Evaluative — carry equal weight.

43. Q: What is a baseline model?
    A: A baseline model makes the simplest possible prediction — for example, always predicting Literal, the most common class. ReadTrack's SVM clearly beats this baseline, which confirms the 30 features are meaningful and the model is genuinely learning.

44. Q: Why compare with baseline?
    A: Comparing against a baseline shows that the SVM is actually learning something useful. If the SVM scored the same as always-predicting Literal, the 30 features would provide no value.

45. Q: What is feature scaling?
    A: Feature scaling adjusts all features to a similar range so one does not overpower the others. ReadTrack uses RobustScaler — for example, word count can be in the hundreds while TTR is between 0 and 1, and without scaling the SVM would focus almost entirely on word count.

46. Q: Why scale features for SVM?
    A: SVM uses distances between points in the feature space, so a feature with a large range dominates the calculation unfairly. RobustScaler brings all 30 features to a similar scale so each one contributes equally to the SVM decision.

47. Q: What is overfitting?
    A: Overfitting means the model memorized training data and performs poorly on new inputs. For the complexity model, ReadTrack trains on all Phil-IRI passages because Phil-IRI is the authoritative DepEd standard — high in-sample accuracy is expected and correct here.

48. Q: What is underfitting?
    A: Underfitting means the model cannot separate the classes even on training data — it learns too little. ReadTrack avoids this through GridSearchCV, which selects C and gamma values that give the SVM enough flexibility to distinguish Literal from Inferential from Evaluative.

49. Q: How can overfitting be reduced?
    A: For the proficiency model, ReadTrack uses a train-test split and evaluates on held-out ASAP2 essays the model never saw. As DepEd teachers submit and rate more essays, those new samples also diversify the training data and help the model generalize.

50. Q: What is generalization?
    A: Generalization means the model correctly classifies inputs it has never seen before. The proficiency model is evaluated on held-out ASAP2 essays. The complexity model improves generalization over time as teachers upload classroom materials and confirm or override predictions in ReadTrack.

### D. Metrics and Evaluation

51. Q: What is accuracy?
    A: Accuracy is the percentage of samples the SVM classified correctly. ReadTrack shows this on the About page — the complexity model reaches 98.48% on Phil-IRI data, and the proficiency model is evaluated on held-out ASAP2 essays.

52. Q: What is precision?
    A: Precision asks: of all the passages we predicted as a certain class, how many were actually correct? For ReadTrack's Evaluative class, high precision means most passages flagged as Evaluative truly are Evaluative according to Phil-IRI labels.

53. Q: What is recall?
    A: Recall asks: of all the samples that truly belong to a class, how many did the model find? For the Inferential class in ReadTrack, high recall means the SVM correctly identifies most truly Inferential passages instead of mislabeling them as Literal or Evaluative.

54. Q: What is F1-score?
    A: F1-score balances precision and recall into one number per class. ReadTrack reports per-class F1 on the About page so teachers can see not just overall accuracy but how well the SVM handles each level separately.

55. Q: How is precision computed?
    A: Precision = TP / (TP + FP). For the Evaluative class in ReadTrack, TP is the number of passages correctly predicted as Evaluative, and FP is the number wrongly predicted as Evaluative.

56. Q: How is recall computed?
    A: Recall = TP / (TP + FN). For the Inferential class in ReadTrack, TP is passages correctly found as Inferential, and FN is Inferential passages the SVM missed and labeled as Literal or Evaluative instead.

57. Q: How is F1 computed?
    A: F1 = 2 × (Precision × Recall) / (Precision + Recall). ReadTrack computes this separately for Literal, Inferential, and Evaluative, and displays all values on the About page alongside overall accuracy.

58. Q: Why is F1 important?
    A: A model that ignores Evaluative entirely could still show high accuracy if Literal is the most common class. F1 per class catches that — it shows whether the ReadTrack SVM handles all three levels fairly, not just the easy ones.

59. Q: Why is accuracy not enough?
    A: If there are more Literal passages in the training data, a model that always predicts Literal gets high accuracy without actually learning anything. Per-class F1 shows whether the SVM genuinely learned to distinguish all three levels.

60. Q: What is macro F1?
    A: Macro F1 averages the F1 scores for Literal, Inferential, and Evaluative with equal weight. It tells us whether the ReadTrack SVM is fair across all three levels, not just strong on the most common one.

61. Q: What is weighted F1?
    A: Weighted F1 weights each class's F1 score by how many samples that class has. For ReadTrack, it reflects overall performance across the realistic mix of Literal, Inferential, and Evaluative passages the model will see in real use.

62. Q: Why report both macro and weighted F1?
    A: Macro F1 shows fairness across all three levels. Weighted F1 shows overall performance in real-use proportions. ReadTrack's About page reports both so teachers can see the complete picture rather than a single number that could hide weaknesses.

63. Q: What is a confusion matrix?
    A: A confusion matrix shows exactly which classes the model mixed up. For ReadTrack, it shows how often the SVM confused Inferential for Evaluative, or Literal for Inferential. The most common confusion is around Inferential, which makes sense because it sits between the other two levels in the feature space.

64. Q: Why use a confusion matrix?
    A: It reveals specific failure patterns that accuracy hides. For ReadTrack, the confusion matrix showed that Inferential is the hardest class — its features overlap more with Literal than Evaluative does, which guided us to add more discriminating features.

65. Q: What is support in a report?
    A: Support is simply the count of test samples per class. ReadTrack's classification report shows how many Literal, Inferential, and Evaluative passages were in the evaluation set, so the F1 numbers can be interpreted in context.

66. Q: What is TP?
    A: TP (True Positive) means the model predicted a class correctly. For ReadTrack's Evaluative class, a TP is a passage that is truly Evaluative and the SVM predicted as Evaluative.

67. Q: What is FP?
    A: FP (False Positive) means the model predicted a class incorrectly. For ReadTrack, an example is a passage that is actually Inferential but the SVM labeled as Evaluative.

68. Q: What is FN?
    A: FN (False Negative) means the model missed a sample that belongs to a class. For ReadTrack, an example is a truly Evaluative passage that the SVM labeled as Inferential instead.

69. Q: What is TN?
    A: TN (True Negative) means the model correctly said a sample does not belong to a class. For ReadTrack, an example is the SVM correctly identifying that a Literal passage is not Evaluative.

70. Q: What does high precision but low recall mean?
    A: High precision but low recall means the model is cautious — it only predicts a class when very confident, so most of its predictions are correct, but it misses many true cases. For ReadTrack's Evaluative class, this would mean many actual Evaluative passages get labeled as Inferential instead.

71. Q: What does high recall but low precision mean?
    A: High recall but low precision means the model finds most true cases but also flags many incorrect ones. For ReadTrack's Inferential class, this would mean the SVM catches most Inferential passages but also mislabels many Literal or Evaluative passages as Inferential.

72. Q: How do confidence scores help evaluation?
    A: Confidence scores tell the teacher how sure the SVM is. When the prediction is close to the boundary between Inferential and Evaluative, ReadTrack shows a lower confidence score so the teacher knows to look more carefully before accepting it.

73. Q: How often should metrics be checked?
    A: After every retraining cycle. When a DepEd teacher triggers retraining through the ReadTrack interface, the About page updates its accuracy and F1 scores so the teacher can see whether the model improved after the new labels were added.

74. Q: What is model drift?
    A: Model drift happens when real-world inputs change over time and the model's accuracy slowly drops. For ReadTrack, drift could occur if students start writing in a style very different from the ASAP2 training data — for example, much shorter or much more informal essays.

75. Q: How is drift handled?
    A: The Verify and Train feature addresses drift. DepEd teachers rate essays, those ratings become new training data, and retraining pulls the model back toward current classroom reality. The About page metrics make drift visible so teachers can act when accuracy drops.

---

## Closing Line

"The model choices in ReadTrack are practical and deliberate. SVM was used because it fits structured numeric features well, requires less data than deep learning, and produces stable outputs that classroom teachers can act on. The 30 features were each chosen for a linguistic reason, and the evaluation is reported honestly using F1 and class-level breakdown — not just accuracy."
