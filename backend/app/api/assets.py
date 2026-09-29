import json
from pathlib import Path

from fastapi import APIRouter

router = APIRouter()

DATA_FILE = Path(__file__).resolve().parents[3] / "data" / "assets.json"


def load_assets():
    with open(DATA_FILE, "r", encoding="utf-8") as file:
        return json.load(file)


@router.get("/assets")
def get_assets():
    assets = load_assets()

    return {
        "count": len(assets),
        "assets": assets
    }