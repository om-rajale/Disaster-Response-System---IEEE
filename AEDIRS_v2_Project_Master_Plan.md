# AEDIRS v2 — AI-Assisted Emergency Disaster Intelligence and Response System
## Project Master Plan & Continuity Document

> **Purpose of this file:** This is the single source of truth for the rebuild. Every future prompt/session should be read against this document so there's no re-explaining or drift. Update this file (don't restart it) as decisions change.

---

## 1. Project Identity (locked — do not change without a reason)

- **Name:** AEDIRS — AI-Assisted Emergency Disaster Intelligence and Response System
- **Origin:** Rebuild of an IEEE TechForGood 2026 team project (original code/data lost). You are now the sole owner/builder.
- **Problem statement:** Disaster response is bottlenecked at **triage, not rescue**. Authorities get a high volume of citizen reports; manual verification, categorization, prioritization, and duplicate-checking slow everything down.
- **Solution:** A platform that automatically classifies incoming disaster reports, extracts location, predicts priority, scores severity, detects duplicates, and recommends resources — then surfaces ranked incidents to authorities on a dashboard + map.
- **End-to-end flow:** Citizen submits report → AI pipeline processes it in real time → Authority reviews ranked incidents on dashboard → Resources dispatched.

---

## 2. System Architecture (locked)

```
Client (React SPA)
   │  REST calls (JWT-secured)
   ▼
Backend API (FastAPI)
   │
   ▼
AI Intelligence Layer (6 stages, sequential, each with graceful fallback)
   1. Location Extraction        — spaCy NER + regex fallback
   2. Incident Classification    — TF-IDF + Logistic Regression (baseline) → upgrade path: DistilBERT
   3. Priority Prediction        — TF-IDF + Logistic Regression / weak-supervised rule blend
   4. Severity Scoring           — rule-based, transparent/auditable
   5. Duplicate Detection        — Sentence-Transformers embeddings + cosine/Jaccard similarity
   6. Resource Recommendation    — deterministic rule mapping (incident type + severity → resources)
   │
   ▼
PostgreSQL (+ SQLAlchemy ORM) — incident lifecycle store
   │
   ▼
Authority Dashboard + Leaflet.js interactive map
```

**Design principle carried over from the original:** every AI stage must degrade gracefully (e.g., regex when NER is inconclusive) — the pipeline must never hard-fail on messy citizen text.

---

## 3. Technology Stack — What & Why

| Layer | Technology | Why this, specifically |
|---|---|---|
| Frontend | **React.js** (Vite) | Component-based SPA, matches original resume claim, huge ecosystem, pairs naturally with Leaflet for maps and Axios/TanStack Query for API calls. |
| Map | **Leaflet.js + OpenStreetMap** | Free, no API key/billing (unlike Google Maps), lightweight, industry-standard for open-source geo dashboards. |
| Backend | **FastAPI** | Async-native, automatic OpenAPI/Swagger docs (huge for demoing to recruiters/judges), Pydantic validation catches bad input before it reaches your ML models, and it's the de facto standard for serving Python ML models in production today. |
| Auth | **JWT (via `python-jose` + `passlib`)** | Stateless, works cleanly with a SPA frontend, industry standard. |
| Database | **PostgreSQL + SQLAlchemy** | Relational integrity for incident lifecycle (status transitions, duplicate links, resource assignments); PostGIS extension available later for real geo-queries (nearest resource, radius search). |
| Classical ML | **scikit-learn (TF-IDF + Logistic Regression)** | Interpretable, trains in seconds on modest labeled data, no GPU needed, easy to explain in a report/interview ("why did the model flag this as high priority?" — you can point to feature weights). This is your **baseline**, not your ceiling. |
| NLP entities | **spaCy (`en_core_web_sm` / `en_core_web_trf`)** | Pretrained NER (GPE/LOC/FAC entities) — no training data needed for a working v1; regex catches Indian address patterns (pin codes, "near X", landmarks) the model misses. |
| Semantic similarity | **Sentence-Transformers (`all-MiniLM-L6-v2`)** | Pretrained embeddings — no training needed. Captures "flood near XYZ bridge" ≈ "water logging at XYZ bridge" even with zero keyword overlap, which pure TF-IDF/Jaccard would miss. |
| Model upgrade path (Sprint 2+ stretch) | **DistilBERT / fine-tuned transformer** | Once the TF-IDF baseline works end-to-end, swapping in a fine-tuned transformer for classification is a natural "v2" story for your resume — shows you can iterate, not just ship once. |
| Experiment tracking | **MLflow (lightweight, local)** | Lets you log Accuracy/Precision/Recall/F1 per experiment run — directly maps to the metrics your original resume bullet already claims you used. |
| Deployment (later sprint) | **Docker Compose** (frontend + backend + Postgres) | One-command local spin-up, portable to any cloud later, standard practice expected in "production-ready" projects. |

---

## 4. Datasets (real, verified, freely accessible)

