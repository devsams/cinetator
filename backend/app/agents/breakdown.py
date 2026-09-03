import os
import json
from google import genai
from google.genai import types

_PROJECT = os.getenv("GOOGLE_CLOUD_PROJECT")
_LOCATION = os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1")

_client = genai.Client(vertexai=True, project=_PROJECT, location=_LOCATION)

_MODEL = "gemini-2.5-flash"

_PROMPT = """You are a film production breakdown assistant.
Read the document below (it may be raw text extracted from a PDF, so tables and
lines can be broken up awkwardly) and extract a structured breakdown.

Return ONLY valid JSON (no markdown, no commentary) with this exact shape:
{
  "title": "string or null",
  "estimated_shoot_days": integer,
  "characters": ["Character Name", ...],
  "locations": ["Location Name", ...],
  "location_details": [
    {
      "name": "Location name",
      "address": "address / city or null",
      "contact_name": "on-site coordinator/manager or null",
      "contact_email": "email or null",
      "contact_phone": "phone or null"
    }
  ],
  "scenes": [
    {
      "number": "1",
      "day": 1,
      "int_ext": "INT" or "EXT",
      "location": "string",
      "time_of_day": "string",
      "cast": ["Character Name", ...],
      "props": ["prop", ...],
      "pages": "3/8"
    }
  ],
  "day_notes": { "1": "One-line call note for day 1", "2": "..." },
  "people": [
    {
      "name": "Full Name",
      "role_type": "cast" or "crew" or "other",
      "character": "Character or job title or null",
      "email": "email or null",
      "phone": "phone or null"
    }
  ]
}

Extracting people:
- If the document contains a cast/crew/production directory or contact table
  (columns like ROLE, NAME, PHONE, EMAIL), extract EVERY listed person into "people".
- role_type: actors -> "cast" (character = role played); crew (Director, DP/Camera,
  Sound, Makeup Artist) -> "crew" (character = job title); anyone else -> "other".

Extracting locations:
- "locations" = simple list of distinct filming location names.
- "location_details" = richer info for filming locations when the document lists them
  (e.g. "Location 1: Tel Aviv Savidor Central Station" with a coordinator name, phone,
  email). Include the on-site contact person if given. If only names are known, still
  include each with address/contact fields as null.

Repairing PDF extraction artifacts (CRITICAL - the text is messy):
- Phone numbers are often split across lines, e.g. "+972" then "50-555-0199".
  JOIN them into "+972 50-555-0199".
- Emails are often split by a hyphen line break, e.g. "alex.miller@example-" then
  "cast.com". JOIN into "alex.miller@examplecast.com" (remove the break and hyphen).
- A single table row may span several lines; group fields correctly per entry.

Extracting shoot days:
- If the document marks shoot days (e.g. "SHOOT DAY 1", "Day 2", or groups scenes
  under day headers), set each scene's "day" to that day number.
- If the document does NOT indicate days, set "day" to null for every scene.
- Never invent a day number that isn't supported by the document.

Page counts and call notes:
- "pages" = eighths-of-a-page estimate per scene as a string like "3/8", "1", "1 2/8".
  Estimate from scene length; if unknown use "1".
- "day_notes" = a short, practical one-line call note per shoot day (keyed by day
  number as a string), e.g. crowd/timing/light advice. Only include days that exist.

Other rules:
- characters = named speaking characters in the scenes.
- estimated_shoot_days = realistic estimate (doc may state it, e.g. "Two-Day").
- NEVER invent emails or phone numbers. Missing detail = null. No people/locations
  listed with detail = empty arrays.

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
            temperature=0.1,
            response_mime_type="application/json",
        ),
    )
    text = resp.text or "{}"
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        cleaned = text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        return json.loads(cleaned)
