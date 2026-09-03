from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .db import init_db
from .routes import breakdown, people, plan, schedule, link, projects, chat, stripboard

app = FastAPI(title="Cinetator API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://cinetator-frontend-844278617352.us-central1.run.app",
        "http://localhost:5173",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)
@app.on_event("startup")
def _startup():
    init_db()


@app.get("/health")
def health():
    return {"status": "ok", "app": "cinetator"}


app.include_router(breakdown.router)
app.include_router(people.router)
app.include_router(plan.router)
app.include_router(schedule.router)
app.include_router(link.router)
app.include_router(projects.router)
app.include_router(chat.router)
app.include_router(stripboard.router)
