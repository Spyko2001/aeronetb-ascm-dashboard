# Demo Checklist

Student: Spyros Kokkoris  
Student ID: 100774175

| Requirement | Evidence |
| --- | --- |
| Working relational database | PostgreSQL schema in `sql_scripts/ddl.sql`, seeded relational data in `sql_scripts/dml.sql`, Render `DATABASE_URL`, API reads suppliers/orders/shipments/employees/audit logs. |
| Working MongoDB collections | `mongo_scripts/collections.js`, seeded QC/certification/IoT/compliance documents, API reads and writes document collections. |
| API endpoints responding | `/api/health`, `/api/dashboard`, `/api/suppliers`, `/api/orders`, `/api/shipments`, `/api/qc-reports`, `/api/certifications`, `/api/iot`, `/api/audit-logs`. |
| Role-based login | Demo users for procurement, quality, manager, engineer, and auditor; all use `demo123`. |
| Dashboard interaction | Create supplier/order, add shipment event, create QC report, approve certification, submit IoT reading, raise compliance flag. |
| Security enforcement | Auditor cannot create suppliers; endpoint returns HTTP 403. |
| Audit logging | Audit table shows emp_id, action, entity, timestamp, outcome, and details. |
| QC immutability/versioning example | New QC retest creates next version number. |
| Certification immutability example | Approved certification update returns HTTP 409. |
| GitHub link | `https://github.com/Spyko2001/aeronetb-ascm-dashboard` |
| Render Blueprint link | `https://render.com/deploy?repo=https://github.com/Spyko2001/aeronetb-ascm-dashboard` |
| Live Render app link | `https://aeronetb-ascm-dashboard.onrender.com` |
| Live health endpoint | `https://aeronetb-ascm-dashboard.onrender.com/api/health` |
| Verified database mode | `PostgreSQL + MongoDB`, `database_warning: null` |
