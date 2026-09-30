from __future__ import annotations

import json
import threading
from typing import Any, Dict, List

from backend.app.api import hazard as hazard_api
from backend.app.api.missions import MISSIONS
from backend.app.services.gemini_service import API_KEYS, MODELS

_agent_request_lock = threading.Lock()


def _generate_agent_json(prompt: str) -> tuple[Dict[str, Any] | None, str | None]:
    if not API_KEYS:
        return None, "Gemini API key not configured."

    if not _agent_request_lock.acquire(blocking=False):
        return None, "An AI agent request is already running. Please retry shortly."

    try:
        from google import genai
        from google.genai import types

        last_error = "Gemini returned an unusable response."
        for model in MODELS:
            try:
                client = genai.Client(
                    api_key=API_KEYS[0],
                    http_options=types.HttpOptions(
                        timeout=15000,
                        retry_options=types.HttpRetryOptions(attempts=1),
                    ),
                )
                response = client.models.generate_content(
                    model=model,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        thinking_config=types.ThinkingConfig(thinking_level="low"),
                    ),
                )
                if not response.text:
                    last_error = "Gemini returned an empty response."
                    continue

                payload = json.loads(response.text)
                if not isinstance(payload, dict) or not isinstance(payload.get("summary"), str) or not payload["summary"].strip():
                    last_error = "Gemini response did not include a summary."
                    continue
                return payload, None
            except Exception:
                last_error = "Gemini service request failed or returned an invalid response."

        return None, last_error
    finally:
        _agent_request_lock.release()


def _mission_facts() -> List[Dict[str, Any]]:
    missions = list(MISSIONS.values())
    facts: List[Dict[str, Any]] = []
    for mission in missions:
        facts.append(
            {
                "id": mission.get("id"),
                "asset": mission.get("asset") or mission.get("asset_name") or mission.get("asset_id"),
                "priority": mission.get("priority"),
                "status": mission.get("status"),
                "action": mission.get("action"),
                "owner_role": mission.get("owner_role"),
                "deadline_minutes": mission.get("deadline_minutes"),
                "risk_score": mission.get("risk_score"),
                "priority_score": mission.get("priority_score"),
            }
        )
    return facts


def _hazard_facts() -> Dict[str, Any]:
    hazard = getattr(hazard_api, "_current_hazard", None)
    if not hazard:
        return {"status": "unavailable", "message": "No hazard data available"}
    return {
        "source": hazard.get("source"),
        "mode": hazard.get("mode"),
        "alert_level": hazard.get("alert_level"),
        "warning_status": hazard.get("warning_status"),
        "weather_status": hazard.get("weather_status"),
        "area": hazard.get("area"),
        "safety_phase": hazard.get("safety_phase") or hazard_api._derive_safety_phase(hazard),
    }


def agent_status() -> Dict[str, Any]:
    configured = bool(API_KEYS)
    return {
        "available": configured,
        "configured": configured,
        "agent_count": 2,
        "agents": [
            "Situation Briefing Agent",
            "Mission Intelligence Agent",
        ],
        "message": (
            "AI agents configured; provider availability is checked when an agent is run."
            if configured
            else "AI agent service unavailable. Existing workflow continues without AI summary."
        ),
        "source": "existing_project_data",
    }


def situation_briefing() -> Dict[str, Any]:
    hazard = _hazard_facts()
    missions = _mission_facts()
    status_counts: Dict[str, int] = {}
    for mission in missions:
        status = str(mission.get("status") or "unknown")
        status_counts[status] = status_counts.get(status, 0) + 1

    facts = {
        "hazard": hazard,
        "mission_count": len(missions),
        "missions_by_status": status_counts,
        "mission_ids": [mission.get("id") for mission in missions],
    }

    if not API_KEYS:
        return {
            "available": False,
            "agent": "Situation Briefing Agent",
            "message": "AI agent service unavailable",
            "source": "existing_project_data",
            "facts": facts,
        }

    prompt = (
        "You are a disaster-response briefing agent. Use ONLY the following project facts. "
        "Do not claim anything as confirmed ground truth beyond the supplied data. "
        "Return one JSON object with exactly these fields: summary (a concise string), "
        "observations (an array of strings), recommendations (an array of strings). "
        "Recommendations must be suggestions for a human officer and must never claim to have changed the system.\n\n"
        + json.dumps(facts, ensure_ascii=False)
    )
    payload, error = _generate_agent_json(prompt)
    if payload is not None:
        return {
            "available": True,
            "agent": "Situation Briefing Agent",
            "summary": payload["summary"],
            "observations": payload.get("observations") if isinstance(payload.get("observations"), list) else [],
            "recommendations": payload.get("recommendations") if isinstance(payload.get("recommendations"), list) else [],
            "source": "existing_project_data",
            "facts": facts,
        }

    return {
        "available": False,
        "agent": "Situation Briefing Agent",
        "message": "AI agent service unavailable",
        "error": error or "Gemini model unavailable",
        "source": "existing_project_data",
        "facts": facts,
    }


def mission_intelligence(mission_id: str) -> Dict[str, Any]:
    mission = MISSIONS.get(mission_id)
    if mission is None:
        return {
            "available": False,
            "agent": "Mission Intelligence Agent",
            "mission_id": mission_id,
            "message": "Mission not found.",
            "source": "existing_project_data",
        }

    facts = {
        "mission_id": mission.get("id"),
        "asset": mission.get("asset") or mission.get("asset_name") or mission.get("asset_id"),
        "action": mission.get("action"),
        "priority": mission.get("priority"),
        "risk_score": mission.get("risk_score"),
        "priority_score": mission.get("priority_score"),
        "status": mission.get("status"),
        "owner_role": mission.get("owner_role"),
        "deadline_minutes": mission.get("deadline_minutes"),
        "evidence_required": mission.get("evidence_required"),
        "dependency_targets": mission.get("dependency_targets"),
    }

    if not API_KEYS:
        return {
            "available": False,
            "agent": "Mission Intelligence Agent",
            "mission_id": mission_id,
            "message": "AI agent service unavailable",
            "source": "existing_project_data",
            "facts": facts,
        }

    prompt = (
        "You are a mission-analysis agent. Use ONLY the supplied mission facts. "
        "Do not propose or claim mission changes or status changes. "
        "Return one JSON object with exactly these fields: summary (a concise string), "
        "reasoning (an array of strings grounded in the supplied facts), "
        "recommendations (an array of optional suggestions for a human officer).\n\n"
        + json.dumps(facts, ensure_ascii=False)
    )
    payload, error = _generate_agent_json(prompt)
    if payload is not None:
        return {
            "available": True,
            "agent": "Mission Intelligence Agent",
            "mission_id": mission_id,
            "summary": payload["summary"],
            "reasoning": payload.get("reasoning") if isinstance(payload.get("reasoning"), list) else [],
            "recommendations": payload.get("recommendations") if isinstance(payload.get("recommendations"), list) else [],
            "source": "existing_project_data",
            "facts": facts,
        }

    return {
        "available": False,
        "agent": "Mission Intelligence Agent",
        "mission_id": mission_id,
        "message": "AI agent service unavailable",
        "error": error or "Gemini model unavailable",
        "source": "existing_project_data",
        "facts": facts,
    }
