import pickle
import os
import numpy as np
import warnings

# Suppress library-specific deprecation warnings
warnings.filterwarnings("ignore", category=FutureWarning)
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"  # Suppress TensorFlow/Torch logs

from sklearn.model_selection import train_test_split, GridSearchCV
from sklearn.preprocessing import RobustScaler
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, precision_recall_fscore_support
from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier, StackingClassifier, VotingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.svm import SVC
import matplotlib.pyplot as plt
import seaborn as sns
from svm_models import StudentProficiencySVM
from train_utils import load_asap_data, get_data_path, save_model_metrics

try:
    from xgboost import XGBClassifier
    HAS_XGBOOST = True
except ImportError:
    HAS_XGBOOST = False
    print("XGBoost not found. Using standard ensemble.")

def train_proficiency():
    base_dir = os.path.dirname(__file__)
    models_dir = os.path.join(base_dir, 'models')
    os.makedirs(models_dir, exist_ok=True)

    # Use ASAP2 dataset
    asap_path = os.path.join(base_dir, "ASAP2_train_sourcetexts.csv")
    
    if os.path.exists(asap_path):
        print(f"Using ASAP2 Dataset: {asap_path}")
        # DO NOT limit sample size - use full dataset
        X, y_prof = load_asap_data(asap_path)
        print(f"DEBUG: X shape={X.shape}, y_prof shape={y_prof.shape}, y_prof unique values={np.unique(y_prof)}")
    else:
        print(f"Error: ASAP dataset not found at {asap_path}")
        print("Please download 'ASAP2_train_sourcetexts.csv' and place it in the backend folder.")
        return

    print("\nTraining Student Proficiency Model (Gradient Boosting)...")
    
    # Split data for evaluation with stratification and fixed seed for consistency
    X_train, X_test, y_train, y_test = train_test_split(
        X, y_prof, test_size=0.2, stratify=y_prof, random_state=42
    )

    # Note: With the new label mapping (Score 4+ as Independent), classes are well-balanced:
    # Frustration (~35%), Instructional (~36%), Independent (~29%)
    # No aggressive oversampling needed.

    # Feature Inspection
    print(f"\n=== Feature Inspection (Balanced Dataset) ===")
    print(f"  Total samples: {len(X_train)}")
    print(f"  Class distribution: {np.bincount(y_train)}")
    
    proficiency_model = StudentProficiencySVM()
    # Use RobustScaler for better handling of linguistic outliers
    scaler = RobustScaler()
    
    # Scale training data
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    
    # === Ensemble Approach for >90% Goal ===
    # Using a more aggressive ensemble with tuned hyperparameters
    print("\n=== Training Advanced Ensemble (Targeting >90% Accuracy) ===")
    
    # 1. Histogram-based Gradient Boosting (LightGBM-like)
    # Great for large datasets and finding non-linear patterns
    hgb = HistGradientBoostingClassifier(
        random_state=42, 
        early_stopping=True, 
        max_iter=1500,
        max_depth=16,         
        learning_rate=0.04,   
        l2_regularization=0.2,
        max_leaf_nodes=60
    )
    
    # 2. Random Forest
    # Robust baseline, good for high-dimensional data
    rf = RandomForestClassifier(
        random_state=42, 
        n_estimators=1200,
        max_depth=40,
        class_weight='balanced_subsample',
        min_samples_split=2,
        min_samples_leaf=1,
        max_features='sqrt',
        bootstrap=True
    )

    # 3. XGBoost (if available) - The heavy lifter
    if HAS_XGBOOST:
        # XGBoost with explicit class weighting for Independent (class 0)
        # Calculate class weights
        from sklearn.utils.class_weight import compute_class_weight
        classes = np.unique(y_train)
        class_weights = compute_class_weight('balanced', classes=classes, y=y_train)
        
        # Create sample weights for XGBoost
        sample_weights = np.ones(len(y_train))
        for idx, cls in enumerate(classes):
            sample_weights[y_train == cls] = class_weights[idx]
        
        xgb = XGBClassifier(
            random_state=42,
            n_estimators=2500,
            max_depth=12,
            learning_rate=0.01,
            subsample=0.7,
            colsample_bytree=0.7,
            reg_alpha=0.01,
            reg_lambda=0.1,
            min_child_weight=1,
            gamma=0.01,
            eval_metric='mlogloss'
        )
        
        print("Training XGBoost component...")
        xgb.fit(X_train_scaled, y_train, sample_weight=sample_weights)
        
        # Use Stacking instead of Voting even when XGBoost is available
        # This allows a meta-learner to correct XGBoost's biases
        print("Training Stacking Ensemble with XGBoost...")
        lr = LogisticRegression(max_iter=3000, C=1.0, solver='saga', class_weight='balanced')
        
        best_model = StackingClassifier(
            estimators=[('xgb', xgb), ('hgb', hgb), ('rf', rf), ('lr', lr)],
            final_estimator=RandomForestClassifier(
                n_estimators=200, max_depth=10, class_weight='balanced'
            ),
            cv=5,
            n_jobs=-1,
            passthrough=True
        )
        best_model.fit(X_train_scaled, y_train)
        
    else:
        # Fallback to Stacking without XGBoost
        print("XGBoost unavailable. Using Stacking Classifier...")
        # Switch to stacking which often outperforms voting for weaker base models
        lr = LogisticRegression(max_iter=3000, C=1.0, solver='saga', class_weight='balanced')
        
        best_model = StackingClassifier(
            estimators=[('hgb', hgb), ('rf', rf), ('lr', lr)],
            final_estimator=RandomForestClassifier(
                n_estimators=200, max_depth=10, class_weight='balanced'
            ),
            cv=5,
            n_jobs=-1,
            passthrough=True # Pass original features to meta-learner
        )
        best_model.fit(X_train_scaled, y_train)
    
    # Use standard prediction (no threshold calibration needed for soft voting)
    y_pred = best_model.predict(X_test_scaled)
    
    # Evaluate on test set
    acc = accuracy_score(y_test, y_pred)
    
    print(f"\n=== Test Results ===")
    print(f"Student Proficiency Model Accuracy: {acc*100:.2f}%")
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred, target_names=proficiency_model.labels))
    
    # Generate Confusion Matrix
    print("\n=== Generating Confusion Matrix ===")
    cm = confusion_matrix(y_test, y_pred)
    plt.figure(figsize=(8, 6))
    sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', 
                xticklabels=proficiency_model.labels,
                yticklabels=proficiency_model.labels)
    plt.title('Proficiency Model - Confusion Matrix')
    plt.ylabel('True Label')
    plt.xlabel('Predicted Label')
    
    # Save confusion matrix
    cm_path = os.path.join(models_dir, 'proficiency_confusion_matrix.png')
    plt.savefig(cm_path, dpi=100, bbox_inches='tight')
    print(f"Confusion matrix saved to {cm_path}")
    plt.close()
    
    # Calculate detailed metrics
    precision, recall, f1, _ = precision_recall_fscore_support(y_test, y_pred, average='weighted')
    
    metrics = {
        "accuracy": f"{acc*100:.1f}%",
        "f1": round(f1, 2),
        "precision": round(precision, 2),
        "recall": round(recall, 2),
        "labels": proficiency_model.labels,
        "matrix": cm.tolist()
    }
    
    save_model_metrics("proficiency", metrics)

    # Save the best model
    # Ensure directory exists
    if not os.path.exists(models_dir):
        os.makedirs(models_dir)
        
    model_path = os.path.join(models_dir, 'proficiency_model.pkl')
    try:
        with open(model_path, 'wb') as f:
            pickle.dump({
                'model': best_model, 
                'scaler': scaler
            }, f)
        print(f"Proficiency model saved to {model_path}")
    except Exception as e:
        print(f"Error saving model: {e}")

if __name__ == "__main__":
    train_proficiency()
