import json
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from ..db import get_session
from ..models import Project, Person, Location, ShootDay, ScheduleResponse, Strip, Note
from ..agents.insights import generate_insights

router = APIRouter(prefix="/api/insights", tags=["insights"])


def _loads(s):
    return json.loads(s) if s else []


def _schedule_data(session: Session, project_id: str) -> dict:
    days = session.exec(
        select(ShootDay).where(ShootDay.project_id == project_id).order_by(ShootDay.day_number)
    ).all()
    locations = {l.id: l.name for l in session.exec(select(Location).where(Location.project_id == project_id)).all()}
    people = {p.id: p.name for p in session.exec(select(Person).where(Person.project_id == project_id)).all()}
    responses = session.exec(select(ScheduleResponse).where(ScheduleResponse.project_id == project_id)).all()
    by_day = {}
    for r in responses:
        by_day.setdefault(r.shoot_day_id, []).append({
            "person": people.get(r.person_id, "Unknown"),
            "picked_dates": _loads(r.picked_dates),
            "suggested_dates": _loads(r.suggested_dates),
        })
    return {
        "days": [
            {
                "day_number": d.day_number,
                "location": locations.get(d.location_id),
                "candidate_dates": _loads(d.candidate_dates),
                "locked_date": d.locked_date,
                "responses": by_day.get(d.id, []),
            }
            for d in days
        ]
    }


def _stripboard_data(session: Session, project_id: str, day_id: Optional[str]) -> dict:
    project = session.get(Project, project_id)
    breakdown = json.loads(project.breakdown_json or "{}") if project else {}
    scene_by_num = {s.get("number"): s for s in breakdown.get("scenes", [])}
    days = session.exec(
        select(ShootDay).where(ShootDay.project_id == project_id).order_by(ShootDay.day_number)
    ).all()
    target = session.get(ShootDay, day_id) if day_id else None
    if not target and days:
        target = days[0]
    if not target:
        return {"day_number": None, "strips": []}

    strips = session.exec(
        select(Strip).where(Strip.shoot_day_id == target.id).order_by(Strip.order_index)
    ).all()
    out_strips = []
    total_mins = 0
    for s in strips:
        total_mins += s.duration_mins or 0
        if s.type == "scene":
            sc = scene_by_num.get(s.scene_number, {})
            out_strips.append({
                "type": "scene", "scene_number": s.scene_number,
                "location": sc.get("location"), "int_ext": sc.get("int_ext"),
                "time_of_day": sc.get("time_of_day"), "cast": sc.get("cast", []),
                "duration_mins": s.duration_mins,
            })
        else:
            out_strips.append({"type": "special", "label": s.label, "duration_mins": s.duration_mins})

    return {
        "day_number": target.day_number,
        "total_hours": round(total_mins / 60, 1),
        "strip_count": len(strips),
        "strips": out_strips,
    }


def _team_data(session: Session, project_id: str) -> dict:
    people = {p.id: p.name for p in session.exec(select(Person).where(Person.project_id == project_id)).all()}
    notes = session.exec(
        select(Note).where(Note.project_id == project_id).order_by(Note.created_at)
    ).all()
    return {
        "unanswered": [
            {
                "person": people.get(n.person_id, "Unknown"),
                "text": n.text,
                "flags_production": n.flags_production,
                "created_at": n.created_at.isoformat() if n.created_at else None,
            }
            for n in notes if not n.reply_text
        ],
        "answered_count": len([n for n in notes if n.reply_text]),
    }


_GATHER = {
    "schedule": lambda session, project_id, day_id: _schedule_data(session, project_id),
    "stripboard": lambda session, project_id, day_id: _stripboard_data(session, project_id, day_id),
    "team": lambda session, project_id, day_id: _team_data(session, project_id),
}


@router.get("/{tab}/{project_id}")
def get_insights(
    tab: str,
    project_id: str,
    day_id: Optional[str] = Query(None),
    session: Session = Depends(get_session),
):
    """Read-only, tab-scoped AI summary/alerts/recommendations. One small Gemini
    call per tab against just that tab's own data — never the whole project,
    never anything that writes. Actual changes still go through Lily's chat."""
    if tab not in _GATHER:
        raise HTTPException(status_code=404, detail=f"No insights available for tab '{tab}'.")
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")
    if not project.breakdown_json:
        raise HTTPException(status_code=400, detail="Analyze a script first.")

    data = _GATHER[tab](session, project_id, day_id)
    return generate_insights(tab, data)
