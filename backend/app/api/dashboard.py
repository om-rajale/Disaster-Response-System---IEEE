from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import not_
from pydantic import BaseModel

from database import get_db
import db_models
from schemas import IncidentResponse
from security import get_current_user, require_roles

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


class PublicIncidentResponse(BaseModel):
    id: int
    category: str
    priority: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


@router.get("/public", response_model=List[PublicIncidentResponse])
def get_public_dashboard(db: Session = Depends(get_db)):
    incidents = (
        db.query(db_models.Incident)
        .filter(
            db_models.Incident.status != "dismissed",
            not_(db_models.Incident.status.like("duplicate_of_%"))
        )
        .order_by(db_models.Incident.created_at.desc())
        .all()
    )
    return incidents


@router.get("/rescue", response_model=List[IncidentResponse])
def get_rescue_dashboard(
    db: Session = Depends(get_db),
    current_user: db_models.User = Depends(require_roles(["rescue_team", "admin"]))
):
    incidents = (
        db.query(db_models.Incident)
        .filter(db_models.Incident.status.in_(["pending", "in_progress"]))
        .order_by(db_models.Incident.severity_score.desc())
        .all()
    )
    return incidents


@router.get("/admin", response_model=List[IncidentResponse])
def get_admin_dashboard(
    db: Session = Depends(get_db),
    current_user: db_models.User = Depends(require_roles(["admin"]))
):
    incidents = (
        db.query(db_models.Incident)
        .order_by(db_models.Incident.created_at.desc())
        .all()
    )
    return incidents
