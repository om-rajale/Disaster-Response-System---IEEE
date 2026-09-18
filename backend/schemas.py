from datetime import datetime
from pydantic import BaseModel
from typing import Optional, List

class ReportRequest(BaseModel):
    text: str
    reporter_id: Optional[int] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class IncidentResponse(BaseModel):
    id: int
    reporter_id: Optional[int] = None
    text: str
    category: str
    priority: str
    severity_score: float
    status: str
    ai_recommendation: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    created_at: Optional[datetime] = None
    assigned_team_id: Optional[int] = None

    class Config:
        from_attributes = True