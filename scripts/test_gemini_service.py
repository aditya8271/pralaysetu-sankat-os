import os
import sys
from pathlib import Path

# Project root ko Python path mein add karo
PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from dotenv import load_dotenv
from google import genai

from backend.app.services.gemini_service import API_KEYS, MODEL

print("======================================")
print(" PralaySetu - Gemini Service Test")
print("======================================")

load_dotenv()

print()
print("1. Environment Check")
print("--------------------------------------")

model_from_env = os.getenv("GEMINI_MODEL")

print("GEMINI_MODEL from .env:", model_from_env)
print("Model used by gemini_service.py:", MODEL)

print()
print("2. API Key Check")
print("--------------------------------------")

print("API keys detected:", len(API_KEYS))

for index, key in enumerate(API_KEYS, start=1):
    print(f"Key {index}:", "FOUND" if key else "MISSING")

if not API_KEYS:
    print()
    print("❌ No Gemini API keys found.")
    raise SystemExit(1)

print()
print("3. Gemini API Test")
print("--------------------------------------")

key = API_KEYS[0]

try:
    client = genai.Client(api_key=key)

    print(f"Sending test request using: {MODEL}")

    response = client.models.generate_content(
        model=MODEL,
        contents="Reply with exactly: GEMINI_OK"
    )

    print()
    print("Gemini response:")
    print(response.text)

    print()

    if response.text and "GEMINI_OK" in response.text:
        print("✅ GEMINI SERVICE TEST PASSED")
    else:
        print("⚠️ Gemini responded, but response was unexpected.")

except Exception as error:

    print()
    print("❌ GEMINI SERVICE TEST FAILED")
    print("Error type:", type(error).__name__)
    print("Error:", error)