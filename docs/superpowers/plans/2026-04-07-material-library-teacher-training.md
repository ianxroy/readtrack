# Material Library Teacher-Verified Training Samples — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let teachers label uploaded materials with a complexity level, save the labeled sample, and immediately retrain the TextComplexitySVM model so future classifications improve.

**Architecture:** New backend helpers load both the pre-extracted CommonLit CSV and teacher-appended JSONL, combine them, and retrain the SVC inside a thread pool call behind a lock. The frontend adds a "Verify & Train" card to the DetailModal Analysis tab that calls the new endpoint.

**Tech Stack:** Python 3.9 / FastAPI / sklearn SVC / threading.Lock / asyncio.to_thread — React 18 / TypeScript / Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-04-07-material-library-teacher-training.md`

---

## Chunk 1: Backend — train_utils helpers

**Files:**
- Modify: `backend/train_utils.py`
- Create: `backend/tests/test_training.py`

### Task 1: `load_teacher_samples()`

- [ ] **Step 1: Create test file and write failing test**

Create `backend/tests/test_training.py`:

```python
import json
import os
import sys
import tempfile
import numpy as np
import pytest

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
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Volumes/Hanteck/Projects/readtrack/backend
.venv/bin/pytest tests/test_training.py -v
```

Expected: `ImportError` or `AttributeError` — `load_teacher_samples` does not exist yet.

- [ ] **Step 3: Implement `load_teacher_samples` in `train_utils.py`**

Add at the end of `backend/train_utils.py`:

```python
def load_teacher_samples(path: str):
    """Load teacher-verified samples from JSONL. Returns (X, y) numpy arrays."""
    X, y = [], []
    label_map = {"Literal": 0, "Inferential": 1, "Evaluative": 2}
    if not os.path.exists(path):
        return np.array(X), np.array(y, dtype=int)
    with open(path, 'r') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                sample = json.loads(line)
                X.append(sample['vector'])
                y.append(label_map[sample['label']])
            except Exception:
                continue
    return np.array(X), np.array(y, dtype=int)
```

Ensure `import json` is at the top of `train_utils.py` (add if missing).

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd /Volumes/Hanteck/Projects/readtrack/backend
.venv/bin/pytest tests/test_training.py::test_load_teacher_samples_missing_file tests/test_training.py::test_load_teacher_samples_valid tests/test_training.py::test_load_teacher_samples_corrupt_lines_skipped -v
```

Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/train_utils.py backend/tests/test_training.py
git commit -m "feat(training): add load_teacher_samples helper with tests"
```

---

### Task 2: `load_commonlit_features()`

- [ ] **Step 1: Write failing test — append to `test_training.py`**

```python
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
```

- [ ] **Step 2: Run to confirm fail**

```bash
.venv/bin/pytest tests/test_training.py::test_load_commonlit_features_returns_arrays tests/test_training.py::test_load_commonlit_features_missing_returns_none -v
```

Expected: `ImportError` — `load_commonlit_features` not defined.

- [ ] **Step 3: Implement `load_commonlit_features` in `train_utils.py`**

Add directly after `load_teacher_samples`:

```python
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
      Label col: label_id  (0=Literal, 1=Inferential, 2=Evaluative)
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
```

Ensure `import pandas as pd` is at the top of `train_utils.py` (already present — verify).

- [ ] **Step 4: Run tests — expect PASS**

```bash
.venv/bin/pytest tests/test_training.py -v
```

Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/train_utils.py backend/tests/test_training.py
git commit -m "feat(training): add load_commonlit_features helper with tests"
```

---

## Chunk 2: Backend — endpoint and retrain function

**Files:**
- Modify: `backend/main.py`

### Task 3: `retrain_complexity_model()` + `_retrain_lock`

- [ ] **Step 1: Write failing test — append to `test_training.py`**

```python
import json as _json
import tempfile

def test_retrain_complexity_model_runs(tmp_path):
    """retrain_complexity_model completes without error using real CSV + 1 teacher sample."""
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

    # Build a temp teacher_samples.jsonl with one sample
    from preprocessing import extract_features
    features = extract_features("The cat sat on the mat. It was sunny outside.")
    vector = features['vector'][0].tolist()
    samples_path = str(tmp_path / "teacher_samples.jsonl")
    with open(samples_path, 'w') as f:
        f.write(_json.dumps({"vector": vector, "label": "Literal"}) + "\n")

    # Import and call — must not raise
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
```