### 4.1 Primary — Incident Classification (multiclass, humanitarian categories)
**HumAID (via CrisisNLP / QCRI)**
- Hugging Face mirror (easiest, no form): `https://huggingface.co/datasets/QCRI/HumAID-all` and `https://huggingface.co/datasets/QCRI/HumAID-event-type`
- Original source (request form): `https://crisisnlp.qcri.org/humaid_dataset`
- **What it is:** 77,196 human-annotated tweets from 19 real disaster events (2016–2019: earthquakes, hurricanes, floods, wildfires), labeled into **11 humanitarian categories**: Caution & advice, Sympathy & support, Requests/urgent needs, Displaced people & evacuations, Injured or dead people, Missing or found people, Infrastructure & utility damage, Rescue/volunteering/donation, Other relevant, Not humanitarian.
- **Why this dataset:** it's the largest and most-cited dataset built *specifically* for disaster-response triage (not generic sentiment/topic data) — its label set maps almost one-to-one onto your "Incident Classification" pipeline stage. It comes with pre-defined train/val/test splits per event, which is exactly what you need for clean evaluation.
- **Use for:** Pipeline Stage 2 — Incident Classification model.

### 4.2 Secondary — Relevance Filter / Sprint-1 Quick Win (binary)
**Kaggle: "Natural Language Processing with Disaster Tweets"**
- `https://www.kaggle.com/competitions/nlp-getting-started` (competition + data)
- Mirror dataset if you don't want to join the competition: `https://www.kaggle.com/datasets/vstepanenko/disaster-tweets`
- **What it is:** ~10,000 tweets labeled `1` (real disaster) / `0` (not a real disaster), with `text`, `keyword`, `location` columns.
- **Why this dataset:** smaller and cleaner than HumAID, perfect for **Sprint 1** — you can get a working train → predict → evaluate loop running in under a day, prove your pipeline plumbing works, then swap in HumAID for the real multiclass model in Sprint 2. It also doubles as a genuine "is this even a real report?" pre-filter stage, which is a nice architectural addition beyond the original design.
- **Use for:** Sprint 1 baseline/plumbing model, and optionally a permanent "relevance gate" before Stage 2.

### 4.3 Priority Scoring — no clean labeled dataset exists publicly, so:
- **Decision:** don't force-fit a dataset here. Build priority as a **weak-supervised / rule-blended score**: `priority = f(HumAID category, severity keywords, entity signals)`. This is *more* defensible in a report than training on a noisy proxy label, and it mirrors what the original slide called "rule-based, auditable" logic anyway — that's a legitimate, intentional design choice you can explain confidently.
- (Optional, later, if you want a real dataset for this): **TREC Incident Streams (TREC-IS)** — `https://trecis.github.io/` — has explicit priority levels (Critical/High/Medium/Low), but requires a data-request form. Treat as a stretch-goal citation, not a Sprint-1 dependency.

### 4.4 Duplicate Detection
- **No training dataset needed** — `sentence-transformers/all-MiniLM-L6-v2` is used purely for inference (pretrained embeddings + cosine similarity threshold). This is a correct, real-world approach — most production dedup systems use pretrained sentence embeddings, not custom-trained ones.
- (Optional domain fine-tune later): **Quora Question Pairs** — `https://www.kaggle.com/datasets/quora/question-pairs-dataset` — only if you want to fine-tune the similarity model itself; not required for a strong v1.

### 4.5 Future Roadmap Dataset (matches your original "Future Scope" slide — image-based detection)
**CrisisMMD (multimodal — text + image)**
- `https://crisisnlp.qcri.org/crisismmd`
- Use this later if/when you extend to image-based disaster detection, as your original roadmap slide proposed. Not needed for Sprint 1–4.

---

## 5. Evaluation Metrics (carried over from your resume bullet — keep using these)
- **Accuracy, Precision, Recall, F1-score** for the classification and priority models (macro-averaged, since classes are imbalanced — HumAID especially).
- Log every run in MLflow so you can show a metrics table/graph in your final report — this is what turns "I built a model" into "I evaluated and improved a model," which is what makes an interview conversation strong.

---

## 6. Sprint Roadmap (high-level — detail for each sprint expands when we get there)

| Sprint | Goal |
|---|---|
| **Sprint 1** (this one) | Analysis, environment setup, dataset acquisition, EDA, repo scaffold, architecture decisions locked in writing |
| Sprint 2 | Data preprocessing + feature engineering + train baseline classification/priority models |
| Sprint 3 | FastAPI backend: DB models, auth, model-serving endpoints, wire up trained models |
| Sprint 4 | Location extraction + duplicate detection + severity scoring + resource recommendation modules |
| Sprint 5 | React frontend: citizen report form, authority dashboard, Leaflet map |
| Sprint 6 | Integration testing, evaluation report, Dockerized deployment, documentation/README |

We will do **one sprint per phase of our conversation**, in order, and I will always check this file's state before proposing the next step.

---

## 7. Repository Structure (target — build incrementally)

