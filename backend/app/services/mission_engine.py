import json
from pathlib import Path


DEPENDENCIES_FILE = (
    Path(__file__).resolve().parents[3]
    / "data"
    / "processed"
    / "puri_dependencies.json"
)


# =========================================================
# MISSION TEMPLATES
# =========================================================

MISSION_TEMPLATES = {

    "road": {
        "action": "Inspect route accessibility",
        "owner_role": "pwd_team",
        "deadline_minutes": 30,
        "evidence_required": [
            "photo",
            "gps"
        ],
    },

    "power_tower": {
        "action": "Inspect power infrastructure",
        "owner_role": "electricity_team",
        "deadline_minutes": 60,
        "evidence_required": [
            "photo",
            "gps"
        ],
    },

    "hospital": {
        "action": "Verify hospital access and operational readiness",
        "owner_role": "health_team",
        "deadline_minutes": 30,
        "evidence_required": [
            "photo",
            "voice",
            "gps"
        ],
    },

    "clinic": {
        "action": "Verify clinic access and readiness",
        "owner_role": "health_team",
        "deadline_minutes": 45,
        "evidence_required": [
            "photo",
            "voice",
            "gps"
        ],
    },

    "shelter": {
        "action": "Verify shelter accessibility and readiness",
        "owner_role": "disaster_management_team",
        "deadline_minutes": 30,
        "evidence_required": [
            "photo",
            "gps"
        ],
    },

    "police": {
        "action": "Verify police facility accessibility",
        "owner_role": "police_team",
        "deadline_minutes": 45,
        "evidence_required": [
            "photo",
            "gps"
        ],
    },

    "school": {
        "action": "Verify site condition and accessibility",
        "owner_role": "local_administration",
        "deadline_minutes": 60,
        "evidence_required": [
            "photo",
            "gps"
        ],
    },

    "blood_bank": {
        "action": "Verify blood bank access and continuity",
        "owner_role": "health_team",
        "deadline_minutes": 30,
        "evidence_required": [
            "photo",
            "voice",
            "gps"
        ],
    },

    "pharmacy": {
        "action": "Verify pharmacy accessibility",
        "owner_role": "health_team",
        "deadline_minutes": 60,
        "evidence_required": [
            "photo",
            "gps"
        ],
    },

    "bus_station": {
        "action": "Verify transport access",
        "owner_role": "transport_team",
        "deadline_minutes": 60,
        "evidence_required": [
            "photo",
            "gps"
        ],
    },

    "fuel": {
        "action": "Verify fuel facility accessibility",
        "owner_role": "civil_supplies_team",
        "deadline_minutes": 60,
        "evidence_required": [
            "photo",
            "gps"
        ],
    },
}


# =========================================================
# ROAD MISSION TEMPLATE
# =========================================================

ROAD_MISSION_TEMPLATE = {
    "action": "Inspect and verify critical road accessibility",
    "owner_role": "pwd_team",
    "deadline_minutes": 30,
    "evidence_required": [
        "photo",
        "voice",
        "gps"
    ],
}


# =========================================================
# LOAD DEPENDENCIES
# =========================================================

def load_dependencies():

    with open(
        DEPENDENCIES_FILE,
        "r",
        encoding="utf-8"
    ) as file:

        return json.load(file)["dependencies"]


# =========================================================
# BUILD DEPENDENCY INDEX
# =========================================================

def build_dependency_index():

    dependencies = load_dependencies()

    outgoing = {}
    incoming = {}

    for dependency in dependencies:

        source = dependency["source"]
        target = dependency["target"]

        # source -> target
        outgoing.setdefault(
            source,
            []
        ).append(
            dependency
        )

        # target <- source
        incoming.setdefault(
            target,
            []
        ).append(
            dependency
        )

    return {
        "outgoing": outgoing,
        "incoming": incoming,
    }


# =========================================================
# GENERATE ASSET MISSIONS
# =========================================================

def generate_asset_missions(
    priorities,
    outgoing,
    incoming
):

    missions = []

    for item in priorities:

        # Only P0/P1 assets become missions
        if item["priority"] not in [
            "P0",
            "P1"
        ]:
            continue

        asset_id = item["asset_id"]
        asset_type = item["asset_type"]

        template = MISSION_TEMPLATES.get(
            asset_type
        )

        if not template:
            continue

        # ---------------------------------------------
        # Dependencies where asset is SOURCE
        # ---------------------------------------------

        outgoing_links = outgoing.get(
            asset_id,
            []
        )

        # ---------------------------------------------
        # Dependencies where asset is TARGET
        # ---------------------------------------------

        incoming_links = incoming.get(
            asset_id,
            []
        )

        # ---------------------------------------------
        # Connected infrastructure
        # ---------------------------------------------

        connected_assets = set()

        for dependency in outgoing_links:

            connected_assets.add(
                dependency["target"]
            )

        for dependency in incoming_links:

            connected_assets.add(
                dependency["source"]
            )

        connected_assets = sorted(
            connected_assets
        )

        mission_id = (
            f"MISSION-{asset_id}"
        )

        mission = {

            "id": mission_id,

            "mission_type": "asset",

            "asset_id": asset_id,

            "asset_type": asset_type,

            "asset_name":
                item["asset_name"],

            "priority":
                item["priority"],

            "priority_score":
                item["priority_score"],

            "action":
                template["action"],

            "owner_role":
                template["owner_role"],

            "deadline_minutes":
                template["deadline_minutes"],

            "evidence_required":
                template["evidence_required"],

            "dependency_targets":
                connected_assets,

            "dependency_count":
                len(connected_assets),

            "dependency_links": {

                "outgoing":
                    len(outgoing_links),

                "incoming":
                    len(incoming_links)
            },

            "status":
                "pending",

            "verification_required":
                True,

            "reason": {

                "priority_reason":
                    item["reason"],

                "dependency_reason": (
                    f"{len(connected_assets)} "
                    "connected infrastructure assets "
                    "identified through spatial inference."
                )
            }
        }

        missions.append(
            mission
        )

    return missions


