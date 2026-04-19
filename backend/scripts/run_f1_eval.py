"""
F1 evaluation script for ReadTrack.

What this script now reports:
1) Text complexity metrics (full set + held-out split)
2) Essay proficiency metrics for two paths:
   - Heuristic path (StudentProficiencySVM.predict)
   - Strict ML-only path (StudentProficiencySVM.ml_predict)
3) Per-language breakdowns (English, Filipino)

Run from backend/:
    python scripts/run_f1_eval.py
"""

import datetime
import json
import os
import sys

from sklearn.metrics import classification_report, confusion_matrix

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECT_ROOT = os.path.dirname(BACKEND_DIR)
sys.path.insert(0, BACKEND_DIR)

from preprocessing import extract_features
from svm_models import StudentProficiencySVM, TextComplexitySVM


MATERIAL_LABELS = ["Independent", "Instructional", "Frustration"]
ESSAY_LABELS = ["Nagsisimula", "Papaunlad", "Mahusay"]


def normalize_material_label(raw_label):
    norm = {
        "Independent": "Independent",
        "Instructional": "Instructional",
        "Frustration": "Frustration",
        "Madali": "Independent",
        "Katamtaman": "Instructional",
        "Mahirap": "Frustration",
        "Literal": "Independent",
        "Inferential": "Instructional",
        "Evaluative": "Frustration",
    }
    return norm.get(raw_label, raw_label)


def normalize_essay_label(raw_label):
    norm = {
        "Mahusay": "Mahusay",
        "Papaunlad": "Papaunlad",
        "Nagsisimula": "Nagsisimula",
        "Proficient": "Mahusay",
        "Developing": "Papaunlad",
        "Beginning": "Nagsisimula",
    }
    return norm.get(raw_label, raw_label)


def print_header(title):
    print("\n" + "=" * 72)
    print(title)
    print("=" * 72)


def get_protocol(eval_data):
    """Load explicit split protocol, or fall back to test=all if absent."""
    protocol_path = os.path.join(PROJECT_ROOT, "docs", "f1_eval_protocol.json")

    default = {
        "description": "Fallback protocol: no explicit split file found; all items are test.",
        "reading_materials": {
            "calibration_ids": [],
            "test_ids": [m["id"] for m in eval_data["reading_materials"]],
        },
        "student_essays": {
            "calibration_ids": [],
            "test_ids": [e["id"] for e in eval_data["student_essays"]],
        },
        "source": "fallback",
    }

    if not os.path.exists(protocol_path):
        return default, protocol_path

    with open(protocol_path, "r", encoding="utf-8") as f:
        loaded = json.load(f)

    loaded["source"] = "docs/f1_eval_protocol.json"
    return loaded, protocol_path


def assign_split(item_id, calibration_ids, test_ids):
    if item_id in calibration_ids:
        return "calibration"
    if item_id in test_ids:
        return "test"
    return "unused"


def compute_metrics(y_true, y_pred, labels):
    if not y_true:
        return {
            "count": 0,
            "accuracy": 0.0,
            "macro_precision": 0.0,
            "macro_recall": 0.0,
            "macro_f1": 0.0,
            "classification_report": {},
            "confusion_matrix": [],
        }

    report = classification_report(
        y_true,
        y_pred,
        labels=labels,
        target_names=labels,
        output_dict=True,
        zero_division=0,
    )
    cm = confusion_matrix(y_true, y_pred, labels=labels)
    correct = sum(1 for a, b in zip(y_true, y_pred) if a == b)
    count = len(y_true)

    return {
        "count": count,
        "accuracy": round(correct / count, 4),
        "macro_precision": round(report["macro avg"]["precision"], 4),
        "macro_recall": round(report["macro avg"]["recall"], 4),
        "macro_f1": round(report["macro avg"]["f1-score"], 4),
        "classification_report": report,
        "confusion_matrix": cm.tolist(),
    }


def summarize_records(records, pred_key, labels):
    full = [r for r in records if r["split"] in ("calibration", "test")]
    calibration = [r for r in records if r["split"] == "calibration"]
    test = [r for r in records if r["split"] == "test"]

    def metric_for(rows):
        return compute_metrics(
            [r["ground_truth"] for r in rows],
            [r[pred_key] for r in rows],
            labels,
        )

    by_language = {}
    for lang in ["english", "filipino"]:
        lang_rows = [r for r in full if r["language"] == lang]
        by_language[lang] = metric_for(lang_rows)

    return {
        "full": metric_for(full),
        "calibration": metric_for(calibration),
        "test": metric_for(test),
        "by_language": by_language,
    }


def print_metric_block(name, metrics):
    print(f"\n{name}")
    print("-" * len(name))
    for split in ["full", "calibration", "test"]:
        m = metrics[split]
        print(
            f"  {split:12s} n={m['count']:2d} | "
            f"acc={m['accuracy']:.4f} "
            f"prec={m['macro_precision']:.4f} "
            f"rec={m['macro_recall']:.4f} "
            f"f1={m['macro_f1']:.4f}"
        )

    print("  by_language:")
    for lang in ["english", "filipino"]:
        m = metrics["by_language"][lang]
        print(
            f"    {lang:9s} n={m['count']:2d} | "
            f"acc={m['accuracy']:.4f} "
            f"f1={m['macro_f1']:.4f}"
        )


