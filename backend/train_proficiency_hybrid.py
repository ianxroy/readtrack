import pickle
import os
import warnings
from typing import List

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns
import torch
from sklearn.ensemble import RandomForestClassifier, VotingClassifier
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    precision_recall_fscore_support,
)
from sklearn.model_selection import StratifiedKFold, train_test_split
from sklearn.preprocessing import StandardScaler

from preprocessing import extract_features
from train_utils import save_model_metrics

try:
    import lightgbm as lgb
    HAS_LIGHTGBM = True
except ImportError:
    HAS_LIGHTGBM = False

from transformers import AutoModel, DebertaV2Tokenizer, DebertaV2Config


warnings.filterwarnings("ignore", category=FutureWarning)


def map_score_to_label(score: int) -> int:
    # Score 4-6 => Independent, 3 => Instructional, 1-2 => Frustration
    if score >= 4:
        return 0
    if score >= 3:
        return 1
    return 2


def load_asap_texts(path: str, sample_size: int | None = None):
    df = pd.read_csv(path)
    df = df.dropna(subset=["full_text", "score"]).copy()
    df["score"] = pd.to_numeric(df["score"], errors="coerce")
    df = df.dropna(subset=["score"])
    df = df[df["score"].between(1, 6)]

    if sample_size is not None:
        df = df.sample(n=min(sample_size, len(df)), random_state=42)

    texts = df["full_text"].astype(str).tolist()
    labels = df["score"].astype(int).map(map_score_to_label).to_numpy()

    return texts, labels


def build_linguistic_features(texts: List[str]) -> np.ndarray:
    vectors = []
    for index, text in enumerate(texts):
        if index % 500 == 0:
            print(f"Linguistic features: {index}/{len(texts)}")
        try:
            feat = extract_features(text)
            vectors.append(feat["vector"][0])
        except Exception:
            vectors.append(np.zeros(37, dtype=np.float32))
    return np.array(vectors, dtype=np.float32)


class DebertaEmbedder:
    def __init__(self, model_name: str = "microsoft/deberta-v3-base"):
        self.model_name = model_name
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"Loading {model_name} on {self.device}...")

        # Kaggle Trick 1: "Zero Dropout" Regression Trick
        # Disable dropout to stabilize regression/classification features
        config = DebertaV2Config.from_pretrained(model_name)
        config.hidden_dropout_prob = 0.0
        config.attention_probs_dropout_prob = 0.0
        
        # Use explicit slow tokenizer class
        self.tokenizer = DebertaV2Tokenizer.from_pretrained(model_name)
        self.model = AutoModel.from_pretrained(model_name, config=config).to(self.device)
        self.model.eval()

    @torch.no_grad()
    def encode(self, texts: List[str], batch_size: int = 8, max_length: int = 512, stride: int = 256) -> np.ndarray:
        """
        Kaggle Trick 2: Expanded Context Windows (Chunking)
        Instead of truncating, we split long texts into overlapping windows 
        and average their embeddings.
        """
        all_embeddings = []
        
        # Kaggle Trick 4: Explicit Paragraph Breaks
        # Replace newlines with [SEP] token to help model see structure
        processed_texts = [t.replace("\n", " [SEP] ") for t in texts]
        
        for start in range(0, len(processed_texts), batch_size):
            end = min(start + batch_size, len(processed_texts))
            if start % 100 == 0:
                print(f"DeBERTa embeddings: {start}/{len(texts)}")
            
            batch_texts = processed_texts[start:end]
            batch_embeddings = []

            for text in batch_texts:
                # Tokenize with sliding window
                inputs = self.tokenizer(
                    text,
                    return_tensors="pt",
                    add_special_tokens=True,
                    max_length=max_length,
                    truncation=True,
                    padding="max_length",
                    return_overflowing_tokens=True,
                    stride=stride
                )
                
                # Move batch to device
                input_ids = inputs["input_ids"].to(self.device)
                attention_mask = inputs["attention_mask"].to(self.device)
                
                # Encode all chunks for this text
                outputs = self.model(input_ids=input_ids, attention_mask=attention_mask)
                hidden = outputs.last_hidden_state
                
                # Mean pooling
                mask = attention_mask.unsqueeze(-1).expand(hidden.size()).float()
                pooled = (hidden * mask).sum(dim=1) / torch.clamp(mask.sum(dim=1), min=1e-9)
                
                # Average chunks to get single vector for text
                text_embedding = pooled.mean(dim=0).cpu().numpy()
                batch_embeddings.append(text_embedding)

            all_embeddings.extend(batch_embeddings)

        return np.vstack(all_embeddings)


