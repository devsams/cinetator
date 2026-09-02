import json
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from sqlmodel import Session
from io import BytesIO
from pypdf import PdfReader

from ..db import get_session
from ..models import Project
from ..agents.breakdown import run_breakdown

router = APIRouter(prefix="/api/breakdown", tags=["breakdown"])


def _extract_pdf_text(data: bytes) -> str:
    reader = PdfReader(BytesIO(data))
    return "\n".join((page.extract_text() or "") for page in reader.pages)


@router.post("/analyze")
async def analyze(
    title: str = Form("Untitled Production"),
    script_text: str = Form(None),
    file: UploadFile = File(None),
    session: Session = Depends(get_session),
):
    # get script text from either the pasted field or an uploaded PDF/txt
    text = script_text or ""
    if file is not None:
        raw = await file.read()
        if file.filename.lower().endswith(".pdf"):
            text = _extract_pdf_text(raw)
        else:
            text = raw.decode("utf-8", errors="ignore")

    if not text.strip():
        raise HTTPException(status_code=400, detail="No script text or file provided.")

    breakdown = run_breakdown(text)

    project = Project(
        title=breakdown.get("title") or title,
        script_text=text,
        breakdown_json=json.dumps(breakdown),
    )
    session.add(project)
    session.commit()
    session.refresh(project)

    return {"project_id": project.id, "breakdown": breakdown}


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
