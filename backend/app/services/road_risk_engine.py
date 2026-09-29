import json
from pathlib import Path
from math import radians, sin, cos, sqrt, atan2


ROADS_FILE = (
    Path(__file__).resolve().parents[3]
    / "data"
    / "processed"
    / "puri_roads.geojson"
)


# ---------------------------------------------------------
# LOAD REAL OSM ROAD DATA
# ---------------------------------------------------------

def load_roads():
    with open(ROADS_FILE, "r", encoding="utf-8") as file:
        data = json.load(file)

    return data["features"]


# ---------------------------------------------------------
# DISTANCE CALCULATION
# ---------------------------------------------------------

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

    c = 2 * atan2(
        sqrt(a),
        sqrt(1 - a)
    )

    return earth_radius * c


# ---------------------------------------------------------
# ROAD GEOMETRY CENTROID
# ---------------------------------------------------------

def geometry_centroid(geometry):

    coordinates = geometry.get("coordinates", [])

    if not coordinates:
        return None

    points = []

    def collect_points(coords):

        if (
            isinstance(coords, list)
            and len(coords) >= 2
            and isinstance(coords[0], (int, float))
            and isinstance(coords[1], (int, float))
        ):
            points.append(
                (coords[0], coords[1])
            )
            return

        if isinstance(coords, list):

            for item in coords:
                collect_points(item)

    collect_points(coordinates)

    if not points:
        return None

    lon = sum(
        point[0] for point in points
    ) / len(points)

    lat = sum(
        point[1] for point in points
    ) / len(points)

    return lat, lon


# ---------------------------------------------------------
# PROXIMITY SCORE
# ---------------------------------------------------------

def calculate_proximity_score(distance):

    if distance <= 0.5:
        return 100

    elif distance <= 1:
        return 90

    elif distance <= 2:
        return 75

    elif distance <= 3:
        return 60

    elif distance <= 5:
        return 40

    elif distance <= 7:
        return 25

    elif distance <= 10:
        return 15

    else:
        return 5


# ---------------------------------------------------------
# WIND SCORE
# ---------------------------------------------------------

def calculate_wind_score(wind):

    if wind <= 0:
        return 0

    elif wind < 60:
        return 20

    elif wind < 90:
        return 40

    elif wind < 120:
        return 60

    elif wind < 140:
        return 80

    else:
        return 100


# ---------------------------------------------------------
# RAINFALL SCORE
# ---------------------------------------------------------

def calculate_rainfall_score(rainfall):

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


# ---------------------------------------------------------
# ROAD TYPE CRITICALITY
# ---------------------------------------------------------

def calculate_road_type_score(highway):

    critical_roads = {
        "trunk": 100,
        "trunk_link": 95,
        "primary": 90,
        "primary_link": 85,
        "secondary": 75,
        "secondary_link": 70,
        "tertiary": 60,
        "tertiary_link": 55,
        "unclassified": 40,
        "residential": 30,
        "living_street": 25,
        "service": 20,
        "track": 15
    }

    return critical_roads.get(
        highway,
        30
    )


# ---------------------------------------------------------
# RISK CLASSIFICATION
# ---------------------------------------------------------

def classify_risk(score):

    if score >= 80:
        return "critical"

    elif score >= 65:
        return "high"

    elif score >= 45:
        return "medium"

    else:
        return "low"


# ---------------------------------------------------------
# MAIN ROAD RISK ENGINE
# ---------------------------------------------------------

def calculate_road_risk(
    hazard_lat,
    hazard_lon,
    wind_speed_kmh=0,
    rainfall_mm=0,
    roads=None
):

    if roads is None:
        roads = load_roads()

    results = []

    for feature in roads:

        properties = feature.get(
            "properties",
            {}
        )

        geometry = feature.get(
            "geometry"
        )

        if not geometry:
            continue

        centroid = geometry_centroid(
            geometry
        )

        if centroid is None:
            continue

        road_lat, road_lon = centroid

        distance = distance_km(
            road_lat,
            road_lon,
            hazard_lat,
            hazard_lon
        )

        highway = properties.get(
            "highway",
            "unknown"
        )

        # -----------------------------
        # COMPONENT SCORES
        # -----------------------------

        proximity_score = (
            calculate_proximity_score(
                distance
            )
        )

        wind_score = (
            calculate_wind_score(
                wind_speed_kmh
            )
        )

        rainfall_score = (
            calculate_rainfall_score(
                rainfall_mm
            )
        )

        road_type_score = (
            calculate_road_type_score(
                highway
            )
        )

        # -----------------------------
        # FINAL SCORE
        # -----------------------------

        risk_score = (
            0.45 * proximity_score
            + 0.20 * wind_score
            + 0.15 * rainfall_score
            + 0.20 * road_type_score
        )

        risk_score = round(
            risk_score,
            2
        )

        risk_level = classify_risk(
            risk_score
        )

        osm_id = properties.get(
            "osm_id"
        )

        if osm_id is None:
            continue

        road_id = f"ROAD-{osm_id}"

        results.append({

            "road_id": road_id,

            "osm_id": osm_id,

            "road_name": properties.get(
                "name"
            ),

            "highway": highway,

            "distance_km": round(
                distance,
                3
            ),

            "proximity_score":
                proximity_score,

            "wind_score":
                wind_score,

            "rainfall_score":
                rainfall_score,

            "road_type_score":
                road_type_score,

            "risk_score":
                risk_score,

            "risk_level":
                risk_level,

            "source":
                properties.get(
                    "source",
                    "OpenStreetMap"
                ),

            "source_type":
                properties.get(
                    "source_type",
                    "real_public_data"
                )
        })

    # Highest risk first

    results.sort(
        key=lambda item:
        item["risk_score"],
        reverse=True
    )

    return {

        "road_count":
            len(results),

        "roads":
            results
    }