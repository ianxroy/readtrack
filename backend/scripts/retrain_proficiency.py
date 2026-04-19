"""
Retrain the proficiency model with balanced class weights and fixed score mapping.
Run from backend/ directory:
    python scripts/retrain_proficiency.py
"""
import sys, os, pickle
import numpy as np

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND_DIR)

from sklearn.svm import SVC
from sklearn.preprocessing import RobustScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix
from train_utils import load_asap_data, save_model_metrics

ASAP_PATH   = os.path.join(BACKEND_DIR, "ASAP2_train_sourcetexts.csv")
MODELS_DIR  = os.path.join(BACKEND_DIR, "models")
OUTPUT_PKL  = os.path.join(MODELS_DIR, "proficiency_model.pkl")
OUTPUT_EN   = os.path.join(MODELS_DIR, "proficiency_model_en.pkl")

# Delete stale cache first so load_asap_data re-extracts with the new score mapping
cache = ASAP_PATH.replace(".csv", "_features.pkl")
if os.path.exists(cache):
    os.remove(cache)
    print(f"Deleted stale feature cache: {cache}")

print("Loading ASAP2 dataset with new score mapping (this may take a few minutes)…")
X, y_int = load_asap_data(ASAP_PATH)

# Map int labels → string labels expected by svm_models.py
label_names = {0: "Mahusay", 1: "Papaunlad", 2: "Nagsisimula"}
y = np.array([label_names[i] for i in y_int])

unique, counts = np.unique(y, return_counts=True)
print("\nClass distribution after new mapping:")
for cls, cnt in zip(unique, counts):
    print(f"  {cls}: {cnt}  ({cnt/len(y)*100:.1f}%)")

# 70/30 split
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.30, random_state=42, stratify=y
)
print(f"\nTrain: {len(X_train)}  Test: {len(X_test)}")

scaler = RobustScaler()
X_train_s = scaler.fit_transform(X_train)
X_test_s  = scaler.transform(X_test)

print("\nTraining SVC with class_weight='balanced'…")
model = SVC(kernel="rbf", C=10, gamma="scale", class_weight="balanced", random_state=42, probability=True)
model.fit(X_train_s, y_train)

y_pred = model.predict(X_test_s)
acc = (y_pred == y_test).mean()

print(f"\nTest accuracy: {acc*100:.1f}%")
print("\nClassification report:")
labels_order = ["Mahusay", "Papaunlad", "Nagsisimula"]
print(classification_report(y_test, y_pred, labels=labels_order))
print("Confusion matrix (rows=true, cols=pred):")
print(confusion_matrix(y_test, y_pred, labels=labels_order))

# Save models
payload = {"model": model, "scaler": scaler}
os.makedirs(MODELS_DIR, exist_ok=True)
with open(OUTPUT_PKL, "wb") as f:
    pickle.dump(payload, f)
with open(OUTPUT_EN, "wb") as f:
    pickle.dump(payload, f)

print(f"\nSaved → {OUTPUT_PKL}")
print(f"Saved → {OUTPUT_EN}")

# Persist metrics
from sklearn.metrics import precision_recall_fscore_support
p, r, f, s = precision_recall_fscore_support(y_test, y_pred, labels=labels_order, average="macro")
matrix = confusion_matrix(y_test, y_pred, labels=labels_order).tolist()
save_model_metrics("proficiency", {
    "accuracy": f"{acc*100:.1f}%",
    "f1": round(float(f), 4),
    "precision": round(float(p), 4),
    "recall": round(float(r), 4),
    "labels": labels_order,
    "matrix": matrix,
})
print("Metrics saved to evaluation_metrics.json")
