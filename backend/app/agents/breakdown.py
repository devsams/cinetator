import os
import json
from google import genai
from google.genai import types

_PROJECT = os.getenv("GOOGLE_CLOUD_PROJECT")
_LOCATION = os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1")

# Vertex-backed client (uses your ADC / gcloud login)
_client = genai.Client(vertexai=True, project=_PROJECT, location=_LOCATION)

_MODEL = "gemini-2.5-flash"

_PROMPT = """You are a film production breakdown assistant.
Read the script below and extract a structured breakdown.

Return ONLY valid JSON (no markdown, no commentary) with this exact shape:
{
  "title": "string or null",
  "estimated_shoot_days": integer,
  "characters": ["Character Name", ...],
  "locations": ["Location Name", ...],
  "scenes": [
    {
      "number": "1",
      "int_ext": "INT" or "EXT",
      "location": "string",
      "time_of_day": "DAY" or "NIGHT" or "string",
      "cast": ["Character Name", ...],
      "props": ["prop", ...]
    }
  ]
}

Rules:
- characters = every named speaking/acting character across all scenes.
- locations = every distinct filming location.
- estimated_shoot_days = a realistic estimate based on scene count and locations.
- If something is unknown, use an empty list or null. Never invent contact info.

SCRIPT:
---
{script}
---
"""


def run_breakdown(script_text: str) -> dict:
    prompt = _PROMPT.replace("{script}", script_text[:100000])
    resp = _client.models.generate_content(
        model=_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            temperature=0.2,
            response_mime_type="application/json",
        ),
    )
    text = resp.text or "{}"
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # strip accidental code fences and retry
        cleaned = text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        return json.loads(cleaned)
