from fastapi import APIRouter

from backend.app.agents.service import (
    agent_status,
    mission_intelligence,
    situation_briefing,
)

router = APIRouter()


@router.get("/agents/status")
def get_agent_status():
    return agent_status()


@router.get("/agents/briefing")
def get_situation_briefing():
    return situation_briefing()


@router.get("/agents/mission/{mission_id}/insight")
def get_mission_insight(mission_id: str):
    return mission_intelligence(mission_id)