def main():
    # Load models
    complexity_model = TextComplexitySVM()
    complexity_model.load(os.path.join(BACKEND_DIR, "models", "complexity_model.pkl"))

    proficiency_model = StudentProficiencySVM()
    proficiency_model.load(os.path.join(BACKEND_DIR, "models", "proficiency_model.pkl"))

    # Load evaluation data
    eval_path = os.path.join(PROJECT_ROOT, "docs", "f1_evaluation_set.json")
    with open(eval_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    protocol, protocol_path = get_protocol(data)

    mat_cal = set(protocol["reading_materials"].get("calibration_ids", []))
    mat_test = set(protocol["reading_materials"].get("test_ids", []))
    ess_cal = set(protocol["student_essays"].get("calibration_ids", []))
    ess_test = set(protocol["student_essays"].get("test_ids", []))

    # Evaluate reading materials
    print_header("TEXT COMPLEXITY ANALYSIS")
    material_records = []

    for item in data["reading_materials"]:
        lang_code = "en" if item["language"] == "english" else "tl"
        split = assign_split(item["id"], mat_cal, mat_test)
        try:
            features = extract_features(item["text"], language=lang_code)
            result = complexity_model.predict(features, item["text"])
            pred = normalize_material_label(result.get("level", "Unknown"))
            status = "✓" if pred == item["ground_truth"] else "✗"
            print(
                f"  {status} [{item['id']}] split={split:11s} "
                f"GT={item['ground_truth']:15s} Pred={pred:15s} lang={lang_code}"
            )
        except Exception as exc:
            pred = "Unknown"
            print(f"  ERROR [{item['id']}]: {exc}")

        material_records.append(
            {
                "id": item["id"],
                "language": item["language"],
                "ground_truth": item["ground_truth"],
                "predicted": pred,
                "correct": pred == item["ground_truth"],
                "split": split,
            }
        )

    # Evaluate essays (heuristic + strict ML-only)
    print_header("ESSAY PROFICIENCY SCORING (DUAL PATH)")
    essay_records = []

    for item in data["student_essays"]:
        lang_code = "en" if item["language"] == "english" else "tl"
        split = assign_split(item["id"], ess_cal, ess_test)

        heuristic_pred = "Unknown"
        ml_pred = "Unknown"

        try:
            features = extract_features(item["text"], language=lang_code)

            # Production path (heuristic + calibrated thresholds)
            h = proficiency_model.predict(features, item["text"], language=lang_code)
            heuristic_pred = normalize_essay_label(
                h.get("proficiency", h.get("level", "Unknown"))
            )

            # Strict ML-only path (bypass heuristic thresholds)
            ml_raw = proficiency_model.ml_predict(features["vector"])
            ml_pred = normalize_essay_label(ml_raw if ml_raw is not None else "Unknown")

            h_status = "✓" if heuristic_pred == item["ground_truth"] else "✗"
            m_status = "✓" if ml_pred == item["ground_truth"] else "✗"
            print(
                f"  [{item['id']}] split={split:11s} GT={item['ground_truth']:12s} "
                f"H={heuristic_pred:12s} ({h_status}) "
                f"ML={ml_pred:12s} ({m_status}) lang={lang_code}"
            )
        except Exception as exc:
            print(f"  ERROR [{item['id']}]: {exc}")

        essay_records.append(
            {
                "id": item["id"],
                "language": item["language"],
                "ground_truth": item["ground_truth"],
                "heuristic_predicted": heuristic_pred,
                "heuristic_correct": heuristic_pred == item["ground_truth"],
                "ml_predicted": ml_pred,
                "ml_correct": ml_pred == item["ground_truth"],
                "split": split,
            }
        )

    # Aggregate metrics
    material_metrics = summarize_records(material_records, "predicted", MATERIAL_LABELS)
    essay_heur_metrics = summarize_records(essay_records, "heuristic_predicted", ESSAY_LABELS)
    essay_ml_metrics = summarize_records(essay_records, "ml_predicted", ESSAY_LABELS)

    print_header("METRIC SUMMARY")
    print_metric_block("Reading Materials", material_metrics)
    print_metric_block("Essay Proficiency (Heuristic Path)", essay_heur_metrics)
    print_metric_block("Essay Proficiency (Strict ML-only)", essay_ml_metrics)

    # Persist expanded results
    results = {
        "generated_at_utc": datetime.datetime.utcnow().isoformat() + "Z",
        "evaluation_set": os.path.relpath(eval_path, PROJECT_ROOT),
        "protocol": {
            "path": os.path.relpath(protocol_path, PROJECT_ROOT),
            "description": protocol.get("description", ""),
            "source": protocol.get("source", "fallback"),
            "reading_materials": protocol.get("reading_materials", {}),
            "student_essays": protocol.get("student_essays", {}),
        },
        "records": {
            "materials": material_records,
            "essays": essay_records,
        },
        "metrics": {
            "materials": material_metrics,
            "essays": {
                "heuristic_path": essay_heur_metrics,
                "strict_ml_only": essay_ml_metrics,
            },
        },
        "notes": [
            "Heuristic essay path uses StudentProficiencySVM.predict (calibrated thresholds).",
            "Strict ML-only essay path uses StudentProficiencySVM.ml_predict on extracted vectors.",
            "Held-out metrics are computed from docs/f1_eval_protocol.json when available.",
        ],
    }

    out_path = os.path.join(PROJECT_ROOT, "docs", "f1_eval_results.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)

    print(f"\nResults saved to: {out_path}")


if __name__ == "__main__":
    main()
