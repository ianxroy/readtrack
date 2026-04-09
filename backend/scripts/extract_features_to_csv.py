import pandas as pd
import numpy as np
import os
import warnings

warnings.filterwarnings("ignore")

from train_utils import load_asap_data

# Feature names matching the order in preprocessing.py extract_features
FEATURE_NAMES = [
    "ttr",
    "avg_sentence_length",
    "diff_ratio",
    "clause_density",
    "advanced_ratio",
    "flesch_kincaid",
    "gunning_fog",
    "verb_ratio",
    "noun_ratio",
    "adj_ratio",
    "avg_dep_distance",
    "word_count",
    "sentence_count",
    "sent_len_std",
    "punct_density",
    "stopword_ratio",
    "avg_word_length",
    "syllables_per_word",
    "cefr_a1_ratio",
    "cefr_a2_ratio",
    "cefr_b1_ratio",
    "cefr_b2_ratio",
    "cefr_c1_ratio",
    "cefr_c2_ratio"
]

PROFICIENCY_LABELS = {
    0: "Independent",
    1: "Instructional",
    2: "Frustration"
}

def extract_proficiency_features():
    """Extract features from ASAP2 student proficiency dataset"""
    base_dir = os.path.dirname(__file__)
    asap_path = os.path.join(base_dir, "ASAP2_train_sourcetexts.csv")
    
    if not os.path.exists(asap_path):
        print(f"Error: ASAP dataset not found at {asap_path}")
        return None
    
    print("Loading ASAP2 dataset for proficiency features...")
    X, y = load_asap_data(asap_path)
    
    print(f"Loaded {len(X)} samples with {X.shape[1]} features")
    
    # Create DataFrame
    df = pd.DataFrame(X, columns=FEATURE_NAMES)
    df['label_id'] = y
    df['label_name'] = df['label_id'].map(PROFICIENCY_LABELS)
    
    # Save to CSV
    output_path = os.path.join(base_dir, 'proficiency_features.csv')
    df.to_csv(output_path, index=False)
    print(f"✓ Proficiency features saved to: {output_path}")
    
    # Print statistics
    print("\n=== Proficiency Dataset Statistics ===")
    print(f"Total samples: {len(df)}")
    print("\nLabel distribution:")
    print(df['label_name'].value_counts())
    print("\nFeature summary (first 5 features):")
    print(df[FEATURE_NAMES[:5]].describe())
    
    return df

def create_feature_descriptions():
    """Create a reference CSV with feature descriptions"""
    base_dir = os.path.dirname(__file__)
    
    descriptions = {
        "feature_name": FEATURE_NAMES,
        "description": [
            "Type-Token Ratio (vocabulary richness)",
            "Average words per sentence",
            "Ratio of difficult words (>9 characters)",
            "Verbs per sentence (syntactic complexity)",
            "Ratio of advanced CEFR words (C1+C2)",
            "Flesch-Kincaid Grade Level",
            "Gunning Fog Index",
            "Ratio of verbs to total words",
            "Ratio of nouns to total words",
            "Ratio of adjectives to total words",
            "Average dependency distance (syntax complexity)",
            "Total word count",
            "Total sentence count",
            "Standard deviation of sentence lengths",
            "Punctuation density",
            "Stopword ratio",
            "Average word length in characters",
            "Average syllables per word",
            "Ratio of A1 level words (beginner)",
            "Ratio of A2 level words (elementary)",
            "Ratio of B1 level words (intermediate)",
            "Ratio of B2 level words (upper-intermediate)",
            "Ratio of C1 level words (advanced)",
            "Ratio of C2 level words (proficient)"
        ],
        "category": [
            "Lexical", "Syntactic", "Lexical", "Syntactic", "Lexical",
            "Readability", "Readability", "Syntactic", "Syntactic", "Syntactic",
            "Syntactic", "Basic", "Basic", "Syntactic", "Basic",
            "Lexical", "Lexical", "Lexical",
            "CEFR", "CEFR", "CEFR", "CEFR", "CEFR", "CEFR"
        ]
    }
    
    df_desc = pd.DataFrame(descriptions)
    output_path = os.path.join(base_dir, 'feature_descriptions.csv')
    df_desc.to_csv(output_path, index=False)
    print(f"✓ Feature descriptions saved to: {output_path}")
    
    return df_desc

def main():
    print("="*60)
    print("Feature Extraction for ReadTrack ML Models")
    print("="*60)

    print("\n[1/2] Extracting Student Proficiency Features...")
    extract_proficiency_features()

    print("\n[2/2] Creating Feature Descriptions...")
    create_feature_descriptions()

    print("\n" + "="*60)
    print("Done. Generated files:")
    print("  proficiency_features.csv  — student proficiency dataset with all features")
    print("  feature_descriptions.csv  — feature names and descriptions")
    print("\nFor complexity features, run:")
    print("  python scripts/build_complexity_features.py")

if __name__ == "__main__":
    main()
