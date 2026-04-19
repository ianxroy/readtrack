import pandas as pd
import numpy as np
import os
import pickle
import json
from joblib import Parallel, delayed
from preprocessing import extract_features

def save_model_metrics(model_key, metrics):
    base_dir = os.path.dirname(__file__)
    models_dir = os.path.join(base_dir, 'models')
    os.makedirs(models_dir, exist_ok=True)
    metrics_path = os.path.join(models_dir, 'evaluation_metrics.json')

    existing = {}
    if os.path.exists(metrics_path):
        try:
            with open(metrics_path, 'r') as f:
                existing = json.load(f)
        except Exception:
            existing = {}

    existing[model_key] = metrics

    with open(metrics_path, 'w') as f:
        json.dump(existing, f, indent=4)

    print(f"Saved {model_key} metrics to {metrics_path}")

def process_single_essay(row):
    """Helper function for parallel processing"""
    try:
        essay_text = str(row['full_text'])
        if len(essay_text) > 10000:
            essay_text = essay_text[:10000]
        
        score = row['score']
        features = extract_features(essay_text)
        
        # Map Score (1-6) to Phil-IRI Levels
        # Score 5-6 → Mahusay / Independent
        # Score 3-4 → Papaunlad / Instructional
        # Score 1-2 → Nagsisimula / Frustration
        if score >= 5:
            label = 0 # Mahusay
        elif score >= 3:
            label = 1 # Papaunlad
        else:
            label = 2 # Nagsisimula
            
        return features['vector'][0], label
    except Exception:
        return None, None

def load_asap_data(path, sample_size=None):
    """
    Loads student essays with parallel processing and smart caching.
    """
    cache_path = path.replace(".csv", "_features.pkl")
    
    # Check if we can use the cache
    if os.path.exists(cache_path) and sample_size is None:
        print(f"Loading cached features from {cache_path}...")
        try:
            with open(cache_path, 'rb') as f:
                X, y = pickle.load(f)
                # Verify cache is valid (check if dimensions match expected)
                print(f"Cache loaded: shape={X.shape}")
                return X, y
        except Exception as e:
            print(f"Cache load failed ({e}). Re-extracting...")

    try:
        df = pd.read_csv(path)
        print(f"Loaded ASAP dataset with {len(df)} essays.")
    except Exception as e:
        print(f"Error loading ASAP data: {e}")
        return np.array([]), np.array([])

    # Shuffle
    df = df.sample(frac=1, random_state=42).reset_index(drop=True)
    if sample_size:
        df = df.iloc[:sample_size]
        
    print(f"Processing {len(df)} essays in parallel (using all cores)...")
    
    # Use tqdm for progress bar
    try:
        from tqdm import tqdm
        iterable = tqdm(df.iterrows(), total=len(df), desc="Extracting Features")
    except ImportError:
        iterable = df.iterrows()

    # Run extraction in parallel
    results = Parallel(n_jobs=-1)(
        delayed(process_single_essay)(row) for _, row in iterable
    )
    
    X, y = [], []
    for feat, label in results:
        if feat is not None:
            X.append(feat)
            y.append(label)
    
    X_final, y_final = np.array(X), np.array(y)
    
    # Save to cache if we processed the whole thing
    if sample_size is None:
        with open(cache_path, 'wb') as f:
            pickle.dump((X_final, y_final), f)
        print(f"Features cached to {cache_path}")
            
    return X_final, y_final

def load_teacher_samples(path: str):
    """Load teacher-verified samples from JSONL. Returns (X, y) numpy arrays."""
    pairs = []
    label_map = {"Independent": 0, "Instructional": 1, "Frustration": 2}
    if not os.path.exists(path):
        return np.array([]), np.array([], dtype=int)
    with open(path, 'r') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                sample = json.loads(line)
                vec = sample.get('vector')
                label = label_map[sample['label']]
                if isinstance(vec, (list, tuple)) and len(vec) > 0:
                    pairs.append((list(vec), label))
            except Exception:
                continue
    if not pairs:
        return np.array([]), np.array([], dtype=int)

    # Teacher samples may come from older feature schemas; pad shorter vectors with zeros.
    max_len = max(len(v) for v, _ in pairs)
    padded = []
    y = []
    for v, label in pairs:
        vec = list(v)
        if len(vec) < max_len:
            vec.extend([0.0] * (max_len - len(vec)))
        padded.append(vec)
        y.append(label)

    return np.array(padded, dtype=float), np.array(y, dtype=int)

def load_commonlit_features(base_dir: str = None):
    """
    Load pre-extracted CommonLit feature vectors from complexity_features.csv.
    Returns (X, y) numpy arrays, or (None, None) if the file is missing.

    CSV schema:
      Feature cols (24): ttr, avg_sentence_length, diff_ratio, clause_density,
        advanced_ratio, flesch_kincaid, gunning_fog, verb_ratio, noun_ratio,
        adj_ratio, avg_dep_distance, word_count, sentence_count, sent_len_std,
        punct_density, stopword_ratio, avg_word_length, syllables_per_word,
        cefr_a1_ratio, cefr_a2_ratio, cefr_b1_ratio, cefr_b2_ratio,
        cefr_c1_ratio, cefr_c2_ratio
      Label col: label_id  (0=Independent, 1=Instructional, 2=Frustration)
      Ignored:   label_name
    """
    if base_dir is None:
        base_dir = os.path.dirname(__file__)
    path = os.path.join(base_dir, 'data', 'complexity_features.csv')
    if not os.path.exists(path):
        print(f"Warning: complexity_features.csv not found at {path}")
        return None, None
    df = pd.read_csv(path)
    feature_cols = [c for c in df.columns if c not in ('label_id', 'label_name')]
    X = df[feature_cols].values.astype(float)
    y = df['label_id'].values.astype(int)
    return X, y
