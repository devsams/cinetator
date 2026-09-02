from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .db import init_db
from .routes import breakdown, people, plan

app = FastAPI(title="Cinetator API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
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


@app.get("/api/dashboard/ping")
def dashboard_ping():
    return {"tab": "dashboard", "ready": True}
