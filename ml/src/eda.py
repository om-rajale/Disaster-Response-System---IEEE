"""
AEDIRS v2 — Exploratory Data Analysis
Run: python ml/src/eda.py
Reads ml/data/raw/kaggle_disaster_tweets/train.csv and prints a full data-quality report.
"""
import pandas as pd
from pathlib import Path

DATA_PATH = Path(__file__).resolve().parents[1] / "data" / "raw" / "kaggle_disaster_tweets" / "train.csv"


def run_eda():
    df = pd.read_csv(DATA_PATH)
    print("=" * 60)
    print("SHAPE:", df.shape)
    print("=" * 60)

    print("\n--- Columns & dtypes ---")
    print(df.dtypes)

    print("\n--- Missing values ---")
    print(df.isnull().sum())
    print(f"location missing: {df['location'].isnull().mean():.1%}")
    print(f"keyword missing:  {df['keyword'].isnull().mean():.1%}")

    print("\n--- Class balance (target) ---")
    counts = df["target"].value_counts()
    pct = df["target"].value_counts(normalize=True)
    for label in counts.index:
        tag = "Real disaster" if label == 1 else "Not a disaster"
        print(f"  {label} ({tag}): {counts[label]} rows  ({pct[label]:.1%})")

    print("\n--- Duplicate rows (exact text) ---")
    dup_count = df.duplicated(subset=["text"]).sum()
    print(f"  {dup_count} duplicate text rows out of {len(df)}")

    print("\n--- Text length stats (characters) ---")
    df["text_len"] = df["text"].str.len()
    print(df["text_len"].describe())

    print("\n--- Text length stats (words) ---")
    df["word_count"] = df["text"].str.split().str.len()
    print(df["word_count"].describe())

    print("\n--- Top 15 keywords ---")
    print(df["keyword"].value_counts().head(15))

    print("\n--- Sample: real disaster tweets ---")
    for t in df[df["target"] == 1]["text"].head(3):
        print("  •", t[:100])

    print("\n--- Sample: non-disaster tweets ---")
    for t in df[df["target"] == 0]["text"].head(3):
        print("  •", t[:100])

    print("\n--- URLs / hashtags / mentions presence ---")
    print(f"  contains URL:      {df['text'].str.contains('http').mean():.1%}")
    print(f"  contains hashtag:  {df['text'].str.contains('#').mean():.1%}")
    print(f"  contains mention:  {df['text'].str.contains('@').mean():.1%}")

    return df


if __name__ == "__main__":
    run_eda()
