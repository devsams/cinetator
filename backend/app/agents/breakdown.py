import os
import json
from google import genai
from google.genai import types

_PROJECT = os.getenv("GOOGLE_CLOUD_PROJECT")
_LOCATION = os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1")

_client = genai.Client(vertexai=True, project=_PROJECT, location=_LOCATION)

_MODEL = "gemini-2.5-flash"

_PROMPT = """You are a film production breakdown assistant.
Read the document below and extract a structured breakdown.

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
  ],
  "people": [
    {
      "name": "Full Name",
      "role_type": "cast" or "crew" or "other",
      "character": "Character or role label or null",
      "email": "email or null",
      "phone": "phone or null"
    }
  ]
}

Rules:
- characters = every named speaking/acting character across all scenes.
- locations = every distinct filming location.
- estimated_shoot_days = a realistic estimate based on scene count and locations.
- people = ONLY real people explicitly listed in the document with their details
  (e.g. a CAST or CREW list with names, roles, emails, phones). For each, capture
  name, role_type, character/role, email, phone.
  * Put actors under role_type "cast" (character = the role they play, if given).
  * Put crew (DP, gaffer, sound, etc.) under role_type "crew" (character = their job title).
  * Anyone else under "other".
- CRITICAL: Never invent or guess emails or phone numbers. If a contact detail is
  not present in the document, use null. If no people are explicitly listed with
  details, return an empty "people" array.

DOCUMENT:
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
        cleaned = text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        return json.loads(cleaned)
