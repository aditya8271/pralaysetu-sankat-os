from typing import Any, Dict, Optional

from backend.app.services.road_risk_engine import calculate_road_risk
from backend.app.services.road_priority_engine import calculate_road_priorities
from backend.app.services.impact_engine import calculate_impact
from backend.app.services.priority_engine import calculate_priority


# =========================================================
# FIELD STATE HELPERS
# =========================================================

def determine_field_state(
    verification: Optional[Dict[str, Any]]
) -> str:
    """
    Convert Gemini verification output into an operational
    field state.

    IMPORTANT:
    Gemini does not autonomously close or resolve missions.
    Human review is still required.
    """

    if not verification:
        return "unknown"

    incident_type = str(
        verification.get("incident_type", "")
    ).lower()

    severity = str(
        verification.get("severity", "")
    ).lower()

    needs_human_review = verification.get(
        "needs_human_review",
        True
    )

    # If evidence is insufficient, keep state uncertain.
    if needs_human_review:
        return "human_review"

    # Road-related observations
    if (
        "blocked" in incident_type
        or "obstruction" in incident_type
        or "road damage" in incident_type
        or "pothole" in incident_type
    ):
        if severity in {"high", "critical"}:
            return "blocked"

        return "degraded"

    # No confirmed incident
    if (
        "no damage" in incident_type
        or "clear" in incident_type
        or "normal" in incident_type
    ):
        return "clear"

    return "observed"


# =========================================================
# ROAD REASSESSMENT
# =========================================================

def reassess_road(
    road_id: str,
    hazard: Dict[str, Any],
    verification: Optional[Dict[str, Any]] = None,
    roads=None
) -> Dict[str, Any]:
    """
    Reassess a road after field evidence.

    This recalculates:
        1. Road hazard risk
        2. Dependency cascade
        3. Operational priority

    Field evidence is treated as an observation.
    It does not automatically mark a mission resolved.
    """

    # -----------------------------------------------------
    # FIELD STATE
    # -----------------------------------------------------

    field_state = determine_field_state(
        verification
    )

    # -----------------------------------------------------
    # RECALCULATE ROAD RISK
    # -----------------------------------------------------

    hazard_lat = hazard.get("latitude")
    hazard_lon = hazard.get("longitude")

    if hazard_lat is None or hazard_lon is None:
        raise ValueError(
            "Hazard latitude and longitude are required."
        )

    road_risk_result = calculate_road_risk(
        hazard_lat=hazard_lat,
        hazard_lon=hazard_lon,
        wind_speed_kmh=hazard.get(
            "wind_speed_kmh",
            0
        ),
        rainfall_mm=hazard.get(
            "rainfall_mm",
            0
        ),
        roads=roads
    )

    road_result = next(
        (
            road
            for road in road_risk_result["roads"]
            if road.get("road_id") == road_id
        ),
        None
    )

    if road_result is None:
        raise ValueError(
            f"Road {road_id} not found."
        )

    # -----------------------------------------------------
    # RECALCULATE ROAD PRIORITY
    # -----------------------------------------------------

    priority_result = calculate_road_priorities(
        road_risk_result["roads"]
    )

    priority = next(
        (
            item
            for item in priority_result["priorities"]
            if item.get("road_id") == road_id
        ),
        None
    )

    # -----------------------------------------------------
    # FIELD OBSERVATION OVERLAY
    # -----------------------------------------------------

    operational_status = field_state

    # Field observation does NOT modify the deterministic
    # hazard score. Instead, it is kept as an additional
    # operational state.
    #
    # This separation is important:
    #
    # predicted risk != observed condition
    #
    # The UI can show both independently.

    return {
        "road_id": road_id,

        "field_state": operational_status,

        "predicted_risk": {
            "risk_score": road_result.get(
                "risk_score"
            ),
            "risk_level": road_result.get(
                "risk_level"
            ),
            "distance_km": road_result.get(
                "distance_km"
            )
        },

        "operational_priority": (
            priority
            if priority is not None
            else {}
        ),

        "verification": verification or {},

        "reassessment": {
            "status": "completed",
            "source": "field_evidence_plus_deterministic_recalculation"
        }
    }


# =========================================================
# ASSET REASSESSMENT
# =========================================================

def reassess_assets(
    hazard: Dict[str, Any],
    impact_results=None
) -> Dict[str, Any]:
    """
    Recalculate infrastructure asset impact and priority.

    Existing deterministic engines are reused.
    """

    # -----------------------------------------------------
    # IMPACT
    # -----------------------------------------------------

    if impact_results is None:
        impact_results = calculate_impact(
            hazard
        )

    # -----------------------------------------------------
    # PRIORITY
    # -----------------------------------------------------

    priority_result = calculate_priority(
        impact_results["results"]
    )

    return {
        "impact": impact_results,
        "priority": priority_result,
        "reassessment": {
            "status": "completed",
            "source": "deterministic_recalculation"
        }
    }


# =========================================================
# COMPLETE REASSESSMENT
# =========================================================

def reassess_after_field_verification(
    mission: Dict[str, Any],
    hazard: Dict[str, Any],
    verification: Optional[Dict[str, Any]] = None,
    roads=None
) -> Dict[str, Any]:
    """
    Main reassessment entry point.

    Supports:
        - road missions
        - asset missions

    Returns updated operational intelligence.
    """

    mission_type = mission.get(
        "mission_type",
        "asset"
    )

    # -----------------------------------------------------
    # ROAD MISSION
    # -----------------------------------------------------

    if mission_type == "road":

        road_id = mission.get(
            "road_id"
        )

        if not road_id:
            raise ValueError(
                "Road mission does not contain road_id."
            )

        road_reassessment = reassess_road(
            road_id=road_id,
            hazard=hazard,
            verification=verification,
            roads=roads
        )

        return {
            "mission_id": mission.get(
                "id"
            ),

            "mission_type": "road",

            "road": road_reassessment,

            "next_action": (
                "human_review"
                if road_reassessment["field_state"]
                == "human_review"
                else "operational_reassessment"
            )
        }

    # -----------------------------------------------------
    # ASSET MISSION
    # -----------------------------------------------------

    asset_reassessment = reassess_assets(
        hazard=hazard
    )

    return {
        "mission_id": mission.get(
            "id"
        ),

        "mission_type": "asset",

        "asset": asset_reassessment,

        "next_action": "operational_reassessment"
    }