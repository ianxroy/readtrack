import json
import os
import sys
import tempfile
import types
import numpy as np
import pytest

# Mock preprocessing before importing train_utils
preprocessing = types.ModuleType('preprocessing')
preprocessing.extract_features = lambda x: {'vector': [0]*24}
sys.modules['preprocessing'] = preprocessing

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from train_utils import load_teacher_samples

def test_load_teacher_samples_missing_file():
    """Returns empty arrays when file does not exist."""
    X, y = load_teacher_samples("/tmp/does_not_exist_abc123.jsonl")
    assert X.shape == (0,)
    assert y.shape == (0,)

def test_load_teacher_samples_valid():
    """Loads vectors and maps labels to ints correctly."""
    sample = {"vector": [0.1] * 24, "label": "Literal"}
    with tempfile.NamedTemporaryFile(mode='w', suffix='.jsonl', delete=False) as f:
        f.write(json.dumps(sample) + "\n")
        f.write(json.dumps({"vector": [0.5] * 24, "label": "Evaluative"}) + "\n")
        path = f.name
    try:
        X, y = load_teacher_samples(path)
        assert X.shape == (2, 24)
        assert y.tolist() == [0, 2]  # Literal=0, Evaluative=2
    finally:
        os.unlink(path)

def test_load_teacher_samples_corrupt_lines_skipped():
    """Corrupt JSONL lines are skipped gracefully."""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.jsonl', delete=False) as f:
        f.write("not valid json\n")
        f.write(json.dumps({"vector": [0.2] * 24, "label": "Inferential"}) + "\n")
        f.write("\n")  # blank line
        path = f.name
    try:
        X, y = load_teacher_samples(path)
        assert X.shape == (1, 24)
        assert y.tolist() == [1]  # Inferential=1
    finally:
        os.unlink(path)
