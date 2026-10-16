# RideShare Route

A shared-commute MVP for office workers in Colombo, Sri Lanka. Passengers book a seat on a shared AC van/bus
along a fixed corridor; the matching engine groups same-direction, same-slot passengers into vehicles each
night at cut-off; drivers run the trip; the platform takes a commission plus a booking fee.

> "RideShare Route" is just the working name — it lives in one place: `APP_NAME` in
> [`backend/app/config.py`](backend/app/config.py) and [`frontend/src/lib/config.ts`](frontend/src/lib/config.ts).

## Stack

- **Backend:** Python 3.11+, FastAPI, Pydantic v2, JSON-file storage (no DB server), APScheduler for the
  nightly matching job, JWT auth.
- **Frontend:** React 18+/TypeScript, Vite, Tailwind CSS, React Router, TanStack Query, Zustand, React Hook
  Form + Zod, Leaflet/react-leaflet (CARTO Positron tiles), Recharts.
- **Maps:** Nominatim (geocoding, proxied + cached + rate-limited by the backend) and OSRM (routing, used at
  corridor-save time; falls back to haversine × 1.3 if OSRM is unreachable).

## Quick start

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
python -m app.seed --reset
uvicorn app.main:app --reload --port 8000
```

API docs: http://localhost:8000/docs

### Frontend

```bash
cd frontend
npm install
cp .env.example .env        # VITE_API_URL=http://localhost:8000/api
npm run dev
```

App: http://localhost:5173

### Tests

```bash
cd backend
source .venv/Scripts/activate   # or .venv/bin/activate on macOS/Linux
python -m pytest -q
```

11 tests cover pricing (including the exact worked example), the matching engine (seat reuse, overflow,
merging, unmatched refunds, idempotent re-runs, outbound direction reversal) and storage.

## Demo accounts

| Role | Email | Password | Notes |
|---|---|---|---|
| Admin | `admin@demo.lk` | `Admin@123` | |
| Driver (approved, 14-seat van) | `driver1@demo.lk` | `Driver@123` | Kadawatha → Colombo Fort |
| Driver (approved, 14-seat van) | `driver2@demo.lk` | `Driver@123` | Maharagama → Kollupitiya |
| Driver (approved, 28-seat bus) | `driver3@demo.lk` | `Driver@123` | Malabe → Colombo 07 |
| Driver (pending approval) | `driver4@demo.lk` | `Driver@123` | For testing the admin approval flow |
| Passenger | `passenger1@demo.lk` … `passenger20@demo.lk` | `Pass@123` | LKR 5,000 starting wallet each |

The login page also shows one-tap demo-login buttons in dev mode.

## Trying the full flow

1. Log in as a passenger → **Book** → search two Colombo-area addresses → pick a route/time → confirm.
   Your booking shows as **Pending match**.
2. Log in as `admin@demo.lk` → **Dashboard** → pick the next weekday date → **Run matching**. Confirmed,
   merged and unmatched outcomes all appear (the nightly job does the same automatically at 9:00 PM
   Asia/Colombo the day before).
3. Log in as `driver1@demo.lk` → **Today** → Accept → Start → mark passengers boarded/no-show → Complete.
   A pending payout transaction appears in **Earnings**.
4. Back as the passenger → **My Rides** → the completed ride → **Rate**.

## Architecture notes

- **Storage:** one JSON file per collection in `backend/data/`, behind a generic thread-safe
  `JsonStore` (atomic writes via `os.replace`) and a thin `Repositories` wrapper
  ([`backend/app/storage/`](backend/app/storage/)). Routers and services never touch the filesystem
  directly — only the repositories. **To swap in a real database:** reimplement `JsonStore`'s five methods
  (`all/get/find/insert/update/delete`) against your DB of choice (e.g. SQLAlchemy models) behind the same
  `Repositories` interface; nothing in `services/` or `routers/` needs to change.
- **Matching engine** ([`backend/app/services/matching.py`](backend/app/services/matching.py)): pure,
  unit-tested helper functions (interval packing via a sweep-line peak-load calculation, first-fit vehicle
  assignment, bus-vs-van vehicle selection) plus an orchestrator that is idempotent — re-running a date
  rebuilds `planned` trips but never touches trips already `driver_accepted` or later.
- **Pricing** ([`backend/app/services/pricing.py`](backend/app/services/pricing.py)): pure functions mirrored
  by the frontend's review screen; the backend is always the source of truth for the fare actually charged.

## Deployment

This repo deploys as two independent pieces:

- **Frontend → GitHub Pages**, via [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml).
  Pushing to `main` builds `frontend/` and publishes it automatically.
- **Backend → Render** (or any host that runs a long-lived Python process + persistent disk — GitHub Pages
  cannot host a FastAPI app). A [`render.yaml`](render.yaml) blueprint is included.

### One-time setup

1. **Deploy the backend on Render:**
   - New → Blueprint → point at this repo → Render reads `render.yaml` and provisions the API with a
     persistent disk for `backend/data/`.
   - Note the resulting URL (e.g. `https://rideshare-route-api.onrender.com`).
2. **Point the frontend at it:** in the GitHub repo, go to Settings → Secrets and variables → Actions →
   Variables, and add `VITE_API_URL` = `https://<your-render-url>/api`.
3. **Enable Pages:** Settings → Pages → Source = "GitHub Actions". The next push to `main` (or a manual
   run of the workflow) builds and deploys the frontend.
4. Free Render instances spin down when idle — the first request after a quiet period can take ~30–50s to
   wake up.

## Project structure

```
rideshare-route/
├── backend/            # FastAPI app, services, routers, seed script, tests
├── frontend/            # React + Vite + TypeScript app
├── render.yaml          # Backend deploy blueprint (Render)
└── .github/workflows/   # Frontend deploy to GitHub Pages
```
