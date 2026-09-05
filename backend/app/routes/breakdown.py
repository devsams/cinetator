import json
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from sqlmodel import Session, select
from io import BytesIO
from pypdf import PdfReader
from pydantic import BaseModel

from ..db import get_session
from ..models import Project, Person, Location, Upload
from ..agents.breakdown import run_breakdown, run_details_import

router = APIRouter(prefix="/api/breakdown", tags=["breakdown"])


def _extract_pdf_text(data: bytes) -> str:
    reader = PdfReader(BytesIO(data))
    return "\n".join((page.extract_text() or "") for page in reader.pages)


def _merge_people(session: Session, project_id: str, people: list[dict]) -> int:
    """Upsert people by name — update contact details if the person already
    exists, otherwise create them. Returns count of new people added."""
    existing = session.exec(select(Person).where(Person.project_id == project_id)).all()
    by_name = {p.name.lower(): p for p in existing}
    added = 0
    for entry in people:
        name = (entry.get("name") or "").strip()
        if not name:
            continue
        key = name.lower()
        if key in by_name:
            p = by_name[key]
            # fill in any missing fields, don't overwrite what's already set
            p.email = p.email or entry.get("email")
            p.phone = p.phone or entry.get("phone")
            p.character = p.character or entry.get("character")
            session.add(p)
        else:
            session.add(Person(
                project_id=project_id, name=name,
                role_type=entry.get("role_type") or "other",
                character=entry.get("character"),
                email=entry.get("email"), phone=entry.get("phone"),
            ))
            added += 1
    return added


def _merge_locations(session: Session, project_id: str, breakdown: dict, new_details: list[dict]) -> dict:
    """Merge new location_details into the project's breakdown JSON (by name),
    without touching scenes. Does NOT create Location rows — that still happens
    via the existing Plan 'confirm' flow."""
    existing = {d.get("name", "").lower(): d for d in breakdown.get("location_details", [])}
    names = set(breakdown.get("locations", []))
    for d in new_details:
        name = (d.get("name") or "").strip()
        if not name:
            continue
        existing[name.lower()] = d
        names.add(name)
    breakdown["location_details"] = list(existing.values())
    breakdown["locations"] = list(names)
    return breakdown


@router.post("/analyze")
async def analyze(
    title: str = Form("Untitled Production"),
    script_text: str = Form(None),
    file: UploadFile = File(None),
    project_id: str = Form(None),
    mode: str = Form("script"),  # "script" | "details"
    session: Session = Depends(get_session),
):
    text = script_text or ""
    if file is not None:
        raw = await file.read()
        if file.filename.lower().endswith(".pdf"):
            text = _extract_pdf_text(raw)
        else:
            text = raw.decode("utf-8", errors="ignore")

    if not text.strip():
        raise HTTPException(status_code=400, detail="No script text or file provided.")

    project = session.get(Project, project_id) if project_id else None

    # log this upload regardless of outcome, once we know which project it belongs to
    def _log_upload(pid: str):
        session.add(Upload(project_id=pid, mode=mode, text=text, filename=(file.filename if file else None)))

    if mode == "details":
        data = run_details_import(text)
        people = data.get("people", [])
        location_details = data.get("location_details", [])

        if project:
            # merge into existing project
            breakdown = json.loads(project.breakdown_json or "{}")
            breakdown = _merge_locations(session, project.id, breakdown, location_details)
            project.breakdown_json = json.dumps(breakdown)
            session.add(project)
            added = _merge_people(session, project.id, people)
            _log_upload(project.id)
            session.commit()
            return {"project_id": project.id, "added_people": added, "people": people, "location_details": location_details}
        else:
            # new project from details only, no scenes
            breakdown = {
                "title": None, "estimated_shoot_days": None,
                "characters": [], "locations": [d.get("name") for d in location_details if d.get("name")],
                "location_details": location_details, "scenes": [], "day_notes": {}, "people": people,
            }
            new_project = Project(title=title, script_text=text, breakdown_json=json.dumps(breakdown))
            session.add(new_project); session.commit(); session.refresh(new_project)
            _merge_people(session, new_project.id, people)
            _log_upload(new_project.id)
            session.commit()
            return {"project_id": new_project.id, "breakdown": breakdown}

    # mode == "script" (default, existing behavior)
    breakdown = run_breakdown(text)
    if project:
        project.title = breakdown.get("title") or project.title
        project.script_text = text
        project.breakdown_json = json.dumps(breakdown)
        session.add(project)
        _log_upload(project.id)
        session.commit(); session.refresh(project)
        return {"project_id": project.id, "breakdown": breakdown}
    else:
        new_project = Project(
            title=breakdown.get("title") or title,
            script_text=text,
            breakdown_json=json.dumps(breakdown),
        )
        session.add(new_project); session.commit(); session.refresh(new_project)
        _log_upload(new_project.id)
        session.commit()
        return {"project_id": new_project.id, "breakdown": breakdown}


