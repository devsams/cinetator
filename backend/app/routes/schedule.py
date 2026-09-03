import json
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from pydantic import BaseModel
from typing import Optional, List

from ..db import get_session
from ..models import Project, Location, ShootDay, Person, ScheduleResponse, Event

router = APIRouter(prefix="/api/schedule", tags=["schedule"])


def _loads(s): return json.loads(s) if s else []


def _serialize_day(d: ShootDay) -> dict:
    return {
        "id": d.id, "day_number": d.day_number, "location_id": d.location_id,
        "candidate_dates": _loads(d.candidate_dates),
        "locked_date": d.locked_date, "call_time": d.call_time,
        "scenes": d.scenes, "status": d.status,
    }


# ---------- Shoot days ----------
class DayIn(BaseModel):
    project_id: str
    day_number: int
    location_id: Optional[str] = None
    candidate_dates: List[str] = []
    scenes: Optional[str] = None
    call_time: Optional[str] = None


class DayUpdate(BaseModel):
    location_id: Optional[str] = None
    candidate_dates: Optional[List[str]] = None
    scenes: Optional[str] = None
    call_time: Optional[str] = None
    locked_date: Optional[str] = None
    status: Optional[str] = None


@router.get("/days/{project_id}")
def list_days(project_id: str, session: Session = Depends(get_session)):
    days = session.exec(
        select(ShootDay).where(ShootDay.project_id == project_id).order_by(ShootDay.day_number)
    ).all()
    return [_serialize_day(d) for d in days]


@router.post("/days")
def add_day(body: DayIn, session: Session = Depends(get_session)):
    if not session.get(Project, body.project_id):
        raise HTTPException(status_code=404, detail="Project not found.")
    d = ShootDay(
        project_id=body.project_id, day_number=body.day_number,
        location_id=body.location_id, scenes=body.scenes, call_time=body.call_time,
        candidate_dates=json.dumps(body.candidate_dates[:3]),
    )
    session.add(d); session.commit(); session.refresh(d)
    return _serialize_day(d)


@router.patch("/days/{day_id}")
def update_day(day_id: str, body: DayUpdate, session: Session = Depends(get_session)):
    d = session.get(ShootDay, day_id)
    if not d:
        raise HTTPException(status_code=404, detail="Shoot day not found.")
    data = body.model_dump(exclude_unset=True)
    if "candidate_dates" in data and data["candidate_dates"] is not None:
        d.candidate_dates = json.dumps(data.pop("candidate_dates")[:3])
    for k, v in data.items():
        setattr(d, k, v)
    session.add(d); session.commit(); session.refresh(d)
    return _serialize_day(d)


@router.delete("/days/{day_id}")
def delete_day(day_id: str, session: Session = Depends(get_session)):
    d = session.get(ShootDay, day_id)
    if not d:
        raise HTTPException(status_code=404, detail="Shoot day not found.")
    session.delete(d); session.commit()
    return {"deleted": day_id}


@router.post("/days/auto/{project_id}")
def auto_days(project_id: str, session: Session = Depends(get_session)):
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")
    existing = session.exec(select(ShootDay).where(ShootDay.project_id == project_id)).all()
    if existing:
        return [_serialize_day(d) for d in sorted(existing, key=lambda x: x.day_number)]
    breakdown = json.loads(project.breakdown_json or "{}")
    n = int(breakdown.get("estimated_shoot_days") or 1)
    created = []
    for i in range(1, n + 1):
        d = ShootDay(project_id=project_id, day_number=i, candidate_dates=json.dumps([]))
        session.add(d); created.append(d)
    session.commit()
    for d in created:
        session.refresh(d)
    return [_serialize_day(d) for d in created]


# ---------- Link a location to its coordinator person ----------
class CoordinatorIn(BaseModel):
    coordinator_person_id: str


@router.patch("/locations/{location_id}/coordinator")
def set_coordinator(location_id: str, body: CoordinatorIn, session: Session = Depends(get_session)):
    loc = session.get(Location, location_id)
    if not loc:
        raise HTTPException(status_code=404, detail="Location not found.")
    loc.coordinator_person_id = body.coordinator_person_id
    session.add(loc); session.commit(); session.refresh(loc)
    return {"location_id": loc.id, "coordinator_person_id": loc.coordinator_person_id}


# ---------- Outreach (draft + send via Mailpit) ----------
import os as _os
from ..models import ScheduleResponse
from ..mailer import send_email
from ..agents.outreach import draft_email

APP_BASE_URL = _os.getenv("APP_BASE_URL", "http://localhost:5173")


