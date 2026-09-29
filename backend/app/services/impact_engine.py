import json
from pathlib import Path
from math import radians, sin, cos, sqrt, atan2


ASSETS_FILE = (
    Path(__file__).resolve().parents[3]
    / "data"
    / "processed"
    / "puri_assets.json"
)


def load_assets():
    with open(ASSETS_FILE, "r", encoding="utf-8") as file:
        data = json.load(file)

    return data["assets"]


def distance_km(lat1, lon1, lat2, lon2):
    earth_radius = 6371.0

    lat1 = radians(lat1)
    lon1 = radians(lon1)
    lat2 = radians(lat2)
    lon2 = radians(lon2)

    dlat = lat2 - lat1
    dlon = lon2 - lon1

    a = (
        sin(dlat / 2) ** 2
        + cos(lat1)
        * cos(lat2)
        * sin(dlon / 2) ** 2
    )

    c = 2 * atan2(sqrt(a), sqrt(1 - a))

    return earth_radius * c


def calculate_proximity_score(distance):
    """
    Distance-based exposure.
    Smaller distance = higher exposure.

    This is a deterministic demo model,
    not a scientific cyclone damage model.
    """

    if distance <= 1:
        return 100

    elif distance <= 2:
        return 90

    elif distance <= 3:
        return 78

    elif distance <= 5:
        return 65

    elif distance <= 7:
        return 52

    elif distance <= 10:
        return 40

    elif distance <= 15:
        return 28

    elif distance <= 20:
        return 18

    else:
        return 8


def calculate_wind_score(wind):
    """
    Wind intensity contribution.
    """

    if wind <= 0:
        return 0

    elif wind < 60:
        return 30

    elif wind < 90:
        return 50

    elif wind < 120:
        return 70

    elif wind < 140:
        return 85

    else:
        return 100


def calculate_rainfall_score(rainfall):
    """
    Rainfall intensity contribution.
    """

    if rainfall <= 0:
        return 0

    elif rainfall < 50:
        return 20

    elif rainfall < 100:
        return 40

    elif rainfall < 150:
        return 60

    elif rainfall < 200:
        return 80

    else:
        return 100


def classify_exposure(score):

    if score >= 75:
        return "high"

    elif score >= 50:
        return "medium"

    elif score >= 25:
        return "low"

    else:
        return "minimal"


def calculate_asset_exposure(asset, hazard):

    asset_lat = asset["lat"]
    asset_lon = asset["lon"]

    hazard_lat = hazard.get("latitude")
    hazard_lon = hazard.get("longitude")

    if hazard_lat is None or hazard_lon is None:

        return {
            "exposure": "unknown",
            "score": 0,
            "distance_km": None,
            "reason": "Hazard location not provided"
        }

    distance = distance_km(
        asset_lat,
        asset_lon,
        hazard_lat,
        hazard_lon
    )

    wind = hazard.get("wind_speed_kmh") or 0
    rainfall = hazard.get("rainfall_mm") or 0

    proximity_score = calculate_proximity_score(distance)
    wind_score = calculate_wind_score(wind)
    rainfall_score = calculate_rainfall_score(rainfall)

    # Exposure model
    #
    # Location/proximity is the strongest factor.
    # Wind and rainfall modify the hazard intensity.
    #
    score = (
        0.60 * proximity_score
        + 0.25 * wind_score
        + 0.15 * rainfall_score
    )

    score = round(score, 2)

    exposure = classify_exposure(score)

    return {
        "exposure": exposure,
        "score": score,
        "distance_km": round(distance, 2),
        "proximity_score": proximity_score,
        "wind_score": wind_score,
        "rainfall_score": rainfall_score,
        "reason": (
            f"Asset is {distance:.2f} km from hazard reference point; "
            f"wind={wind} km/h, rainfall={rainfall} mm."
        )
    }


def calculate_impact(hazard):

    assets = load_assets()

    results = []

    for asset in assets:

        exposure = calculate_asset_exposure(
            asset,
            hazard
        )

        results.append({
            "asset": asset,
            "impact": exposure
        })

    results.sort(
        key=lambda item: item["impact"]["score"],
        reverse=True
    )

    return {
        "source": hazard.get("source"),
        "mode": hazard.get("mode"),
        "hazard_type": hazard.get("hazard_type"),
        "area": hazard.get("area"),
        "asset_count": len(results),
        "results": results
    }