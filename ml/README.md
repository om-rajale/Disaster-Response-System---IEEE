# AEDIRS v2 — ML Module

## Setup
```bash
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
```

## Run order
```bash
python src/download_data.py     # pulls Kaggle + HumAID data (needs your Kaggle API key)
python src/eda.py               # prints data-quality report
python src/preprocessing.py     # cleans data -> ml/data/processed/
python src/train_classification.py   # trains + evaluates + saves model
python src/priority_scoring.py       # demo of rule-based priority scorer
python src/pipeline_demo.py          # full end-to-end demo (classification + priority)
```

## Outputs
- `ml/models/classification_model.joblib` — trained Logistic Regression
- `ml/models/tfidf_vectorizer.joblib` — fitted TF-IDF vectorizer
- `ml/models/classification_metrics.json` — accuracy/precision/recall/F1

See `../AEDIRS_v2_Project_Master_Plan.md` for full architecture, dataset rationale, and sprint log.