def _days_text_for(session: Session, project_id: str) -> str:
    days = session.exec(
        select(ShootDay).where(ShootDay.project_id == project_id).order_by(ShootDay.day_number)
    ).all()
    locs = {l.id: l for l in session.exec(select(Location).where(Location.project_id == project_id)).all()}
    lines = []
    for d in days:
        loc = locs.get(d.location_id)
        cds = _loads(d.candidate_dates)
        lines.append(
            f"- Day {d.day_number}"
            + (f" at {loc.name}" if loc else "")
            + (f": candidate dates {', '.join(cds)}" if cds else ": (no dates set yet)")
        )
    return "\n".join(lines) if lines else "(no shoot days set yet)"


class SendIn(BaseModel):
    project_id: str
    person_ids: Optional[List[str]] = None   # None = everyone with an email


@router.post("/send-requests")
def send_requests(body: SendIn, session: Session = Depends(get_session)):
    project = session.get(Project, body.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")

    people = session.exec(select(Person).where(Person.project_id == body.project_id)).all()
    if body.person_ids:
        people = [p for p in people if p.id in set(body.person_ids)]

    days_text = _days_text_for(session, body.project_id)
    title = project.title or "the production"

    sent, skipped = [], []
    for p in people:
        if not p.email:
            skipped.append({"name": p.name, "reason": "no email"})
            continue
        link = f"{APP_BASE_URL}/shoot/{p.token}"
        try:
            role = p.character or p.role_type
            body_text = draft_email(title, p.name, role, link, days_text)
            send_email(p.email, f"{title} — please confirm your shoot dates", body_text)
            session.add(Event(project_id=body.project_id, type="outreach-sent", person_id=p.id))
            sent.append({"name": p.name, "email": p.email})
        except Exception as e:
            skipped.append({"name": p.name, "reason": str(e)})
    session.commit()
    return {"sent": sent, "skipped": skipped}


@router.get("/preview/{project_id}")
def preview_recipients(project_id: str, session: Session = Depends(get_session)):
    """Who would receive a request (has an email) vs who's missing one."""
    people = session.exec(select(Person).where(Person.project_id == project_id)).all()
    return {
        "with_email": [{"id": p.id, "name": p.name, "role_type": p.role_type} for p in people if p.email],
        "no_email": [{"id": p.id, "name": p.name, "role_type": p.role_type} for p in people if not p.email],
    }


# ---------- Template-based send (in-app, editable message) ----------
class TemplateSendIn(BaseModel):
    project_id: str
    person_ids: List[str]
    subject: str
    template: str   # may contain {name}, {link}, {days}


@router.post("/send-template")
def send_template(body: TemplateSendIn, session: Session = Depends(get_session)):
    project = session.get(Project, body.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")

    days_text = _days_text_for(session, body.project_id)
    people = session.exec(select(Person).where(Person.project_id == body.project_id)).all()
    chosen = {p.id: p for p in people}

    sent, skipped = [], []
    for pid in body.person_ids:
        p = chosen.get(pid)
        if not p:
            continue
        if not p.email:
            skipped.append({"name": p.name, "reason": "no email"})
            continue
        link = f"{APP_BASE_URL}/shoot/{p.token}"
        msg = (body.template
               .replace("{name}", p.name)
               .replace("{link}", link)
               .replace("{days}", days_text))
        try:
            send_email(p.email, body.subject, msg)
            session.add(Event(project_id=body.project_id, type="outreach-sent", person_id=p.id))
            sent.append({"name": p.name, "email": p.email})
        except Exception as e:
            skipped.append({"name": p.name, "reason": str(e)})
    session.commit()
    return {"sent": sent, "skipped": skipped}


@router.get("/days-text/{project_id}")
def days_text(project_id: str, session: Session = Depends(get_session)):
    if not session.get(Project, project_id):
        raise HTTPException(status_code=404, detail="Project not found.")
    return {"days_text": _days_text_for(session, project_id)}


# ---------- Auto-link coordinators + Decide/Lock ----------
def _auto_link_coordinators(session: Session, project_id: str):
    """Match each location to a coordinator Person using extracted location_details."""
    project = session.get(Project, project_id)
    if not project:
        return
    breakdown = json.loads(project.breakdown_json or "{}")
    details = {(d.get("name") or "").lower(): d for d in (breakdown.get("location_details") or [])}
    people = session.exec(select(Person).where(Person.project_id == project_id)).all()
    by_email = {(p.email or "").lower(): p for p in people if p.email}
    by_name = {(p.name or "").lower(): p for p in people}
    locs = session.exec(select(Location).where(Location.project_id == project_id)).all()
    for loc in locs:
        if loc.coordinator_person_id:
            continue
        d = details.get((loc.name or "").lower(), {})
        match = None
        if d.get("contact_email") and d["contact_email"].lower() in by_email:
            match = by_email[d["contact_email"].lower()]
        elif d.get("contact_name") and d["contact_name"].lower() in by_name:
            match = by_name[d["contact_name"].lower()]
        if match:
            loc.coordinator_person_id = match.id
            session.add(loc)
    session.commit()


@router.post("/auto-link-coordinators/{project_id}")
def auto_link(project_id: str, session: Session = Depends(get_session)):
    _auto_link_coordinators(session, project_id)
    locs = session.exec(select(Location).where(Location.project_id == project_id)).all()
    return [{"id": l.id, "name": l.name, "coordinator_person_id": l.coordinator_person_id} for l in locs]


@router.get("/decide/{project_id}")
def decide(project_id: str, session: Session = Depends(get_session)):
    """Per shoot day: tally how many can make each candidate date, mark location
    availability and the recommended date."""
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")

    days = session.exec(
        select(ShootDay).where(ShootDay.project_id == project_id).order_by(ShootDay.day_number)
    ).all()
    locs = {l.id: l for l in session.exec(select(Location).where(Location.project_id == project_id)).all()}
    people = {p.id: p for p in session.exec(select(Person).where(Person.project_id == project_id)).all()}
    responses = session.exec(select(ScheduleResponse).where(ScheduleResponse.project_id == project_id)).all()

    out = []
    for d in days:
        cds = _loads(d.candidate_dates)
        loc = locs.get(d.location_id)
        coord_id = loc.coordinator_person_id if loc else None

        day_resps = [r for r in responses if r.shoot_day_id == d.id]
        # tally per candidate date
        tally = []
        for cd in cds:
            available = []
            for r in day_resps:
                if cd in _loads(r.picked_dates):
                    available.append(person_name := people.get(r.person_id).name if people.get(r.person_id) else "?")
            loc_ok = None
            if coord_id:
                cr = next((r for r in day_resps if r.person_id == coord_id), None)
                loc_ok = (cr is not None and cd in _loads(cr.picked_dates))
            tally.append({
                "date": cd,
                "available_count": len(available),
                "available_names": available,
                "location_available": loc_ok,  # True / False / None(unknown)
            })

        # recommended = highest available_count among dates where location is ok (or unknown)
        rec = None
        eligible = [t for t in tally if t["location_available"] in (True, None)]
        if eligible:
            rec = max(eligible, key=lambda t: t["available_count"])["date"]

        # suggested alternates from anyone who couldn't do the candidates
        suggested = []
        for r in day_resps:
            for sd in _loads(r.suggested_dates):
                nm = people.get(r.person_id).name if people.get(r.person_id) else "?"
                suggested.append({"date": sd, "by": nm})

        out.append({
            "shoot_day_id": d.id,
            "day_number": d.day_number,
            "location_name": loc.name if loc else None,
            "coordinator_name": people[coord_id].name if coord_id and coord_id in people else None,
            "candidate_dates": cds,
            "tally": tally,
            "recommended_date": rec,
            "locked_date": d.locked_date,
            "suggested_alternates": suggested,
            "responses_in": len(day_resps),
        })
    return out


class LockIn(BaseModel):
    date: str


@router.post("/days/{day_id}/lock")
def lock_date(day_id: str, body: LockIn, session: Session = Depends(get_session)):
    d = session.get(ShootDay, day_id)
    if not d:
        raise HTTPException(status_code=404, detail="Shoot day not found.")
    d.locked_date = body.date
    d.status = "locked"
    session.add(d)
    session.add(Event(project_id=d.project_id, type="day-locked", shoot_day_id=d.id,
                      payload=json.dumps({"date": body.date})))
    session.commit()
    return {"shoot_day_id": d.id, "locked_date": d.locked_date}


@router.post("/days/{day_id}/unlock")
def unlock_date(day_id: str, session: Session = Depends(get_session)):
    d = session.get(ShootDay, day_id)
    if not d:
        raise HTTPException(status_code=404, detail="Shoot day not found.")
    d.locked_date = None
    d.status = "planning"
    session.add(d); session.commit()
    return {"shoot_day_id": d.id, "locked_date": None}


# ---------- Response roster (who responded, who's waiting) ----------
@router.get("/responses/{project_id}")
def response_roster(project_id: str, session: Session = Depends(get_session)):
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")

    people = session.exec(select(Person).where(Person.project_id == project_id)).all()
    days = session.exec(
        select(ShootDay).where(ShootDay.project_id == project_id).order_by(ShootDay.day_number)
    ).all()
    responses = session.exec(select(ScheduleResponse).where(ScheduleResponse.project_id == project_id)).all()
    resp_by = {(r.person_id, r.shoot_day_id): r for r in responses}

    out = []
    for d in days:
        rows = []
        for p in people:
            r = resp_by.get((p.id, d.id))
            rows.append({
                "person_id": p.id,
                "name": p.name,
                "role_type": p.role_type,
                "responded": bool(r and r.responded_at),
                "picked_dates": _loads(r.picked_dates) if r else [],
                "suggested_dates": _loads(r.suggested_dates) if r else [],
            })
        responded = sum(1 for x in rows if x["responded"])
        out.append({
            "shoot_day_id": d.id,
            "day_number": d.day_number,
            "responded_count": responded,
            "total": len(rows),
            "rows": rows,
        })
    return out
