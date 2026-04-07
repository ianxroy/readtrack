# Material Library — Teacher-Verified Training Samples

**Date:** 2026-04-07
**Status:** Approved

## Overview

Teachers can verify the correct complexity level of an uploaded material and immediately contribute it as a labeled training sample. The backend retrains the `TextComplexitySVM` model on each verified submission, combining the original CommonLit training data with all accumulated teacher samples.

## Goals

- Allow teachers to confirm or override the AI's complexity prediction for any material
- Use teacher-labeled samples to continuously improve the complexity classifier
- Retrain automatically on each verified submission — no manual trigger needed
- Keep the improved model persistent (saved to disk, reloaded on restart)

## Data Flow

1. Teacher opens a material in `DetailModal` (Analysis tab)
2. Teacher selects the correct complexity level (pre-filled with AI prediction) and clicks **Verify & Train**
3. Frontend calls `POST /training/add-sample` with `{ text, level }`
4. Backend extracts features → appends sample to `teacher_samples.jsonl` → retrains → saves pkl → replaces in-memory model
5. Frontend shows success state; button is disabled to prevent duplicate submissions in the same session

## Frontend — `components/MaterialLibrary.tsx`

Add a "Verify for Training" card to the **Analysis tab** of `DetailModal`.

**States:**
- Default: level buttons pre-filled with AI prediction, "Verify & Train" button enabled
- Loading: "Training model…" — all controls disabled
- Success: "✓ Saved as training sample" — button disabled for the session
- Error: error message shown inline

**Level selection:** Three pill buttons — `Literal`, `Inferential`, `Evaluative`. Selecting one highlights it. Pre-selected to the current `material.complexityResult.level`.

**New state variables in `DetailModal`:**
```ts
const [verifyLevel, setVerifyLevel] = useState<string>(material.complexityResult.level)
const [isVerifying, setIsVerifying] = useState(false)
const [verifyMessage, setVerifyMessage] = useState<string | null>(null)
const [verifyDone, setVerifyDone] = useState(false)
```

## Frontend — `services/pythonService.ts`

```ts
export const addTrainingSampleAPI = async (text: string, level: string): Promise<void> => {
  const response = await fetch('http://localhost:8000/training/add-sample', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, level }),
  })
  if (!response.ok) {
    const err = await response.json()
    throw new Error(err.detail || 'Training failed')
  }
}
```

## Backend — `train_utils.py`

Add `load_teacher_samples()`:

```python
def load_teacher_samples(path: str):
    """Load teacher-verified samples from JSONL. Returns (X, y) numpy arrays."""
    import json, numpy as np
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

## Backend — `main.py`

### Thread safety

Retraining is CPU-bound and can block for several seconds. Two mitigations are required:

1. **Lock to prevent concurrent retrains:** A `threading.Lock` (`_retrain_lock`) is acquired before retraining. If a retrain is already running, the endpoint returns immediately with a `423 Locked` response rather than queuing a second retrain.
2. **Lock on global replacement:** The `complexity_model = new_model` assignment is wrapped in the same lock to prevent a prediction request reading a partially-replaced object mid-assignment.
3. **Run in thread pool:** The endpoint is `async` and calls `await asyncio.to_thread(retrain_complexity_model, samples_path)` so FastAPI's event loop is not blocked during the CPU-bound work.

### Retrain function

```python
import threading, asyncio

_retrain_lock = threading.Lock()

def retrain_complexity_model(samples_path: str):
    global complexity_model

    if not _retrain_lock.acquire(blocking=False):
        raise RuntimeError("Retrain already in progress")

    try:
        from train_utils import load_commonlit_features, load_teacher_samples

        X_orig, y_orig = load_commonlit_features()  # from complexity_features.csv
        if X_orig is None:
            # CSV missing — proceed with teacher samples only if we have enough
            X_orig, y_orig = np.array([]), np.array([], dtype=int)

        X_teach, y_teach = load_teacher_samples(samples_path)

        if len(X_orig) == 0 and len(X_teach) == 0:
            raise RuntimeError("No training data available")

        X = np.concatenate([X_orig, X_teach]) if len(X_teach) > 0 else X_orig
        y = np.concatenate([y_orig, y_teach]) if len(y_teach) > 0 else y_orig

        new_model = TextComplexitySVM()
        new_model.train(X, y)

        comp_path = os.path.join(models_dir, 'complexity_model.pkl')
        with open(comp_path, 'wb') as f:
            pickle.dump({'model': new_model.model, 'scaler': new_model.scaler}, f)

        # Thread-safe global replacement — lock already held
        complexity_model = new_model
        print(f"Model retrained: {len(X_orig)} original + {len(X_teach)} teacher samples")
    finally:
        _retrain_lock.release()
