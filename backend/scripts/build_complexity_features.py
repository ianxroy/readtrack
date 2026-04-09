"""
Extract features from labeled_passages.csv and write complexity_features.csv.

This replaces the FK-threshold auto-labeled CommonLit data with human-verified
Phil-IRI grade-level labels. Run this once (and re-run whenever labeled_passages.csv
is updated) before training or retraining the complexity model.

Usage:
  cd backend
  python scripts/build_complexity_features.py
"""

import csv
import os
import sys
import pandas as pd

# Allow importing backend modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from preprocessing import extract_features

LABELED_CSV  = os.path.join(os.path.dirname(__file__), '..', 'data', 'labeled_passages.csv')
FEATURES_CSV = os.path.join(os.path.dirname(__file__), '..', 'data', 'complexity_features.csv')

LABEL_MAP = {"Literal": 0, "Inferential": 1, "Evaluative": 2}

FEATURE_NAMES = [
    'ttr', 'avg_sentence_length', 'diff_ratio', 'clause_density',
    'advanced_ratio', 'flesch_kincaid', 'gunning_fog', 'verb_ratio',
    'noun_ratio', 'adj_ratio', 'avg_dep_distance', 'word_count',
    'sentence_count', 'sent_len_std', 'punct_density', 'stopword_ratio',
    'avg_word_length', 'syllables_per_word',
    'cefr_a1_ratio', 'cefr_a2_ratio', 'cefr_b1_ratio', 'cefr_b2_ratio',
    'cefr_c1_ratio', 'cefr_c2_ratio',
]


def main():
    labeled_path = os.path.abspath(LABELED_CSV)
    features_path = os.path.abspath(FEATURES_CSV)

    if not os.path.exists(labeled_path):
        print(f"ERROR: {labeled_path} not found.")
        sys.exit(1)

    with open(labeled_path, newline='', encoding='utf-8') as f:
        passages = list(csv.DictReader(f))

    print(f"\nExtracting features from {len(passages)} labeled passages...\n")

    rows = []
    failed = 0
    for p in passages:
        try:
            feat = extract_features(p['text'])
            vector = feat['vector'][0]
            if len(vector) != len(FEATURE_NAMES):
                raise ValueError(f"Expected {len(FEATURE_NAMES)} features, got {len(vector)}")
            row = dict(zip(FEATURE_NAMES, vector))
            row['label_id']   = LABEL_MAP[p['label']]
            row['label_name'] = p['label']
            rows.append(row)
            print(f"  ✓ [{p['label']:12}] {p['name']}")
        except Exception as e:
            print(f"  ✗ [{p.get('label','?'):12}] {p.get('name','?')}  — {e}")
            failed += 1

    if not rows:
        print("\nERROR: No features extracted. Check preprocessing module.")
        sys.exit(1)

    df = pd.DataFrame(rows, columns=FEATURE_NAMES + ['label_id', 'label_name'])
    df.to_csv(features_path, index=False)

    counts = df['label_name'].value_counts().to_dict()
    print(f"\nWrote {len(df)} rows to complexity_features.csv")
    print(f"  Label distribution: {counts}")
    if failed:
        print(f"  Skipped (errors): {failed}")


if __name__ == "__main__":
    main()
