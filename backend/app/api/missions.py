from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional


router = APIRouter()


# =========================================================
# IN-MEMORY MISSION STORE
# =========================================================

MISSIONS = {}


# =========================================================
# ALLOWED STATUS TRANSITIONS
# =========================================================

STATUS_TRANSITIONS = {
    "pending": [
        "assigned"
    ],

    "assigned": [
        "acknowledged"
    ],

    "acknowledged": [
        "in_progress"
    ],

    "in_progress": [
        "verification_required"
    ],

    "verification_required": [
        "human_review"
    ],

    "human_review": [
        "resolved",
        "reopened",
        "escalated"
    ],

    "reopened": [
        "assigned",
        "in_progress",
        "escalated"
    ],

    "escalated": [
        "assigned",
        "resolved"
    ],

    "resolved": []
}


# =========================================================
# STATUS REQUEST MODEL
# =========================================================

class MissionStatusUpdate(BaseModel):

    status: str
    note: Optional[str] = None


# =========================================================
# SAVE MISSIONS
# =========================================================

def save_missions(missions):

    for mission in missions:

        mission_id = mission["id"]

        # Preserve existing mission state
        if mission_id in MISSIONS:

            existing = MISSIONS[mission_id]

            mission["status"] = existing.get(
                "status",
                mission.get("status", "pending")
            )

            if "status_history" in existing:
                mission["status_history"] = (
                    existing["status_history"]
                )

        else:

            mission["status"] = mission.get(
                "status",
                "pending"
            )

            mission["status_history"] = [
                {
                    "status": mission["status"],
                    "note": "Mission created"
                }
            ]

        MISSIONS[mission_id] = mission


# =========================================================
# GET MISSION
# =========================================================

def get_mission(mission_id: str):

    if mission_id not in MISSIONS:

        raise HTTPException(
            status_code=404,
            detail="Mission not found"
        )

    return MISSIONS[mission_id]


# =========================================================
# UPDATE STATUS
# =========================================================

def update_mission_status(
    mission_id: str,
    new_status: str,
    note: Optional[str] = None
):

    mission = get_mission(mission_id)

    current_status = mission.get(
        "status",
        "pending"
    )

    # ---------------------------------------------
    # Validate status
    # ---------------------------------------------

    allowed_statuses = [
        "pending",
        "assigned",
        "acknowledged",
        "in_progress",
        "verification_required",
        "human_review",
        "resolved",
        "reopened",
        "escalated"
    ]

    if new_status not in allowed_statuses:

        raise HTTPException(
            status_code=400,
            detail={
                "message": "Invalid mission status",
                "allowed_statuses": allowed_statuses
            }
        )

    # ---------------------------------------------
    # Validate transition
    # ---------------------------------------------

    allowed_transitions = STATUS_TRANSITIONS.get(
        current_status,
        []
    )

    if new_status not in allowed_transitions:

        raise HTTPException(
            status_code=400,
            detail={
                "message": "Invalid mission status transition",
                "current_status": current_status,
                "requested_status": new_status,
                "allowed_next_statuses": allowed_transitions
            }
        )

    # ---------------------------------------------
    # Update mission
    # ---------------------------------------------

    mission["status"] = new_status

    # ---------------------------------------------
    # Add status history
    # ---------------------------------------------

    if "status_history" not in mission:
        mission["status_history"] = []

    history_entry = {
        "status": new_status
    }

    if note:
        history_entry["note"] = note

    mission["status_history"].append(
        history_entry
    )

    return mission


# =========================================================
# LIST MISSIONS
# =========================================================

@router.get("/missions")
def list_missions():

    return {
        "total": len(MISSIONS),
        "missions": list(
            MISSIONS.values()
        )
    }


# =========================================================
# GET SINGLE MISSION
# =========================================================

@router.get("/missions/{mission_id}")
def get_single_mission(
    mission_id: str
):

    return get_mission(
        mission_id
    )


# =========================================================
# GENERIC STATUS UPDATE
# =========================================================

@router.patch(
    "/missions/{mission_id}/status"
)
def change_mission_status(
    mission_id: str,
    update: MissionStatusUpdate
):

    mission = update_mission_status(
        mission_id,
        update.status,
        update.note
    )

    return {
        "status": "success",
        "message": (
            f"Mission status updated to "
            f"{mission['status']}"
        ),
        "mission": mission
    }


# =========================================================
# ASSIGN
# =========================================================

@router.post(
    "/missions/{mission_id}/assign"
)
def assign_mission(
    mission_id: str
):

    mission = update_mission_status(
        mission_id,
        "assigned",
        "Mission assigned to response team"
    )

    return {
        "status": "success",
        "message": "Mission assigned",
        "mission": mission
    }


# =========================================================
# ACKNOWLEDGE
# =========================================================

@router.post(
    "/missions/{mission_id}/acknowledge"
)
def acknowledge_mission(
    mission_id: str
):

    mission = update_mission_status(
        mission_id,
        "acknowledged",
        "Field team acknowledged mission"
    )

    return {
        "status": "success",
        "message": "Mission acknowledged",
        "mission": mission
    }


# =========================================================
# START
# =========================================================

@router.post(
    "/missions/{mission_id}/start"
)
def start_mission(
    mission_id: str
):

    mission = update_mission_status(
        mission_id,
        "in_progress",
        "Field team started mission"
    )

    return {
        "status": "success",
        "message": "Mission started",
        "mission": mission
    }


# =========================================================
# COMPLETE
# =========================================================

@router.post(
    "/missions/{mission_id}/complete"
)
def complete_mission(
    mission_id: str
):

    mission = update_mission_status(
        mission_id,
        "verification_required",
        "Field action completed. Evidence verification required."
    )

    return {
        "status": "success",
        "message": (
            "Mission completed. "
            "Evidence verification required."
        ),
        "mission": mission
    }


# =========================================================
# MOVE TO HUMAN REVIEW
# =========================================================

@router.post(
    "/missions/{mission_id}/human-review"
)
def move_to_human_review(
    mission_id: str
):

    mission = update_mission_status(
        mission_id,
        "human_review",
        "AI evidence analysis completed. Human review required."
    )

    return {
        "status": "success",
        "message": "Mission moved to human review",
        "mission": mission
    }


# =========================================================
# RESOLVE
# =========================================================

@router.post(
    "/missions/{mission_id}/resolve"
)
def resolve_mission(
    mission_id: str
):

    mission = update_mission_status(
        mission_id,
        "resolved",
        "Evidence verified and mission resolved"
    )

    return {
        "status": "success",
        "message": "Mission resolved",
        "mission": mission
    }


# =========================================================
# REOPEN
# =========================================================

@router.post(
    "/missions/{mission_id}/reopen"
)
def reopen_mission(
    mission_id: str
):

    mission = update_mission_status(
        mission_id,
        "reopened",
        "Evidence indicates that further action is required"
    )

    return {
        "status": "success",
        "message": "Mission reopened",
        "mission": mission
    }


# =========================================================
# ESCALATE
# =========================================================

@router.post(
    "/missions/{mission_id}/escalate"
)
def escalate_mission(
    mission_id: str
):

    mission = update_mission_status(
        mission_id,
        "escalated",
        "Mission requires higher-level intervention"
    )

    return {
        "status": "success",
        "message": "Mission escalated",
        "mission": mission
    }