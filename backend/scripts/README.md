# Backend Scripts

Run these from the `backend/` directory so imports resolve correctly:

```bash
cd backend
python scripts/train_models.py          # train both complexity + proficiency
python scripts/train_proficiency.py     # proficiency SVM only
python scripts/train_complexity.py      # complexity SVM only
python scripts/evaluate_models_full.py  # evaluate model accuracy
python scripts/extract_features_to_csv.py  # export feature vectors to CSV
```
