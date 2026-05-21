# 100774175 Video Demo Script

Student: Spyros Kokkoris  
System: AeroNetB ASCM Dashboard  
Target length: 15-20 minutes

## 1. Opening

Introduce the system as a continuation of the Task 1 AeroNetB database design. State that the implementation uses PostgreSQL for structured relational data and MongoDB for flexible QC, certification, IoT, and compliance documents.

## 2. Deployment And Repository

Show the GitHub repository:

`https://github.com/Spyko2001/aeronetb-ascm-dashboard`

Show the Render dashboard URL:

`https://aeronetb-ascm-dashboard.onrender.com`

Open `/api/health` and show that the API responds with `database_mode: "PostgreSQL + MongoDB"` and `database_warning: null`.

## 3. Manager Overview

Log in as `marcus.manager` with password `demo123`.

Show:

- KPI cards for suppliers, open orders, delays, failed QC, pending certifications, and IoT warnings.
- Supplier performance chart.
- QC outcome chart.
- Alerts for overdue orders, QC failures, pending certifications, or sensor warnings.
- Search box and CSV export.

## 4. Procurement Workflow

Log in as `priya.procurement`.

Show:

- Supplier table.
- Order table.
- Create supplier form.
- Create purchase order form.
- Shipment visibility.

Create one small dummy supplier or order and show the record appears after refresh.

## 5. Quality Workflow

Log in as `lena.inspector`.

Show:

- QC reports table with versions.
- Certification table.
- Create a QC report for order `5002`, supplier `2`, part `101`, type `ndt`.
- Explain that this creates the next version instead of overwriting existing reports.
- Create a certification and approve it.
- Try to update the approved certification through the API or app flow and show the immutable-record error.

## 6. Equipment Workflow

Log in as `irene.engineer`.

Show:

- Equipment status list.
- IoT trend chart.
- IoT logs.
- Submit a new reading with a warning-level temperature or vibration value.
- Refresh and show the dashboard status/alert updates.

## 7. Auditor Workflow

Log in as `omar.auditor`.

Show:

- Certification records are visible.
- Core edit actions are not available.
- Raise a compliance flag against `CERT-2026-00003`.
- Explain that auditors are read-only for core records but can flag non-compliance.

## 8. Audit Trail And Security

Log back in as `marcus.manager` or stay as auditor.

Show:

- Audit log table.
- EmpID attribution for view/create/update/approve/export actions.
- RBAC enforcement: auditor write attempt returns HTTP 403.
- Certification immutability: approved certification update returns HTTP 409.

## 9. Source Code And Database Evidence

Show these files:

- `backend/server.js`
- `backend/src/db.js`
- `backend/src/security.js`
- `sql_scripts/ddl.sql`
- `sql_scripts/dml.sql`
- `mongo_scripts/collections.js`
- `render.yaml`

Explain that Render uses `DATABASE_URL` from the PostgreSQL Blueprint resource and `MONGODB_URI` from a private environment variable.

## 10. Closing

Summarise that the system demonstrates:

- Working relational database model.
- Working MongoDB document model.
- API access to both stores.
- Role-based dashboard.
- RBAC enforcement.
- Audit logging.
- QC versioning.
- Certification immutability.
