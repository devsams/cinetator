import json
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from pydantic import BaseModel
from typing import Optional

from ..db import get_session
from ..models import Project, Person, ShootDay, Location, ScheduleResponse

router = APIRouter(prefix="/api/projects", tags=["projects"])


class CreateIn(BaseModel):
    title: str = "Untitled Production"


class StatusIn(BaseModel):
    status: str   # in_progress | live | archived


def _summary(session: Session, p: Project) -> dict:
    bd = json.loads(p.breakdown_json or "{}")
    days = session.exec(select(ShootDay).where(ShootDay.project_id == p.id)).all()
    people = session.exec(select(Person).where(Person.project_id == p.id)).all()
    locked = sum(1 for d in days if d.locked_date)
    return {
        "id": p.id,
        "title": p.title,
        "status": getattr(p, "status", "in_progress"),
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "shoot_days": len(days),
        "days_locked": locked,
        "people": len(people),
        "scenes": len(bd.get("scenes", [])),
        "locations": len(bd.get("locations", [])),
    }


@router.get("")
def list_projects(session: Session = Depends(get_session)):
    projects = session.exec(select(Project).order_by(Project.created_at.desc())).all()
    return [_summary(session, p) for p in projects]


@router.post("")
def create_project(body: CreateIn, session: Session = Depends(get_session)):
    p = Project(title=body.title, status="in_progress")
    session.add(p); session.commit(); session.refresh(p)
    return _summary(session, p)


@router.patch("/{project_id}/status")
def set_status(project_id: str, body: StatusIn, session: Session = Depends(get_session)):
    p = session.get(Project, project_id)
    if not p:
        raise HTTPException(status_code=404, detail="Project not found.")
    if body.status not in ("in_progress", "live", "wrapped", "abandoned"):
        raise HTTPException(status_code=400, detail="Bad status.")
    p.status = body.status
    session.add(p); session.commit()
    return {"id": p.id, "status": p.status}


@router.delete("/{project_id}")
def delete_project(project_id: str, session: Session = Depends(get_session)):
    p = session.get(Project, project_id)
    if not p:
        raise HTTPException(status_code=404, detail="Project not found.")
    # clean up children
    for model in (Person, ShootDay, Location, ScheduleResponse):
        for row in session.exec(select(model).where(model.project_id == project_id)).all():
            session.delete(row)
    session.delete(p); session.commit()
    return {"deleted": project_id}


@router.get("/{project_id}")
def get_project(project_id: str, session: Session = Depends(get_session)):
    p = session.get(Project, project_id)
    if not p:
        raise HTTPException(status_code=404, detail="Project not found.")
    return {**_summary(session, p), "breakdown": json.loads(p.breakdown_json or "{}")}


class CompanyIn(BaseModel):
    production_company: str


@router.patch("/{project_id}/company")
def set_company(project_id: str, body: CompanyIn, session: Session = Depends(get_session)):
    p = session.get(Project, project_id)
    if not p:
        raise HTTPException(status_code=404, detail="Project not found.")
    p.production_company = body.production_company
    session.add(p); session.commit()
    return {"production_company": p.production_company}
