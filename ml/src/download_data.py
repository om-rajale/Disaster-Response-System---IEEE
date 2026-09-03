"""
AEDIRS v2 — Dataset acquisition script.

Run this on YOUR machine (not in a sandboxed/offline environment) with:
    python ml/src/download_data.py

Prerequisites:
1. Kaggle API credentials:
   - Go to kaggle.com -> Account -> Create New API Token -> downloads kaggle.json
   - Place it at ~/.kaggle/kaggle.json (chmod 600 on Linux/Mac)
   - Join the competition at https://www.kaggle.com/competitions/nlp-getting-started
     (click "Join Competition" once — required before the API will let you download)

2. `pip install -r ml/requirements.txt` (installs `kaggle` and `datasets` libraries)

This script pulls TWO datasets:
  A) Kaggle "NLP with Disaster Tweets" — binary relevance dataset (Sprint 1/2 baseline)
  B) HumAID — 11-class humanitarian category dataset (Sprint 2 real multiclass model)
"""

import os
import subprocess
import sys
from pathlib import Path

RAW_DIR = Path(__file__).resolve().parents[1] / "data" / "raw"
KAGGLE_DIR = RAW_DIR / "kaggle_disaster_tweets"
HUMAID_DIR = RAW_DIR / "humaid"


def download_kaggle_disaster_tweets():
    """Downloads the official Kaggle 'nlp-getting-started' competition data."""
    KAGGLE_DIR.mkdir(parents=True, exist_ok=True)
    print(f"[1/2] Downloading Kaggle disaster-tweets competition data to {KAGGLE_DIR} ...")
    try:
        subprocess.run(
            [
                "kaggle", "competitions", "download",
                "-c", "nlp-getting-started",
                "-p", str(KAGGLE_DIR),
            ],
            check=True,
        )
        # unzip
        for zf in KAGGLE_DIR.glob("*.zip"):
            subprocess.run(["unzip", "-o", str(zf), "-d", str(KAGGLE_DIR)], check=True)
            zf.unlink()
        print("    Done. Files:", [p.name for p in KAGGLE_DIR.iterdir()])
    except FileNotFoundError:
        print("    ERROR: `kaggle` CLI not found. Run `pip install kaggle` first.")
    except subprocess.CalledProcessError as e:
        print(f"    ERROR: Kaggle download failed ({e}). "
              f"Check ~/.kaggle/kaggle.json exists and you've joined the competition on kaggle.com.")


def download_humaid():
    """Downloads HumAID (11-class humanitarian categories) from the HuggingFace mirror."""
    HUMAID_DIR.mkdir(parents=True, exist_ok=True)
    print(f"[2/2] Downloading HumAID dataset to {HUMAID_DIR} ...")
    try:
        from datasets import load_dataset
    except ImportError:
        print("    ERROR: `datasets` library not found. Run `pip install datasets` first.")
        return

    try:
        ds = load_dataset("QCRI/HumAID-all")
        for split_name, split_data in ds.items():
            out_path = HUMAID_DIR / f"{split_name}.csv"
            split_data.to_csv(str(out_path))
            print(f"    Saved split '{split_name}' -> {out_path} ({len(split_data)} rows)")
    except Exception as e:
        print(f"    ERROR: HumAID download failed ({e}).")
        print("    Fallback: request the dataset directly at https://crisisnlp.qcri.org/humaid_dataset "
              "and place the extracted TSVs under ml/data/raw/humaid/")


if __name__ == "__main__":
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    download_kaggle_disaster_tweets()
    download_humaid()
    print("\nDone. Next: run `python ml/src/preprocessing.py` to clean and split the data.")
