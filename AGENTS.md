# AGENTS.md

Compact guidance for working in this repo.

## Commands

- `npm run check` — syntax check backend + tests
- `npm test` — run integration tests
- `npm start` — start server (memory mode if no DB URLs)
- `npm run dev` — start with watch
- `npm run seed` / `npm run seed -- --force` — seed databases

## Architecture

- Single-package Node ESM app (Node ≥20)
- Entry: `backend/server.js`
- Frontend: static (`frontend/index.html` + `app.js`)
- Dual DB: PostgreSQL (Render) + MongoDB Atlas
- Falls back to in-memory mode when `DATABASE_URL` or `MONGODB_URI` missing
- Health endpoint (`/api/health`) must return `database_mode: "PostgreSQL + MongoDB"` + `database_warning: null` with real DBs

## Submission Folder

- Use `second semester/SUBMIT_THIS`
- Must contain **only**:
  - DDD (pdf + docx)
  - Logbook (pdf + docx)
  - videoDemo_script (pdf + docx)
  - demo_checklist.md
  - sql_scripts/, mongo_scripts/
  - backend/, frontend/
  - screenshots/ (current dashboard + diagrams)
- Never include node_modules, package-lock, render.yaml, or .env files

## Frontend Notes

- Charts use canvas (no external libs)
- Global search filters tables live
- Clear (×) button appears when filter is active
- Role permissions are enforced in both backend and frontend

## Git

- Main repo: `aeronetb-ascm-dashboard`
- Always commit before major submission steps
- Current branch: `main`

## Verification

Before finishing any session:
1. Run `npm run check && npm test`
2. Start with real DB credentials and confirm health shows dual-DB mode
3. Confirm submission folder contains only allowed files
