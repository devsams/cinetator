from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field
import uuid


def _uid() -> str:
    return uuid.uuid4().hex


class Project(SQLModel, table=True):
    id: str = Field(default_factory=_uid, primary_key=True)
    title: str
    script_text: Optional[str] = None
    breakdown_json: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Person(SQLModel, table=True):
    id: str = Field(default_factory=_uid, primary_key=True)
    project_id: str = Field(foreign_key="project.id")
    name: str
    role_type: str          # cast | crew | other
    character: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    token: str = Field(default_factory=_uid, index=True)


class Location(SQLModel, table=True):
    id: str = Field(default_factory=_uid, primary_key=True)
    project_id: str = Field(foreign_key="project.id")
    name: str
    address: Optional[str] = None
    research_json: Optional[str] = None


class ShootDay(SQLModel, table=True):
    id: str = Field(default_factory=_uid, primary_key=True)
    project_id: str = Field(foreign_key="project.id")
    day_number: int
    date: Optional[str] = None
    location_id: Optional[str] = Field(default=None, foreign_key="location.id")
    call_time: Optional[str] = None
    scenes: Optional[str] = None
    status: str = "planned"


class Assignment(SQLModel, table=True):
    id: str = Field(default_factory=_uid, primary_key=True)
    project_id: str = Field(foreign_key="project.id")
    person_id: str = Field(foreign_key="person.id")
    shoot_day_id: str = Field(foreign_key="shootday.id")
    status: str = "pending"
    alternate_dates: Optional[str] = None


class Event(SQLModel, table=True):
    id: str = Field(default_factory=_uid, primary_key=True)
    project_id: str = Field(foreign_key="project.id")
    type: str
    person_id: Optional[str] = None
    shoot_day_id: Optional[str] = None
    payload: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
