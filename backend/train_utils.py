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
        
        # Map Score (1-6) to Phil-IRI Levels (Refined Mapping)
        # Score 6 → Independent (elite writers only)
        # Score 3-5 → Instructional (broader middle range)
        # Score 1-2 → Frustration (struggling writers)
        if score >= 6:
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

def load_commonlit_data(path, model_type="proficiency", sample_size=None):
    df = pd.read_csv(path)
    X, y = [], []
    
    # Shuffle data to get a representative sample
    df = df.sample(frac=1).reset_index(drop=True)
    
    # Use all data if sample_size not specified
    if sample_size is None:
        sample_size = len(df)
    else:
        sample_size = min(len(df), sample_size)
    
    print(f"Loading {sample_size} samples for {model_type}...")
    
    for idx, row in df.iloc[:sample_size].iterrows():
        try:
            features = extract_features(row['excerpt'])
            X.append(features['vector'][0])
            
            target = row['target']
            if model_type == "proficiency":
                # Phil-IRI Proficiency Mapping
                if target > -0.5:
                    y.append(0) # Independent
                elif target > -1.8:
                    y.append(1) # Instructional
                else:
                    y.append(2) # Frustration
            else:
                # Complexity Mapping (Text inherent property)
                fk = features['metrics']['readabilityIndices']['flesch_kincaid']
                if fk < 12.0:
                    y.append(0) # Literal
                elif fk < 15.0:
                    y.append(1) # Inferential
                else:
                    y.append(2) # Evaluative
                    
        except Exception:
            continue
            
    return np.array(X), np.array(y)

def get_data_path():
    base_dir = os.path.dirname(__file__)
    commonlit_path = os.path.join(base_dir, "commonlit_data.csv")
    commonlit_path_alt = os.path.join(base_dir, "train_word_frequencies (1).csv")
    
    if os.path.exists(commonlit_path):
        return commonlit_path
    elif os.path.exists(commonlit_path_alt):
        return commonlit_path_alt
    return None
