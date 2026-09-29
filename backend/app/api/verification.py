from fastapi import APIRouter, HTTPException
from pathlib import Path

from backend.app.api.missions import (
    get_mission,
    update_mission_status
)

from backend.app.services.gemini_service import (
    verify_field_evidence
)

from backend.app.services.reassessment_engine import (
    reassess_after_field_verification
)


router = APIRouter()


# =========================================================
# VERIFY FIELD EVIDENCE
# =========================================================

@router.post(
    "/missions/{mission_id}/verify"
)
def verify_mission_evidence(
    mission_id: str
):

    # -----------------------------------------------------
    # 1. Get mission
    # -----------------------------------------------------

    mission = get_mission(
        mission_id
    )


    # -----------------------------------------------------
    # 2. Get evidence
    # -----------------------------------------------------

    evidence = mission.get(
        "evidence"
    )

    if not evidence:

        raise HTTPException(
            status_code=400,
            detail="No evidence submitted for this mission."
        )


    # -----------------------------------------------------
    # 3. Get evidence files
    # -----------------------------------------------------

    files = evidence.get(
        "files",
        []
    )

    if not files:

        raise HTTPException(
            status_code=400,
            detail="No evidence photo found."
        )


    # -----------------------------------------------------
    # 4. Check photo
    # -----------------------------------------------------

    photo_path = Path(
        files[0]
    )

    if not photo_path.is_file():

        raise HTTPException(
            status_code=400,
            detail="Evidence photo file not found."
        )


    # -----------------------------------------------------
    # 5. Send evidence to Gemini
    # -----------------------------------------------------

    result = verify_field_evidence(
        photo_path=photo_path,
        mission=mission,
        evidence=evidence
    )


    # -----------------------------------------------------
    # 6. Save verification result
    # -----------------------------------------------------

    mission["verification"] = result


    # -----------------------------------------------------
    # 7. Run reassessment
    # -----------------------------------------------------

    reassessment = None

    if result.get("status") == "analyzed":

        try:

            # Current hazard information stored with mission
            hazard = mission.get(
                "hazard"
            )

            if hazard:

                reassessment = (
                    reassess_after_field_verification(
                        mission=mission,
                        hazard=hazard,
                        verification=result
                    )
                )

                mission["reassessment"] = (
                    reassessment
                )

            else:

                mission["reassessment"] = {
                    "status": "skipped",
                    "reason": "Hazard data not available in mission."
                }

        except Exception as error:

            mission["reassessment"] = {
                "status": "failed",
                "error": str(error)
            }


    # -----------------------------------------------------
    # 8. Update mission status
    # -----------------------------------------------------

    if result.get("status") == "analyzed":

        mission = update_mission_status(
            mission_id,
            "human_review",
            "Gemini analyzed field evidence. Reassessment completed. Human review required."
        )

    else:

        # AI verification failed/unavailable.
        # Keep mission open for manual verification.

        mission["status"] = (
            "verification_required"
        )


    # -----------------------------------------------------
    # 9. Return result
    # -----------------------------------------------------

    return {

        "status": "success",

        "mission_id":
            mission_id,

        "mission_status":
            mission["status"],

        "verification":
            result,

        "reassessment":
            reassessment
    }