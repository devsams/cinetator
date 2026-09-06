import os
import json
from parallel import Parallel
from google import genai
from google.genai import types

_PARALLEL = Parallel(api_key=os.getenv("PARALLEL_API_KEY"))

_PROJECT = os.getenv("GOOGLE_CLOUD_PROJECT")
_LOCATION = os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1")
_genai = genai.Client(vertexai=True, project=_PROJECT, location=_LOCATION)
_MODEL = "gemini-2.5-flash"

_DISTILL_PROMPT = """You are a film location scout assistant.
Below are raw web search excerpts about a filming location. Distill them into a
clean, factual JSON summary for a production team. Use ONLY information supported
by the excerpts; if something isn't covered, use null or an empty list.

Return ONLY valid JSON with this shape:
{
  "summary": "1-2 sentence overview for filming at this location",
  "hours": "opening/operating hours or null",
  "permits": "filming permit rules, fees, contacts, or null",
  "weather": "typical weather / climate notes or null",
  "nearby_safety": "nearest hospital / police / emergency notes or null",
  "constraints": ["notable constraint or logistics note", ...],
  "sources": ["url", ...],
  "answer_to_question": "a direct answer to the SPECIFIC QUESTION below, using
    the excerpts, or null if no specific question was asked or the excerpts
    don't cover it"
}

LOCATION: {loc}

SPECIFIC QUESTION (may be none): {question}

EXCERPTS:
{excerpts}
"""


def research_location(name: str, address: str | None = None, question: str | None = None) -> dict:
    loc = name if not address else f"{name}, {address}"

    queries = [
        f"{name} filming permit rules",
        f"{name} opening hours",
        f"{name} nearest hospital police station",
    ]
    objective = (
        f"Film production logistics for {loc}: operating hours, "
        f"filming permit rules and fees, typical weather, and the nearest "
        f"hospital and police station."
    )
    # A specific question (e.g. "is there parking nearby?", "is it noisy at
    # night?") gets folded in as its own search query and objective clause,
    # on top of the standard checklist — so asking something ad-hoc doesn't
    # replace the baseline research, it adds to it.
    if question:
        queries.append(f"{loc} {question}")
        objective += f" Also specifically: {question}"

    # --- Parallel Search (partner integration, runtime call) ---
    result = _PARALLEL.search(
        objective=objective,
        search_queries=queries,
        mode="fast",
        max_chars_total=6000,
    )

    excerpt_lines = []
    sources = []
    for r in (result.results or []):
        url = getattr(r, "url", None)
        title = getattr(r, "title", "") or ""
        for ex in (getattr(r, "excerpts", []) or []):
            excerpt_lines.append(f"- ({title}) {ex}")
        if url:
            sources.append(url)

    raw_excerpts = "\n".join(excerpt_lines) if excerpt_lines else "No results found."

    # --- Gemini distills the raw excerpts into structured facts ---
    prompt = (
        _DISTILL_PROMPT.replace("{loc}", loc)
        .replace("{question}", question or "none")
        .replace("{excerpts}", raw_excerpts[:12000])
    )
    resp = _genai.models.generate_content(
        model=_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            temperature=0.2,
            response_mime_type="application/json",
        ),
    )
    text = resp.text or "{}"
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        cleaned = text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        data = json.loads(cleaned)

    # ensure sources present even if the model omitted them
    if not data.get("sources"):
        data["sources"] = sources[:5]
    return data
