import pandas as pd
import numpy as np
import os
import pickle
from joblib import Parallel, delayed
from preprocessing import extract_features

def process_single_essay(row):
    """Helper function for parallel processing"""
    try:
        essay_text = str(row['full_text'])
        if len(essay_text) > 10000:
            essay_text = essay_text[:10000]
        
        score = row['score']
        features = extract_features(essay_text)
        
        # Map Score (1-6) to Phil-IRI Levels
        # REVISED MAPPING for better class balance and linguistic accuracy
        # Score 4-6 → Independent (Proficient to Advanced)
        # Score 3   → Instructional (Developing/Average)
        # Score 1-2 → Frustration (Struggling)
        if score >= 4:
            label = 0 # Independent
        elif score >= 3:
            label = 1 # Instructional
        else:
            label = 2 # Frustration
            
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
                # Verify dimensions haven't changed (we expect 37 now)
                if X.shape[1] == 37: 
                    return X, y
                else:
                    print(f"Cache dimension mismatch ({X.shape[1]} vs 37). Re-extracting...")
        except Exception:
            print("Cache corrupted. Re-extracting...")

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

def load_commonlit_data(path, model_type="proficiency", sample_size=None):
    """
    Loads CommonLit essays with parallel processing for feature extraction.
    """
    try:
        df = pd.read_csv(path)
        print(f"Loaded CommonLit dataset with {len(df)} texts.")
    except Exception as e:
        print(f"Error loading CommonLit data: {e}")
        return np.array([]), np.array([])
    
    # Shuffle data to get a representative sample
    df = df.sample(frac=1, random_state=42).reset_index(drop=True)
    
    # Use all data if sample_size not specified
    if sample_size is None:
        sample_size = len(df)
    else:
        sample_size = min(len(df), sample_size)
    
    print(f"Processing {sample_size} samples for {model_type} using all cores...")

    # Define helper for parallel execution
    def process_commonlit_row(row, m_type):
        try:
            features = extract_features(row['excerpt'])
            vec = features['vector'][0]
            
            target = row['target']
            lab = None
            
            if m_type == "proficiency":
                # Phil-IRI Proficiency Mapping
                if target > -0.5:
                    lab = 0 # Independent
                elif target > -1.8:
                    lab = 1 # Instructional
                else:
                    lab = 2 # Frustration
            else:
                # Complexity Mapping
                fk = features['metrics']['readabilityIndices']['flesch_kincaid']
                if fk < 8.0:
                    lab = 0 # Literal
                elif fk < 12.0:
                    lab = 1 # Inferential
                else:
                    lab = 2 # Evaluative
            return vec, lab
        except Exception:
            return None, None

    # Parallel Execution
    from joblib import Parallel, delayed
    try:
        from tqdm import tqdm
        iterable = tqdm(df.iloc[:sample_size].iterrows(), total=sample_size, desc=f"Extracting {model_type} features")
    except ImportError:
        iterable = df.iloc[:sample_size].iterrows()
        
    results = Parallel(n_jobs=-1)(
        delayed(process_commonlit_row)(row, model_type) for _, row in iterable
    )

    X, y = [], []
    for vec, lab in results:
        if vec is not None and lab is not None:
            X.append(vec)
            y.append(lab)
            
    return np.array(X), np.array(y)

import json

def save_model_metrics(model_key, metrics):
    """
    Save evaluation metrics to a JSON file in the models directory.
    model_key: "proficiency" or "complexity"
    metrics: dict containing accuracy, f1, precision, recall, labels, matrix
    """
    base_dir = os.path.dirname(__file__)
    metrics_path = os.path.join(base_dir, 'models', 'evaluation_metrics.json')
    
    current_metrics = {}
    if os.path.exists(metrics_path):
        try:
            with open(metrics_path, 'r') as f:
                current_metrics = json.load(f)
        except json.JSONDecodeError:
            pass
            
    current_metrics[model_key] = metrics
    
    with open(metrics_path, 'w') as f:
        json.dump(current_metrics, f, indent=4)
    print(f"Metrics saved to {metrics_path}")

def get_data_path():
    base_dir = os.path.dirname(__file__)
    commonlit_path = os.path.join(base_dir, "commonlit_data.csv")
    commonlit_path_alt = os.path.join(base_dir, "train_word_frequencies (1).csv")
    
    if os.path.exists(commonlit_path):
        return commonlit_path
    elif os.path.exists(commonlit_path_alt):
        return commonlit_path_alt
    return None
