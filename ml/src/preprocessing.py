"""
AEDIRS v2 — Text preprocessing.

Why these specific steps (decided from the EDA findings, not guessed):
  - 52% of tweets contain a URL -> strip URLs; they add no classification signal and
    inflate the TF-IDF vocabulary with junk tokens (t.co/xxxxx).
  - 27% contain @mentions -> strip the handle but keep a marker, since "who" is being
    mentioned is noise but "a mention exists" can correlate with conversational
    (non-disaster) chatter.
  - 23% contain hashtags -> keep the WORD inside the hashtag (#earthquake -> earthquake),
    drop the '#' symbol. The word itself is high-signal; the symbol is not.
  - 110 exact-duplicate texts found in EDA -> deduplicate before splitting train/val,
    otherwise the same tweet can leak into both sets and inflate validation accuracy.
  - We do NOT aggressively remove stopwords or stem/lemmatize for the TF-IDF baseline:
    Logistic Regression + TF-IDF benefits from natural phrasing, and negation words
    ("no", "not") which stemming/stopword-removal would strip are meaningful in
    disaster text ("no injuries reported" vs "injuries reported").
"""
import re
import pandas as pd

URL_RE = re.compile(r"https?://\S+|www\.\S+")
MENTION_RE = re.compile(r"@\w+")
HASHTAG_RE = re.compile(r"#(\w+)")
NON_ALPHA_RE = re.compile(r"[^a-zA-Z0-9\s']")
MULTI_SPACE_RE = re.compile(r"\s+")


def clean_text(text: str) -> str:
    if not isinstance(text, str):
        return ""
    text = text.lower()
    text = URL_RE.sub(" ", text)
    text = MENTION_RE.sub(" ", text)
    text = HASHTAG_RE.sub(r"\1", text)          # keep the word, drop '#'
    text = NON_ALPHA_RE.sub(" ", text)
    text = MULTI_SPACE_RE.sub(" ", text).strip()
    return text


def load_and_clean(path: str) -> pd.DataFrame:
    df = pd.read_csv(path)
    before = len(df)
    df = df.drop_duplicates(subset=["text"]).reset_index(drop=True)
    print(f"Deduplicated: {before} -> {len(df)} rows ({before - len(df)} removed)")

    df["text_clean"] = df["text"].apply(clean_text)
    df = df[df["text_clean"].str.len() > 0].reset_index(drop=True)  # drop rows that became empty
    return df


if __name__ == "__main__":
    from pathlib import Path
    raw_path = Path(__file__).resolve().parents[1] / "data" / "raw" / "kaggle_disaster_tweets" / "train.csv"
    out_path = Path(__file__).resolve().parents[1] / "data" / "processed" / "kaggle_clean.csv"
    out_path.parent.mkdir(parents=True, exist_ok=True)

    df = load_and_clean(str(raw_path))
    df.to_csv(out_path, index=False)
    print(f"Saved cleaned data -> {out_path}  ({len(df)} rows)")
    print("\nBefore/after example:")
    for i in [0, 5, 12]:
        print(f"  RAW:   {df['text'].iloc[i]}")
        print(f"  CLEAN: {df['text_clean'].iloc[i]}\n")
