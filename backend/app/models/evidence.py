from typing import Optional
from pydantic import BaseModel


class EvidenceInput(BaseModel):
    evidence_type: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    notes: Optional[str] = None
    transcript: Optional[str] = None