import pickle
import os
import sys
import numpy as np
from sklearn.model_selection import train_test_split, GridSearchCV, StratifiedKFold, cross_val_score
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, precision_recall_fscore_support
from sklearn.svm import SVC
from sklearn.ensemble import VotingClassifier, RandomForestClassifier, GradientBoostingClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
import matplotlib.pyplot as plt
import seaborn as sns

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from svm_models import TextComplexitySVM
from train_utils import load_commonlit_features, load_teacher_samples, save_model_metrics

OVERFIT_MODE = os.getenv("COMPLEXITY_OVERFIT_MODE", "1") == "1"

def train_complexity():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    models_dir = os.path.join(base_dir, 'models')
    os.makedirs(models_dir, exist_ok=True)

    # ── Load Phil-IRI labeled features (built from labeled_passages.csv) ──
    X_base, y_base = load_commonlit_features(base_dir=base_dir)
    if X_base is None or len(X_base) == 0:
        print(
            "ERROR: complexity_features.csv not found or empty.\n"
            "Run this first:\n"
            "  python scripts/build_complexity_features.py"
        )
        return
    X_base = np.asarray(X_base, dtype=float)
    y_base = np.asarray(y_base, dtype=int)

    # ── Load any additional teacher-submitted samples ──
    samples_path = os.path.join(base_dir, 'data', 'teacher_samples.jsonl')
    X_teach, y_teach = load_teacher_samples(samples_path)
    X_teach = np.asarray(X_teach, dtype=float) if len(X_teach) > 0 else np.empty((0, X_base.shape[1]))
    y_teach = np.asarray(y_teach, dtype=int) if len(y_teach) > 0 else np.array([], dtype=int)

    # Pad teacher vectors that were saved with an older (shorter) feature set.
    # New features default to 0 (neutral baseline).
    if len(X_teach) > 0 and X_teach.shape[1] < X_base.shape[1]:
        pad_cols = X_base.shape[1] - X_teach.shape[1]
        X_teach = np.hstack([X_teach, np.zeros((len(X_teach), pad_cols))])
        print(f"Padded {len(X_teach)} teacher samples from {X_teach.shape[1] - pad_cols} → {X_base.shape[1]} features")

    if len(X_teach) > 0:
        X = np.concatenate([X_base, X_teach], axis=0)
        y = np.concatenate([y_base, y_teach], axis=0)
        print(f"Combined: {len(X_base)} Phil-IRI base + {len(X_teach)} teacher samples = {len(X)} total")
    else:
        X, y = X_base, y_base
        print(f"Using {len(X)} Phil-IRI base samples (no teacher samples yet)")

    X = np.asarray(X, dtype=float)
    y = np.asarray(y, dtype=int)

    print(f"\nTraining Text Complexity Model...")
    print(f"  Feature dimensions : {X.shape[1]}")
    print(f"  Class distribution : Literal={np.sum(y==0)}  Inferential={np.sum(y==1)}  Evaluative={np.sum(y==2)}")

    # Overfit mode (requested): train/evaluate on full dataset.
    if OVERFIT_MODE:
        print("\nOVERFIT MODE ENABLED: Training and evaluating on full dataset (in-sample).")
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)

        # High-capacity model to maximize in-sample fit.
        model = RandomForestClassifier(
            n_estimators=1200,
            max_depth=None,
            min_samples_split=2,
            min_samples_leaf=1,
            random_state=42,
        )
        model.fit(X_scaled, y)
        y_pred = model.predict(X_scaled)

        complexity_model = TextComplexitySVM()
        complexity_model.scaler = scaler
        complexity_model.model = model
        complexity_model.feature_idx = None

        acc = accuracy_score(y, y_pred)
        precision, recall, f1, _ = precision_recall_fscore_support(y, y_pred, average='weighted', zero_division=0)
        cm = confusion_matrix(y, y_pred)

        print(f"\n=== In-Sample Results (Overfit Mode) ===")
        print(f"Accuracy: {acc*100:.2f}%")
        print("\nClassification Report:")
        print(classification_report(y, y_pred, target_names=complexity_model.labels, zero_division=0))

        plt.figure(figsize=(8, 6))
        sns.heatmap(cm, annot=True, fmt='d', cmap='Greens',
                    xticklabels=complexity_model.labels,
                    yticklabels=complexity_model.labels)
        plt.title('Complexity Model — Confusion Matrix (In-Sample)')
        plt.ylabel('True Label')
        plt.xlabel('Predicted Label')
        cm_path = os.path.join(models_dir, 'complexity_confusion_matrix.png')
        plt.savefig(cm_path, dpi=100, bbox_inches='tight')
        plt.close()
        print(f"Confusion matrix saved to {cm_path}")

    else:
        # Need at least 2 samples per class for stratified split
        min_class = min(np.sum(y == c) for c in [0, 1, 2])
        if min_class < 2:
            print(f"\nWARNING: Too few samples for a train/test split (min class size={min_class}).")
            print("Training on all data — no held-out evaluation.")
            complexity_model = TextComplexitySVM()
            complexity_model.train(X, y)
            acc, f1, precision, recall = None, None, None, None
            cm = None
        else:
            # Drop English-biased features (stopword_ratio=15, cefr_*=18-23)
            # so Filipino passages are not misclassified by English CEFR vocabulary
            LANG_AGNOSTIC_IDX = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,16,17]
            X = X[:, LANG_AGNOSTIC_IDX]

            n_classes = len(np.unique(y))
            test_size = max(n_classes / len(X), 0.15)
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=test_size, stratify=y, random_state=42
            )

            # Grid-search best SVC hyperparameters on training fold
            scaler = StandardScaler()
            X_train_scaled = scaler.fit_transform(X_train)
            param_grid = {
                'C': [0.1, 0.5, 1, 5, 10, 50, 100],
                'gamma': ['scale', 'auto', 0.001, 0.01, 0.1],
                'kernel': ['rbf', 'linear'],
            }
            cv = StratifiedKFold(n_splits=min(5, min(np.bincount(y_train.astype(int)))), shuffle=True, random_state=42)
            gs = GridSearchCV(SVC(probability=True), param_grid, cv=cv, scoring='accuracy', n_jobs=-1)
            gs.fit(X_train_scaled, y_train)
            print(f"  Best params: {gs.best_params_}  CV acc: {gs.best_score_*100:.1f}%")

            complexity_model = TextComplexitySVM()
            complexity_model.scaler = scaler
            complexity_model.model = gs.best_estimator_
            complexity_model.feature_idx = LANG_AGNOSTIC_IDX

            X_test_scaled = complexity_model.scaler.transform(X_test)
            y_pred = complexity_model.model.predict(X_test_scaled)
            acc = accuracy_score(y_test, y_pred)

            print(f"\n=== Test Results ===")
            print(f"Accuracy: {acc*100:.2f}%")
            print("\nClassification Report:")
            print(classification_report(y_test, y_pred, target_names=complexity_model.labels))

            cm = confusion_matrix(y_test, y_pred)
            plt.figure(figsize=(8, 6))
            sns.heatmap(cm, annot=True, fmt='d', cmap='Greens',
                        xticklabels=complexity_model.labels,
                        yticklabels=complexity_model.labels)
            plt.title('Complexity Model — Confusion Matrix')
            plt.ylabel('True Label')
            plt.xlabel('Predicted Label')
            cm_path = os.path.join(models_dir, 'complexity_confusion_matrix.png')
            plt.savefig(cm_path, dpi=100, bbox_inches='tight')
            plt.close()
            print(f"Confusion matrix saved to {cm_path}")

            precision, recall, f1, _ = precision_recall_fscore_support(y_test, y_pred, average='weighted')

    metrics = {
        "accuracy":  f"{acc*100:.1f}%" if acc is not None else "n/a",
        "f1":        round(float(f1), 2) if f1 is not None else "n/a",
        "precision": round(float(precision), 2) if precision is not None else "n/a",
        "recall":    round(float(recall), 2) if recall is not None else "n/a",
        "evaluation_mode": "in_sample_overfit" if OVERFIT_MODE else "held_out_split",
        "labels":    complexity_model.labels,
        "matrix":    cm.tolist() if cm is not None else [],
        "n_samples": int(len(X)),
        "n_base":    int(len(X_base)),
        "n_teacher": int(len(X_teach)),
    }
    save_model_metrics("complexity", metrics)

    model_path = os.path.join(models_dir, 'complexity_model.pkl')
    with open(model_path, 'wb') as f:
        pickle.dump({
            'model': complexity_model.model,
            'scaler': complexity_model.scaler,
            'feature_idx': getattr(complexity_model, 'feature_idx', None),
        }, f)
    print(f"\nComplexity model saved to {model_path}")

if __name__ == "__main__":
    train_complexity()
