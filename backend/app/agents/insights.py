import os
import json
from google import genai
from google.genai import types

_PROJECT = os.getenv("GOOGLE_CLOUD_PROJECT")
_LOCATION = os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1")
_client = genai.Client(vertexai=True, project=_PROJECT, location=_LOCATION)
_MODEL = "gemini-2.5-flash"

# Per-tab framing: what this slice of data is, and what's worth noticing in it.
# Each of these stays scoped to one tab's own data — this is a small, cheap,
# read-only call per tab, not a rebuild of Lily's full-project chat context.
TAB_GUIDANCE = {
    "schedule": (
        "This is the Schedule tab: every shoot day, its confirmed location, up to 3 "
        "candidate dates, and who has responded so far with what they picked or suggested. "
        "Notice: days with no candidate dates yet, days with responses in but nothing "
        "locked, days where everyone who's responded agrees on one date (ready to lock), "
        "days waiting on specific people who haven't answered, and any day with no "
        "confirmed location at all."
    ),
    "stripboard": (
        "This is the Stripboard tab for one shoot day: the ordered strips (scenes plus "
        "specials like crew call, company move, lunch, wrap), each scene's cast and prop "
        "count, and the running total. Notice: a total day length pushing past a standard "
        "12-hour day, no lunch break scheduled within 6 hours of crew call, scenes with no "
        "cast identified yet, and whether the running order makes sense (e.g. a big move "
        "wedged with no break)."
    ),
    "team": (
        "This is the Team tab: notes sent in by cast, crew, and location contacts, split "
        "into unanswered and answered. Notice: anything flagged @PRODUCTION, notes that "
        "have sat the longest without a reply, and any pattern across several notes (the "
        "same question from multiple people usually means something upstream needs fixing, "
        "not five individual replies)."
    ),
}

_PROMPT = """You are Lily, reading the {tab} tab of a film production's coordination app.
You're given one scoped slice of the production's real, current data below — not the
whole app — and your job is a short, sharp status read of just that slice, the way a
sharp 1st AD would glance at a call sheet and immediately spot what needs attention.

{tab_guidance}

Rules:
- "summary": one or two plain sentences using the real names, dates, numbers in the
  data below. Never generic ("things look good so far") — say what's actually true.
  If the data is empty or there's genuinely nothing yet, say that plainly.
- "alerts": concrete problems worth flagging right now, most severe first, each with
  a "severity" of "high", "medium", or "low" and a "text" naming the specific person,
  day, or scene involved. Only include real problems — omit alerts entirely (empty
  array) if nothing is actually wrong. Never invent one to fill space.
- "recommendations": up to 3 concrete next actions, ranked by what unblocks the most.
  Each has:
    - "text": one sentence a coordinator could act on immediately, ending in the
      specific move (who to contact, what to lock, what to move).
    - "ask": a short 2-5 word phrase completing "Ask Lily to ___" for that same
      action (e.g. "send it", "lock Day 2", "move Scene 4").
  Leave "recommendations" empty if there's nothing worth doing right now.
- You are read-only. You never say you've done anything ("I've sent…", "I've
  marked…") — you're only reading and advising what a person should do next.

Return ONLY valid JSON (no markdown, no commentary) with this exact shape:
{
  "summary": "string",
  "alerts": [{"severity": "high", "text": "string"}],
  "recommendations": [{"text": "string", "ask": "string"}]
}

DATA:
---
{data}
---
"""


def generate_insights(tab: str, data: dict) -> dict:
    prompt = (
        _PROMPT.replace("{tab}", tab)
        .replace("{tab_guidance}", TAB_GUIDANCE.get(tab, ""))
        .replace("{data}", json.dumps(data, indent=2)[:8000])
    )
    resp = _client.models.generate_content(
        model=_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(temperature=0.2, response_mime_type="application/json"),
    )
    text_out = resp.text or "{}"
    try:
        result = json.loads(text_out)
    except json.JSONDecodeError:
        cleaned = text_out.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        result = json.loads(cleaned)
    result.setdefault("summary", "")
    result.setdefault("alerts", [])
    result.setdefault("recommendations", [])
    return result
