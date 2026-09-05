import json
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from pydantic import BaseModel
from typing import List, Optional

from ..db import get_session
from ..models import Person, ShootDay, Location, ScheduleResponse, Event, Project

router = APIRouter(prefix="/api/link", tags=["link"])


def _loads(s): return json.loads(s) if s else []


def _scenes_for_person(project: Project, day: ShootDay, person: Person) -> list:
    """Cast only: scenes on this day that include this person's character/name."""
    if person.role_type != "cast":
        return []
    breakdown = json.loads(project.breakdown_json or "{}")
    name_keys = {(person.character or "").lower(), (person.name or "").lower()}
    name_keys.discard("")
    out = []
    for sc in breakdown.get("scenes", []):
        if str(sc.get("day")) != str(day.day_number):
            continue
        cast_lower = {c.lower() for c in (sc.get("cast") or [])}
        if cast_lower & name_keys:
            out.append({
                "number": sc.get("number"),
                "int_ext": sc.get("int_ext"),
                "location": sc.get("location"),
                "time_of_day": sc.get("time_of_day"),
            })
    return out


def _build_person_view(session: Session, person: Person) -> dict:
    """Shared logic: the role-scoped view of days/scenes/call-time/availability
    for one person. Used by both the token-based public link and the in-app
    person-id lookup ('My Page' / admin view-as)."""
    project_id = person.project_id
    project = session.get(Project, project_id)
    days = session.exec(
        select(ShootDay).where(ShootDay.project_id == project_id).order_by(ShootDay.day_number)
    ).all()
    locs = {l.id: l for l in session.exec(select(Location).where(Location.project_id == project_id)).all()}

    resp = session.exec(
        select(ScheduleResponse).where(
            ScheduleResponse.person_id == person.id,
            ScheduleResponse.project_id == project_id,
        )
    ).all()
    resp_by_day = {r.shoot_day_id: r for r in resp}

    all_people = session.exec(select(Person).where(Person.project_id == project_id)).all()

    out_days = []
    for d in days:
        loc = locs.get(d.location_id)
        r = resp_by_day.get(d.id)
        my_scenes = _scenes_for_person(project, d, person)

        if person.role_type == "cast" and not my_scenes:
            continue

        research = json.loads(loc.research_json) if (loc and loc.research_json) else None
        who_else = [
            {"name": p.name, "role_type": p.role_type, "character": p.character}
            for p in all_people if p.id != person.id
        ]

        out_days.append({
            "shoot_day_id": d.id,
            "day_number": d.day_number,
            "location_name": loc.name if loc else None,
            "location_address": loc.address if loc else None,
            "call_time": d.call_time,
            "candidate_dates": _loads(d.candidate_dates),
            "locked_date": d.locked_date,
            "picked_dates": _loads(r.picked_dates) if r else [],
            "suggested_dates": _loads(r.suggested_dates) if r else [],
            "responded": bool(r and r.responded_at),
            "my_scenes": my_scenes,
            "weather": research.get("weather") if research else None,
            "nearby_safety": research.get("nearby_safety") if research else None,
            "constraints": research.get("constraints") if research else [],
            "who_else": who_else,
        })

    return {
        "person": {"id": person.id, "name": person.name, "role_type": person.role_type, "character": person.character},
        "days": out_days,
    }


@router.get("/{token}")
def get_link(token: str, session: Session = Depends(get_session)):
    """Public: what a cast/crew/location person sees when they open their link."""
    person = session.exec(select(Person).where(Person.token == token)).first()
    if not person:
        raise HTTPException(status_code=404, detail="Invalid link.")
    return _build_person_view(session, person)


@router.get("/by-person/{person_id}")
def get_link_by_person(person_id: str, session: Session = Depends(get_session)):
    """In-app: same view as the public link, looked up by person_id instead of
    token. Used for the 'My Page' tab and the admin 'view as' picker."""
    person = session.get(Person, person_id)
    if not person:
        raise HTTPException(status_code=404, detail="Person not found.")
    return _build_person_view(session, person)


class ResponseIn(BaseModel):
    shoot_day_id: str
    picked_dates: List[str] = []
    suggested_dates: List[str] = []


def _submit_response(session: Session, person: Person, body: ResponseIn):
    day = session.get(ShootDay, body.shoot_day_id)
    if not day or day.project_id != person.project_id:
        raise HTTPException(status_code=404, detail="Shoot day not found.")

    existing = session.exec(
        select(ScheduleResponse).where(
            ScheduleResponse.person_id == person.id,
            ScheduleResponse.shoot_day_id == body.shoot_day_id,
        )
    ).first()

    if existing:
        existing.picked_dates = json.dumps(body.picked_dates)
        existing.suggested_dates = json.dumps(body.suggested_dates)
        existing.responded_at = datetime.utcnow()
        r = existing
    else:
        r = ScheduleResponse(
            project_id=person.project_id, person_id=person.id,
            shoot_day_id=body.shoot_day_id,
            picked_dates=json.dumps(body.picked_dates),
            suggested_dates=json.dumps(body.suggested_dates),
            responded_at=datetime.utcnow(),
        )
    session.add(r)

    ev_type = "responded" if body.picked_dates else "suggested-alternate"
    session.add(Event(
        project_id=person.project_id, type=ev_type,
        person_id=person.id, shoot_day_id=body.shoot_day_id,
        payload=json.dumps({"picked": body.picked_dates, "suggested": body.suggested_dates}),
    ))
    session.commit()
    return {"ok": True}


