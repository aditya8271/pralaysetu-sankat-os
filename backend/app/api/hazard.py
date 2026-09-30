from fastapi import APIRouter, HTTPException

from backend.app.models.hazard import HazardInput

from backend.app.services.impact_engine import calculate_impact

from backend.app.services.priority_engine import calculate_priority

from backend.app.services.road_priority_engine import (
    calculate_road_priorities,
)

from backend.app.services.dependency_engine import (
    calculate_cascade_for_assets,
    calculate_road_cascade,
)

from backend.app.services.road_risk_engine import (
    calculate_road_risk,
)

from backend.app.services.mission_engine import generate_missions

from backend.app.api.missions import save_missions
from backend.app.services.weather_service import fetch_current_weather


router = APIRouter()


def _derive_safety_phase(hazard_data):
    """Return a field-safe operational phase unless the hazard data actually indicates severe conditions."""
    mode = str(hazard_data.get("mode") or "").upper()
    alert = str(hazard_data.get("alert_level") or "").strip().lower()
    warning = str(hazard_data.get("warning_status") or "").strip().lower()
    weather_status = str(hazard_data.get("weather_status") or "").strip().lower()

    if alert in {"red", "orange", "severe", "high", "warning"} or warning in {"red", "orange", "severe", "high", "warning"}:
        return "DURING_STORM"

    if "storm" in weather_status or "thunderstorm" in weather_status or "heavy rain" in weather_status or "rain" in weather_status and "light" not in weather_status:
        return "DURING_STORM"

    if alert in {"green", "cleared", "post-clearance", "post_clearance"} or "cleared" in warning or warning in {"clear", "none", "normal"}:
        return "POST_CLEARANCE"

    if mode in {"FORECAST", "SIMULATION", "UNAVAILABLE"}:
        return "POST_CLEARANCE"

    return "PRE_LANDFALL"


# =========================================================
# CURRENT HAZARD STATE
#
# Stores the most recently processed hazard so that the
# frontend can retrieve it using GET /api/hazard.
#
# This is in-memory for the demo.
# It resets when the backend restarts.
# =========================================================

_current_hazard = {
    "source": "simulation",
    "mode": "SIMULATION",
    "hazard_type": "cyclone",
    "area": "Puri, Odisha",
    "valid_from": "2026-09-28T00:00:00",
    "valid_until": "2026-09-28T06:00:00",
    "wind_speed_kmh": 40,
    "rainfall_mm": 12,
    "alert_level": "green",
    "warning_status": "cleared",
    "latitude": 19.8135,
    "longitude": 85.8312,
    "description": "Puri coastal cyclone simulation for operational impact and infrastructure cascade analysis."
}


# =========================================================
# GET CURRENT HAZARD
#
# Frontend uses this endpoint to display:
# - wind speed
# - rainfall
# - alert level
# - location
# - hazard type
# - validity window
# =========================================================

@router.get("/hazard")
def get_current_hazard():

    if _current_hazard is None:
        return {
            "status": "no_hazard",
            "hazard": None,
        }

    hazard_data = _current_hazard.copy()
    hazard_data["safety_phase"] = _derive_safety_phase(hazard_data)
    return {
        "status": "active",
        "hazard": hazard_data,
    }


@router.get("/hazard/current-weather")
def get_current_weather():
    """Fetch current provider conditions without falling back to simulation."""
    return fetch_current_weather()


# =========================================================
# POST HAZARD
# =========================================================

