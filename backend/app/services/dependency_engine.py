import json
from pathlib import Path
from collections import defaultdict


DEPENDENCIES_FILE = (
    Path(__file__).resolve().parents[3]
    / "data"
    / "processed"
    / "puri_dependencies.json"
)


# Criticality used for operational cascade calculation.
# These values represent the relative importance of asset types
# in the demo model, not official government criticality ratings.
CRITICAL_TYPES = {
    "hospital": 100,
    "blood_bank": 100,
    "shelter": 95,
    "police": 90,
    "clinic": 85,
    "pharmacy": 80,
    "power_tower": 75,
    "school": 65,
    "bus_station": 60,
    "fuel": 55,
}


def load_dependencies():
    """
    Load spatially inferred dependency relationships
    generated from the Puri OSM dataset.
    """

    with open(DEPENDENCIES_FILE, "r", encoding="utf-8") as file:
        data = json.load(file)

    return data["dependencies"]


def build_dependency_graph():
    """
    Build directed graph:

        ROAD -> INFRASTRUCTURE

    Example:

        ROAD-123
            |
            +--> hospital
            |
            +--> police
            |
            +--> shelter
    """

    dependencies = load_dependencies()

    graph = defaultdict(list)

    for dependency in dependencies:

        source = dependency["source"]
        target = dependency["target"]

        graph[source].append(dependency)

    return graph


def build_reverse_dependency_graph():
    """
    Build reverse graph:

        INFRASTRUCTURE -> ROADS

    This is useful for understanding which roads
    provide access to a particular asset.
    """

    dependencies = load_dependencies()

    reverse_graph = defaultdict(list)

    for dependency in dependencies:

        source = dependency["source"]
        target = dependency["target"]

        reverse_graph[target].append(dependency)

    return reverse_graph


def calculate_cascade(source_asset_id, max_depth=2):
    """
    Existing generic cascade traversal.

    Starts from a source asset and follows outgoing
    dependency relationships.

    Example:

        ROAD
          ↓
        POLICE
    """

    graph = build_dependency_graph()

    visited = set()

    queue = [
        (source_asset_id, 0)
    ]

    affected_assets = []

    while queue:

        current_id, depth = queue.pop(0)

        if current_id in visited:
            continue

        visited.add(current_id)

        if depth >= max_depth:
            continue

        for dependency in graph.get(
            current_id,
            []
        ):

            target_id = dependency["target"]

            if target_id in visited:
                continue

            target_type = dependency.get(
                "target_type",
                "unknown"
            )

            criticality = CRITICAL_TYPES.get(
                target_type,
                50
            )

            affected_assets.append({
                "source": current_id,
                "target": target_id,
                "target_type": target_type,
                "depth": depth + 1,
                "relation": dependency.get(
                    "relation"
                ),
                "distance_km": dependency.get(
                    "distance_km"
                ),
                "confidence": dependency.get(
                    "confidence"
                ),
                "status": dependency.get(
                    "status"
                ),
                "relationship_source": dependency.get(
                    "relationship_source"
                ),
                "criticality_score": criticality
            })

            queue.append(
                (
                    target_id,
                    depth + 1
                )
            )

    cascade_score = 0

    for item in affected_assets:

        depth_penalty = 1 / item["depth"]

        cascade_score += (
            item["criticality_score"]
            * depth_penalty
        )

    cascade_score = round(
        min(cascade_score, 100),
        2
    )

    return {
        "source_asset_id": source_asset_id,
        "affected_count": len(
            affected_assets
        ),
        "cascade_score": cascade_score,
        "affected_assets": affected_assets
    }


def calculate_cascade_for_assets(
    asset_ids
):
    """
    Calculate cascade impact for multiple
    source assets.
    """

    results = []

    for asset_id in asset_ids:

        result = calculate_cascade(
            asset_id
        )

        results.append(result)

    return {
        "source_asset_count": len(asset_ids),
        "cascade_results": results
    }


def calculate_road_cascade(
    road_ids=None,
    min_criticality=0
):
    """
    Calculate operational consequences of
    roads becoming inaccessible.

    The dependency data has relationships:

        ROAD -> INFRASTRUCTURE

    Therefore, this function starts from roads
    and identifies the infrastructure that depends
    on those roads for access.

    This does NOT claim that the road is actually
    blocked. It only calculates the potential
    downstream consequence if the road becomes
    unavailable.

    Parameters
    ----------
    road_ids:
        Optional list of road IDs.

        If None, all roads present in the
        dependency dataset are analysed.

    min_criticality:
        Ignore dependent assets below this
        criticality score.
    """

    graph = build_dependency_graph()

    # If specific roads are supplied,
    # analyse only those roads.
    if road_ids:

        selected_roads = [
            road_id
            for road_id in road_ids
            if road_id in graph
        ]

    else:

        selected_roads = [
            source
            for source in graph.keys()
            if source.startswith("ROAD-")
        ]

    road_results = []

    for road_id in selected_roads:

        dependencies = graph.get(
            road_id,
            []
        )

        affected_assets = []

        total_cascade_score = 0

        for dependency in dependencies:

            target_id = dependency.get(
                "target"
            )

            target_type = dependency.get(
                "target_type",
                "unknown"
            )

            criticality = CRITICAL_TYPES.get(
                target_type,
                50
            )

            if criticality < min_criticality:
                continue

            affected_asset = {
                "target": target_id,
                "target_type": target_type,
                "criticality_score": criticality,
                "relation": dependency.get(
                    "relation"
                ),
                "distance_km": dependency.get(
                    "distance_km"
                ),
                "confidence": dependency.get(
                    "confidence"
                ),
                "status": dependency.get(
                    "status"
                ),
                "relationship_source": dependency.get(
                    "relationship_source"
                )
            }

            affected_assets.append(
                affected_asset
            )

            total_cascade_score += (
                criticality
            )

        # Cap score at 100.
        cascade_score = round(
            min(
                total_cascade_score,
                100
            ),
            2
        )

        # Determine operational consequence.
        if cascade_score >= 85:

            cascade_level = "critical"

        elif cascade_score >= 65:

            cascade_level = "high"

        elif cascade_score >= 40:

            cascade_level = "moderate"

        else:

            cascade_level = "low"

        road_results.append({
            "road_id": road_id,

            "affected_count": len(
                affected_assets
            ),

            "cascade_score": cascade_score,

            "cascade_level": cascade_level,

            "affected_assets": affected_assets
        })

    # Most consequential roads first.
    road_results.sort(
        key=lambda item: (
            item["cascade_score"],
            item["affected_count"]
        ),
        reverse=True
    )

    return {
        "road_count": len(
            road_results
        ),
        "roads": road_results
    }


def calculate_road_cascade_for_roads(
    road_ids
):
    """
    Convenience wrapper for analysing
    a selected set of roads.
    """

    return calculate_road_cascade(
        road_ids=road_ids
    )