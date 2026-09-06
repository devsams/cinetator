# LilyCue

Film production coordination, with an AI assistant ("Lily") built in — script breakdown, scheduling, a stripboard, call sheets, and cast/crew availability tracking in one app, with Gemini and web research layered on top instead of bolted beside it.

## What it does

- **Breakdown** — upload a script (PDF or pasted text) and Gemini extracts scenes, characters, locations, and props into a structured breakdown.
- **Plan** — confirm detected locations and run web research on each one (via the Parallel API) for hours, permits, weather, and nearby safety info.
- **Schedule** — organize scenes into shoot days, propose candidate dates, lock a final date, and send/track cast & crew availability requests by email.
- **Dashboard** — shoot-day readiness scoring: what's confirmed, what's pending, what's blocking a day from being ready.
- **Stripboard** — the traditional strip-based scene order for a shoot day, auto-populated from the breakdown and re-orderable.
- **Storyboard** — visual, per-scene view of a shoot day.
- **Call Sheet** — generated call sheet for a shoot day.
- **My Page** — the view a single cast/crew member sees via their own link: their scenes, call times, and an availability form (no login needed).
- **Team** — the full cast/crew directory and response status.
- **Lily (Command Center)** — a chat assistant docked in the app. She can answer questions about the current production directly, and can propose actions (adding a person, confirming a location, researching a location, locking a date, sending reminders, marking arrivals/scenes complete, etc.). Every action she proposes is shown to the user for confirmation before it actually runs — she never executes a write on her own. `check_readiness` is the one exception, since it's read-only.
- **Lily Everywhere** — the Breakdown, Schedule, Stripboard, and Team tabs each carry a small, tab-scoped AI summary/alerts/recommendations panel (one Gemini call per tab). Any recommendation can be handed off to Lily's chat with one click, which pre-fills the message for the user to review and send — never sent automatically.

## Tech stack

**Backend**
- Python, FastAPI, SQLModel (SQLite)
- Google Vertex AI (Gemini 2.5 Flash) via the `google-genai` SDK — script breakdown, chat/tool-calling, and per-tab insights
- Parallel API (`parallel-web`) — real web research on filming locations
- `pypdf` — PDF script parsing
- SMTP (via `smtplib`) — availability request/reminder emails

**Frontend**
- React 19 + Vite
- Tailwind CSS 4 + Base UI components

**Deployment**
- Docker + Google Cloud Run (separate backend and frontend services)

## Project structure

```
backend/
  app/
    main.py           FastAPI app, middleware, router registration
    db.py              SQLite session/engine setup
    models.py          SQLModel tables
    mailer.py           SMTP email sending
    routes/            API endpoints (breakdown, plan, schedule, stripboard,
                        people, link, projects, chat, insights)
    agents/             Gemini/Parallel logic (breakdown extraction, chat
                        tool-calling, location research, per-tab insights,
                        outreach email copy)
  requirements.txt
  Dockerfile

frontend/
  src/                 One component per tab, plus api.js (backend client),
                        lilyBus.js (tab -> Lily hand-off), AiLayer.jsx
                        (the embeddable per-tab AI panel)
  Dockerfile
```

## Running locally

**Backend**
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in your own values — see below
uvicorn app.main:app --reload
```

**Frontend**
```bash
cd frontend
npm install
npm run dev
```

The frontend expects the backend at `http://localhost:8000` in dev mode.

### Environment variables (`backend/.env`)

Copy `backend/.env.example` and fill in your own values — this file is gitignored and never committed. None of the variables below have real values checked into this repo.

| Variable | Purpose |
|---|---|
| `GOOGLE_CLOUD_PROJECT` | Your GCP project ID (for Vertex AI) |
| `GOOGLE_CLOUD_LOCATION` | Vertex AI region, e.g. `us-central1` |
| `GOOGLE_GENAI_USE_VERTEXAI` | `true` to route Gemini calls through Vertex AI |
| `PARALLEL_API_KEY` | API key for the Parallel web-research API |
| `DATABASE_URL` | SQLite connection string |
| `MAIL_FROM` | From-address used on outgoing emails (optional, has a default) |
| `SMTP_HOST` / `SMTP_PORT` | SMTP server for sending availability requests (optional, has a default) |
| `APP_BASE_URL` | Base URL used to build cast/crew links sent by email |

Authentication to Google Cloud (Vertex AI) uses Application Default Credentials — set those up with `gcloud auth application-default login` locally, or a service account when deployed. No credentials of any kind belong in this repo.

## Deployment

Both services deploy to Cloud Run from their respective `Dockerfile`s:
```bash
gcloud run deploy cinetator-backend --source backend
gcloud run deploy cinetator-frontend --source frontend
```
Set the backend's environment variables in Cloud Run's own configuration (Console or `--set-env-vars`) rather than shipping a `.env` file in the image.

## License

MIT — see [LICENSE](LICENSE).
