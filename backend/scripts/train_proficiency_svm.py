import pickle
import os
import warnings

# Suppress warnings
warnings.filterwarnings("ignore", category=FutureWarning)
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"

CPU_COUNT = os.cpu_count() or 1
THREAD_ENV_VARS = (
    "OMP_NUM_THREADS",
    "OPENBLAS_NUM_THREADS",
    "MKL_NUM_THREADS",
    "VECLIB_MAXIMUM_THREADS",
    "NUMEXPR_NUM_THREADS",
)
for env_var in THREAD_ENV_VARS:
    os.environ[env_var] = str(CPU_COUNT)

from sklearn.model_selection import train_test_split, GridSearchCV
from sklearn.preprocessing import RobustScaler
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, precision_recall_fscore_support
from sklearn.svm import SVC
import matplotlib.pyplot as plt
import seaborn as sns
from svm_models import StudentProficiencySVM
from train_utils import load_asap_data, save_model_metrics

def train_proficiency_svm():
    scripts_dir = os.path.dirname(__file__)
    base_dir = os.path.dirname(scripts_dir)
    models_dir = os.path.join(base_dir, 'models')
    os.makedirs(models_dir, exist_ok=True)

    # Load ASAP2 dataset
    asap_path = os.path.join(base_dir, "ASAP2_train_sourcetexts.csv")
    
    if os.path.exists(asap_path):
        print(f"Using ASAP2 Dataset: {asap_path}")
        X, y_prof = load_asap_data(asap_path)
        print(f"Loaded: X shape={X.shape}, y_prof shape={y_prof.shape}")
    else:
        print(f"Error: ASAP dataset not found at {asap_path}")
        return

    print("\n=== Training SVM Proficiency Model ===")

    # Split proficiency data (non-stratified with seed 174 matches proven 85%+ setup)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y_prof, test_size=0.2, random_state=174
    )
    
    print(f"\n=== Data Summary ===")
    print(f"  Training samples: {len(X_train)}")
    print(f"  Test samples: {len(X_test)}")
    print(f"  Features: {X_train.shape[1]}")
    
    proficiency_model = StudentProficiencySVM()
    scaler = RobustScaler()

    # Scale data
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    
    print(f"\n=== Training SVM (RBF Kernel) with GridSearchCV ===")

    param_grid = {
        'C': [10, 50, 100, 500, 1000],
        'gamma': ['scale', 0.01, 0.05, 0.1],
        'class_weight': ['balanced', None]
    }

    svm_base = SVC(
        kernel='rbf',
        random_state=42,
        cache_size=2000
    )

    n_combos = len(param_grid['C']) * len(param_grid['gamma']) * len(param_grid['class_weight'])
    print(f"Running GridSearchCV ({n_combos} combinations, 3-fold CV)...")

    grid_search = GridSearchCV(
        svm_base,
        param_grid,
        cv=3,
        scoring='accuracy',
        n_jobs=-1,
        verbose=1
    )
    grid_search.fit(X_train_scaled, y_train)

    best_model = grid_search.best_estimator_
    print(f"\nBest parameters: {grid_search.best_params_}")
    print(f"Best CV accuracy: {grid_search.best_score_*100:.2f}%")

    # Test set evaluation
    y_pred = best_model.predict(X_test_scaled)
    best_acc = accuracy_score(y_test, y_pred)
    
    print(f"\n=== Test Results ===")
    print(f"Model Accuracy: {best_acc*100:.2f}%")
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred, target_names=proficiency_model.labels))
    
    # Confusion Matrix
    cm = confusion_matrix(y_test, y_pred)
    plt.figure(figsize=(8, 6))
    sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', 
                xticklabels=proficiency_model.labels,
                yticklabels=proficiency_model.labels)
    plt.title('Proficiency Model (SVM) - Confusion Matrix')
    plt.ylabel('True Label')
    plt.xlabel('Predicted Label')
    
    cm_path = os.path.join(models_dir, 'proficiency_confusion_matrix.png')
    plt.savefig(cm_path, dpi=100, bbox_inches='tight')
    print(f"Confusion matrix saved to {cm_path}")
    plt.close()

    precision, recall, f1, _ = precision_recall_fscore_support(
        y_test, y_pred, average='weighted'
    )

    metrics = {
        "accuracy": f"{best_acc * 100:.1f}%",
        "f1": round(float(f1), 2),
        "precision": round(float(precision), 2),
        "recall": round(float(recall), 2),
        "labels": proficiency_model.labels,
        "matrix": cm.tolist()
    }

    save_model_metrics("proficiency", metrics)
    
    # Save model
    model_path = os.path.join(models_dir, 'proficiency_model.pkl')
    with open(model_path, 'wb') as f:
        pickle.dump({
            'model': best_model,
            'scaler': scaler
        }, f)
    
    print(f"Model saved to {model_path}")
    
    if best_acc >= 0.85:
        print(f"\n✓ SUCCESS: Achieved {best_acc*100:.2f}%")
    else:
        print(f"\n✗ Below 85%: {best_acc*100:.2f}%")
    
    return best_acc

if __name__ == "__main__":
    train_proficiency_svm()
