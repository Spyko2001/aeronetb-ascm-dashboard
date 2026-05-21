# AeroNetB ASCM Dashboard

Student: Spyros Kokkoris  
Student ID: 100774175  
Module: 5CM506 Data Driven Systems

This repository contains the D-II implementation for the AeroNetB Aerospace Supply Chain Management scenario. It continues the first-semester database design and provides a Render-ready dashboard, Node.js API, PostgreSQL relational model, and MongoDB document model.

## Live Links

- GitHub: `https://github.com/Spyko2001/aeronetb-ascm-dashboard`
- Render Blueprint deploy link: `https://render.com/deploy?repo=https://github.com/Spyko2001/aeronetb-ascm-dashboard`
- Live Render app: `https://aeronetb-ascm-dashboard.onrender.com`
- Live health check: `https://aeronetb-ascm-dashboard.onrender.com/api/health`

The deployed service is connected to both databases. The health endpoint should report `database_mode: "PostgreSQL + MongoDB"` and `database_warning: null`.

## Architecture

| Layer | Technology | Purpose |
| --- | --- | --- |
| Frontend | HTML, CSS, JavaScript | Role-based dashboard with charts, search, forms, and CSV export |
| API | Node.js | Auth, RBAC, validation, audit logging, and cross-database responses |
| Relational DB | PostgreSQL on Render | Suppliers, parts, orders, shipments, employees, roles, permissions, equipment, audit logs |
| Document DB | MongoDB Atlas | QC reports, certifications, IoT logs, compliance flags |
| Deployment | Render Blueprint | Web service plus PostgreSQL database from `render.yaml` |

## Run Locally

```bash
npm install
npm start
```

Open `http://127.0.0.1:10000`.

Without `DATABASE_URL` or `MONGODB_URI`, the app runs in seeded memory mode for local demo and tests. With both variables present, PostgreSQL and MongoDB are used.

## Environment Variables

```bash
PORT=10000
DATABASE_URL=postgresql://student:password@host:5432/aeronetsql
MONGODB_URI=mongodb+srv://username:password@cluster0.mongodb.net/aeronetsystem
MONGODB_DB_NAME=aeronetsystem
SESSION_SECRET=replace-with-a-long-random-value
AUTO_SEED=true
```

No real credentials are committed.

## Demo Users

All seeded demo users use password `demo123`.

| Role | Auth ID |
| --- | --- |
| Procurement Officer | `priya.procurement` |
| Quality Inspector | `lena.inspector` |
| Supply Chain Manager | `marcus.manager` |
| Equipment Engineer | `irene.engineer` |
| Auditor / Regulator | `omar.auditor` |

## Render Blueprint Deployment

1. Push this repository to GitHub.
2. In Render, create a new Blueprint instance from this repo.
3. Render reads `render.yaml` and creates:
   - `aeronetb-ascm-dashboard` web service
   - `aeronetb-ascm-postgres` PostgreSQL database
4. Enter the private `MONGODB_URI` value when Render prompts for it.
5. Keep `AUTO_SEED=true` for first deployment so PostgreSQL and MongoDB are populated.

Render supplies `DATABASE_URL` to the service through a `fromDatabase` Blueprint reference.

## Scripts

```bash
npm run check
npm test
npm run seed
npm run seed -- --force
```

`npm run seed -- --force` reseeds configured databases. Use it only for resetting demo data.

## Main API Endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/auth/login` | Role login |
| `GET` | `/api/health` | Service health and database mode |
| `GET` | `/api/dashboard` | KPI dashboard summary |
| `GET/POST` | `/api/suppliers` | Supplier list/create |
| `GET/POST/PATCH` | `/api/orders` | Purchase order read/create/status update |
| `GET` | `/api/shipments` | Shipment list with latest event |
| `POST` | `/api/shipments/:id/events` | Add shipment checkpoint |
| `GET/POST` | `/api/qc-reports` | Versioned QC reports |
| `POST` | `/api/qc-reports/:id/approve` | Approve QC report |
| `GET/POST/PATCH` | `/api/certifications` | Certification workflow |
| `POST` | `/api/certifications/:id/approve` | Lock certification as immutable |
| `GET/POST` | `/api/iot` | IoT sensor readings |
| `GET/POST` | `/api/compliance-flags` | Auditor compliance flags |
| `GET` | `/api/audit-logs` | Audit trail |
| `GET` | `/api/export/:collection` | CSV export |

## Submission Evidence

- `docs/100774175_DDD.pdf`
- `docs/100774175_Logbook.pdf`
- `docs/100774175_videoDemo_script.md`
- `docs/demo_checklist.md`
- `sql_scripts/ddl.sql`
- `sql_scripts/dml.sql`
- `mongo_scripts/collections.js`
- `backend/`
- `frontend/`

The final ZIP is generated as `100774175_5CM506_DII.zip`, matching the provided ZIP structure template. If the Blackboard submission point asks for the shorter name from the brief, rename it to `100774175_DII.zip`.
