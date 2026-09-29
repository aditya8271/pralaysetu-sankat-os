import osmium
import json
from pathlib import Path

INPUT_FILE = Path("data/raw/eastern-zone.osm.pbf")
OUTPUT_FILE = Path("data/raw/puri_osm_clean.json")

MIN_LON = 85.80
MIN_LAT = 19.78
MAX_LON = 85.86
MAX_LAT = 19.84


def inside_bbox(lon, lat):
    return (
        MIN_LON <= lon <= MAX_LON
        and MIN_LAT <= lat <= MAX_LAT
    )


class PuriHandler(osmium.SimpleHandler):

    def __init__(self):
        super().__init__()
        self.nodes = []
        self.ways = []

    def node(self, n):
        if not n.location.valid():
            return

        lon = n.location.lon
        lat = n.location.lat

        if not inside_bbox(lon, lat):
            return

        tags = dict(n.tags)

        if tags:
            self.nodes.append({
                "id": n.id,
                "lat": lat,
                "lon": lon,
                "tags": tags
            })

    def way(self, w):
        tags = dict(w.tags)

        # Only infrastructure useful for PralaySetu
        if not (
            "highway" in tags
            or "building" in tags
            or "amenity" in tags
            or "healthcare" in tags
            or "emergency" in tags
            or "power" in tags
        ):
            return

        # Check whether any way node lies inside Puri bbox
        inside = False

        for node in w.nodes:
            if node.location.valid():
                lon = node.lon
                lat = node.lat

                if inside_bbox(lon, lat):
                    inside = True
                    break

        if not inside:
            return

        self.ways.append({
            "id": w.id,
            "tags": tags
        })


handler = PuriHandler()

print("===================================")
print(" PralaySetu - Puri Data Extraction")
print("===================================")

print(f"Input: {INPUT_FILE}")
print("Reading Eastern India OSM data...")
print("Filtering Puri infrastructure...")

handler.apply_file(
    str(INPUT_FILE),
    locations=True
)

result = {
    "source": "OpenStreetMap",
    "area": "Puri, Odisha",
    "bbox": {
        "min_lon": MIN_LON,
        "min_lat": MIN_LAT,
        "max_lon": MAX_LON,
        "max_lat": MAX_LAT
    },
    "nodes": handler.nodes,
    "ways": handler.ways
}

OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)

with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
    json.dump(
        result,
        f,
        ensure_ascii=False
    )

print()
print("========== COMPLETE ==========")
print(f"Nodes: {len(handler.nodes)}")
print(f"Ways:  {len(handler.ways)}")
print(f"Output: {OUTPUT_FILE}")