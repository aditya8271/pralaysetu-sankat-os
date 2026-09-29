import json
from pathlib import Path

INPUT_FILE = Path("data/raw/puri_osm_clean.json")
OUTPUT_FILE = Path("data/processed/puri_assets.json")

ASSET_RULES = {
    "hospital": lambda tags: (
        tags.get("amenity") == "hospital"
        or tags.get("healthcare") == "hospital"
    ),
    "clinic": lambda tags: (
        tags.get("amenity") == "clinic"
        or tags.get("healthcare") == "clinic"
    ),
    "blood_bank": lambda tags: tags.get("amenity") == "blood_bank",
    "pharmacy": lambda tags: (
        tags.get("amenity") == "pharmacy"
        or tags.get("healthcare") == "pharmacy"
        or tags.get("shop") == "chemist"
    ),
    "police": lambda tags: tags.get("amenity") == "police",
    "shelter": lambda tags: tags.get("amenity") == "shelter",
    "bus_station": lambda tags: tags.get("amenity") == "bus_station",
    "school": lambda tags: tags.get("amenity") == "school",
    "fuel": lambda tags: tags.get("amenity") == "fuel",
    "power_tower": lambda tags: tags.get("power") == "tower",
}


def detect_asset_type(tags):
    for asset_type, rule in ASSET_RULES.items():
        if rule(tags):
            return asset_type

    return None


print("======================================")
print(" PralaySetu - Puri Asset Extraction")
print("======================================")

with open(INPUT_FILE, "r", encoding="utf-8") as file:
    data = json.load(file)

assets = []

for node in data["nodes"]:
    tags = node.get("tags", {})

    asset_type = detect_asset_type(tags)

    if not asset_type:
        continue

    asset = {
        "id": f"OSM-{node['id']}",
        "type": asset_type,
        "name": tags.get("name", f"Unnamed {asset_type}"),
        "lat": node["lat"],
        "lon": node["lon"],
        "source": "OpenStreetMap",
        "source_type": "real_public_data",
        "osm_id": node["id"],
        "tags": tags
    }

    assets.append(asset)


OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)

with open(OUTPUT_FILE, "w", encoding="utf-8") as file:
    json.dump(
        {
            "area": "Puri city-area",
            "source": "OpenStreetMap",
            "asset_count": len(assets),
            "assets": assets
        },
        file,
        indent=2,
        ensure_ascii=False
    )


print()
print("========== COMPLETE ==========")
print(f"Assets extracted: {len(assets)}")
print(f"Output: {OUTPUT_FILE}")

print()
print("Asset breakdown:")

from collections import Counter

counts = Counter(asset["type"] for asset in assets)

for asset_type, count in counts.most_common():
    print(f"  {asset_type}: {count}")