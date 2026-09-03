import os
import json
from google import genai
from google.genai import types

_PROJECT = os.getenv("GOOGLE_CLOUD_PROJECT")
_LOCATION = os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1")
_client = genai.Client(vertexai=True, project=_PROJECT, location=_LOCATION)
_MODEL = "gemini-2.5-flash"

_PROMPT = """You are a film production coordinator writing a short, friendly, professional
availability request email to a cast/crew member (or a location coordinator).

Write a concise email (120-160 words) that:
- Greets them by name.
- Explains we're locking shoot dates for the production "{title}".
- Lists each shoot day they're needed on, its location, and the candidate dates.
- Asks them to click their personal link to confirm which dates work, or suggest
  alternates if none do.
- Ends warmly. Sign off as "The {title} Production Team".

Return ONLY the email body text (no subject line, no markdown).

PERSON: {name} ({role})
PERSONAL LINK: {link}
SHOOT DAYS:
{days}
"""


def draft_email(title: str, name: str, role: str, link: str, days_text: str) -> str:
    prompt = (_PROMPT
              .replace("{title}", title or "the production")
              .replace("{name}", name)
              .replace("{role}", role)
              .replace("{link}", link)
              .replace("{days}", days_text))
    resp = _client.models.generate_content(
        model=_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(temperature=0.5),
    )
    return (resp.text or "").strip()
