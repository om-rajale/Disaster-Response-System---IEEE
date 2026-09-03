"""
AEDIRS v2 — End-to-end Sprint 2 pipeline demo.
Loads the trained classifier + vectorizer, runs new/unseen report text through:
   raw text -> clean -> TF-IDF+features -> classification confidence -> priority score
This is the exact function the FastAPI backend (Sprint 3) will call.
"""
from pathlib import Path
import joblib
import pandas as pd

from preprocessing import clean_text
from feature_engineering import build_features
from priority_scoring import score_severity

MODEL_DIR = Path(__file__).resolve().parents[1] / "models"


class AedirsPipeline:
    def __init__(self):
        self.model = joblib.load(MODEL_DIR / "classification_model.joblib")
        self.vectorizer = joblib.load(MODEL_DIR / "tfidf_vectorizer.joblib")

    def process_report(self, raw_text: str, keyword: str = None) -> dict:
        clean = clean_text(raw_text)
        row = pd.DataFrame([{
            "text": raw_text, "text_clean": clean, "keyword": keyword
        }])
        X, _ = build_features(row["text_clean"], row, vectorizer=self.vectorizer, fit=False)

        proba = self.model.predict_proba(X)[0]
        is_disaster = bool(self.model.predict(X)[0])
        confidence = float(proba[1])  # P(class=1, real disaster)

        priority_result = score_severity(raw_text, confidence)

        return {
            "raw_text": raw_text,
            "is_disaster_report": is_disaster,
            "classification_confidence": round(confidence, 3),
            "severity_score": priority_result.severity_score,
            "priority": priority_result.priority,
            "matched_severity_terms": priority_result.matched_terms,
        }


if __name__ == "__main__":
    pipeline = AedirsPipeline()

    test_reports = [
        "Massive earthquake just hit downtown, buildings collapsed, people trapped inside!!",
        "Check out this cool new coffee shop that opened near me",
        "Flash flood warning issued, water rising fast near the river bridge",
        "lol my dog just did something so funny",
        "Wildfire spreading rapidly, evacuation orders issued for the whole neighborhood",
    ]

    print(f"{'REPORT':<70} {'DISASTER?':<10} {'CONF':<6} {'PRIORITY':<10} {'SCORE'}")
    print("-" * 115)
    for text in test_reports:
        result = pipeline.process_report(text)
        print(f"{text[:68]:<70} {str(result['is_disaster_report']):<10} "
              f"{result['classification_confidence']:<6} {result['priority']:<10} {result['severity_score']}")
