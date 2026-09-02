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
    coordinator_person_id: Optional[str] = Field(default=None, foreign_key="person.id")


class ShootDay(SQLModel, table=True):
    id: str = Field(default_factory=_uid, primary_key=True)
    project_id: str = Field(foreign_key="project.id")
    day_number: int
    location_id: Optional[str] = Field(default=None, foreign_key="location.id")
    candidate_dates: Optional[str] = None       # JSON list of up to 3 ISO dates
    locked_date: Optional[str] = None           # final chosen date, or null
    call_time: Optional[str] = None
    scenes: Optional[str] = None
    status: str = "planning"                    # planning | locked


class ScheduleResponse(SQLModel, table=True):
    id: str = Field(default_factory=_uid, primary_key=True)
    project_id: str = Field(foreign_key="project.id")
    person_id: str = Field(foreign_key="person.id")
    shoot_day_id: str = Field(foreign_key="shootday.id")
    picked_dates: Optional[str] = None          # JSON list of candidate dates they can do
    suggested_dates: Optional[str] = None       # JSON list of alternates if none work
    responded_at: Optional[datetime] = None


class Event(SQLModel, table=True):
    id: str = Field(default_factory=_uid, primary_key=True)
    project_id: str = Field(foreign_key="project.id")
    type: str
    person_id: Optional[str] = None
    shoot_day_id: Optional[str] = None
    payload: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
