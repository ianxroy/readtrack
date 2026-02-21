import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
import os

def analyze_proficiency_data():
    base_dir = os.path.dirname(__file__)
    asap_path = os.path.join(base_dir, "ASAP2_train_sourcetexts.csv")
    
    if not os.path.exists(asap_path):
        print(f"File not found: {asap_path}")
        return

    print("Loading dataset...")
    df = pd.read_csv(asap_path)
    
    print(f"Total samples: {len(df)}")
    print("\nColumn names:", df.columns.tolist())
    
    # Check score distribution
    if 'score' in df.columns:
        print("\nOriginal Score Distribution:")
        score_counts = df['score'].value_counts().sort_index()
        print(score_counts)
        
        # Simulate current mapping
        # Score 5-6 → Independent (0)
        # Score 3-4 → Instructional (1)
        # Score 1-2 → Frustration (2)
        
        def map_label(score):
            if score >= 5: return "Independent (0)"
            elif score >= 3: return "Instructional (1)"
            else: return "Frustration (2)"
            
        df['mapped_label'] = df['score'].apply(map_label)
        
        print("\nCurrent Mapping Distribution:")
        label_counts = df['mapped_label'].value_counts()
        print(label_counts)
        
        # Calculate percentages
        total = len(df)
        print("\nPercentages:")
        for label, count in label_counts.items():
            print(f"{label}: {count/total*100:.2f}%")
            
    else:
        print("Column 'score' not found.")

if __name__ == "__main__":
    analyze_proficiency_data()
