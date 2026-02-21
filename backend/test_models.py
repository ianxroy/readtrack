import pickle
import os
import sys
import numpy as np

# Add the current directory to sys.path so we can import preprocessing
sys.path.append(os.path.dirname(__file__))
from preprocessing import extract_features

def test_models():
    base_dir = os.path.dirname(__file__)
    prof_model_path = os.path.join(base_dir, 'models', 'proficiency_model.pkl')
    comp_model_path = os.path.join(base_dir, 'models', 'complexity_model.pkl')

    if not os.path.exists(prof_model_path) or not os.path.exists(comp_model_path):
        print("Error: Model files not found. Please run train_models.py first.")
        return

    # Load models
    with open(prof_model_path, 'rb') as f:
        prof_data = pickle.load(f)
    
    with open(comp_model_path, 'rb') as f:
        comp_data = pickle.load(f)

    prof_labels = ["Beginning", "Developing", "Proficient", "Advanced"]
    comp_labels = ["Literal", "Inferential", "Evaluative"]

    test_samples = [
        {
            "name": "Simple Text",
            "text": "The cat sat on the mat. It was a fat cat. The mat was red. The cat liked the mat."
        },
        {
            "name": "News Article",
            "text": "The global economy is facing unprecedented challenges as central banks attempt to curb inflation without triggering a recession. Analysts suggest that interest rates may remain elevated for a longer period than previously anticipated."
        },
        {
            "name": "Scientific/Academic",
            "text": "The pharmacological efficacy of the novel compound was evaluated using a double-blind, placebo-controlled trial. Results indicated a significant reduction in biosynthetic pathways associated with inflammatory cytokines, suggesting potential therapeutic applications for chronic autoimmune disorders."
        }
    ]

    print(f"{'Sample Name':<20} | {'Proficiency':<15} | {'Complexity':<15}")
    print("-" * 55)

    for sample in test_samples:
        features = extract_features(sample['text'])['vector'][0]
        
        # Predict Proficiency
        prof_scaled = prof_data['scaler'].transform([features])
        prof_pred = prof_data['model'].predict(prof_scaled)[0]
        prof_label = prof_labels[prof_pred] if isinstance(prof_pred, (int, np.integer)) else prof_pred

        # Predict Complexity
        comp_scaled = comp_data['scaler'].transform([features])
        comp_pred = comp_data['model'].predict(comp_scaled)[0]
        comp_label = comp_labels[comp_pred] if isinstance(comp_pred, (int, np.integer)) else comp_pred

        print(f"{sample['name']:<20} | {str(prof_label):<15} | {str(comp_label):<15}")

if __name__ == "__main__":
    test_models()
