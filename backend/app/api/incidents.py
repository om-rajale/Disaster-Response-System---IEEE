from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, model_validator

from database import get_db
import db_models
from schemas import IncidentResponse

router = APIRouter(prefix="/incidents", tags=["Incidents"])

ALLOWED_STATUSES = {"pending", "in_progress", "resolved", "dismissed"}


class StatusUpdateRequest(BaseModel):
    new_status: str

    @model_validator(mode="before")
    @classmethod
    def handle_aliases(cls, data):
        if isinstance(data, dict):
            if "new_status" not in data and "status" in data:
                data["new_status"] = data["status"]
        return data


@router.get("/", response_model=list[IncidentResponse])
@router.get("", response_model=list[IncidentResponse], include_in_schema=False)
def get_incidents(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    query = db.query(db_models.Incident)
    if status is not None:
        query = query.filter(db_models.Incident.status == status)
    if priority is not None:
        query = query.filter(db_models.Incident.priority == priority)

    incidents = query.order_by(db_models.Incident.created_at.desc()).limit(limit).all()
    return incidents


@router.get("/{incident_id}", response_model=IncidentResponse)
def get_incident(incident_id: int, db: Session = Depends(get_db)):
    incident = db.query(db_models.Incident).filter(db_models.Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Incident with ID {incident_id} not found"
        )
    return incident


@router.patch("/{incident_id}/status", response_model=IncidentResponse)
def update_incident_status(
    incident_id: int,
    payload: StatusUpdateRequest,
    db: Session = Depends(get_db)
):
    if payload.new_status not in ALLOWED_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status '{payload.new_status}'. Must be one of: {sorted(list(ALLOWED_STATUSES))}"
        )

    incident = db.query(db_models.Incident).filter(db_models.Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Incident with ID {incident_id} not found"
        )

    incident.status = payload.new_status
    db.commit()
    db.refresh(incident)
    return incident
