import json
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

from ..db import get_session
from ..models import Project, Person, Location, ShootDay, ScheduleResponse, ChatSession, ChatMessage
from ..agents.chat import chat_turn

router = APIRouter(prefix="/api/chat", tags=["chat"])


def _loads(s): return json.loads(s) if s else []


def _build_state(session: Session, project_id: str) -> dict:
    project = session.get(Project, project_id)
    breakdown = json.loads(project.breakdown_json or "{}")
    people = session.exec(select(Person).where(Person.project_id == project_id)).all()
    locations = session.exec(select(Location).where(Location.project_id == project_id)).all()
    days = session.exec(select(ShootDay).where(ShootDay.project_id == project_id)).all()
    responses = session.exec(select(ScheduleResponse).where(ScheduleResponse.project_id == project_id)).all()
    return {
        "title": project.title,
        "scenes": len(breakdown.get("scenes", [])),
        "estimated_shoot_days": breakdown.get("estimated_shoot_days"),
        "people": [{"name": p.name, "role_type": p.role_type, "character": p.character,
                    "email": p.email, "phone": p.phone} for p in people],
        "detected_locations": breakdown.get("locations", []),
        "confirmed_locations": [{"name": l.name, "researched": bool(l.research_json)} for l in locations],
        "shoot_days": [{"day_number": d.day_number, "location_id": d.location_id,
                         "candidate_dates": _loads(d.candidate_dates), "locked_date": d.locked_date} for d in days],
        "responses_count": len(responses),
    }


def _serialize_session(s: ChatSession) -> dict:
    return {"id": s.id, "title": s.title, "created_at": s.created_at.isoformat() if s.created_at else None,
            "updated_at": s.updated_at.isoformat() if s.updated_at else None}


def _serialize_msg(m: ChatMessage) -> dict:
    return {"role": m.role, "text": m.text, "created_at": m.created_at.isoformat() if m.created_at else None}


# ---------- Sessions ----------
@router.get("/sessions/{project_id}")
def list_sessions(project_id: str, session: Session = Depends(get_session)):
    rows = session.exec(
        select(ChatSession).where(ChatSession.project_id == project_id)
        .order_by(ChatSession.updated_at.desc())
    ).all()[:10]
    return [_serialize_session(r) for r in rows]


@router.post("/sessions/{project_id}")
def new_session(project_id: str, session: Session = Depends(get_session)):
    if not session.get(Project, project_id):
        raise HTTPException(status_code=404, detail="Project not found.")
    cs = ChatSession(project_id=project_id)
    session.add(cs); session.commit(); session.refresh(cs)
    return _serialize_session(cs)


@router.get("/sessions/{project_id}/{session_id}/messages")
def get_messages(project_id: str, session_id: str, session: Session = Depends(get_session)):
    msgs = session.exec(
        select(ChatMessage).where(ChatMessage.session_id == session_id).order_by(ChatMessage.created_at)
    ).all()
    return [_serialize_msg(m) for m in msgs]


# ---------- Chat turn ----------
class ChatIn(BaseModel):
    project_id: str
    session_id: str
    message: str


@router.post("")
def chat(body: ChatIn, session: Session = Depends(get_session)):
    project = session.get(Project, body.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")
    if not project.breakdown_json:
        raise HTTPException(status_code=400, detail="Analyze a script first.")

    cs = session.get(ChatSession, body.session_id)
    if not cs:
        raise HTTPException(status_code=404, detail="Chat session not found.")

    # load prior messages for context (last 10)
    prior = session.exec(
        select(ChatMessage).where(ChatMessage.session_id == body.session_id).order_by(ChatMessage.created_at)
    ).all()
    history = [{"role": m.role, "text": m.text} for m in prior[-10:]]

    # save the user's message
    session.add(ChatMessage(session_id=body.session_id, role="user", text=body.message))
    if not cs.title:
        cs.title = body.message[:60]
    cs.updated_at = datetime.utcnow()
    session.add(cs)
    session.commit()

    state = _build_state(session, body.project_id)
    result = chat_turn(state, history, body.message)

    # save the assistant's reply
    session.add(ChatMessage(session_id=body.session_id, role="assistant", text=result.get("reply", "")))
    cs.updated_at = datetime.utcnow()
    session.add(cs)
    session.commit()

    return result


# ---------- Execute a confirmed action ----------
class ExecuteIn(BaseModel):
    project_id: str
    name: str
    args: Dict[str, Any]


@router.post("/execute")
def execute(body: ExecuteIn, session: Session = Depends(get_session)):
    from ..routes.people import add_person as _add_person, PersonIn
    from ..routes.plan import add_location as _add_location, LocationIn, research as _research
    from ..routes.schedule import add_candidate as _add_candidate, AddCandidateIn, lock_date as _lock_date, LockIn
    from ..routes.schedule import remind as _remind, RemindIn, send_requests as _send_requests, SendIn

    pid = body.project_id
    a = body.args
    name = body.name

    people = session.exec(select(Person).where(Person.project_id == pid)).all()
    by_name = {p.name.lower(): p for p in people}
    locations = session.exec(select(Location).where(Location.project_id == pid)).all()
    loc_by_name = {l.name.lower(): l for l in locations}
    days = session.exec(select(ShootDay).where(ShootDay.project_id == pid)).all()
    day_by_num = {d.day_number: d for d in days}

    if name == "add_person":
        return _add_person(PersonIn(project_id=pid, name=a["name"], role_type=a.get("role_type", "cast"),
                                    character=a.get("character"), email=a.get("email"), phone=a.get("phone")), session)
    if name == "confirm_location":
        return _add_location(LocationIn(project_id=pid, name=a["name"], address=a.get("address")), session)
    if name == "research_location":
        loc = loc_by_name.get(a["location_name"].lower())
        if not loc:
            raise HTTPException(status_code=404, detail="Location not confirmed yet.")
        return _research(loc.id, session)
    if name == "add_candidate_date":
        day = day_by_num.get(a["day_number"])
        if not day:
            raise HTTPException(status_code=404, detail="Shoot day not found.")
        return _add_candidate(day.id, AddCandidateIn(date=a["date"]), session)
    if name == "lock_date":
        day = day_by_num.get(a["day_number"])
        if not day:
            raise HTTPException(status_code=404, detail="Shoot day not found.")
        return _lock_date(day.id, LockIn(date=a["date"]), session)
    if name in ("send_reminder", "send_outreach"):
        names = [n.lower() for n in a.get("names", [])]
        ids = [p.id for p in people if p.name.lower() in names]
        if not ids:
            raise HTTPException(status_code=400, detail="No matching people found.")
        if name == "send_reminder":
            return _remind(RemindIn(project_id=pid, person_ids=ids), session)
        return _send_requests(SendIn(project_id=pid, person_ids=ids), session)

    raise HTTPException(status_code=400, detail=f"Unknown action: {name}")
