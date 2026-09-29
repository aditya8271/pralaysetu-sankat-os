import json
from pathlib import Path

ASSETS_FILE = Path("data/processed/puri_assets.json")
ROADS_FILE = Path("data/processed/puri_roads.geojson")
OUTPUT_FILE = Path("data/processed/puri_operational_map.geojson")


print("======================================")
print(" PralaySetu - Puri GeoData Combiner")
print("======================================")


# -----------------------------
# Load assets
# -----------------------------

with open(ASSETS_FILE, "r", encoding="utf-8") as file:
    asset_data = json.load(file)


# -----------------------------
# Load roads
# -----------------------------

with open(ROADS_FILE, "r", encoding="utf-8") as file:
    road_data = json.load(file)


features = []


# -----------------------------
# Convert assets → GeoJSON
# -----------------------------

for asset in asset_data["assets"]:

    feature = {
        "type": "Feature",
        "geometry": {
            "type": "Point",
            "coordinates": [
                asset["lon"],
                asset["lat"]
            ]
        },
        "properties": {
            "id": asset["id"],
            "type": asset["type"],
            "name": asset["name"],
            "source": asset["source"],
            "source_type": asset["source_type"]
        }
    }

    features.append(feature)


# -----------------------------
# Add roads
# -----------------------------

for road in road_data["features"]:

    features.append(road)


# -----------------------------
# Create combined GeoJSON
# -----------------------------

geojson = {
    "type": "FeatureCollection",
    "name": "PralaySetu Puri Operational Map",
    "metadata": {
        "area": "Puri city-area",
        "asset_count": len(asset_data["assets"]),
        "road_count": len(road_data["features"]),
        "asset_source": "OpenStreetMap",
        "road_source": "OpenStreetMap"
    },
    "features": features
}


# -----------------------------
# Save
# -----------------------------

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
        geojson,
        file,
        indent=2,
        ensure_ascii=False
    )


print()
print("========== COMPLETE ==========")
print(f"Assets: {len(asset_data['assets'])}")
print(f"Roads:  {len(road_data['features'])}")
print(f"Total features: {len(features)}")
print(f"Output: {OUTPUT_FILE}")