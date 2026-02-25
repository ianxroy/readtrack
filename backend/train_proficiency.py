import pickle
import os
import numpy as np
import warnings

# Suppress library-specific deprecation warnings
warnings.filterwarnings("ignore", category=FutureWarning)
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"  # Suppress TensorFlow/Torch logs

from sklearn.model_selection import train_test_split, GridSearchCV
from sklearn.preprocessing import RobustScaler
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier, StackingClassifier, VotingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.svm import SVC
import matplotlib.pyplot as plt
import seaborn as sns
from svm_models import StudentProficiencySVM
from train_utils import load_asap_data, get_data_path

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

    # === Enhanced Oversampling: SMOTE-like Interpolation + Jitter ===
    # Create synthetic samples by interpolating between existing Independent essays
    X_ind = X_train[y_train == 0]
    y_ind = y_train[y_train == 0]
    
    np.random.seed(42)
    synthetic_samples = []
    
    # Moderate oversampling (25x) to avoid overfitting
    for i in range(len(X_ind)):
        for _ in range(25):
            # Pick random neighbor
            neighbor_idx = np.random.randint(0, len(X_ind))
            if neighbor_idx == i:
                neighbor_idx = (i + 1) % len(X_ind)
            
            # Interpolate between sample and neighbor
            alpha = np.random.uniform(0.25, 0.75)
            interpolated = alpha * X_ind[i] + (1 - alpha) * X_ind[neighbor_idx]
            
            # Add modest jitter
            noise_level = np.random.uniform(0.01, 0.025)
            noise = np.random.normal(0, noise_level, interpolated.shape)
            synthetic_samples.append(interpolated + noise)
    
    X_synthetic = np.array(synthetic_samples)
    y_synthetic = np.full(len(X_synthetic), 0)  # All Independent
    
    X_train = np.vstack([X_train, X_synthetic])
    y_train = np.hstack([y_train, y_synthetic])
    
    # Feature Inspection
    print(f"\n=== Feature Inspection (Diverse Jittered Oversampling) ===")
    print(f"  Total samples: {len(X_train)}")
    print(f"  Feature dimensions: {X_train.shape[1]}")
    
    proficiency_model = StudentProficiencySVM()
    # Use RobustScaler for better handling of linguistic outliers
    scaler = RobustScaler()
    
    # Scale training data
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    
    # === Ensemble Approach for 85%+ Goal ===
    # XGBoost + Gradient Boosting + Random Forest
    print("\n=== Training Advanced Ensemble ===")
    
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
            n_estimators=1200,
            max_depth=10,
            learning_rate=0.02,
            subsample=0.85,
            colsample_bytree=0.85,
            reg_alpha=0.3,
            reg_lambda=0.8,
            min_child_weight=1,  # Reduced to allow more sensitivity
            eval_metric='mlogloss'
        )
    else:
        sample_weights = None
    
    hgb = HistGradientBoostingClassifier(
        random_state=42, 
        early_stopping=True, 
        max_iter=700,  # Increased
        max_depth=24, 
        learning_rate=0.05,
        l2_regularization=1.0
    )
    
    rf = RandomForestClassifier(
        random_state=42, 
        n_estimators=700,  # Increased
        max_depth=34, 
        class_weight='balanced_subsample',
        min_samples_split=3,
        min_samples_leaf=1
    )

    if HAS_XGBOOST:
        # Fit XGBoost first with sample weights
        xgb.fit(X_train_scaled, y_train, sample_weight=sample_weights)
        
        # Use Voting with weighted XGBoost
        best_model = VotingClassifier(
            estimators=[('xgb', xgb), ('hgb', hgb), ('rf', rf)],
            voting='soft',
            weights=[4, 1, 1],  # Give XGBoost dominant weight
            n_jobs=-1
        )
        # Refit all estimators together
        best_model.fit(X_train_scaled, y_train)
    else:
        # Fallback to Stacking without XGBoost
        best_model = StackingClassifier(
            estimators=[('hgb', hgb), ('rf', rf)],
            final_estimator=RandomForestClassifier(
                n_estimators=120,
                max_depth=6,
                class_weight='balanced',
                random_state=42
            ),
            cv=5,
            n_jobs=-1
        )
        best_model.fit(X_train_scaled, y_train)
    
    # Use standard prediction (no threshold calibration)
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
    
    # Save the best model
    model_path = os.path.join(models_dir, 'proficiency_model.pkl')
    with open(model_path, 'wb') as f:
        pickle.dump({
            'model': best_model, 
            'scaler': scaler
        }, f)
    
    print(f"Proficiency model saved to {model_path}")

if __name__ == "__main__":
    train_proficiency()
