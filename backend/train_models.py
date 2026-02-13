import pandas as pd
import numpy as np
import pickle
import os
from svm_models import StudentProficiencySVM, TextComplexitySVM
from preprocessing import extract_features

def load_commonlit_data(path):
    df = pd.read_csv(path)
    X, y_comp, y_prof = [], [], []
    
    sample_size = min(len(df), 1000)
    print(f"Calibrating with {sample_size} CommonLit samples...")
    
    for idx, row in df.iloc[:sample_size].iterrows():
        try:
            features = extract_features(row['excerpt'])
            X.append(features['vector'][0])
            
            target = row['target']
            if target > -0.5:
                y_comp.append(0)
                y_prof.append(1)
            elif target > -1.5:
                y_comp.append(1)
                y_prof.append(2)
            else:
                y_comp.append(2)
                y_prof.append(3)
        except Exception:
            continue
            
    return np.array(X), np.array(y_comp), np.array(y_prof)

def load_custom_data(path):
    df = pd.read_csv(path)
    X, y_comp, y_prof = [], [], []
    
    print(f"Processing {len(df)} samples from {path}...")
    for idx, row in df.iterrows():
        try:
            features = extract_features(row['text'])
            X.append(features['vector'][0])
            y_comp.append(row['complexity_label'])
            y_prof.append(row['proficiency_label'])
        except Exception as e:
            print(f"Skipping row {idx} due to error: {e}")
            
    return np.array(X), np.array(y_comp), np.array(y_prof)

def train_all_models():
    base_dir = os.path.dirname(__file__)
    models_dir = os.path.join(base_dir, 'models')
    os.makedirs(models_dir, exist_ok=True)

    commonlit_path = os.path.join(base_dir, "commonlit_data.csv")
    commonlit_path_alt = os.path.join(base_dir, "train_word_frequencies (1).csv")
    custom_path = os.path.join(base_dir, "training_data.csv")

    if os.path.exists(commonlit_path):
        X, y_comp, y_prof = load_commonlit_data(commonlit_path)
    elif os.path.exists(commonlit_path_alt):
        X, y_comp, y_prof = load_commonlit_data(commonlit_path_alt)
    elif os.path.exists(custom_path):
        X, y_comp, y_prof = load_custom_data(custom_path)
    else:
        print("No CSV data found. Using synthetic initialization.")
        X = np.array([
            [0.8, 5, 2, 0.5, 0.0, 3, 4], [0.6, 15, 10, 1.2, 0.05, 8, 9],
            [0.5, 25, 20, 2.0, 0.15, 12, 13], [0.4, 40, 30, 3.5, 0.3, 16, 18]
        ])
        y_prof = [0, 1, 2, 3]
        y_comp = [0, 1, 2, 2]

    print("Training Student Proficiency Model...")
    proficiency_model = StudentProficiencySVM()
    proficiency_model.train(X, y_prof[:len(X)])
    with open(os.path.join(models_dir, 'proficiency_model.pkl'), 'wb') as f:
        pickle.dump({'model': proficiency_model.model, 'scaler': proficiency_model.scaler}, f)

    print("Training Text Complexity Model...")
    complexity_model = TextComplexitySVM()
    complexity_model.train(X, y_comp[:len(X)])
    with open(os.path.join(models_dir, 'complexity_model.pkl'), 'wb') as f:
        pickle.dump({'model': complexity_model.model, 'scaler': complexity_model.scaler}, f)

    print(f"Models successfully saved to {models_dir}")

if __name__ == "__main__":
    train_all_models()
