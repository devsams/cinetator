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
    status: str = "in_progress"   # in_progress | live | archived
    production_company: Optional[str] = None
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
    crew_calls: Optional[str] = None             # JSON list of {dept, time}
    weather: Optional[str] = None
    sunrise: Optional[str] = None
    sunset: Optional[str] = None


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


class ChatSession(SQLModel, table=True):
    id: str = Field(default_factory=_uid, primary_key=True)
    project_id: str = Field(foreign_key="project.id")
    title: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class ChatMessage(SQLModel, table=True):
    id: str = Field(default_factory=_uid, primary_key=True)
    session_id: str = Field(foreign_key="chatsession.id")
    role: str            # user | assistant
    text: str
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Strip(SQLModel, table=True):
    id: str = Field(default_factory=_uid, primary_key=True)
    project_id: str = Field(foreign_key="project.id")
    shoot_day_id: str = Field(foreign_key="shootday.id")
    order_index: int = 0
    type: str = "scene"           # scene | special
    scene_number: Optional[str] = None   # references breakdown.scenes[].number
    label: Optional[str] = None          # for special strips: Crew Call / Company Move / Lunch Break / Wrap
    duration_mins: int = 30


class Note(SQLModel, table=True):
    id: str = Field(default_factory=_uid, primary_key=True)
    project_id: str = Field(foreign_key="project.id")
    person_id: str = Field(foreign_key="person.id")
    shoot_day_id: Optional[str] = Field(default=None, foreign_key="shootday.id")
    text: str
    flags_production: bool = False
    resolved: bool = False
    reply_text: Optional[str] = None
    replied_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class PropStatus(SQLModel, table=True):
    id: str = Field(default_factory=_uid, primary_key=True)
    project_id: str = Field(foreign_key="project.id")
    shoot_day_id: str = Field(foreign_key="shootday.id")
    prop_name: str
    ready: bool = False


class Arrival(SQLModel, table=True):
    id: str = Field(default_factory=_uid, primary_key=True)
    project_id: str = Field(foreign_key="project.id")
    shoot_day_id: str = Field(foreign_key="shootday.id")
    person_id: str = Field(foreign_key="person.id")
    arrived: bool = False
    arrived_at: Optional[datetime] = None


class SceneCompletion(SQLModel, table=True):
    id: str = Field(default_factory=_uid, primary_key=True)
    project_id: str = Field(foreign_key="project.id")
    shoot_day_id: str = Field(foreign_key="shootday.id")
    scene_number: str
    completed: bool = False


class Upload(SQLModel, table=True):
    id: str = Field(default_factory=_uid, primary_key=True)
    project_id: str = Field(foreign_key="project.id")
    mode: str                    # "script" | "details"
    text: str
    filename: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