@router.post("/{token}/respond")
def respond(token: str, body: ResponseIn, session: Session = Depends(get_session)):
    """Public: person submits availability for one shoot day, via their token link."""
    person = session.exec(select(Person).where(Person.token == token)).first()
    if not person:
        raise HTTPException(status_code=404, detail="Invalid link.")
    return _submit_response(session, person, body)


@router.post("/by-person/{person_id}/respond")
def respond_by_person(person_id: str, body: ResponseIn, session: Session = Depends(get_session)):
    """In-app: same as respond(), looked up by person_id (My Page / view-as)."""
    person = session.get(Person, person_id)
    if not person:
        raise HTTPException(status_code=404, detail="Person not found.")
    return _submit_response(session, person, body)


from ..models import Note

class NoteIn(BaseModel):
    text: str
    shoot_day_id: Optional[str] = None


def _create_note(session: Session, person: Person, body: NoteIn) -> dict:
    flags = "@production" in body.text.lower()
    n = Note(
        project_id=person.project_id, person_id=person.id,
        shoot_day_id=body.shoot_day_id, text=body.text, flags_production=flags,
    )
    session.add(n)
    session.add(Event(
        project_id=person.project_id, type="note-added", person_id=person.id,
        shoot_day_id=body.shoot_day_id, payload=json.dumps({"text": body.text}),
    ))
    session.commit(); session.refresh(n)
    return {"id": n.id, "text": n.text, "flags_production": n.flags_production}


@router.post("/{token}/notes")
def add_note(token: str, body: NoteIn, session: Session = Depends(get_session)):
    person = session.exec(select(Person).where(Person.token == token)).first()
    if not person:
        raise HTTPException(status_code=404, detail="Invalid link.")
    return _create_note(session, person, body)


@router.post("/by-person/{person_id}/notes")
def add_note_by_person(person_id: str, body: NoteIn, session: Session = Depends(get_session)):
    person = session.get(Person, person_id)
    if not person:
        raise HTTPException(status_code=404, detail="Person not found.")
    return _create_note(session, person, body)


@router.get("/notes/{project_id}")
def list_notes(project_id: str, session: Session = Depends(get_session)):
    """For production: all notes across the project, newest first."""
    rows = session.exec(
        select(Note).where(Note.project_id == project_id).order_by(Note.created_at.desc())
    ).all()
    people = {p.id: p for p in session.exec(select(Person).where(Person.project_id == project_id)).all()}
    days = {d.id: d for d in session.exec(select(ShootDay).where(ShootDay.project_id == project_id)).all()}
    return [
        {
            "id": n.id, "text": n.text, "flags_production": n.flags_production,
            "resolved": n.resolved,
            "reply_text": n.reply_text,
            "replied_at": n.replied_at.isoformat() if n.replied_at else None,
            "person_id": n.person_id,
            "person_name": people[n.person_id].name if n.person_id in people else "Unknown",
            "shoot_day_id": n.shoot_day_id,
            "day_number": days[n.shoot_day_id].day_number if n.shoot_day_id in days else None,
            "created_at": n.created_at.isoformat() if n.created_at else None,
        }
        for n in rows
    ]


class ResolveIn(BaseModel):
    resolved: bool = True


@router.patch("/notes/{note_id}")
def resolve_note(note_id: str, body: ResolveIn, session: Session = Depends(get_session)):
    n = session.get(Note, note_id)
    if not n:
        raise HTTPException(status_code=404, detail="Note not found.")
    n.resolved = body.resolved
    session.add(n); session.commit()
    return {"id": n.id, "resolved": n.resolved}


class ReplyIn(BaseModel):
    reply_text: str


@router.post("/notes/{note_id}/reply")
def reply_to_note(note_id: str, body: ReplyIn, session: Session = Depends(get_session)):
    n = session.get(Note, note_id)
    if not n:
        raise HTTPException(status_code=404, detail="Note not found.")
    n.reply_text = body.reply_text
    n.replied_at = datetime.utcnow()
    n.resolved = True  # a reply implicitly resolves it
    session.add(n)
    session.add(Event(
        project_id=n.project_id, type="note-replied", person_id=n.person_id,
        shoot_day_id=n.shoot_day_id, payload=json.dumps({"reply": body.reply_text}),
    ))
    session.commit(); session.refresh(n)
    return {"id": n.id, "reply_text": n.reply_text, "resolved": n.resolved}


@router.get("/by-person/{person_id}/notes")
def list_my_notes(person_id: str, session: Session = Depends(get_session)):
    """A person's own notes + any replies, for showing threads on My Page."""
    person = session.get(Person, person_id)
    if not person:
        raise HTTPException(status_code=404, detail="Person not found.")
    rows = session.exec(
        select(Note).where(Note.person_id == person_id).order_by(Note.created_at.desc())
    ).all()
    return [
        {
            "id": n.id, "text": n.text, "shoot_day_id": n.shoot_day_id,
            "reply_text": n.reply_text,
            "replied_at": n.replied_at.isoformat() if n.replied_at else None,
            "created_at": n.created_at.isoformat() if n.created_at else None,
        }
        for n in rows
    ]
