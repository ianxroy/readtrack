# Scikit-Learn Machine Learning Integration Guide

This guide details the Scikit-Learn (sklearn) architecture used for text complexity and student proficiency analysis in ReadTrack.

## 1. Architecture Overview
ReadTrack uses a **hybrid analysis pipeline** that combines standard NLP feature extraction with Scikit-Learn Support Vector Machine (SVM) classification.

- **Feature Engineering:** Raw text is converted into a 7-dimensional numerical vector using spaCy and CEFR linguistic rules.
- **Classification:** Linear and RBF SVM models (via `sklearn.svm.SVC`) classify the text into educational levels.
- **Robustness:** A heuristic fallback system ensures the application remains functional even if trained model weights (`.pkl` files) are missing.

## 2. Feature Extraction (`preprocessing.py`)
The system extracts the following features for every text analysis:

| Feature | Description | Importance |
|---------|-------------|------------|
| **TTR** | Type-Token Ratio | Measures lexical diversity and vocabulary range. |
| **Avg Sentence Length** | Words per sentence | Indicator of syntactic complexity. |
| **Difficult Word Ratio** | % of words > 9 chars | Measures word-level complexity. |
| **Clause Density** | Verbs per sentence | Measures grammatical complexity (subordination). |
| **Advanced CEFR Ratio** | % of C1/C2 words | Maps text to international proficiency standards. |
| **Flesch-Kincaid** | Grade Level Score | Standard readability metric for English. |
| **Gunning Fog** | Complexity Index | Measures the "fog" or difficulty of the prose. |

## 3. Training the Models (`train_models.py`)
The training script initializes the models and saves them to the `backend/models/` directory.

### To Train/Re-train:
1. Ensure `pandas` and `scikit-learn` are installed.
2. Run the training script:
   ```powershell
   python backend/train_models.py
   ```

### Dataset Integration:
- **Current State:** Uses representative synthetic data to initialize the decision boundaries.
- **Future Integration:** Replace the synthetic arrays in `train_all_models()` with a CSV loader for datasets like **CommonLit** or **OneStopEnglish**.

## 4. Model Inference (`svm_models.py`)
The `BaseModel` handles the lifecycle of the ML models:
- **`.load(path)`**: Safely loads the `pickle` file containing the trained model and its associated `StandardScaler`.
- **`.ml_predict(vector)`**: Performs feature scaling followed by SVM prediction.

### Complexity Levels (TextComplexitySVM)
- **Literal:** Simple, direct information.
- **Inferential:** Requires reading between the lines.
- **Evaluative:** Requires critical thinking and judgment.

### Proficiency Levels (StudentProficiencySVM)
- **Beginning / Developing:** Needs intervention or consolidation.
- **Proficient / Advanced:** Ready for enhancement or independent work.

## 5. Deployment
When deploying to production, ensure the `backend/models/*.pkl` files are included in the build artifact. If missing, the system will log a warning and use the heuristic scoring logic as a fallback.
