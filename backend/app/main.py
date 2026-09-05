import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from .db import init_db
from .routes import breakdown, people, plan, schedule, link, projects, chat, stripboard

logger = logging.getLogger("cinetator")

app = FastAPI(title="Cinetator API")


class ErrorHandlingMiddleware(BaseHTTPMiddleware):
    """Catch unhandled exceptions and turn them into a normal JSON response.

    Without this, an unhandled exception (e.g. a Gemini/Vertex AI call failing,
    a Parallel API timeout, a bad PDF) propagates past CORSMiddleware before a
    response is ever built, so the browser never sees CORS headers on the
    error response. The frontend then reports a generic "Failed to fetch" /
    CORS error instead of the real problem, which makes debugging painful for
    both developers and end users. Catching it here, *inside* CORSMiddleware,
    means the resulting response still gets proper CORS headers attached.
    """

    async def dispatch(self, request, call_next):
        try:
            return await call_next(request)
        except Exception as exc:
            logger.exception("Unhandled error in %s %s", request.method, request.url.path)
            return JSONResponse(
                status_code=500,
                content={"detail": f"Internal server error: {exc}"},
            )


# NOTE: order matters here. Middleware added first ends up innermost (closest
# to the routes), so ErrorHandlingMiddleware must be added *before*
# CORSMiddleware so that CORSMiddleware wraps it — that way, a response built
# by ErrorHandlingMiddleware after catching an exception still passes through
# CORSMiddleware's header injection on its way out.
app.add_middleware(ErrorHandlingMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://localhost:\d+",
    allow_origins=["https://cinetator-frontend-844278617352.us-central1.run.app"],
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
