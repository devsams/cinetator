import json
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from pydantic import BaseModel
from typing import Optional, List

from ..db import get_session
from ..models import Project, ShootDay, Strip

router = APIRouter(prefix="/api/stripboard", tags=["stripboard"])


def _serialize(s: Strip) -> dict:
    return {
        "id": s.id, "shoot_day_id": s.shoot_day_id, "order_index": s.order_index,
        "type": s.type, "scene_number": s.scene_number, "label": s.label,
        "duration_mins": s.duration_mins,
    }


@router.get("/{shoot_day_id}")
def list_strips(shoot_day_id: str, session: Session = Depends(get_session)):
    rows = session.exec(
        select(Strip).where(Strip.shoot_day_id == shoot_day_id).order_by(Strip.order_index)
    ).all()
    return [_serialize(r) for r in rows]


class StripIn(BaseModel):
    project_id: str
    type: str = "scene"
    scene_number: Optional[str] = None
    label: Optional[str] = None
    duration_mins: int = 30


@router.post("/{shoot_day_id}")
def add_strip(shoot_day_id: str, body: StripIn, session: Session = Depends(get_session)):
    day = session.get(ShootDay, shoot_day_id)
    if not day:
        raise HTTPException(status_code=404, detail="Shoot day not found.")
    existing = session.exec(select(Strip).where(Strip.shoot_day_id == shoot_day_id)).all()
    strip = Strip(
        project_id=body.project_id, shoot_day_id=shoot_day_id,
        order_index=len(existing), type=body.type,
        scene_number=body.scene_number, label=body.label, duration_mins=body.duration_mins,
    )
    session.add(strip); session.commit(); session.refresh(strip)
    return _serialize(strip)


class StripUpdate(BaseModel):
    duration_mins: Optional[int] = None
    label: Optional[str] = None


@router.patch("/strips/{strip_id}")
def update_strip(strip_id: str, body: StripUpdate, session: Session = Depends(get_session)):
    s = session.get(Strip, strip_id)
    if not s:
        raise HTTPException(status_code=404, detail="Strip not found.")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(s, k, v)
    session.add(s); session.commit(); session.refresh(s)
    return _serialize(s)


@router.delete("/strips/{strip_id}")
def delete_strip(strip_id: str, session: Session = Depends(get_session)):
    s = session.get(Strip, strip_id)
    if not s:
        raise HTTPException(status_code=404, detail="Strip not found.")
    session.delete(s); session.commit()
    return {"deleted": strip_id}


class ReorderIn(BaseModel):
    ordered_ids: List[str]


@router.post("/{shoot_day_id}/reorder")
def reorder(shoot_day_id: str, body: ReorderIn, session: Session = Depends(get_session)):
    rows = {r.id: r for r in session.exec(select(Strip).where(Strip.shoot_day_id == shoot_day_id)).all()}
    for i, sid in enumerate(body.ordered_ids):
        if sid in rows:
            rows[sid].order_index = i
            session.add(rows[sid])
    session.commit()
    return {"ok": True}


@router.post("/{shoot_day_id}/auto-populate")
def auto_populate(shoot_day_id: str, session: Session = Depends(get_session)):
    """Create scene strips from the breakdown for every scene tagged with this day."""
    day = session.get(ShootDay, shoot_day_id)
    if not day:
        raise HTTPException(status_code=404, detail="Shoot day not found.")
    project = session.get(Project, day.project_id)
    breakdown = json.loads(project.breakdown_json or "{}")
    scenes = [sc for sc in breakdown.get("scenes", []) if str(sc.get("day")) == str(day.day_number)]

    existing = session.exec(select(Strip).where(Strip.shoot_day_id == shoot_day_id)).all()
    if existing:
        return [_serialize(r) for r in sorted(existing, key=lambda x: x.order_index)]

    created = []
    for i, sc in enumerate(scenes):
        pages = sc.get("pages", "1")
        try:
            eighths = int(round(float(eval(pages.replace(" ", "+"))) * 8)) if "/" not in pages else None
        except Exception:
            eighths = None
        strip = Strip(
            project_id=day.project_id, shoot_day_id=shoot_day_id, order_index=i, type="scene",
            scene_number=sc.get("number"), duration_mins=30,
        )
        session.add(strip); created.append(strip)
    session.commit()
    for s in created:
        session.refresh(s)
    return [_serialize(s) for s in created]


class CrewCallsIn(BaseModel):
    crew_calls: List[dict]


@router.patch("/{shoot_day_id}/crew-calls")
def set_crew_calls(shoot_day_id: str, body: CrewCallsIn, session: Session = Depends(get_session)):
    day = session.get(ShootDay, shoot_day_id)
    if not day:
        raise HTTPException(status_code=404, detail="Shoot day not found.")
    day.crew_calls = json.dumps(body.crew_calls)
    session.add(day); session.commit()
    return {"crew_calls": body.crew_calls}


class DayMetaIn(BaseModel):
    weather: Optional[str] = None
    sunrise: Optional[str] = None
    sunset: Optional[str] = None


@router.patch("/{shoot_day_id}/meta")
def set_day_meta(shoot_day_id: str, body: DayMetaIn, session: Session = Depends(get_session)):
    day = session.get(ShootDay, shoot_day_id)
    if not day:
        raise HTTPException(status_code=404, detail="Shoot day not found.")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(day, k, v)
    session.add(day); session.commit()
    return {"ok": True}
