from fastapi import APIRouter

router = APIRouter()


DEMO_SCENARIO = {
    "id": "OD-CYCLONE-DEMO-01",
    "name": "Odisha Coastal Cyclone Simulation",
    "state": "Odisha",
    "district": "Demo Coastal District",
    "status": "simulation",
    "forecast_window_hours": 6,
    "wind_speed_kmh": 140,
    "rainfall_mm": 220,
    "landfall_lat": 20.3,
    "landfall_lon": 86.5
}


@router.get("/scenarios")
def get_scenarios():
    return {
        "count": 1,
        "scenarios": [DEMO_SCENARIO]
    }