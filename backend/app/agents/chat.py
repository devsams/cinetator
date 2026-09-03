import os
import json
from google import genai
from google.genai import types

_PROJECT = os.getenv("GOOGLE_CLOUD_PROJECT")
_LOCATION = os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1")
_client = genai.Client(vertexai=True, project=_PROJECT, location=_LOCATION)
_MODEL = "gemini-2.5-flash"

# --- Tool (function) declarations Gemini can choose to call ---
TOOLS = [
    types.Tool(function_declarations=[
        types.FunctionDeclaration(
            name="add_person",
            description="Add a cast, crew, or other person to the production with contact details.",
            parameters={
                "type": "OBJECT",
                "properties": {
                    "name": {"type": "STRING"},
                    "role_type": {"type": "STRING", "enum": ["cast", "crew", "other"]},
                    "character": {"type": "STRING", "description": "Character or job title, optional"},
                    "email": {"type": "STRING"},
                    "phone": {"type": "STRING"},
                },
                "required": ["name", "role_type"],
            },
        ),
        types.FunctionDeclaration(
            name="confirm_location",
            description="Confirm a location detected in the script so it becomes an active shoot location.",
            parameters={
                "type": "OBJECT",
                "properties": {"name": {"type": "STRING"}, "address": {"type": "STRING"}},
                "required": ["name"],
            },
        ),
        types.FunctionDeclaration(
            name="research_location",
            description="Run Parallel web research on a confirmed location to get hours, permits, weather, and safety info.",
            parameters={
                "type": "OBJECT",
                "properties": {"location_name": {"type": "STRING"}},
                "required": ["location_name"],
            },
        ),
        types.FunctionDeclaration(
            name="add_candidate_date",
            description="Add a candidate shoot date to a shoot day.",
            parameters={
                "type": "OBJECT",
                "properties": {
                    "day_number": {"type": "INTEGER"},
                    "date": {"type": "STRING", "description": "ISO date, e.g. 2026-09-05"},
                },
                "required": ["day_number", "date"],
            },
        ),
        types.FunctionDeclaration(
            name="lock_date",
            description="Lock the final shoot date for a day.",
            parameters={
                "type": "OBJECT",
                "properties": {
                    "day_number": {"type": "INTEGER"},
                    "date": {"type": "STRING"},
                },
                "required": ["day_number", "date"],
            },
        ),
        types.FunctionDeclaration(
            name="send_reminder",
            description="Send an availability reminder email to one or more people by name.",
            parameters={
                "type": "OBJECT",
                "properties": {
                    "names": {"type": "ARRAY", "items": {"type": "STRING"}},
                },
                "required": ["names"],
            },
        ),
        types.FunctionDeclaration(
            name="send_outreach",
            description="Send the initial availability request email to one or more people by name.",
            parameters={
                "type": "OBJECT",
                "properties": {
                    "names": {"type": "ARRAY", "items": {"type": "STRING"}},
                },
                "required": ["names"],
            },
        ),
    ])
]

_SYSTEM = """You are the Command Center for Cinetator, a film production coordination app.
You help the production team understand and manage their shoot by answering questions
and, when asked, proposing actions using the available tools.

Rules:
- Answer questions directly and concisely using the CURRENT PRODUCTION STATE below.
- If the user asks you to do something that matches a tool, call that tool. Do not
  fabricate a tool call for something not requested.
- Never claim an action was completed — the system will execute it only after the
  user confirms; you are only proposing it.
- If information is missing or ambiguous (e.g. no email on file, unknown person),
  say so plainly instead of guessing.
- Keep answers short and practical, like a helpful assistant, not a report.

CURRENT PRODUCTION STATE:
{state}
"""


def chat_turn(state: dict, history: list[dict], message: str) -> dict:
    """Returns {'reply': str, 'tool_call': {'name':..., 'args':...} | None}"""
    system_text = _SYSTEM.replace("{state}", json.dumps(state, indent=2)[:6000])

    contents = []
    for h in history[-10:]:
        role = "user" if h["role"] == "user" else "model"
        contents.append(types.Content(role=role, parts=[types.Part(text=h["text"])]))
    contents.append(types.Content(role="user", parts=[types.Part(text=message)]))

    resp = _client.models.generate_content(
        model=_MODEL,
        contents=contents,
        config=types.GenerateContentConfig(
            system_instruction=system_text,
            tools=TOOLS,
            temperature=0.3,
        ),
    )

    candidate = resp.candidates[0] if resp.candidates else None
    tool_call = None
    reply_text = ""
    if candidate and candidate.content and candidate.content.parts:
        for part in candidate.content.parts:
            if getattr(part, "function_call", None):
                fc = part.function_call
                tool_call = {"name": fc.name, "args": dict(fc.args) if fc.args else {}}
            if getattr(part, "text", None):
                reply_text += part.text

    if not reply_text and tool_call:
        reply_text = f"I can {tool_call['name'].replace('_', ' ')} — want me to go ahead?"

    return {"reply": reply_text.strip(), "tool_call": tool_call}
