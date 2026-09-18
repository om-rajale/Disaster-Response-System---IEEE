import os
from sentence_transformers import SentenceTransformer, util
from sqlalchemy.orm import Session
import db_models

DEFAULT_THRESHOLD = float(os.getenv("DUPLICATE_THRESHOLD", "0.65"))

# Load model once
embedder = SentenceTransformer("all-MiniLM-L6-v2")

def check_duplicate(raw_text: str, db: Session, threshold: float = DEFAULT_THRESHOLD) -> int | None:
    # Query recent pending or verified incidents
    recent_incidents = (
        db.query(db_models.Incident)
        .filter(db_models.Incident.status != "dismissed")
        .order_by(db_models.Incident.created_at.desc())
        .limit(50)
        .all()
    )

    if not recent_incidents:
        return None

    incoming_embedding = embedder.encode(raw_text, convert_to_tensor=True)
    existing_texts = [inc.text for inc in recent_incidents]
    existing_embeddings = embedder.encode(existing_texts, convert_to_tensor=True)

    similarities = util.cos_sim(incoming_embedding, existing_embeddings)[0]

    for idx, score in enumerate(similarities):
        if score.item() >= threshold:
            return recent_incidents[idx].id  # Return ID of parent duplicate incident

    return None