def train_proficiency_hybrid(sample_size: int | None = None):
    base_dir = os.path.dirname(__file__)
    models_dir = os.path.join(base_dir, "models")
    os.makedirs(models_dir, exist_ok=True)

    asap_path = os.path.join(base_dir, "ASAP2_train_sourcetexts.csv")
    if not os.path.exists(asap_path):
        print(f"Error: dataset not found at {asap_path}")
        return

    print("Loading dataset...")
    texts, labels = load_asap_texts(asap_path, sample_size=sample_size)
    print(f"Samples: {len(texts)}")
    print(f"Class distribution: {np.bincount(labels)}")

    ling_cache = os.path.join(models_dir, "asap_linguistic_features.npy")
    emb_cache = os.path.join(models_dir, "asap_deberta_embeddings.npy")

    if sample_size is None and os.path.exists(ling_cache):
        print(f"Loading linguistic cache: {ling_cache}")
        X_ling = np.load(ling_cache)
    else:
        print(f"Extracting linguistic features for {len(texts)} texts using all cores...")
        from joblib import Parallel, delayed

        def process_text_linguistic(text):
            try:
                feat = extract_features(text)
                return feat["vector"][0]
            except Exception:
                return np.zeros(37, dtype=np.float32)

        results = Parallel(n_jobs=-1)(
            delayed(process_text_linguistic)(text) for text in texts
        )
        X_ling = np.array(results, dtype=np.float32)
        
        if sample_size is None:
            np.save(ling_cache, X_ling)

    if sample_size is None and os.path.exists(emb_cache):
        print(f"Loading embedding cache: {emb_cache}")
        X_emb = np.load(emb_cache)
    else:
        embedder = DebertaEmbedder()
        # Smaller batch size for chunking logic
        X_emb = embedder.encode(texts, batch_size=8)
        if sample_size is None:
            np.save(emb_cache, X_emb)

    scaler = StandardScaler()
    X_ling_scaled = scaler.fit_transform(X_ling)
    X = np.hstack([X_ling_scaled, X_emb])

    X_train, X_test, y_train, y_test = train_test_split(
        X, labels, test_size=0.2, stratify=labels, random_state=42
    )

    if HAS_LIGHTGBM:
        print("Training LightGBM Ensemble (Kaggle-style Stratified K-Fold)...")
        
        # Kaggle Trick 6: LightGBM Ensemble with Stratified K-Fold
        lgbm_params = {
            "objective": "multiclass",
            "num_class": 3,
            "metric": "multi_logloss",
            "n_estimators": 2000,
            "learning_rate": 0.01,
            "num_leaves": 31,
            "feature_fraction": 0.8,
            "bagging_fraction": 0.8,
            "bagging_freq": 5,
            "verbose": -1,
            "n_jobs": -1,
            "random_state": 42
        }
        
        # Train 5 diverse LightGBM models on different folds
        kf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
        models = []
        
        for fold, (train_idx, val_idx) in enumerate(kf.split(X_train, y_train)):
            print(f"Training Fold {fold+1}/5...")
            X_fold_train, y_fold_train = X_train[train_idx], y_train[train_idx]
            X_fold_val, y_fold_val = X_train[val_idx], y_train[val_idx]
            
            clf = lgb.LGBMClassifier(**lgbm_params)
            clf.fit(
                X_fold_train, y_fold_train,
                eval_set=[(X_fold_val, y_fold_val)],
                eval_metric="multi_logloss",
                callbacks=[lgb.early_stopping(stopping_rounds=100, verbose=False)]
            )
            models.append((f"lgbm_fold_{fold}", clf))
            
        # Combine into a Voting Classifier for final inference
        model = VotingClassifier(estimators=models, voting="soft")
        # Pre-fit hack: we manually set estimators_
        model.estimators_ = [m[1] for m in models]
        model.le_ = None 
        model.classes_ = np.unique(y_train)
        
    else:
        print("LightGBM unavailable, using RandomForest fallback...")
        model = RandomForestClassifier(
            n_estimators=1000,
            max_depth=28,
            class_weight="balanced_subsample",
            n_jobs=-1,
            random_state=42,
        )
        model.fit(X_train, y_train)

    # Predict
    # For VotingClassifier with pre-fitted estimators, we need to be careful.
    # Standard sklearn VotingClassifier expects .fit() to be called.
    # Since we manually trained folds, we can manually average probabilities.
    if HAS_LIGHTGBM:
        probas = np.zeros((X_test.shape[0], 3))
        for _, clf in models:
            probas += clf.predict_proba(X_test)
        probas /= len(models)
        y_pred = np.argmax(probas, axis=1)
    else:
        y_pred = model.predict(X_test)

    labels_text = ["Independent", "Instructional", "Frustration"]
    acc = accuracy_score(y_test, y_pred)
    precision, recall, f1, _ = precision_recall_fscore_support(
        y_test, y_pred, average="weighted"
    )

    print(f"\nHybrid Proficiency Accuracy: {acc * 100:.2f}%")
    print(classification_report(y_test, y_pred, target_names=labels_text))

    cm = confusion_matrix(y_test, y_pred)
    plt.figure(figsize=(8, 6))
    sns.heatmap(cm, annot=True, fmt="d", cmap="Blues", xticklabels=labels_text, yticklabels=labels_text)
    plt.title("Hybrid Proficiency Model - Confusion Matrix")
    plt.ylabel("True Label")
    plt.xlabel("Predicted Label")
    cm_path = os.path.join(models_dir, "proficiency_hybrid_confusion_matrix.png")
    plt.savefig(cm_path, dpi=100, bbox_inches="tight")
    plt.close()

    metrics = {
        "accuracy": f"{acc * 100:.1f}%",
        "f1": round(f1, 2),
        "precision": round(precision, 2),
        "recall": round(recall, 2),
        "labels": labels_text,
        "matrix": cm.tolist(),
    }
    save_model_metrics("proficiency_hybrid", metrics)

    model_path = os.path.join(models_dir, "proficiency_hybrid_model.pkl")
    with open(model_path, "wb") as file_handle:
        pickle.dump(
            {
                "model": model, # Note: if LightGBM, this is the VotingClassifier wrapper
                "scaler": scaler,
                "feature_mode": "linguistic_plus_deberta",
                "label_mapping": "score>=4:Independent, score==3:Instructional, score<=2:Frustration",
                "embedding_model": "microsoft/deberta-v3-base",
                "lightgbm_models": models if HAS_LIGHTGBM else None # Save individual models for custom inference if needed
            },
            file_handle,
        )
    print(f"Hybrid model saved to {model_path}")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--sample-size", type=int, default=None)
    args = parser.parse_args()
    train_proficiency_hybrid(sample_size=args.sample_size)
