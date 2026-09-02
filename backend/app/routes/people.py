import json
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from pydantic import BaseModel
from typing import Optional

from ..db import get_session
from ..models import Project, Person

router = APIRouter(prefix="/api/people", tags=["people"])


class PersonIn(BaseModel):
    project_id: str
    name: str
    role_type: str = "cast"
    character: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None


class PersonUpdate(BaseModel):
    name: Optional[str] = None
    role_type: Optional[str] = None
    character: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None


def _serialize(p: Person) -> dict:
    return {"id": p.id, "name": p.name, "role_type": p.role_type,
            "character": p.character, "email": p.email, "phone": p.phone, "token": p.token}


@router.get("/{project_id}")
def list_people(project_id: str, session: Session = Depends(get_session)):
    people = session.exec(select(Person).where(Person.project_id == project_id)).all()
    return [_serialize(p) for p in people]


@router.post("")
def add_person(body: PersonIn, session: Session = Depends(get_session)):
    if not session.get(Project, body.project_id):
        raise HTTPException(status_code=404, detail="Project not found.")
    p = Person(**body.model_dump())
    session.add(p); session.commit(); session.refresh(p)
    return _serialize(p)


@router.patch("/{person_id}")
def update_person(person_id: str, body: PersonUpdate, session: Session = Depends(get_session)):
    p = session.get(Person, person_id)
    if not p:
        raise HTTPException(status_code=404, detail="Person not found.")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(p, k, v)
    session.add(p); session.commit(); session.refresh(p)
    return _serialize(p)


@router.delete("/{person_id}")
def delete_person(person_id: str, session: Session = Depends(get_session)):
    p = session.get(Person, person_id)
    if not p:
        raise HTTPException(status_code=404, detail="Person not found.")
    session.delete(p); session.commit()
    return {"deleted": person_id}


@router.post("/seed-cast/{project_id}")
def seed_cast(project_id: str, session: Session = Depends(get_session)):
    """Populate the People directory from the breakdown.
    Prefers the extracted `people` list (real names + contacts) when present;
    otherwise falls back to the detected character names (blank contacts)."""
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")
    breakdown = json.loads(project.breakdown_json or "{}")

    existing = session.exec(select(Person).where(Person.project_id == project_id)).all()
    existing_keys = {(p.name or "").lower() for p in existing}

    created = []
    people = breakdown.get("people") or []

    if people:
        # Real people with details extracted from the document
        for entry in people:
            name = (entry.get("name") or "").strip()
            if not name or name.lower() in existing_keys:
                continue
            p = Person(
                project_id=project_id,
                name=name,
                role_type=entry.get("role_type") or "cast",
                character=entry.get("character"),
                email=entry.get("email"),
                phone=entry.get("phone"),
            )
            session.add(p); created.append(p)
            existing_keys.add(name.lower())
    else:
        # Fallback: just the character names
        for name in breakdown.get("characters", []):
            if name.lower() in existing_keys:
                continue
            p = Person(project_id=project_id, name=name, role_type="cast", character=name)
            session.add(p); created.append(p)
            existing_keys.add(name.lower())

    session.commit()
    for p in created:
        session.refresh(p)
    return [_serialize(p) for p in created]
