import os
import time
import json
from pathlib import Path
from dotenv import load_dotenv
from google import genai
from google.genai import types

# Load environment variables
load_dotenv()

# ---------------------------------------------------------
# Gemini API Keys
# ---------------------------------------------------------
API_KEYS = [
    os.getenv(f"GEMINI_API_KEY_{i}")
    for i in range(1, 5)
]
API_KEYS = [key for key in API_KEYS if key]

# ---------------------------------------------------------
# Gemini Models
#
# Primary: current stable multimodal Flash model
# Fallback: lighter stable multimodal Flash model
# ---------------------------------------------------------
PRIMARY_MODEL = os.getenv(
    "GEMINI_MODEL",
    "gemini-3.8-flash",
)

FALLBACK_MODEL = os.getenv(
    "GEMINI_FALLBACK_MODEL",
    "gemini-3.5-flash-lite",
)

MODELS = [PRIMARY_MODEL, FALLBACK_MODEL]

# ---------------------------------------------------------
# Field Evidence Verification
# ---------------------------------------------------------
def verify_field_evidence(photo_path, mission, evidence):
    # ---------------------------------------------
    # 1. Check API keys
    # ---------------------------------------------
    if not API_KEYS:
        return {
            "status": "unavailable",
            "needs_human_review": True,
            "reason": "Gemini API key not configured.",
        }

    # ---------------------------------------------
    # 2. Check photo
    # ---------------------------------------------
    photo = Path(photo_path)
    if not photo.is_file():
        return {
            "status": "unavailable",
            "needs_human_review": True,
            "reason": "Evidence photo not found.",
        }

    # ---------------------------------------------
    # 3. Detect image type
    # ---------------------------------------------
    mime_types = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
    }

    mime_type = mime_types.get(photo.suffix.lower())

    if not mime_type:
        return {
            "status": "unavailable",
            "needs_human_review": True,
            "reason": "Unsupported image format.",
        }

    # ---------------------------------------------
    # 4. Build verification prompt
    # ---------------------------------------------
    prompt = f"""
You are an AI assistant for disaster response evidence review.

MISSION:
Asset: {mission.get('asset_name')}
Action: {mission.get('action')}

FIELD REPORT:
Notes: {evidence.get('notes')}
Transcript: {evidence.get('transcript')}
Reported GPS: {evidence.get('latitude')}, {evidence.get('longitude')}

Analyze the attached image.

RULES:
- Describe only what is actually visible.
- Do not assume that the photo proves the reported location.
- Do not invent infrastructure damage.
- If evidence is insufficient, require human review.
- Do not authorize mission closure.
- Return JSON only.

Return exactly these fields:

{{
  "incident_type": "string",
  "severity": "low | medium | high | unknown",
  "image_description": "string",
  "location_consistent": true,
  "confidence": 0.0,
  "needs_human_review": true,
  "reason": "string"
}}

The value of location_consistent may also be null when there is not enough evidence.
"""

    # ---------------------------------------------
    # 5. Read image once
    # ---------------------------------------------
    try:
        image_bytes = photo.read_bytes()
    except Exception as error:
        return {
            "status": "unavailable",
            "needs_human_review": True,
            "reason": f"Could not read evidence image: {error}",
        }

    # ---------------------------------------------
    # 6. Try models + API keys
    #
    # Primary model is tried first.
    # If it is unavailable/high-demand, the fallback
    # model is tried automatically.
    # ---------------------------------------------
    last_error = None

    for model_index, model in enumerate(MODELS, start=1):
        for key_index, key in enumerate(API_KEYS, start=1):
            try:
                print(
                    f"Trying Gemini model '{model}' "
                    f"with key slot {key_index}..."
                )

                client = genai.Client(api_key=key)

                response = client.models.generate_content(
                    model=model,
                    contents=[
                        prompt,
                        types.Part.from_bytes(
                            data=image_bytes,
                            mime_type=mime_type,
                        ),
                    ],
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        # Low thinking keeps evidence verification
                        # responsive while preserving reasoning.
                        thinking_config=types.ThinkingConfig(
                            thinking_level="low"
                        ),
                    ),
                )

                # -----------------------------------------
                # 7. Validate response
                # -----------------------------------------
                if not response.text:
                    raise ValueError(
                        "Gemini returned an empty response."
                    )

                print(
                    f"Gemini model '{model}' key slot "
                    f"{key_index} returned a response."
                )

                # -----------------------------------------
                # 8. Parse JSON
                # -----------------------------------------
                try:
                    result = json.loads(response.text)
                except json.JSONDecodeError as error:
                    print(
                        f"Gemini returned invalid JSON: {error}"
                    )
                    return {
                        "status": "verification_error",
                        "needs_human_review": True,
                        "reason": "Gemini returned invalid JSON.",
                        "raw_response": response.text[:2000],
                        "provider": "gemini",
                        "model": model,
                    }

                # -----------------------------------------
                # 9. Add system metadata
                # -----------------------------------------
                result["status"] = "analyzed"
                result["provider"] = "gemini"
                result["model"] = model
                result["key_slot"] = key_index

                # -----------------------------------------
                # 10. Return successful verification
                # -----------------------------------------
                return result

            except Exception as error:
                last_error = error
                error_type = type(error).__name__
                error_message = str(error)

                print(
                    f"Gemini model '{model}' key slot "
                    f"{key_index} failed:"
                )
                print(f"  Error type: {error_type}")
                print(f"  Error message: {error_message}")

                # A short delay prevents immediately hammering
                # the same service after a temporary 503.
                if "503" in error_message or "UNAVAILABLE" in error_message:
                    print("Temporary Gemini unavailability detected.")
                    time.sleep(1)
                elif key_index < len(API_KEYS):
                    time.sleep(0.5)

        # Explicitly show when moving from primary to fallback.
        if model_index < len(MODELS):
            print(
                f"Primary Gemini model '{model}' was unavailable. "
                f"Switching to fallback model '{MODELS[model_index]}'."
            )

    # ---------------------------------------------
    # 11. All models + keys failed
    # ---------------------------------------------
    return {
        "status": "unavailable",
        "needs_human_review": True,
        "reason": (
            "AI verification unavailable. "
            "All configured Gemini models and API keys failed."
        ),
        "provider": "gemini",
        "models_tried": MODELS,
        "last_error": str(last_error) if last_error else None,
    }