# =========================================================
# GENERATE ROAD MISSIONS
# =========================================================

def generate_road_missions(
    road_priorities
):

    missions = []

    for road in road_priorities:

        # Only P0/P1 roads become missions
        if road["priority"] not in [
            "P0",
            "P1"
        ]:
            continue

        road_id = road["road_id"]

        mission_id = (
            f"MISSION-{road_id}"
        )

        affected_assets = road.get(
            "affected_assets",
            []
        )

        affected_asset_ids = [
            item.get("target")
            for item in affected_assets
            if item.get("target")
        ]

        mission = {

            "id":
                mission_id,

            "mission_type":
                "road",

            "road_id":
                road_id,

            "road_name":
                road.get("road_name"),

            "highway":
                road.get("highway"),

            "priority":
                road["priority"],

            "priority_score":
                road["priority_score"],

            "risk_score":
                road.get("risk_score", 0),

            "risk_level":
                road.get("risk_level"),

            "cascade_score":
                road.get("cascade_score", 0),

            "cascade_level":
                road.get("cascade_level"),

            "affected_count":
                road.get("affected_count", 0),

            "affected_assets":
                affected_asset_ids,

            "action":
                ROAD_MISSION_TEMPLATE[
                    "action"
                ],

            "owner_role":
                ROAD_MISSION_TEMPLATE[
                    "owner_role"
                ],

            "deadline_minutes":
                ROAD_MISSION_TEMPLATE[
                    "deadline_minutes"
                ],

            "evidence_required":
                ROAD_MISSION_TEMPLATE[
                    "evidence_required"
                ],

            "status":
                "pending",

            "verification_required":
                True,

            "reason": {

                "road_risk":
                    road.get(
                        "risk_score"
                    ),

                "cascade_score":
                    road.get(
                        "cascade_score"
                    ),

                "affected_assets":
                    road.get(
                        "affected_count",
                        0
                    ),

                "explanation": (
                    "Road mission generated because "
                    "road hazard exposure and/or "
                    "dependency cascade reached "
                    "an operational priority threshold."
                )
            }
        }

        missions.append(
            mission
        )

    return missions


# =========================================================
# MAIN MISSION GENERATOR
# =========================================================

def generate_missions(
    priorities,
    road_priorities=None
):

    dependency_index = (
        build_dependency_index()
    )

    outgoing = dependency_index[
        "outgoing"
    ]

    incoming = dependency_index[
        "incoming"
    ]

    # -----------------------------------------------------
    # ASSET MISSIONS
    # -----------------------------------------------------

    asset_missions = (
        generate_asset_missions(
            priorities,
            outgoing,
            incoming
        )
    )

    # -----------------------------------------------------
    # ROAD MISSIONS
    # -----------------------------------------------------

    road_missions = []

    if road_priorities:

        road_missions = (
            generate_road_missions(
                road_priorities
            )
        )

    # -----------------------------------------------------
    # COMBINE
    # -----------------------------------------------------

    missions = (
        asset_missions
        + road_missions
    )

    # -----------------------------------------------------
    # SORT
    #
    # P0 first
    # then P1
    # then highest score
    # -----------------------------------------------------

    missions.sort(
        key=lambda mission: (
            0
            if mission["priority"] == "P0"
            else 1
            if mission["priority"] == "P1"
            else 2,

            -mission["priority_score"]
        )
    )

    # -----------------------------------------------------
    # COUNTS
    # -----------------------------------------------------

    p0_missions = sum(
        1
        for mission in missions
        if mission["priority"] == "P0"
    )

    p1_missions = sum(
        1
        for mission in missions
        if mission["priority"] == "P1"
    )

    asset_mission_count = sum(
        1
        for mission in missions
        if mission["mission_type"] == "asset"
    )

    road_mission_count = sum(
        1
        for mission in missions
        if mission["mission_type"] == "road"
    )

    return {

        "total_missions":
            len(missions),

        "asset_missions":
            asset_mission_count,

        "road_missions":
            road_mission_count,

        "p0_missions":
            p0_missions,

        "p1_missions":
            p1_missions,

        "missions":
            missions
    }