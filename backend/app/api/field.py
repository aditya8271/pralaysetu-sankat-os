from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pathlib import Path
from datetime import datetime

from backend.app.api.missions import get_mission

router = APIRouter()

EVIDENCE_DIR = Path("data/field_evidence")
EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)


@router.post("/missions/{mission_id}/evidence/upload")
async def upload_evidence(
    mission_id: str,
    latitude: float = Form(...),
    longitude: float = Form(...),
    notes: str = Form(""),
    transcript: str = Form(""),
    photo: UploadFile | None = File(None),
    voice: UploadFile | None = File(None),
):
    mission = get_mission(mission_id)

    mission_dir = EVIDENCE_DIR / mission_id
    mission_dir.mkdir(parents=True, exist_ok=True)

    saved_files = []

    # Save photo
    if photo:
        photo_ext = Path(photo.filename or "").suffix.lower()

        allowed_photo = [".jpg", ".jpeg", ".png", ".webp"]

        if photo_ext not in allowed_photo:
            raise HTTPException(
                status_code=400,
                detail="Unsupported photo format"
            )

        filename = (
            f"photo_"
            f"{datetime.now().strftime('%Y%m%d_%H%M%S_%f')}"
            f"{photo_ext}"
        )

        photo_path = mission_dir / filename

        content = await photo.read()
        photo_path.write_bytes(content)

        saved_files.append(str(photo_path))

    # Save voice
    if voice:
        voice_ext = Path(voice.filename or "").suffix.lower()

        allowed_voice = [".wav", ".mp3", ".m4a", ".ogg"]

        if voice_ext not in allowed_voice:
            raise HTTPException(
                status_code=400,
                detail="Unsupported voice format"
            )

        filename = (
            f"voice_"
            f"{datetime.now().strftime('%Y%m%d_%H%M%S_%f')}"
            f"{voice_ext}"
        )

        voice_path = mission_dir / filename

        content = await voice.read()
        voice_path.write_bytes(content)

        saved_files.append(str(voice_path))

    # Save evidence metadata
    mission["evidence"] = {
        "latitude": latitude,
        "longitude": longitude,
        "notes": notes,
        "transcript": transcript,
        "files": saved_files,
        "photo_uploaded": photo is not None,
        "voice_uploaded": voice is not None,
    }

    mission["status"] = "verification_required"

    return {
        "status": "success",
        "message": "Field evidence uploaded. Verification required.",
        "mission_id": mission_id,
        "evidence": mission["evidence"],
        "mission_status": mission["status"],
    }