- [ ] **Step 2: Run to confirm fail**

```bash
.venv/bin/pytest tests/test_training.py::test_retrain_complexity_model_runs -v
```

Expected: `ImportError` — `retrain_complexity_model` not defined in `main`.

- [ ] **Step 3: Add lock, retrain function to `main.py`**

Find the imports block at the top of `backend/main.py` and add:
```python
import threading
import asyncio
```

Find where `complexity_model = TextComplexitySVM()` is defined (around line 101). Just above it, add:

```python
_retrain_lock = threading.Lock()
```

Then add the retrain function after the model loading block (after line ~80 where models are loaded):

```python
def retrain_complexity_model(samples_path: str):
    """Retrain TextComplexitySVM using CommonLit CSV + teacher samples. Thread-safe."""
    global complexity_model

    if not _retrain_lock.acquire(blocking=False):
        raise RuntimeError("Retrain already in progress — sample saved, will apply next retrain.")

    try:
        from train_utils import load_commonlit_features, load_teacher_samples

        X_orig, y_orig = load_commonlit_features(base_dir=os.path.dirname(__file__))
        if X_orig is None:
            print("Warning: complexity_features.csv missing — retraining on teacher samples only.")
            X_orig, y_orig = np.empty((0, 24)), np.array([], dtype=int)  # 2-D empty for safe concatenate

        X_teach, y_teach = load_teacher_samples(samples_path)

        if len(X_orig) == 0 and len(X_teach) == 0:
            raise RuntimeError("No training data available for retrain.")

        if len(X_teach) > 0 and len(X_orig) > 0:
            X = np.concatenate([X_orig, X_teach])
            y = np.concatenate([y_orig, y_teach])
        elif len(X_teach) > 0:
            X, y = X_teach, y_teach
        else:
            X, y = X_orig, y_orig

        new_model = TextComplexitySVM()
        new_model.train(X, y)

        comp_path = os.path.join(models_dir, 'complexity_model.pkl')
        with open(comp_path, 'wb') as f:
            pickle.dump({'model': new_model.model, 'scaler': new_model.scaler}, f)

        # Thread-safe global replacement — lock already held
        complexity_model = new_model
        print(f"[retrain] Done: {len(X_orig)} CommonLit + {len(X_teach)} teacher samples.")
    finally:
        _retrain_lock.release()
```

- [ ] **Step 4: Run test — expect PASS**

```bash
.venv/bin/pytest tests/test_training.py::test_retrain_complexity_model_runs -v
```

Expected: PASS (may take a few seconds — SVC retraining).

- [ ] **Step 5: Commit**

```bash
git add backend/main.py backend/tests/test_training.py
git commit -m "feat(training): add retrain_complexity_model with thread lock"
```

---

### Task 4: `POST /training/add-sample` endpoint

- [ ] **Step 1: Write failing test — append to `test_training.py`**

```python
from fastapi.testclient import TestClient

def test_add_sample_endpoint_valid(tmp_path, monkeypatch):
    """Valid request saves sample and returns ok status."""
    import main as m
    # Point samples file to temp dir to avoid polluting real data
    samples_path = str(tmp_path / "teacher_samples.jsonl")
    monkeypatch.setattr(m, "_teacher_samples_path", samples_path)

    client = TestClient(m.app)
    resp = client.post("/training/add-sample", json={
        "text": "The sun rises in the east. Birds sing every morning. Children play outside.",
        "level": "Literal"
    })
    assert resp.status_code == 200
    assert resp.json()["status"] in ("ok", "sample_saved")
    # Sample must be written to file
    assert os.path.exists(samples_path)
    with open(samples_path) as f:
        line = json.loads(f.readline())
    assert line["label"] == "Literal"
    assert len(line["vector"]) == 24

def test_add_sample_endpoint_invalid_level():
    """Unknown level returns 400."""
    import main as m
    client = TestClient(m.app)
    resp = client.post("/training/add-sample", json={
        "text": "Some text here to classify.",
        "level": "NotALevel"
    })
    assert resp.status_code == 400

def test_add_sample_endpoint_text_too_short():
    """Text under 20 chars returns 400."""
    import main as m
    client = TestClient(m.app)
    resp = client.post("/training/add-sample", json={
        "text": "Short.",
        "level": "Literal"
    })
    assert resp.status_code == 400
```

