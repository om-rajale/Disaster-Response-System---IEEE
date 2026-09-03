"""
AEDIRS v2 — Feature engineering.

TF-IDF is the primary feature space (captures vocabulary signal — words like
"earthquake", "evacuate", "collapsed" are strong predictors on their own).

We ADD a small set of hand-engineered numeric features on top, because TF-IDF alone
can't see structural patterns in the raw text that correlate with genuine incident
reports vs casual chatter:
  - has_url          : real reports are often shared with a news link / photo link
  - has_hashtag       : disaster tweets cluster hashtags (#flood #help) more than chat
  - exclamation_count : urgency signal, but weakly — also present in hype tweets, so
                        it's a WEAK feature deliberately combined with TF-IDF, not
                        relied on alone
  - word_count        : very short tweets ("I love fruits") skew non-disaster in EDA
  - keyword_present   : whether Kaggle's provided `keyword` column is non-null —
                        surprisingly informative since seeded disaster keywords
                        correlate with the labeling process itself
"""
import re
import numpy as np
from scipy.sparse import hstack, csr_matrix
from sklearn.feature_extraction.text import TfidfVectorizer


def engineer_numeric_features(df):
    has_url = df["text"].str.contains(r"https?://", regex=True, na=False).astype(int)
    has_hashtag = df["text"].str.contains(r"#", regex=False, na=False).astype(int)
    exclaim_count = df["text"].str.count("!")
    word_count = df["text_clean"].str.split().str.len()
    keyword_present = df["keyword"].notnull().astype(int)

    numeric = np.column_stack([
        has_url, has_hashtag, exclaim_count, word_count, keyword_present
    ]).astype(float)
    return csr_matrix(numeric)


def build_features(train_texts, train_df, vectorizer=None, fit=True):
    """Returns (feature_matrix, fitted_vectorizer)."""
    if fit or vectorizer is None:
        vectorizer = TfidfVectorizer(
            max_features=8000,
            ngram_range=(1, 2),   # unigrams + bigrams: "forest fire" is more specific than "forest"+"fire" separately
            min_df=2,             # ignore terms that appear in only 1 doc (noise, e.g. typos)
            sublinear_tf=True,    # log-scale term frequency — long ranty tweets don't dominate short factual ones
        )
        tfidf = vectorizer.fit_transform(train_texts)
    else:
        tfidf = vectorizer.transform(train_texts)

    numeric = engineer_numeric_features(train_df)
    combined = hstack([tfidf, numeric]).tocsr()
    return combined, vectorizer
