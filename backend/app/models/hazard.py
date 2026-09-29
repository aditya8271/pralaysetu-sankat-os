from typing import Optional

from pydantic import BaseModel


class HazardInput(BaseModel):
    source: str
    mode: str

    hazard_type: str

    area: str

    valid_from: Optional[str] = None
    valid_until: Optional[str] = None

    wind_speed_kmh: Optional[float] = None
    rainfall_mm: Optional[float] = None
    precipitation_mm: Optional[float] = None
    temperature_c: Optional[float] = None
    wind_direction_degrees: Optional[float] = None

    alert_level: Optional[str] = None

    latitude: Optional[float] = None
    longitude: Optional[float] = None

    description: Optional[str] = None
    provider: Optional[str] = None
    fetched_at: Optional[str] = None
    observation_time: Optional[str] = None
    provider_time: Optional[str] = None
    forecast_time: Optional[str] = None
    freshness: Optional[str] = None
    weather_status: Optional[str] = None
    warning_status: Optional[str] = None
