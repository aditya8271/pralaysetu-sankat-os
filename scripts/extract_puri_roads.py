import json
from pathlib import Path

import osmium


INPUT_FILE = Path("data/raw/eastern-zone.osm.pbf")
OUTPUT_FILE = Path("data/processed/puri_roads.geojson")

MIN_LON = 85.80
MIN_LAT = 19.78
MAX_LON = 85.86
MAX_LAT = 19.84


ROAD_TYPES = {
    "motorway",
    "motorway_link",
    "trunk",
    "trunk_link",
    "primary",
    "primary_link",
    "secondary",
    "secondary_link",
    "tertiary",
    "tertiary_link",
    "unclassified",
    "residential",
    "living_street",
    "service",
    "pedestrian",
    "track",
}


def inside_bbox(lon, lat):
    return (
        MIN_LON <= lon <= MAX_LON
        and MIN_LAT <= lat <= MAX_LAT
    )


class RoadHandler(osmium.SimpleHandler):

    def __init__(self):
        super().__init__()
        self.features = []

    def way(self, w):

        highway = w.tags.get("highway")

        if highway not in ROAD_TYPES:
            return

        coordinates = []

        for node in w.nodes:

            if not node.location.valid():
                continue

            lon = node.lon
            lat = node.lat

            coordinates.append([lon, lat])

        # Need at least 2 points to make a road line
        if len(coordinates) < 2:
            return

        # Keep road if any point is inside Puri bbox
        if not any(
            inside_bbox(lon, lat)
            for lon, lat in coordinates
        ):
            return

        properties = {
            "osm_id": w.id,
            "highway": highway,
            "name": w.tags.get("name"),
            "source": "OpenStreetMap",
            "source_type": "real_public_data"
        }

        feature = {
            "type": "Feature",
            "geometry": {
                "type": "LineString",
                "coordinates": coordinates
            },
            "properties": properties
        }

        self.features.append(feature)


print("======================================")
print(" PralaySetu - Puri Road Geometry")
print("======================================")

print(f"Input: {INPUT_FILE}")
print("Reading original OSM PBF...")
print("Extracting road coordinates...")


handler = RoadHandler()

handler.apply_file(
    str(INPUT_FILE),
    locations=True
)


geojson = {
    "type": "FeatureCollection",
    "name": "Puri Road Network",
    "features": handler.features
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
        geojson,
        file,
        indent=2,
        ensure_ascii=False
    )


print()
print("========== COMPLETE ==========")
print(f"Road geometries: {len(handler.features)}")
print(f"Output: {OUTPUT_FILE}")
print()
print("Each road now contains actual LineString coordinates.")