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

from train_utils import load_commonlit_features

def test_load_commonlit_features_returns_arrays():
    """Loads X and y from the real complexity_features.csv."""
    base_dir = os.path.join(os.path.dirname(__file__), '..')
    X, y = load_commonlit_features(base_dir)
    assert X is not None, "CSV file missing"
    assert X.ndim == 2
    assert X.shape[1] == 24   # exactly 24 features
    assert y.ndim == 1
    assert set(y).issubset({0, 1, 2})   # only valid label ids

def test_load_commonlit_features_missing_returns_none():
    """Returns (None, None) when the CSV is absent."""
    X, y = load_commonlit_features("/tmp/nonexistent_dir_xyz")
    assert X is None
    assert y is None

import json as _json

def _mock_heavy_deps():
    """Register lightweight stubs for modules not installed in the test venv."""
    import types, sys

    # Only mock if not already real
    def _stub(name, **attrs):
        if name not in sys.modules:
            m = types.ModuleType(name)
            for k, v in attrs.items():
                setattr(m, k, v)
            sys.modules[name] = m
        return sys.modules[name]

    # spacy
    spacy_mod = _stub('spacy')
    spacy_mod.prefer_gpu = lambda: None
    spacy_mod.load = lambda *a, **kw: None
    _stub('spacy.cli')

    # torch
    torch_mod = _stub('torch')
    torch_mod.cuda = types.SimpleNamespace(is_available=lambda: False)

    # sklearn and sub-modules
    _stub('sklearn')
    _stub('sklearn.svm', SVC=object)
    _stub('sklearn.preprocessing', RobustScaler=object)
    _stub('sklearn.metrics',
          classification_report=lambda *a, **kw: '',
          confusion_matrix=lambda *a, **kw: [])

    # svm_models — minimal stubs that satisfy main.py at module level
    import numpy as np

    class _FakeSVM:
        def __init__(self):
            self.model = None
            self.scaler = None
        def load(self, path):
            return False
        def train(self, X, y):
            from sklearn.svm import SVC as _SVC  # may be stub
            self.model = object()
            self.scaler = object()

    # Use real svm_models if sklearn available, else stub
    if 'svm_models' not in sys.modules:
        svm_mod = types.ModuleType('svm_models')
        svm_mod.TextComplexitySVM = _FakeSVM
        svm_mod.StudentProficiencySVM = _FakeSVM
        sys.modules['svm_models'] = svm_mod

    # Provide a real TextComplexitySVM that actually trains
    # We need to import the real one if possible
    try:
        import importlib
        real_svm = importlib.import_module('svm_models')
        sys.modules['svm_models'] = real_svm
    except Exception:
        pass  # keep the stub

    # fastapi
    import functools
    class _Router:
        def get(self, *a, **kw): return lambda f: f
        def post(self, *a, **kw): return lambda f: f
    class _FakeApp:
        def add_middleware(self, *a, **kw): pass
        def include_router(self, *a, **kw): pass
        def get(self, *a, **kw): return lambda f: f
        def post(self, *a, **kw): return lambda f: f
        def put(self, *a, **kw): return lambda f: f
        def delete(self, *a, **kw): return lambda f: f
    fa = _stub('fastapi', FastAPI=lambda **kw: _FakeApp(),
               HTTPException=Exception)
    _stub('fastapi.middleware.cors', CORSMiddleware=object)

    # pydantic
    class _BaseModel:
        def __init_subclass__(cls, **kw): pass
    _stub('pydantic', BaseModel=_BaseModel)

    # pypdf
    _stub('pypdf', PdfReader=object)

    # dotenv
    _stub('dotenv', load_dotenv=lambda *a, **kw: None)

    # supabase
    _stub('supabase', create_client=lambda *a, **kw: None)

    # ocr / tagalog_service / grammar_service
    _stub('ocr', extract_text_from_image=lambda *a, **kw: '')
    tl = _stub('tagalog_service', router=_Router())
    gr = _stub('grammar_service', router=_Router())


def test_retrain_complexity_model_runs(tmp_path):
    """retrain_complexity_model completes without error using real CSV + 1 teacher sample."""
    _mock_heavy_deps()

    # Build a temp teacher_samples.jsonl with one sample
    vector = [0.1] * 24
    samples_path = str(tmp_path / "teacher_samples.jsonl")
    with open(samples_path, 'w') as f:
        f.write(_json.dumps({"vector": vector, "label": "Literal"}) + "\n")

    # Remove cached main so mocks take effect
    sys.modules.pop('main', None)
    import main as m

    comp_path = os.path.join(os.path.dirname(__file__), '..', 'models', 'complexity_model.pkl')
    mtime_before = os.path.getmtime(comp_path) if os.path.exists(comp_path) else 0

    m.retrain_complexity_model(samples_path)

    # Model pkl must exist and be newer than before the call
    assert os.path.exists(comp_path)
    assert os.path.getmtime(comp_path) > mtime_before, "complexity_model.pkl was not updated"
    # Reload and verify structure
    import pickle
    with open(comp_path, 'rb') as f:
        data = pickle.load(f)
    assert 'model' in data and 'scaler' in data
