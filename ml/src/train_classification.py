"""
AEDIRS v2 — Train the baseline classification model.

Model choice: TF-IDF + Logistic Regression (matches the original AEDIRS design decision).
Why Logistic Regression over a heavier model at this stage:
  - Trains in seconds on ~7.5k rows, no GPU needed.
  - Coefficients are directly inspectable -> you can point to *why* a report was
    flagged (e.g. "earthquake" has weight +3.2), which matters for an "auditable"
    emergency system and for explaining the model in a report/interview.
  - It is a genuine, defensible baseline to compare a future transformer upgrade
    against — you need this number to prove the upgrade helped.

Evaluation: Accuracy, Precision, Recall, F1 (matches the original resume bullet).
We report Recall specifically as a called-out metric because in a disaster-triage
system, a false negative (missing a real disaster report) is far worse than a false
positive (double-checking a false alarm) — this is a deliberate, stated design choice.
"""
import json
from pathlib import Path

import joblib
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    classification_report, confusion_matrix,
)

from preprocessing import load_and_clean
from feature_engineering import build_features

BASE = Path(__file__).resolve().parents[1]
RAW_PATH = BASE / "data" / "raw" / "kaggle_disaster_tweets" / "train.csv"
MODEL_DIR = BASE / "models"
MODEL_DIR.mkdir(exist_ok=True)


def main():
    df = load_and_clean(str(RAW_PATH))

    # Stratified split: keeps the ~57/43 class ratio identical in train and validation,
    # so validation metrics aren't skewed by an accidental imbalance in the split.
    train_df, val_df = train_test_split(
        df, test_size=0.2, random_state=42, stratify=df["target"]
    )
    print(f"Train: {len(train_df)} rows | Validation: {len(val_df)} rows")

    X_train, vectorizer = build_features(train_df["text_clean"], train_df, fit=True)
    X_val, _ = build_features(val_df["text_clean"], val_df, vectorizer=vectorizer, fit=False)
    y_train, y_val = train_df["target"], val_df["target"]

    # class_weight='balanced' -> compensates for the 57/43 imbalance found in EDA
    # without needing to manually oversample/undersample.
    model = LogisticRegression(
        max_iter=1000, C=1.0, class_weight="balanced", random_state=42
    )
    model.fit(X_train, y_train)

    y_pred = model.predict(X_val)

    metrics = {
        "accuracy": accuracy_score(y_val, y_pred),
        "precision": precision_score(y_val, y_pred),
        "recall": recall_score(y_val, y_pred),
        "f1": f1_score(y_val, y_pred),
    }

    print("\n=== Validation Metrics ===")
    for k, v in metrics.items():
        print(f"  {k:10s}: {v:.4f}")

    print("\n=== Classification Report ===")
    print(classification_report(y_val, y_pred, target_names=["Not disaster", "Real disaster"]))

    print("=== Confusion Matrix ===")
    cm = confusion_matrix(y_val, y_pred)
    print(f"                 Predicted 0   Predicted 1")
    print(f"  Actual 0      {cm[0][0]:>10d}   {cm[0][1]:>10d}")
    print(f"  Actual 1      {cm[1][0]:>10d}   {cm[1][1]:>10d}")

    # Inspect top predictive words (interpretability — the whole point of choosing LogReg)
    feature_names = vectorizer.get_feature_names_out()
    coefs = model.coef_[0][: len(feature_names)]  # numeric features are appended after TF-IDF
    top_pos_idx = coefs.argsort()[-15:][::-1]
    top_neg_idx = coefs.argsort()[:15]
    print("\nTop words pushing toward 'Real disaster':")
    print("  ", [feature_names[i] for i in top_pos_idx])
    print("Top words pushing toward 'Not disaster':")
    print("  ", [feature_names[i] for i in top_neg_idx])

    # Save artifacts
    joblib.dump(model, MODEL_DIR / "classification_model.joblib")
    joblib.dump(vectorizer, MODEL_DIR / "tfidf_vectorizer.joblib")
    with open(MODEL_DIR / "classification_metrics.json", "w") as f:
        json.dump(metrics, f, indent=2)
    print(f"\nSaved model + vectorizer + metrics -> {MODEL_DIR}")

    return model, vectorizer, metrics


if __name__ == "__main__":
    main()
