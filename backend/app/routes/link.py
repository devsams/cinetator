import json
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from pydantic import BaseModel
from typing import List, Optional

from ..db import get_session
from ..models import Person, ShootDay, Location, ScheduleResponse, Event

router = APIRouter(prefix="/api/link", tags=["link"])


def _loads(s): return json.loads(s) if s else []


@router.get("/{token}")
def get_link(token: str, session: Session = Depends(get_session)):
    """Public: what a cast/crew/location person sees when they open their link."""
    person = session.exec(select(Person).where(Person.token == token)).first()
    if not person:
        raise HTTPException(status_code=404, detail="Invalid link.")

    project_id = person.project_id
    days = session.exec(
        select(ShootDay).where(ShootDay.project_id == project_id).order_by(ShootDay.day_number)
    ).all()
    locs = {l.id: l for l in session.exec(select(Location).where(Location.project_id == project_id)).all()}

    # existing responses by this person
    resp = session.exec(
        select(ScheduleResponse).where(
            ScheduleResponse.person_id == person.id,
            ScheduleResponse.project_id == project_id,
        )
    ).all()
    resp_by_day = {r.shoot_day_id: r for r in resp}

    out_days = []
    for d in days:
        loc = locs.get(d.location_id)
        r = resp_by_day.get(d.id)
        out_days.append({
            "shoot_day_id": d.id,
            "day_number": d.day_number,
            "location_name": loc.name if loc else None,
            "candidate_dates": _loads(d.candidate_dates),
            "locked_date": d.locked_date,
            "picked_dates": _loads(r.picked_dates) if r else [],
            "suggested_dates": _loads(r.suggested_dates) if r else [],
            "responded": bool(r and r.responded_at),
        })

    return {
        "person": {"name": person.name, "role_type": person.role_type, "character": person.character},
        "days": out_days,
    }


class ResponseIn(BaseModel):
    shoot_day_id: str
    picked_dates: List[str] = []
    suggested_dates: List[str] = []


@router.post("/{token}/respond")
def respond(token: str, body: ResponseIn, session: Session = Depends(get_session)):
    """Public: person submits availability for one shoot day."""
    person = session.exec(select(Person).where(Person.token == token)).first()
    if not person:
        raise HTTPException(status_code=404, detail="Invalid link.")
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
