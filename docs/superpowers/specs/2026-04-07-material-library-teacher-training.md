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

### New endpoint

```python
class TrainingSampleRequest(BaseModel):
    text: str
    level: str  # "Literal" | "Inferential" | "Evaluative"

@app.post("/training/add-sample")
def add_training_sample(request: TrainingSampleRequest):
    valid_levels = {"Literal", "Inferential", "Evaluative"}
    if request.level not in valid_levels:
        raise HTTPException(status_code=400, detail=f"Invalid level. Must be one of {valid_levels}")
    
    features = extract_features(request.text)
    vector = features['vector'][0].tolist()
    
    samples_path = os.path.join(base_dir, 'data', 'teacher_samples.jsonl')
    with open(samples_path, 'a') as f:
        f.write(json.dumps({"vector": vector, "label": request.level}) + "\n")
    
    retrain_complexity_model(samples_path)
    return {"status": "ok", "message": f"Sample saved and model retrained."}
```

### Retrain function

```python
def retrain_complexity_model(samples_path: str):
    global complexity_model
    from train_utils import load_commonlit_features, load_teacher_samples
    
    X_orig, y_orig = load_commonlit_features()   # from complexity_features.csv
    X_teach, y_teach = load_teacher_samples(samples_path)
    
    if len(X_teach) > 0:
        X = np.concatenate([X_orig, X_teach])
        y = np.concatenate([y_orig, y_teach])
    else:
        X, y = X_orig, y_orig
    
    new_model = TextComplexitySVM()
    new_model.train(X, y)
    
    comp_path = os.path.join(models_dir, 'complexity_model.pkl')
    with open(comp_path, 'wb') as f:
        pickle.dump({'model': new_model.model, 'scaler': new_model.scaler}, f)
    
    complexity_model = new_model
    print(f"Model retrained: {len(X_orig)} original + {len(X_teach)} teacher samples")
```

Note: `load_commonlit_features()` is a new helper in `train_utils.py` that reads `complexity_features.csv` directly (X, y) without the full pipeline used during initial training.

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
- Retraining is synchronous — the endpoint blocks until complete (~1–3s for small sample counts)
- If retraining fails, the sample is still saved to JSONL so it contributes on the next retrain
- The original CommonLit data is never modified
