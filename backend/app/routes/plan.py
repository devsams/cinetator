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
