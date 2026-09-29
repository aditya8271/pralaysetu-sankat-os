from backend.app.services.dependency_engine import (
    calculate_road_cascade
)


def calculate_road_priorities(
    road_risk_results,
    min_risk_score=65
):
    """
    Convert road risk + dependency cascade
    into operational road priorities.

    Risk is deterministic.
    Dependency relationships are candidate
    spatial-inference relationships and should
    be treated accordingly.
    """

    # -------------------------------------------------
    # Select operationally relevant roads
    # -------------------------------------------------

    candidate_roads = [
        road
        for road in road_risk_results
        if road.get("risk_score", 0) >= min_risk_score
    ]

    road_ids = [
        road["road_id"]
        for road in candidate_roads
    ]

    # -------------------------------------------------
    # Calculate dependency cascade
    # -------------------------------------------------

    cascade_result = calculate_road_cascade(
        road_ids
    )

    cascade_by_road = {
        item["road_id"]: item
        for item in cascade_result["roads"]
    }

    priorities = []

    # -------------------------------------------------
    # Calculate operational priority
    # -------------------------------------------------

    for road in candidate_roads:

        road_id = road["road_id"]

        risk_score = float(
            road.get("risk_score", 0)
        )

        cascade = cascade_by_road.get(
            road_id,
            {}
        )

        cascade_score = float(
            cascade.get("cascade_score", 0)
        )

        affected_count = int(
            cascade.get("affected_count", 0)
        )

        # ---------------------------------------------
        # Operational priority score
        # ---------------------------------------------

        priority_score = (
            0.60 * risk_score
            + 0.40 * cascade_score
        )

        priority_score = round(
            priority_score,
            2
        )

        # ---------------------------------------------
        # Priority classification
        # ---------------------------------------------

        if priority_score >= 85:
            priority = "P0"

        elif priority_score >= 65:
            priority = "P1"

        else:
            priority = "P2"

        # ---------------------------------------------
        # Reason
        # ---------------------------------------------

        reasons = []

        if risk_score >= 80:
            reasons.append(
                "high road hazard exposure"
            )

        elif risk_score >= 65:
            reasons.append(
                "elevated road hazard exposure"
            )

        if affected_count > 0:
            reasons.append(
                f"dependency cascade affects "
                f"{affected_count} infrastructure asset(s)"
            )

        if cascade_score >= 85:
            reasons.append(
                "critical dependency cascade"
            )

        elif cascade_score >= 65:
            reasons.append(
                "high dependency cascade"
            )

        priorities.append({

            "road_id":
                road_id,

            "road_name":
                road.get("road_name"),

            "highway":
                road.get("highway"),

            "distance_km":
                road.get("distance_km"),

            "risk_score":
                risk_score,

            "risk_level":
                road.get("risk_level"),

            "cascade_score":
                cascade_score,

            "affected_count":
                affected_count,

            "cascade_level":
                cascade.get(
                    "cascade_level",
                    "none"
                ),

            "priority_score":
                priority_score,

            "priority":
                priority,

            "reason":
                reasons,

            "affected_assets":
                cascade.get(
                    "affected_assets",
                    []
                ),

            "source":
                road.get(
                    "source",
                    "OpenStreetMap"
                ),

            "source_type":
                road.get(
                    "source_type",
                    "real_public_data"
                )
        })

    # -------------------------------------------------
    # Sort highest operational priority first
    # -------------------------------------------------

    priorities.sort(
        key=lambda item:
        item["priority_score"],
        reverse=True
    )

    return {

        "candidate_road_count":
            len(candidate_roads),

        "p0_count":
            sum(
                1
                for item in priorities
                if item["priority"] == "P0"
            ),

        "p1_count":
            sum(
                1
                for item in priorities
                if item["priority"] == "P1"
            ),

        "p2_count":
            sum(
                1
                for item in priorities
                if item["priority"] == "P2"
            ),

        "priorities":
            priorities
    }