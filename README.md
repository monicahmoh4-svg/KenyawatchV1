# KenyaWatch AI — Procurement Intelligence Platform

An independent civic-tech platform for exploring Kenyan government procurement
data: contracts across all 47 counties, AI-assisted risk scoring, satellite
"ghost project" verification, anonymous citizen reporting, and an AI
investigator chat.

## Structure

- `Backend/` — Node.js/Express API + PostgreSQL (deploy to Render; see `render.yaml`)
- `frontend/public/` — static single-page frontend (deploy to Vercel; see `frontend/public/vercel.json`)

## Backend setup

```
npm install
cp .env.example .env   # fill in DATABASE_URL, GEMINI_API_KEY, GOOGLE_MAPS_API_KEY
npm start
```

On first boot the backend creates its schema and seeds:
- A small set of **documented** real, source-cited procurement cases.
- A **reference** baseline of representative sample contracts for all 47 counties (clearly labeled as such everywhere in the UI/API).
- Ghost project records for the documented cases.

Use the "Sync Data" tab (or `POST /api/sync/ocds`) to pull live records from
the Open Contracting Partnership's Kenya OCDS feed for a given year/county.

## Frontend setup

Open `frontend/public/index.html` and edit the single `<meta name="kenyawatch-api-base">`
tag near the top to point at your deployed backend URL. That's the only place
the backend URL needs to be set — every API call in the app reads from it.
You can also override it per-visit with `?api=https://your-backend.example.com`.

## Key API endpoints

- `GET /api/stats` — dashboard totals
- `GET /api/contracts/meta` — counties, sectors, years for filters
- `GET /api/contracts?county=&sector=&year=&risk_level=&data_type=&search=&page=&limit=`
- `GET /api/contracts/:contractId`
- `POST /api/contracts/scan`
- `GET /api/ghost-projects`
- `POST /api/reports`, `GET /api/reports`
- `POST /api/ai/chat`
- `POST /api/sync/ocds` `{ year, county? }`, `GET /api/sync/status`
- `GET /admin` — lightweight ops dashboard served by the backend

## Data honesty note

Kenya's official procurement portal is not yet fully OCDS-compliant, so no
single automated feed currently covers every contract for every county for
every year. This platform is explicit about that: every contract carries a
`data_type` of `documented`, `live_sync`, `manual_scan`, or `reference` — see
the "Sources" tab in the app.
"# KenyawatchV1" 