@router.get("/{project_id}")
def get_breakdown(project_id: str, session: Session = Depends(get_session)):
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")
    return {
        "project_id": project.id,
        "title": project.title,
        "breakdown": json.loads(project.breakdown_json or "{}"),
    }


class SceneIn(BaseModel):
    day: int
    int_ext: str = "EXT"
    location: str
    time_of_day: str = "DAY"
    cast: list[str] = []
    props: list[str] = []
    pages: str = "1"


@router.post("/{project_id}/add-scene")
def add_scene(project_id: str, body: SceneIn, session: Session = Depends(get_session)):
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")
    breakdown = json.loads(project.breakdown_json or "{}")
    scenes = breakdown.get("scenes", [])
    next_num = str(len(scenes) + 1)
    scenes.append({
        "number": next_num, "day": body.day, "int_ext": body.int_ext,
        "location": body.location, "time_of_day": body.time_of_day,
        "cast": body.cast, "props": body.props, "pages": body.pages,
    })
    breakdown["scenes"] = scenes
    if body.location and body.location not in breakdown.get("locations", []):
        breakdown.setdefault("locations", []).append(body.location)
    for c in body.cast:
        if c and c not in breakdown.get("characters", []):
            breakdown.setdefault("characters", []).append(c)
    project.breakdown_json = json.dumps(breakdown)
    session.add(project); session.commit()
    return {"scenes": breakdown["scenes"]}


@router.get("/{project_id}/script")
def get_script(project_id: str, session: Session = Depends(get_session)):
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")
    return {"script_text": project.script_text or "", "title": project.title}


@router.get("/uploads/{project_id}")
def list_uploads(project_id: str, session: Session = Depends(get_session)):
    rows = session.exec(
        select(Upload).where(Upload.project_id == project_id).order_by(Upload.created_at.desc())
    ).all()
    return [
        {"id": u.id, "mode": u.mode, "filename": u.filename,
         "preview": (u.text[:120] + "…") if len(u.text) > 120 else u.text,
         "created_at": u.created_at.isoformat() if u.created_at else None}
        for u in rows
    ]


@router.get("/uploads/one/{upload_id}")
def get_upload(upload_id: str, session: Session = Depends(get_session)):
    u = session.get(Upload, upload_id)
    if not u:
        raise HTTPException(status_code=404, detail="Upload not found.")
    return {"id": u.id, "mode": u.mode, "filename": u.filename, "text": u.text,
            "created_at": u.created_at.isoformat() if u.created_at else None}


@router.post("/uploads/{upload_id}/reapply")
def reapply_upload(upload_id: str, session: Session = Depends(get_session)):
    """Re-run analysis using a historical upload's text, applied to its project."""
    u = session.get(Upload, upload_id)
    if not u:
        raise HTTPException(status_code=404, detail="Upload not found.")
    project = session.get(Project, u.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")

    if u.mode == "details":
        data = run_details_import(u.text)
        breakdown = json.loads(project.breakdown_json or "{}")
        breakdown = _merge_locations(session, project.id, breakdown, data.get("location_details", []))
        project.breakdown_json = json.dumps(breakdown)
        session.add(project)
        added = _merge_people(session, project.id, data.get("people", []))
        session.commit()
        return {"project_id": project.id, "added_people": added}
    else:
        breakdown = run_breakdown(u.text)
        project.title = breakdown.get("title") or project.title
        project.script_text = u.text
        project.breakdown_json = json.dumps(breakdown)
        session.add(project); session.commit()
        return {"project_id": project.id, "breakdown": breakdown}
