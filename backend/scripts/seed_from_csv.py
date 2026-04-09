"""
Seed the complexity model from labeled_passages.csv.

Run with backend running:
  python backend/scripts/seed_from_csv.py

Optional: filter by label or source
  python backend/scripts/seed_from_csv.py --label Inferential
  python backend/scripts/seed_from_csv.py --source "Phil-IRI G7"
"""

import csv
import requests
import sys
import time
import argparse
import os

API_URL = "http://localhost:8000/training/add-sample"
CSV_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'labeled_passages.csv')


def submit(row: dict) -> bool:
    try:
        resp = requests.post(
            API_URL,
            json={"text": row["text"], "level": row["label"]},
            timeout=60,
        )
        if resp.status_code == 200:
            status = resp.json().get("status", "?")
            print(f"  ✓ [{row['label']:12}] {row['name']}  ({status})")
            return True
        else:
            print(f"  ✗ [{row['label']:12}] {row['name']}  HTTP {resp.status_code}: {resp.text[:80]}")
            return False
    except requests.exceptions.ConnectionError:
        print("  ERROR: Cannot connect to backend. Is it running on http://localhost:8000?")
        return False
    except Exception as e:
        print(f"  ERROR: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(description="Seed complexity model from labeled_passages.csv")
    parser.add_argument("--label", help="Filter by label (Literal, Inferential, Evaluative)")
    parser.add_argument("--source", help="Filter by source (partial match)")
    args = parser.parse_args()

    csv_path = os.path.abspath(CSV_PATH)
    if not os.path.exists(csv_path):
        print(f"ERROR: CSV not found at {csv_path}")
        sys.exit(1)

    with open(csv_path, newline='', encoding='utf-8') as f:
        rows = list(csv.DictReader(f))

    if args.label:
        rows = [r for r in rows if r["label"].lower() == args.label.lower()]
    if args.source:
        rows = [r for r in rows if args.source.lower() in r["source"].lower()]

    if not rows:
        print("No passages matched the filter.")
        sys.exit(0)

    counts = {}
    for r in rows:
        counts[r["label"]] = counts.get(r["label"], 0) + 1

    print(f"\nSeeding {len(rows)} passages → {API_URL}")
    print("  " + "  ".join(f"{lbl}: {n}" for lbl, n in sorted(counts.items())) + "\n")

    ok = 0
    for row in rows:
        if submit(row):
            ok += 1
        time.sleep(0.3)

    print(f"\nDone: {ok}/{len(rows)} submitted successfully.")
    if ok < len(rows):
        sys.exit(1)


if __name__ == "__main__":
    main()
