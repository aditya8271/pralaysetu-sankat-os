"""
Sankat OS - Field Dispatch API
Phase 1: connects an existing mission to a PWD / field worker.

This module intentionally does NOT replace the existing mission lifecycle.
It adds assignment metadata on top of the existing /assign endpoint behavior.

Later deployments can connect the team queue to an approved push or department messaging channel.
"""

from datetime import datetime, timezone
from urllib.parse import quote

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

# IMPORTANT:
# Keep this module independent from missions.py's internal in-memory store.
# The existing mission API remains the source of truth for mission lifecycle.
router = APIRouter(prefix="/dispatch", tags=["field-dispatch"])

# Prototype-only in-memory dispatch registry.
# Like the existing mission store, this resets when FastAPI restarts.
DISPATCHES: dict[str, dict] = {}


class DispatchRequest(BaseModel):
    team: str = Field(default="PWD Team", min_length=1, max_length=100)
    worker_name: str = Field(default="Field Worker 07", min_length=1, max_length=100)
    notify_team: bool = True


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _field_url(mission_id: str) -> str:
    # Local development URL for now.
    # Before deployment, set FIELD_APP_BASE_URL in the backend.
    import os

    base = os.getenv("FIELD_APP_BASE_URL", "http://localhost:3000")
    return f"{base.rstrip('/')}/field?mission={quote(mission_id)}"


def notify_team_queue(mission_id: str, team: str, worker_name: str, notify_team: bool) -> dict:
    """Register a mission in the department response queue.

    This is the prototype notification channel: no personal phone number is
    required and the API never claims that an external SMS/push was sent.
    A production deployment can later connect this queue to authenticated
    mobile push, official department messaging, or another approved channel.
    """
    if not notify_team:
        return {
            "requested": False,
            "channel": "team_queue",
            "status": "not_requested",
            "provider": None,
        }

    return {
        "requested": True,
        "channel": "team_queue",
        "status": "queued",
        "provider": "Sankat OS response queue",
        "message": f"Mission queued for {team}; assigned worker: {worker_name}.",
    }


@router.post("/{mission_id}")
def dispatch_mission(mission_id: str, payload: DispatchRequest):
    """
    Dispatch metadata endpoint.

    The frontend should call the existing mission assignment endpoint first:
        POST /api/missions/{mission_id}/assign

    Then call:
        POST /api/dispatch/{mission_id}

    This keeps the existing mission lifecycle untouched.
    """

    notification = notify_team_queue(
        mission_id=mission_id,
        team=payload.team,
        worker_name=payload.worker_name,
        notify_team=payload.notify_team,
    )

    record = {
        "mission_id": mission_id,
        "team": payload.team,
        "worker_name": payload.worker_name,
        "assigned_at": _now(),
        "field_url": _field_url(mission_id),
        "notification": notification,
        "status": "dispatched",
    }

    DISPATCHES[mission_id] = record

    return {
        "status": "success",
        "message": "Mission dispatched to field worker.",
        "dispatch": record,
    }


@router.get("/{mission_id}")
def get_dispatch(mission_id: str):
    record = DISPATCHES.get(mission_id)

    if not record:
        raise HTTPException(
            status_code=404,
            detail=f"No field dispatch found for mission {mission_id}",
        )

    return {
        "status": "success",
        "dispatch": record,
    }


@router.get("")
def list_dispatches():
    return {
        "total": len(DISPATCHES),
        "dispatches": list(DISPATCHES.values()),
    }