@router.post("/hazard")
def receive_hazard(hazard: HazardInput):

    global _current_hazard

    hazard_data = hazard.model_dump()
    # The phase is derived by the backend; never accept a client-supplied phase.
    hazard_data["safety_phase"] = _derive_safety_phase(hazard_data)

    # Save the latest hazard for the frontend.
    _current_hazard = hazard_data.copy()

    # =========================================================
    # STEP 1: Calculate infrastructure impact
    # =========================================================

    impact = calculate_impact(
        hazard_data
    )

    # =========================================================
    # STEP 2: Calculate infrastructure operational priority
    # =========================================================

    priority = calculate_priority(
        impact["results"]
    )

    # =========================================================
    # STEP 3: Calculate infrastructure dependency cascade
    #
    # P0/P1 infrastructure assets are analysed through
    # the dependency graph.
    # =========================================================

    high_priority_asset_ids = [
        item["asset_id"]
        for item in priority["priorities"]
        if item["priority"] in ["P0", "P1"]
    ]

    cascade = calculate_cascade_for_assets(
        high_priority_asset_ids
    )

    # =========================================================
    # STEP 4: Calculate risk for mapped Puri roads
    #
    # Uses real/public OpenStreetMap road geometry.
    # =========================================================

    road_risk = {
        "road_count": 0,
        "roads": []
    }

    if (
        hazard_data.get("latitude") is not None
        and hazard_data.get("longitude") is not None
    ):

        road_risk = calculate_road_risk(
            hazard_data["latitude"],
            hazard_data["longitude"],
            hazard_data.get("wind_speed_kmh") or 0,
            hazard_data.get("rainfall_mm") or 0
        )

    # =========================================================
    # STEP 5: Select operationally relevant roads
    #
    # Both critical and high-risk roads are considered
    # for dependency cascade analysis.
    # =========================================================

    high_risk_road_ids = [
        road["road_id"]
        for road in road_risk["roads"]
        if road["risk_level"] in ["critical", "high"]
    ]

    # =========================================================
    # STEP 6: Calculate road -> infrastructure cascade
    #
    # Example:
    #
    # ROAD
    #   ↓
    # Hospital / Police / Shelter
    #   ↓
    # Cascading operational impact
    # =========================================================

    road_cascade = calculate_road_cascade(
        high_risk_road_ids
    )

    # =========================================================
    # STEP 7: Calculate operational priority for roads
    #
    # Combines:
    #
    # Road hazard risk
    # +
    # Infrastructure dependency cascade
    #
    # Output:
    # P0 / P1 / P2
    # =========================================================

    road_priority = calculate_road_priorities(
        road_risk["roads"]
    )

    # =========================================================
    # STEP 8: Generate infrastructure missions
    #
    # Existing mission engine remains unchanged.
    # =========================================================

    missions = generate_missions(
        priority["priorities"],
        road_priority["priorities"]
    )

    # =========================================================
    # STEP 9: Attach hazard context to every mission
    #
    # Reassessment needs the original hazard information:
    # location, wind, rainfall, alert level, etc.
    #
    # IMPORTANT:
    # This does NOT change the mission engine.
    # It simply stores the hazard context alongside
    # the generated mission.
    # =========================================================

    for mission in missions["missions"]:

        mission["hazard"] = hazard_data.copy()

    # =========================================================
    # STEP 10: Save generated missions
    # =========================================================

    save_missions(
        missions["missions"]
    )

    # =========================================================
    # STEP 11: Return complete
    # PralaySetu + Sankat OS result
    # =========================================================

    return {

        "status": "processed",

        # -----------------------------------------------------
        # Hazard information
        # -----------------------------------------------------

        "hazard": hazard_data,

        # -----------------------------------------------------
        # Infrastructure impact
        # -----------------------------------------------------

        "impact": {
            "asset_count":
                impact["asset_count"],

            "results":
                impact["results"]
        },

        # -----------------------------------------------------
        # Infrastructure priority
        # -----------------------------------------------------

        "priority":
            priority,

        # -----------------------------------------------------
        # Infrastructure dependency cascade
        # -----------------------------------------------------

        "cascade":
            cascade,

        # -----------------------------------------------------
        # Road risk
        # -----------------------------------------------------

        "road_risk": {

            "road_count":
                road_risk["road_count"],

            "critical_road_count":
                sum(
                    1
                    for road in road_risk["roads"]
                    if road["risk_level"] == "critical"
                ),

            "high_risk_road_count":
                len(high_risk_road_ids),

            "medium_road_count":
                sum(
                    1
                    for road in road_risk["roads"]
                    if road["risk_level"] == "medium"
                ),

            "roads":
                road_risk["roads"]
        },

        # -----------------------------------------------------
        # Road dependency cascade
        # -----------------------------------------------------

        "road_cascade":
            road_cascade,

        # -----------------------------------------------------
        # Road operational priority
        # -----------------------------------------------------

        "road_priority":
            road_priority,

        # -----------------------------------------------------
        # Sankat OS missions
        # -----------------------------------------------------

        "missions":
            missions
    }


@router.post("/hazard/analyze-current-weather")
def analyze_current_weather():
    """Fetch fresh provider conditions and run the existing impact pipeline."""
    weather = fetch_current_weather()
    if weather.get("status") != "available":
        raise HTTPException(
            status_code=503,
            detail={
                "message": "Current weather is unavailable or stale; no live impact analysis was run.",
                "weather": weather,
            },
        )

    wind_speed = weather.get("wind_speed_kmh")
    precipitation = weather.get("precipitation_mm")
    if wind_speed is None and precipitation is None:
        raise HTTPException(
            status_code=503,
            detail={"message": "Provider returned no usable wind or precipitation values.", "weather": weather},
        )

    hazard = HazardInput(
        source=weather["source"],
        mode="FORECAST",
        hazard_type="weather",
        area=weather["area"],
        valid_from=weather.get("provider_time"),
        wind_speed_kmh=wind_speed,
        rainfall_mm=precipitation,
        precipitation_mm=precipitation,
        temperature_c=weather.get("temperature_c"),
        wind_direction_degrees=weather.get("wind_direction_degrees"),
        latitude=weather.get("latitude"),
        longitude=weather.get("longitude"),
        description=weather.get("weather_status"),
        provider=weather.get("provider"),
        fetched_at=weather.get("fetched_at"),
        observation_time=weather.get("observation_time"),
        provider_time=weather.get("provider_time"),
        freshness=weather.get("freshness"),
        weather_status=weather.get("weather_status"),
        warning_status=weather.get("warning_status"),
    )
    result = receive_hazard(hazard)
    result["weather"] = weather
    return result