```
aedirs/
├── backend/
│   ├── app/
│   │   ├── api/            # FastAPI routers
│   │   ├── core/           # config, security/JWT
│   │   ├── models/          # SQLAlchemy models
│   │   ├── schemas/         # Pydantic schemas
│   │   ├── ml/              # inference wrappers around trained models
│   │   └── main.py
│   ├── requirements.txt
│   └── tests/
├── ml/
│   ├── data/                # raw/ + processed/ (gitignored, see below)
│   ├── notebooks/           # EDA
│   ├── src/                 # training scripts, feature engineering
│   └── models/              # saved .pkl / .joblib artifacts (gitignored if large)
├── frontend/
│   └── (Vite React app)
├── docker-compose.yml
├── .gitignore
└── README.md
```

**Critical GitHub lesson from last time:** raw datasets and trained model binaries do **not** go in git (they're large and regenerable). `.gitignore` must include `ml/data/raw/`, `ml/data/processed/`, `*.pkl`, `*.joblib`, `.env`. Commit **only** code, small config, and a `download_data.py`/`README` explaining how to re-fetch data — this is what protects you if a laptop dies or a collaborator doesn't push.

---

## 8. Sprint 1 Log — COMPLETE

- Repo scaffold created: `backend/`, `ml/{data/raw,data/processed,src,notebooks,models}`, `frontend/`.
- `.gitignore` written and applied **before** any data/model files existed (lesson learned).
- **Kaggle "NLP Getting Started" disaster-tweets dataset acquired for real** (7,613 rows, `id/keyword/location/text/target` schema — verified authentic Kaggle competition schema).
- **HumAID could not be pulled automatically in the dev sandbox** — it's gated behind a Google Form on `crisisnlp.qcri.org` / Hugging Face, and those domains aren't reachable from the sandboxed environment used to build this plan. `ml/src/download_data.py` contains the correct, real script to pull it on your own machine (Kaggle CLI + HuggingFace `datasets` library) — **run this yourself once, locally, before Sprint 2's multiclass upgrade.**
- EDA findings (real numbers, from `ml/src/eda.py`):
  - 7,613 rows, 5 columns. `location` missing 33.3%, `keyword` missing 0.8%.
  - Class balance: 57.0% not-disaster / 43.0% real-disaster — mild imbalance, handled with `class_weight="balanced"`.
  - 110 exact-duplicate texts found → deduplicated before splitting (prevents train/val leakage).
  - Median tweet length: 107 characters / 15 words.
  - 52.2% of tweets contain a URL, 23.1% a hashtag, 26.8% a mention → directly informed the preprocessing design (strip URLs, unwrap hashtags, strip mentions).

---

## 9. Sprint 2 Log — COMPLETE (baseline model)

**Files added (all in `ml/src/`):**
- `preprocessing.py` — text cleaning (URL/mention strip, hashtag unwrap, dedup). Decisions documented in-file, derived directly from EDA numbers above.
- `feature_engineering.py` — TF-IDF (unigrams+bigrams, 8000 features) + 5 hand-engineered structural features (has_url, has_hashtag, exclaim_count, word_count, keyword_present).
- `train_classification.py` — trains TF-IDF + Logistic Regression (`class_weight="balanced"`), stratified 80/20 split, saves model+vectorizer to `ml/models/`.
- `priority_scoring.py` — rule-blended severity/priority scorer (weighted lexicon + urgency signals + classifier confidence). No dataset needed by design (see Sec 4.3) — fully auditable, every score traceable to matched terms.
- `pipeline_demo.py` — the exact function shape Sprint 3's FastAPI backend will call: raw text in → `{is_disaster_report, confidence, severity_score, priority}` out.

**Real validation metrics (on held-out 20%, 1,501 rows, from the actual trained model):**

| Metric | Score |
|---|---|
| Accuracy | 0.8015 |
| Precision | 0.7749 |
| Recall | 0.7531 |
| F1-score | 0.7639 |

- Confusion matrix: 721 true-negatives, 482 true-positives, 140 false-positives, 158 false-negatives.
- Top words pushing toward "real disaster": `fire, earthquake, wildfire, california, storm, bombing, killed` — sanity-checks correctly against domain intuition.
- This is the **baseline** — the ceiling is a fine-tuned transformer (DistilBERT) once HumAID's multiclass labels are in hand; that upgrade is queued, not urgent, since the baseline already proves the pipeline architecture end-to-end.

**Priority scoring — sanity-checked on 4 constructed examples, behaved correctly:**
"People trapped under collapsed building" → Critical (89.5). "Minor power outage" → Medium (30.0). "Nice sunset" → Low (1.5). "Flooding, families stranded" → High (58.0).

**Known gap going into Sprint 3:** the classification model is currently **binary** (real-disaster vs not) because that's what real data was available for in-sandbox. The 11-class HumAID upgrade (matching the original AEDIRS "Incident Classification" category output) is a drop-in replacement — same `train_classification.py` structure, swap the label column and `LogisticRegression` → `LogisticRegression(multi_class="multinomial")`, once `download_data.py`'s HumAID step has been run locally. This does not block Sprint 3 (backend wiring) — the binary model is a legitimate first version to build the API around.
