# Store Presence Manager

Simple full-stack app to monitor employees and visitors inside a store.

## Stack

- Backend: Node.js + Express + SQLite (`better-sqlite3`)
- Frontend: React (Vite)

## Getting started

```bash
# API
cd server
npm install
npm run dev   # http://localhost:4000

# Frontend
cd ../client
npm install
npm run dev   # http://localhost:5173 (expects API on :4000)
```

SQLite data lives in `server/data/presence.sqlite`. Seed teams/employees are created on first start.

## API outline

- `GET /api/summary` — totals and counts per team/certification/visitors
- `GET/POST/PUT/DELETE /api/teams`
- `GET/POST/PUT /api/employees`, `PATCH /api/employees/:id/activate`
- `GET /api/presence?teamId=` — list present people
- `POST /api/presence/:employeeId` — set presence `{ isPresent: bool }`

## Deploy to Render

1) Connect the repo in Render and choose **Blueprint Deploy** (`render.yaml` provided).

2) Services created by the blueprint:
   - Web service (API)
     - root: `server`
     - build: `npm install`
     - start: `node src/index.js`
     - env: `NODE_VERSION=20`
     - disk: mount `/opt/render/project/src/server/data` (keeps SQLite persistent)
     - health check: `/api/health`
   - Static site (frontend)
     - root: `client`
     - build: `npm install && npm run build`
     - publish dir: `dist`
     - env: `VITE_API_URL=https://<your-api-service>.onrender.com/api` (replace with the actual API service name, e.g. `store-presence-api`)

3) Deploy. Render will build both services; the frontend will point to the API via `VITE_API_URL`.
