import re
import joblib
import spacy
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="AEDIRS API")

# ---- Load everything ONCE at startup (not per-request — that would be slow) ----
relevance_model = joblib.load("relevance_model.pkl")
relevance_vectorizer = joblib.load("relevance_vectorizer.pkl")
category_model = joblib.load("category_model.pkl")
category_vectorizer = joblib.load("category_vectorizer.pkl")
nlp = spacy.load("en_core_web_sm")

SEVERITY_WORDS = {
    "dead": 10, "trapped": 10, "collapsed": 9, "injured": 8, "fire": 7,
    "flooding": 7, "rescue": 7, "evacuate": 6, "damage": 4, "delay": 2,
}
RESOURCE_MAP = {
    "injured_or_dead_people": ["Ambulance", "Medical team"],
    "rescue_volunteering_or_donation_effort": ["Rescue team", "Volunteers"],
    "infrastructure_and_utility_damage": ["Repair crew", "Utility team"],
    "displaced_people_and_evacuations": ["Shelter", "Transport"],
    "requests_or_urgent_needs": ["Relief supplies", "Coordination team"],
    "missing_or_found_people": ["Search and rescue"],
    "caution_and_advice": ["Public advisory team"],
    "sympathy_and_support": ["Community outreach"],
    "other_relevant_information": ["General response team"],
    "not_humanitarian": [],
}

def clean_text(text):
    if not isinstance(text, str):
        return ""
    text = text.lower()
    text = re.sub(r"https?://\S+|www\.\S+", " ", text)
    text = re.sub(r"@\w+", " ", text)
    text = re.sub(r"#(\w+)", r"\1", text)
    text = re.sub(r"[^a-zA-Z0-9\s']", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text

def extract_location(text):
    doc = nlp(text)
    return [ent.text for ent in doc.ents if ent.label_ in ("GPE", "LOC", "FAC")]

def score_severity(text):
    words = re.findall(r"[a-zA-Z']+", text.lower())
    matched = [w for w in words if w in SEVERITY_WORDS]
    score = min(sum(SEVERITY_WORDS[w] for w in matched), 30) / 30 * 100
    if score >= 75: priority = "Critical"
    elif score >= 50: priority = "High"
    elif score >= 25: priority = "Medium"
    else: priority = "Low"
    return round(score, 1), priority, matched

# ---- Request/response schema (FastAPI auto-validates incoming JSON against this) ----
class ReportRequest(BaseModel):
    text: str

@app.post("/process_report")
def process_report(report: ReportRequest):
    raw_text = report.text
    clean = clean_text(raw_text)

    rel_vec = relevance_vectorizer.transform([clean])
    is_relevant = bool(relevance_model.predict(rel_vec)[0])

    cat_vec = category_vectorizer.transform([clean])
    category = category_model.predict(cat_vec)[0]

    locations = extract_location(raw_text)
    severity_score, priority, matched_words = score_severity(raw_text)
    resources = RESOURCE_MAP.get(category, ["General response team"])

    return {
        "is_relevant": is_relevant,
        "category": category,
        "locations": locations,
        "priority": priority,
        "severity_score": severity_score,
        "recommended_resources": resources,
    }

@app.get("/")
def health_check():
    return {"status": "AEDIRS API is running"}