import json
from pathlib import Path


ASSETS_FILE = (
    Path(__file__).resolve().parents[3]
    / "data"
    / "processed"
    / "puri_assets.json"
)

DEPENDENCIES_FILE = (
    Path(__file__).resolve().parents[3]
    / "data"
    / "processed"
    / "puri_dependencies.json"
)


# Asset criticality is based on infrastructure type,
# not manually assigned disaster risk.
ASSET_CRITICALITY = {
    "hospital": 100,
    "blood_bank": 100,
    "shelter": 95,
    "police": 90,
    "clinic": 85,
    "pharmacy": 80,
    "power_tower": 75,
    "school": 65,
    "bus_station": 60,
    "fuel": 55
}


def load_assets():
    with open(ASSETS_FILE, "r", encoding="utf-8") as file:
        return json.load(file)["assets"]


def load_dependencies():
    with open(DEPENDENCIES_FILE, "r", encoding="utf-8") as file:
        return json.load(file)["dependencies"]


def calculate_priority(impact_results):

    dependencies = load_dependencies()

    # Count how many inferred road/infrastructure
    # relationships point toward each asset.
    dependency_count = {}

    for dependency in dependencies:
        target = dependency["target"]

        dependency_count[target] = (
            dependency_count.get(target, 0) + 1
        )

    priorities = []

    for item in impact_results:

        asset = item["asset"]
        impact = item["impact"]

        asset_id = asset["id"]
        asset_type = asset["type"]

        # --------------------------------
        # 1. Hazard exposure
        # --------------------------------

        exposure_score = float(
            impact.get("score", 0)
        )

        # --------------------------------
        # 2. Infrastructure criticality
        # --------------------------------

        criticality_score = ASSET_CRITICALITY.get(
            asset_type,
            50
        )

        # --------------------------------
        # 3. Dependency impact
        # --------------------------------

        access_count = dependency_count.get(
            asset_id,
            0
        )

        if access_count >= 4:
            dependency_score = 100

        elif access_count == 3:
            dependency_score = 85

        elif access_count == 2:
            dependency_score = 70

        elif access_count == 1:
            dependency_score = 50

        else:
            dependency_score = 20

        # --------------------------------
        # 4. Final operational priority
        # --------------------------------
        #
        # Exposure       45%
        # Criticality    35%
        # Dependency     20%
        #

        priority_score = (
            0.45 * exposure_score
            + 0.35 * criticality_score
            + 0.20 * dependency_score
        )

        priority_score = round(
            priority_score,
            2
        )

        # More selective P0 threshold.
        if priority_score >= 88:
            priority = "P0"

        elif priority_score >= 65:
            priority = "P1"

        else:
            priority = "P2"

        priorities.append({
            "asset_id": asset_id,
            "asset_type": asset_type,
            "asset_name": asset["name"],

            "priority": priority,
            "priority_score": priority_score,

            "exposure_score": round(
                exposure_score,
                2
            ),

            "criticality_score": criticality_score,

            "dependency_score": dependency_score,

            "dependency_count": access_count,

            "reason": {
                "hazard_exposure": impact.get(
                    "exposure"
                ),
                "criticality": criticality_score,
                "road_access_dependencies": access_count
            }
        })

    # Highest priority first.
    priorities.sort(
        key=lambda item: item["priority_score"],
        reverse=True
    )

    return {
        "total_assets": len(priorities),

        "p0_count": sum(
            1
            for item in priorities
            if item["priority"] == "P0"
        ),

        "p1_count": sum(
            1
            for item in priorities
            if item["priority"] == "P1"
        ),

        "p2_count": sum(
            1
            for item in priorities
            if item["priority"] == "P2"
        ),

        "priorities": priorities
    }