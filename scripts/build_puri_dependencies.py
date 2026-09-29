import json
from pathlib import Path
from math import radians, sin, cos, sqrt, atan2


ASSETS_FILE = Path("data/processed/puri_assets.json")
ROADS_FILE = Path("data/processed/puri_roads.geojson")
OUTPUT_FILE = Path("data/processed/puri_dependencies.json")


# Maximum distance from a road for an asset to be considered
# spatially accessible by that road.
MAX_DISTANCE_KM = 0.30


CRITICAL_ASSET_TYPES = {
    "hospital",
    "clinic",
    "blood_bank",
    "pharmacy",
    "police",
    "shelter",
    "school",
    "bus_station",
    "fuel",
}


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


def point_to_road_distance(asset_lat, asset_lon, coordinates):
    """
    Approximate minimum distance from an asset point
    to the vertices of an OSM road LineString.

    This is a prototype spatial-access calculation.
    """

    minimum_distance = None

    for lon, lat in coordinates:

        distance = distance_km(
            asset_lat,
            asset_lon,
            lat,
            lon
        )

        if minimum_distance is None or distance < minimum_distance:
            minimum_distance = distance

    return minimum_distance


print("======================================")
print(" PralaySetu - Puri Dependency Engine")
print("======================================")


with open(ASSETS_FILE, "r", encoding="utf-8") as file:
    asset_data = json.load(file)


with open(ROADS_FILE, "r", encoding="utf-8") as file:
    road_data = json.load(file)


assets = asset_data["assets"]
roads = road_data["features"]


critical_assets = [
    asset
    for asset in assets
    if asset["type"] in CRITICAL_ASSET_TYPES
]


print(f"Assets loaded: {len(assets)}")
print(f"Critical assets: {len(critical_assets)}")
print(f"Roads loaded: {len(roads)}")


dependencies = []


for asset in critical_assets:

    nearest_roads = []

    for road in roads:

        geometry = road.get("geometry")

        if not geometry:
            continue

        coordinates = geometry.get("coordinates", [])

        if len(coordinates) < 2:
            continue

        distance = point_to_road_distance(
            asset["lat"],
            asset["lon"],
            coordinates
        )

        if distance is None:
            continue

        if distance <= MAX_DISTANCE_KM:

            nearest_roads.append({
                "road": road,
                "distance_km": distance
            })


    # Keep only the closest 3 roads for each asset
    nearest_roads.sort(
        key=lambda item: item["distance_km"]
    )

    nearest_roads = nearest_roads[:3]


    for item in nearest_roads:

        road = item["road"]
        distance = item["distance_km"]

        properties = road.get("properties", {})

        road_id = properties.get("osm_id")

        highway_type = properties.get("highway")
        road_name = properties.get("name")


        if distance <= 0.05:
            confidence = "high"
        elif distance <= 0.15:
            confidence = "medium"
        else:
            confidence = "low"


        dependencies.append({
            "id": f"DEP-{road_id}-{asset['id']}",
            "source": f"ROAD-{road_id}",
            "target": asset["id"],
            "relation": "provides_access_to",

            "source_type": "osm_road",
            "target_type": asset["type"],

            "road_name": road_name,
            "highway": highway_type,

            "distance_km": round(distance, 4),

            "relationship_source": "spatial_inference",
            "confidence": confidence,

            "status": "candidate"
        })


result = {
    "area": "Puri city-area",

    "source": {
        "roads": "OpenStreetMap",
        "assets": "OpenStreetMap"
    },

    "method": {
        "type": "spatial_proximity",
        "maximum_distance_km": MAX_DISTANCE_KM,
        "max_roads_per_asset": 3
    },

    "dependency_count": len(dependencies),

    "dependencies": dependencies
}


OUTPUT_FILE.parent.mkdir(
    parents=True,
    exist_ok=True
)


with open(
    OUTPUT_FILE,
    "w",
    encoding="utf-8"
) as file:

    json.dump(
        result,
        file,
        indent=2,
        ensure_ascii=False
    )


print()
print("========== COMPLETE ==========")
print(f"Dependencies created: {len(dependencies)}")
print(f"Output: {OUTPUT_FILE}")