```

The endpoint becomes:
```python
@app.post("/training/add-sample")
async def add_training_sample(request: TrainingSampleRequest):
    valid_levels = {"Literal", "Inferential", "Evaluative"}
    if request.level not in valid_levels:
        raise HTTPException(status_code=400, detail=f"Invalid level.")
    if not request.text or len(request.text.strip()) < 20:
        raise HTTPException(status_code=400, detail="Text too short to be a useful training sample.")

    features = extract_features(request.text)
    vector = features['vector'][0].tolist()

    samples_path = os.path.join(base_dir, 'data', 'teacher_samples.jsonl')
    with open(samples_path, 'a') as f:
        f.write(json.dumps({"vector": vector, "label": request.level}) + "\n")

    try:
        await asyncio.to_thread(retrain_complexity_model, samples_path)
    except RuntimeError as e:
        # Sample is saved; retrain failed or was skipped (concurrent lock)
        return {"status": "sample_saved", "message": str(e)}

    return {"status": "ok", "message": "Sample saved and model retrained."}
```

### `load_commonlit_features()` in `train_utils.py`

CSV schema (`backend/data/complexity_features.csv`):
- **Feature columns (24):** `ttr, avg_sentence_length, diff_ratio, clause_density, advanced_ratio, flesch_kincaid, gunning_fog, verb_ratio, noun_ratio, adj_ratio, avg_dep_distance, word_count, sentence_count, sent_len_std, punct_density, stopword_ratio, avg_word_length, syllables_per_word, cefr_a1_ratio, cefr_a2_ratio, cefr_b1_ratio, cefr_b2_ratio, cefr_c1_ratio, cefr_c2_ratio`
- **Label column:** `label_id` (int: 0=Literal, 1=Inferential, 2=Evaluative)
- **Ignored column:** `label_name` (string, human-readable)

```python
def load_commonlit_features(base_dir: str = None):
    """Load pre-extracted CommonLit feature vectors. Returns (X, y) or (None, None) if file missing."""
    import pandas as pd, numpy as np
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

The feature column order in the CSV matches the order produced by `extract_features()['vector']`, so teacher sample vectors and CommonLit vectors are directly concatenable.

## File Changes Summary

| File | Change |
|------|--------|
| `components/MaterialLibrary.tsx` | Add verify UI card in `DetailModal` Analysis tab |
| `services/pythonService.ts` | Add `addTrainingSampleAPI()` |
| `backend/main.py` | Add `TrainingSampleRequest`, `add_training_sample` endpoint, `retrain_complexity_model()` |
| `backend/train_utils.py` | Add `load_teacher_samples()`, `load_commonlit_features()` |
| `backend/data/teacher_samples.jsonl` | Created on first submission (auto) |

## Constraints

- `teacher_samples.jsonl` is append-only; no deduplication in v1
- Retraining runs in a thread pool (`asyncio.to_thread`) — the FastAPI event loop is not blocked
- Concurrent retrain calls are rejected with a `RuntimeError`; the sample is still saved so it takes effect on the next successful retrain
- If `complexity_features.csv` is missing, retraining proceeds on teacher samples only (logged as a warning)
- `verifyDone` state lives in `DetailModal` — closing and reopening the modal resets it, allowing resubmission of the same material. Acceptable in v1 (duplicates are low-risk; JSONL deduplication can be added later)
- The original CommonLit data and `complexity_features.csv` are never modified