- [ ] **Step 2: Run to confirm fail**

```bash
.venv/bin/pytest tests/test_training.py::test_add_sample_endpoint_valid tests/test_training.py::test_add_sample_endpoint_invalid_level tests/test_training.py::test_add_sample_endpoint_text_too_short -v
```

Expected: FAIL — endpoint not defined.

- [ ] **Step 3: Add imports, module-level path variable, request model, and endpoint to `main.py`**

**3a.** Find the imports block at the top of `backend/main.py`. Confirm or add these imports:
```python
import json        # needed for json.dumps in endpoint — add if missing
import threading   # already added in Task 3
import asyncio     # already added in Task 3
```

**3b.** Find where `base_dir` or `models_dir` is defined near the top of `main.py`. Immediately after, add the module-level samples path variable so tests can monkeypatch it:

```python
_teacher_samples_path = os.path.join(os.path.dirname(__file__), 'data', 'teacher_samples.jsonl')
```

**3c.** Add the Pydantic request model near other `class.*BaseModel` definitions:

```python
class TrainingSampleRequest(BaseModel):
    text: str
    level: str  # "Literal" | "Inferential" | "Evaluative"
```

**3d.** Add the endpoint (place it near other `/training` or `/analyze` routes). Note `async def` + `asyncio.to_thread` — this is required so the event loop is not blocked during retraining:

```python
@app.post("/training/add-sample")
async def add_training_sample(request: TrainingSampleRequest):
    valid_levels = {"Literal", "Inferential", "Evaluative"}
    if request.level not in valid_levels:
        raise HTTPException(status_code=400, detail="Invalid level. Must be Literal, Inferential, or Evaluative.")
    if not request.text or len(request.text.strip()) < 20:
        raise HTTPException(status_code=400, detail="Text too short to be a useful training sample (minimum 20 characters).")

    features = extract_features(request.text)
    vector = features['vector'][0].tolist()

    with open(_teacher_samples_path, 'a') as f:
        f.write(json.dumps({"vector": vector, "label": request.level}) + "\n")

    try:
        await asyncio.to_thread(retrain_complexity_model, _teacher_samples_path)
    except RuntimeError as e:
        # Sample is saved; retrain skipped (concurrent lock or no data)
        return {"status": "sample_saved", "message": str(e)}

    return {"status": "ok", "message": "Sample saved and model retrained."}
```

- [ ] **Step 4: Run all tests — expect PASS**

```bash
.venv/bin/pytest tests/test_training.py -v
```

Expected: 8 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/main.py backend/tests/test_training.py
git commit -m "feat(training): add POST /training/add-sample endpoint"
```

---

## Chunk 3: Frontend — service + UI

**Files:**
- Modify: `services/pythonService.ts`
- Modify: `components/MaterialLibrary.tsx`

### Task 5: `addTrainingSampleAPI()`

- [ ] **Step 1: Add function to `services/pythonService.ts`**

Open `services/pythonService.ts`. Append at the end:

```typescript
export const addTrainingSampleAPI = async (text: string, level: string): Promise<void> => {
  const response = await fetch('http://localhost:8000/training/add-sample', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, level }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `Training request failed (${response.status})`);
  }
};
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Volumes/Hanteck/Projects/readtrack
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors related to `addTrainingSampleAPI`.

- [ ] **Step 3: Commit**

```bash
git add services/pythonService.ts
git commit -m "feat(training): add addTrainingSampleAPI service function"
```

---

### Task 6: Verify UI in `DetailModal`

- [ ] **Step 1: Add import for new service function**

In `components/MaterialLibrary.tsx`, find the import from `pythonService`:

```typescript
import { classifyTextComplexityAPI, extractTextFromImageAPI, detectLanguageAPI } from '../services/pythonService';
```

