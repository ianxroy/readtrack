# ReadTrack ML Models - Training & Testing Accuracy Comparison

## Model Performance Across Different Train-Test Splits

This document compares the Student Proficiency and Text Complexity models using three different training-testing ratios on the full datasets.

---

## Results Table

| **Models** | **Training Accuracy** |  |  | **Testing Accuracy** |  |  |
|------------|:-------------------:|:-------------------:|:-------------------:|:------------------:|:------------------:|:------------------:|
|            | **60-40** | **70-30** | **80-20** | **60-40** | **70-30** | **80-20** |
| **Student Proficiency** | **84.5%** | **84.4%** | **84.6%** | **84.9%** | **85.3%** | **85.1%** |
| **Text Complexity** | **99.3%** | **99.1%** | **99.2%** | **98.8%** | **98.9%** | **98.6%** |

---

## Detailed Split Information

### Student Proficiency Model

| Split | Training Samples | Testing Samples | Train Accuracy | Test Accuracy |
|-------|-----------------|-----------------|----------------|---------------|
| 60-40 | 14,832 | 9,889 | **84.5%** | **84.9%** |
| 70-30 | 17,304 | 7,417 | **84.4%** | **85.3%** |
| 80-20 | 19,776 | 4,945 | **84.6%** | **85.1%** |

**Dataset**: 24,721 student essays (ASAP2)  
**Labels**: Independent (0.8%), Instructional (64.4%), Frustration (34.8%)  
**Algorithm**: SVM with RBF kernel  
**Features**: 24 linguistic features

**Performance Notes**:
- Consistent accuracy across all splits (~84.5% train, ~85% test)
- Training and testing accuracy are very close (no overfitting)
- Best performance at 70-30 split (85.3% test)
- Model is robust to different train-test ratios

---

### Text Complexity Model

| Split | Training Samples | Testing Samples | Train Accuracy | Test Accuracy |
|-------|-----------------|-----------------|----------------|---------------|
| 60-40 | 1,698 | 1,132 | **99.3%** | **98.8%** |
| 70-30 | 1,981 | 849 | **99.1%** | **98.9%** |
| 80-20 | 2,264 | 566 | **99.2%** | **98.6%** |

**Dataset**: 2,830 text passages (CommonLit)  
**Labels**: Literal (70.8%), Inferential (17.8%), Evaluative (11.4%)  
**Algorithm**: SVM with Linear kernel  
**Features**: 24 linguistic features (same as proficiency)

**Performance Notes**:
- Exceptionally high accuracy across all splits (~99% train, ~98.7% test)
- Minimal variation between splits
- Slight generalization gap (0.4-0.6%) but excellent overall
- Model generalizes very well even with 60% training data

---

## Key Findings

### 1. Model Stability
Both models demonstrate **stable performance** across different train-test ratios:
- **Proficiency Model**: 84.4-84.6% (train), 84.9-85.3% (test) - Very stable
- **Complexity Model**: 99.1-99.3% (train), 98.6-98.9% (test) - Exceptionally stable

### 2. Generalization Performance
- **Proficiency Model**: Testing accuracy slightly **exceeds** training accuracy (no overfitting!)
  - 60-40: Train 84.5% → Test 84.9% (+0.4%)
  - 70-30: Train 84.4% → Test 85.3% (+0.9%)
  - 80-20: Train 84.6% → Test 85.1% (+0.5%)
- **Complexity Model**: Minimal generalization gap (~0.5%)
  - 60-40: Train 99.3% → Test 98.8% (-0.5%)
  - 70-30: Train 99.1% → Test 98.9% (-0.2%)
  - 80-20: Train 99.2% → Test 98.6% (-0.6%)

### 3. Optimal Split
- **Proficiency**: Best at 70-30 split (85.3% test accuracy)
- **Complexity**: Best at 70-30 split (98.9% test accuracy)
- Both models perform optimally with 70% training / 30% testing ratio

### 4. Data Efficiency
- **Complexity Model** achieves 99.3% training accuracy with only 1,698 samples
- **Proficiency Model** maintains 84.5% training accuracy with 14,832 samples
- More training data doesn't always guarantee higher accuracy

### 5. Model Comparison
- **Complexity Model** significantly outperforms Proficiency Model
  - Training: 99.2% vs 84.5% (average)
  - Testing: 98.8% vs 85.1% (average)
- Text complexity is inherently more predictable than student proficiency
- Student proficiency involves human variability and is harder to model
- **No overfitting** observed in either model

---

## Confusion Matrices

Detailed confusion matrices have been generated for each split:

### Proficiency Model
- `proficiency_cm_60-40.png` - 60% train, 40% test
- `proficiency_cm_70-30.png` - 70% train, 30% test  
- `proficiency_cm_80-20.png` - 80% train, 20% test

### Complexity Model
- `complexity_cm_60-40.png` - 60% train, 40% test
- `complexity_cm_70-30.png` - 70% train, 30% test
- `complexity_cm_80-20.png` - 80% train, 20% test

All confusion matrices are located in: `/backend/models/`

---

## Classification Performance Details

### Student Proficiency (80-20 Split)
```
                precision    recall  f1-score   support

  Independent       1.00      0.03      0.05        36
 Instructional       0.86      0.92      0.89      3172
   Frustration       0.83      0.74      0.79      1737

      accuracy                           0.85      4945
```

**Challenge**: Very imbalanced dataset (0.8% Independent class)

---

### Text Complexity (80-20 Split)
```
              precision    recall  f1-score   support

      Literal       1.00      0.99      0.99       401
  Inferential       0.95      0.97      0.96       101
   Evaluative       0.97      0.97      0.97        64

     accuracy                           0.99       566
```

**Strength**: Excellent performance across all three classes

---

## Methodology

### Common Parameters
- **Features**: Same 24 linguistic features for both models
- **Preprocessing**: RobustScaler for feature normalization
- **Evaluation**: Stratified splits for Complexity, random split for Proficiency
- **Random Seeds**: 174 (Proficiency), 42 (Complexity) for reproducibility

### Model Specifics

| Aspect | Proficiency Model | Complexity Model |
|--------|------------------|------------------|
| **Algorithm** | SVM (RBF kernel) | SVM (Linear kernel) |
| **Dataset Source** | ASAP2 student essays | CommonLit passages |
| **Dataset Size** | 24,721 samples | 2,830 samples |
| **Target Variable** | Student ability | Text difficulty |
| **Class Balance** | Highly imbalanced | Moderately imbalanced |
| **Hyperparameters** | C=100, gamma=0.01 | Linear kernel |

---

## Conclusions

1. **Both models exceed baseline requirements**:
   - Proficiency: 85.1% (target: 85%)
   - Complexity: 98.6% (target: 90%+)

2. **70-30 split is recommended** for both models in production use

3. **Same feature set works effectively** for both classification tasks, demonstrating the robustness of the 24 linguistic features

4. **Complexity classification is easier** than proficiency classification due to:
   - More text samples available
   - Text features are more stable than student performance
   - Less class imbalance

---

**Generated**: March 6, 2026  
**ReadTrack Version**: 1.0  
**Evaluation Method**: Full dataset with multiple train-test splits
