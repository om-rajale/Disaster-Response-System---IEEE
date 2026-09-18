import re
import json
import joblib
import spacy
from fastapi import FastAPI, Depends, status
from sqlalchemy.orm import Session
from geopy.geocoders import Nominatim
from geopy.exc import GeocoderTimedOut, GeocoderServiceError

from database import engine, Base, get_db
import db_models
from schemas import ReportRequest, IncidentResponse
from duplicate_detector import check_duplicate
from app.api.auth import router as auth_router
from app.api import incidents
from app.api import dashboard
from llm_recommender import generate_ai_recommendation

app = FastAPI(title="AEDIRS API")
app.include_router(auth_router)
app.include_router(incidents.router)
app.include_router(dashboard.router)
Base.metadata.create_all(bind=engine)

# Load NLP components and trained model artifacts
relevance_model = joblib.load("relevance_model.pkl")
relevance_vectorizer = joblib.load("relevance_vectorizer.pkl")
category_model = joblib.load("category_model.pkl")
category_vectorizer = joblib.load("category_vectorizer.pkl")
nlp = spacy.load("en_core_web_sm")
geolocator = Nominatim(user_agent="aedirs_v2_emergency_triage")

# Expanded severity lexicon including structural collapse & rubble terminology
SEVERITY_WORDS = {
    "dead": 10, "die": 10, "died": 10, "trapped": 10, "trap": 9,
    "collapsed": 9, "collapse": 9, "crushed": 9, "rubble": 9,
    "injured": 8, "injuries": 8, "injury": 8, "debris": 8, "stuck": 8,
    "fire": 7, "fires": 7, "flooding": 7, "flood": 7, "floods": 7,
    "rescue": 7, "fell": 7, "hazard": 7, "danger": 7,
    "evacuate": 6, "evacuation": 6, "urgent": 6, "urgently": 6,
    "help": 5, "damage": 4, "destroyed": 4, "delay": 2, "critical": 10
}

# Baseline minimum severity floors by category
CATEGORY_FLOORS = {
    "injured_or_dead_people": 50.0,            # Guarantees at least "High"
    "missing_or_found_people": 45.0,
    "requests_or_urgent_needs": 30.0,
    "displaced_people_and_evacuations": 30.0,
    "infrastructure_and_utility_damage": 25.0,
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

def clean_text(text: str) -> str:
    if not isinstance(text, str):
        return ""
    text = text.lower()
    text = re.sub(r"https?://\S+|www\.\S+", " ", text)
    text = re.sub(r"@\w+", " ", text)
    text = re.sub(r"#(\w+)", r"\1", text)
    text = re.sub(r"[^a-zA-Z0-9\s']", " ", text)
    return re.sub(r"\s+", " ", text).strip()

def extract_location(text: str) -> list[str]:
    # 1. Primary: spaCy NER (raw text, then title-cased if all-lowercase)
    doc = nlp(text)
    entities = [ent.text for ent in doc.ents if ent.label_ in ("GPE", "LOC", "FAC")]
    
    if not entities and text.islower():
        doc_title = nlp(text.title())
        entities = [ent.text for ent in doc_title.ents if ent.label_ in ("GPE", "LOC", "FAC")]

    # 2. Stage 1 Fallback: Regex for location prepositions ("near X", "at X", "in X")
    if not entities:
        landmark_matches = re.findall(
            r"(?:near|at|in|around|opposite|behind)\s+([a-zA-Z0-9\s]+?)(?=\s+(?:please|help|urgently|and|with|we|is|are|need|$))", 
            text, 
            re.IGNORECASE
        )
        if landmark_matches:
            entities = [landmark_matches[0].strip()]

    return list(set(entities))

def geocode_location(loc_name: str) -> tuple[float | None, float | None]:
    try:
        location = geolocator.geocode(loc_name, timeout=3)
        if location:
            return location.latitude, location.longitude
    except (GeocoderTimedOut, GeocoderServiceError):
        pass
    return None, None

def score_severity(text: str, category: str = None, parent_score: float = None):
    # 1. Inherit score if marked as duplicate of an existing incident
    if parent_score is not None:
        if parent_score >= 75: priority = "Critical"
        elif parent_score >= 50: priority = "High"
        elif parent_score >= 25: priority = "Medium"
        else: priority = "Low"
        return parent_score, priority, []

    # 2. Lexicon word matching
    words = re.findall(r"[a-zA-Z']+", text.lower())
    matched = [w for w in words if w in SEVERITY_WORDS]
    raw_score = (min(sum(SEVERITY_WORDS[w] for w in matched), 30) / 30) * 100
    
    # 3. Apply category baseline floor
    floor = CATEGORY_FLOORS.get(category, 0.0)
    final_score = max(raw_score, floor)
    
    if final_score >= 75: priority = "Critical"
    elif final_score >= 50: priority = "High"
    elif final_score >= 25: priority = "Medium"
    else: priority = "Low"
    
    return round(final_score, 1), priority, matched

@app.post("/process_report", response_model=IncidentResponse, status_code=status.HTTP_201_CREATED)
def process_report(report: ReportRequest, db: Session = Depends(get_db)):
    raw_text = report.text
    cleaned = clean_text(raw_text)

    # 1. Relevance Gate
    rel_vec = relevance_vectorizer.transform([cleaned])
    is_relevant = bool(relevance_model.predict(rel_vec)[0])

    if not is_relevant:
        category = "not_humanitarian"
        priority = "Low"
        severity_score = 0.0
        status_label = "dismissed"
        recommendation_str = "No action required (Non-humanitarian report)."
        lat, lon = report.latitude, report.longitude
    else:
        # 2. Category Classification (ML)
        cat_vec = category_vectorizer.transform([cleaned])
        category = str(category_model.predict(cat_vec)[0])

        # 3. Duplicate Detection Check
        dup_incident_id = check_duplicate(raw_text, db)
        parent_score = None
        if dup_incident_id:
            status_label = f"duplicate_of_{dup_incident_id}"
            parent_inc = db.query(db_models.Incident).filter(db_models.Incident.id == dup_incident_id).first()
            if parent_inc:
                parent_score = parent_inc.severity_score
        else:
            status_label = "pending"

        # 4. Severity & Priority Scoring (Category Floor + Duplicate Inheritance)
        severity_score, priority, _ = score_severity(
            text=raw_text, 
            category=category, 
            parent_score=parent_score
        )

        # 5. Location Extraction + Nominatim Geocoding Fallback
        locations = extract_location(raw_text)
        lat, lon = report.latitude, report.longitude
        if (lat is None or lon is None) and locations:
            lat, lon = geocode_location(locations[0])

        # 6. Resource Allocation & Tactical Recommendation
        resources = RESOURCE_MAP.get(category, ["General response team"])
        recommendation_str = generate_ai_recommendation(raw_text, category, priority, resources)

    # 7. Incident Persistence
    new_incident = db_models.Incident(
        reporter_id=report.reporter_id,
        text=raw_text,
        category=category,
        priority=priority,
        severity_score=severity_score,
        latitude=lat,
        longitude=lon,
        status=status_label,
        ai_recommendation=recommendation_str,
    )
    db.add(new_incident)
    db.commit()
    db.refresh(new_incident)

    return new_incident