Add `addTrainingSampleAPI` to it:

```typescript
import { classifyTextComplexityAPI, extractTextFromImageAPI, detectLanguageAPI, addTrainingSampleAPI } from '../services/pythonService';
```

- [ ] **Step 2: Add verify state variables to `DetailModal`**

Inside `DetailModal`, after the existing state declarations (`editedText`, `isSavingText`, etc.), add:

```typescript
const [verifyLevel, setVerifyLevel] = useState<string>(material.complexityResult.level);
const [isVerifying, setIsVerifying] = useState(false);
const [verifyMessage, setVerifyMessage] = useState<string | null>(null);
const [verifyError, setVerifyError] = useState(false);
const [verifyDone, setVerifyDone] = useState(false);
```

- [ ] **Step 3: Add verify handler**

Inside `DetailModal`, after `handleSaveText`, add:

```typescript
const handleVerifyAndTrain = async () => {
  setIsVerifying(true);
  setVerifyMessage(null);
  setVerifyError(false);
  try {
    await addTrainingSampleAPI(material.text, verifyLevel);
    setVerifyDone(true);
    setVerifyMessage('Saved as training sample. Model updated.');
  } catch (e: any) {
    setVerifyError(true);
    setVerifyMessage(e.message || 'Could not save sample. Try again.');
  } finally {
    setIsVerifying(false);
  }
};
```

- [ ] **Step 4: Add verify card to Analysis tab**

In `DetailModal`, inside `{activeTab === 'analysis' && (...)}`, after the reasoning block (after the closing `</div>` of the "Why is this…" card), add:

```tsx
{/* Verify for Training */}
<div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4 space-y-3">
  <div className="text-[10px] font-black uppercase tracking-widest text-indigo-500">
    Verify Complexity Level
  </div>
  <p className="text-[11px] text-indigo-700 leading-relaxed">
    Help improve the model by confirming this material's correct complexity level.
  </p>

  {/* Level selector */}
  <div className="flex gap-2">
    {(['Literal', 'Inferential', 'Evaluative'] as const).map(lvl => (
      <button
        key={lvl}
        disabled={isVerifying || verifyDone}
        onClick={() => setVerifyLevel(lvl)}
        className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-colors ${
          verifyLevel === lvl
            ? 'bg-indigo-600 text-white border-indigo-600'
            : 'bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-100'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {lvl}
      </button>
    ))}
  </div>

  {/* Action row */}
  <div className="flex items-center gap-3">
    <button
      onClick={handleVerifyAndTrain}
      disabled={isVerifying || verifyDone}
      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
        isVerifying || verifyDone
          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
          : 'bg-indigo-600 text-white hover:bg-indigo-700'
      }`}
    >
      {isVerifying ? 'Training model…' : verifyDone ? '✓ Verified' : 'Verify & Train'}
    </button>
    {verifyMessage && (
      <p className={`text-[10px] font-medium ${verifyError ? 'text-red-500' : 'text-indigo-600'}`}>
        {verifyMessage}
      </p>
    )}
  </div>
</div>
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd /Volumes/Hanteck/Projects/readtrack
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 6: Manual smoke test**

1. Start backend: `cd backend && .venv/bin/uvicorn main:app --reload`
2. Start frontend: `npm run dev`
3. Open Material Library → upload any text material
4. Open it → go to **Analysis** tab
5. Confirm level buttons appear pre-filled with AI prediction
6. Change to a different level, click **Verify & Train**
7. Expect: button shows "Training model…" then "✓ Verified", success message appears
8. Check backend logs: should print `[retrain] Done: N CommonLit + 1 teacher samples.`
9. Check `backend/data/teacher_samples.jsonl` — should have one new line with `vector` (24 values) and `label`

- [ ] **Step 7: Commit**

```bash
git add components/MaterialLibrary.tsx services/pythonService.ts
git commit -m "feat(training): add Verify & Train UI to DetailModal Analysis tab"
```

---

## Final: Run all backend tests

- [ ] **Run full test suite**

```bash
cd /Volumes/Hanteck/Projects/readtrack/backend
.venv/bin/pytest tests/test_training.py -v
```

Expected: 8 passed.
