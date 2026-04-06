import pickle
import os
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, precision_recall_fscore_support
import matplotlib.pyplot as plt
import seaborn as sns
from svm_models import TextComplexitySVM
from train_utils import load_commonlit_data, get_data_path, save_model_metrics

def train_complexity():
    base_dir = os.path.dirname(__file__)
    models_dir = os.path.join(base_dir, 'models')
    os.makedirs(models_dir, exist_ok=True)

    data_path = get_data_path()
    if not data_path:
        print("Error: No training data found.")
        return

    X, y_comp = load_commonlit_data(data_path, model_type="complexity")

    print("\nTraining Text Complexity Model...")
    
    # Split data for evaluation with stratification
    X_train, X_test, y_train, y_test = train_test_split(
        X, y_comp, test_size=0.2, stratify=y_comp
    )
    
    # Feature Inspection
    print(f"\n=== Feature Inspection ===")
    print(f"  Total samples: {len(X)}")
    print(f"  Feature dimensions: {X.shape[1]}")
    print(f"  Class distribution (train): {np.bincount(y_train)}")
    print(f"  Class distribution (test): {np.bincount(y_test)}")
    
    complexity_model = TextComplexitySVM()
    complexity_model.train(X_train, y_train)
    
    # Evaluate
    X_test_scaled = complexity_model.scaler.transform(X_test)
    y_pred = complexity_model.model.predict(X_test_scaled)
    acc = accuracy_score(y_test, y_pred)
    
    print(f"\n=== Test Results ===")
    print(f"Text Complexity Model Accuracy: {acc*100:.2f}%")
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred, target_names=complexity_model.labels))
    
    # Generate Confusion Matrix
    print("\n=== Generating Confusion Matrix ===")
    cm = confusion_matrix(y_test, y_pred)
    plt.figure(figsize=(8, 6))
    sns.heatmap(cm, annot=True, fmt='d', cmap='Greens', 
                xticklabels=complexity_model.labels,
                yticklabels=complexity_model.labels)
    plt.title('Complexity Model - Confusion Matrix')
    plt.ylabel('True Label')
    plt.xlabel('Predicted Label')
    
    # Save confusion matrix
    cm_path = os.path.join(models_dir, 'complexity_confusion_matrix.png')
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
        "labels": complexity_model.labels,
        "matrix": cm.tolist()
    }
    
    save_model_metrics("complexity", metrics)
    
    # Save
    model_path = os.path.join(models_dir, 'complexity_model.pkl')
    with open(model_path, 'wb') as f:
        pickle.dump({'model': complexity_model.model, 'scaler': complexity_model.scaler}, f)
    
    print(f"Complexity model saved to {model_path}")

if __name__ == "__main__":
    train_complexity()
