import json
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from pydantic import BaseModel
from typing import Optional

from ..db import get_session
from ..models import Project, Location
from ..agents.location import research_location

router = APIRouter(prefix="/api/plan", tags=["plan"])


class LocationIn(BaseModel):
    project_id: str
    name: str
    address: Optional[str] = None


def _serialize_loc(l: Location) -> dict:
    return {
        "id": l.id,
        "name": l.name,
        "address": l.address,
        "research": json.loads(l.research_json) if l.research_json else None,
    }


@router.get("/detected-locations/{project_id}")
def detected_locations(project_id: str, session: Session = Depends(get_session)):
    """Locations found in the breakdown, marked with whether they're already confirmed."""
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")
    breakdown = json.loads(project.breakdown_json or "{}")

    details = {d.get("name"): d for d in (breakdown.get("location_details") or []) if d.get("name")}
    names = list(breakdown.get("locations") or [])
    for n in details:
        if n not in names:
            names.append(n)

    confirmed = session.exec(select(Location).where(Location.project_id == project_id)).all()
    confirmed_names = {(l.name or "").lower() for l in confirmed}

    out = []
    for n in names:
        d = details.get(n, {})
        out.append({
            "name": n,
            "address": d.get("address"),
            "contact_name": d.get("contact_name"),
            "contact_email": d.get("contact_email"),
            "contact_phone": d.get("contact_phone"),
            "confirmed": n.lower() in confirmed_names,
        })
    return out


@router.get("/locations/{project_id}")
def list_locations(project_id: str, session: Session = Depends(get_session)):
    locs = session.exec(select(Location).where(Location.project_id == project_id)).all()
    return [_serialize_loc(l) for l in locs]


@router.post("/locations")
def add_location(body: LocationIn, session: Session = Depends(get_session)):
    if not session.get(Project, body.project_id):
        raise HTTPException(status_code=404, detail="Project not found.")
    loc = Location(project_id=body.project_id, name=body.name, address=body.address)
    session.add(loc); session.commit(); session.refresh(loc)
    return _serialize_loc(loc)


@router.post("/locations/{location_id}/research")
def research(location_id: str, session: Session = Depends(get_session)):
    loc = session.get(Location, location_id)
    if not loc:
        raise HTTPException(status_code=404, detail="Location not found.")
    data = research_location(loc.name, loc.address)
    loc.research_json = json.dumps(data)
    session.add(loc); session.commit(); session.refresh(loc)
    return _serialize_loc(loc)


@router.delete("/locations/{location_id}")
def delete_location(location_id: str, session: Session = Depends(get_session)):
    loc = session.get(Location, location_id)
    if not loc:
        raise HTTPException(status_code=404, detail="Location not found.")
    session.delete(loc); session.commit()
    return {"deleted": location_id}
