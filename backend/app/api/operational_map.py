import json
from pathlib import Path

from fastapi import APIRouter, HTTPException

router = APIRouter()

DATA_FILE = (
    Path(__file__).resolve().parents[3]
    / "data"
    / "processed"
    / "puri_operational_map.geojson"
)


@router.get("/operational-map")
def get_operational_map():
    if not DATA_FILE.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Operational map file not found: {DATA_FILE}"
        )

    try:
        with open(DATA_FILE, "r", encoding="utf-8") as file:
            geojson = json.load(file)

        return geojson

    except json.JSONDecodeError:
        raise HTTPException(
            status_code=500,
            detail="Operational map GeoJSON is invalid."
        )