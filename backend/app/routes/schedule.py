import json
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from pydantic import BaseModel
from typing import Optional, List

from ..db import get_session
from ..models import Project, Location, ShootDay, Person, ScheduleResponse

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
