const app = document.querySelector("#app");

const demoAccounts = [
  ["priya.procurement", "Procurement Officer"],
  ["lena.inspector", "Quality Inspector"],
  ["marcus.manager", "Supply Chain Manager"],
  ["irene.engineer", "Equipment Engineer"],
  ["omar.auditor", "Auditor / Regulator"]
];

const state = {
  token: localStorage.getItem("aeronetb_token") || "",
  user: null,
  databaseMode: "unknown",
  view: localStorage.getItem("aeronetb_view") || "overview",
  filter: "",
  message: null,
  dashboard: null,
  suppliers: [],
  parts: [],
  orders: [],
  shipments: [],
  qcReports: [],
  certifications: [],
  equipment: [],
  iotLogs: [],
  auditLogs: [],
  complianceFlags: []
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function fmtDate(value) {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return escapeHtml(value);
  }
  return date.toLocaleString(undefined, { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function badge(value) {
  const text = String(value || "info");
  return `<span class="badge ${escapeHtml(text.toLowerCase().replaceAll(" ", "-"))}">${escapeHtml(text)}</span>`;
}

function can(permission) {
  const permissions = state.user?.permissions || [];
  const [action] = permission.split(":");
  return permissions.some((granted) => granted === permission || granted === "*" || (granted.endsWith(":*") && granted.split(":")[0] === action));
}

function canExport() {
  return can("export:reports") || can("read:*");
}

async function api(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(state.token ? { Authorization: `Bearer ${state.token}` } : {})
  };

  const response = await fetch(path, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  if (response.status === 401) {
    logout(false);
    throw new Error("Session expired. Log in again.");
  }

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) {
    throw new Error(payload.error || "Request failed.");
  }
  return payload;
}

async function tryLoad(key, endpoint, permission) {
  if (permission && !can(permission)) {
    state[key] = [];
    return;
  }

  try {
    state[key] = await api(endpoint);
  } catch (error) {
    state[key] = [];
  }
}

async function loadSession() {
  const params = new URLSearchParams(window.location.search);
  const demoUser = params.get("demo_user");
  if (params.get("view")) {
    state.view = params.get("view");
  }

  if (!state.token && demoUser) {
    try {
      const payload = await api("/api/auth/login", { method: "POST", body: { auth_id: demoUser, password: "demo123" } });
      state.token = payload.token;
      state.user = payload.user;
      state.databaseMode = payload.database_mode;
      localStorage.setItem("aeronetb_token", state.token);
      await refreshData();
      return;
    } catch (error) {
      state.message = { type: "error", text: error.message };
    }
  }

  if (!state.token) {
    renderLogin();
    return;
  }

  try {
    const session = await api("/api/auth/me");
    state.user = session.user;
    state.databaseMode = session.database_mode;
    await refreshData();
  } catch (error) {
    state.message = { type: "error", text: error.message };
    renderLogin();
  }
}

async function refreshData() {
  state.dashboard = await api("/api/dashboard");
  state.databaseMode = state.dashboard.database_mode;

  await Promise.all([
    tryLoad("suppliers", "/api/suppliers", "read:suppliers"),
    tryLoad("parts", "/api/parts", "read:parts"),
    tryLoad("orders", "/api/orders", "read:orders"),
    tryLoad("shipments", "/api/shipments", "read:shipments"),
    tryLoad("qcReports", "/api/qc-reports", "read:qc"),
    tryLoad("certifications", "/api/certifications", "read:certifications"),
    tryLoad("equipment", "/api/equipment", "read:equipment"),
    tryLoad("iotLogs", "/api/iot", "read:iot"),
    tryLoad("auditLogs", "/api/audit-logs", "read:audit"),
    tryLoad("complianceFlags", "/api/compliance-flags", "read:certifications")
  ]);

  renderShell();
}

function setMessage(type, text) {
  state.message = { type, text };
}

function renderLogin() {
  app.innerHTML = `
    <main class="login-page">
      <div class="login-panel">
        <section class="login-brand">
          <h1>AeroNetB ASCM</h1>
          <p>Render-hosted supply chain dashboard backed by PostgreSQL relational tables and MongoDB document collections.</p>
          <div class="credential-list">
            ${demoAccounts
              .map(([authId, label]) => `<button class="credential-button" data-demo-user="${authId}" type="button"><span>${escapeHtml(label)}</span><strong>${escapeHtml(authId)}</strong></button>`)
              .join("")}
          </div>
        </section>
        <section class="login-form">
          <h2>Role login</h2>
          ${state.message ? `<p class="message ${state.message.type}">${escapeHtml(state.message.text)}</p>` : ""}
          <form id="login-form">
            <label>
              Auth ID
              <select name="auth_id">
                ${demoAccounts.map(([authId, label]) => `<option value="${authId}">${escapeHtml(label)} - ${escapeHtml(authId)}</option>`).join("")}
              </select>
            </label>
            <label>
              Password
              <input name="password" type="password" value="demo123" autocomplete="current-password">
            </label>
            <button type="submit">Log in</button>
          </form>
          <p class="muted">Demo password for seeded users is <strong>demo123</strong>.</p>
        </section>
      </div>
    </main>
  `;
}

function navigationItems() {
  return [
    ["overview", "Overview", "read:dashboard"],
    ["procurement", "Procurement", "read:orders"],
    ["logistics", "Shipments", "read:shipments"],
    ["quality", "Quality", "read:qc"],
    ["equipment", "Equipment", "read:iot"],
    ["compliance", "Compliance", "read:certifications"],
    ["audit", "Audit", "read:audit"]
  ].filter(([, , permission]) => can(permission));
}

function renderShell() {
  const nav = navigationItems();
  if (!nav.some(([id]) => id === state.view)) {
    state.view = "overview";
  }

  app.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <div class="brandline">
          <div class="brandmark">AN</div>
          <div>
            <h1>AeroNetB ASCM</h1>
            <span>${escapeHtml(state.user.role_label)} - ${escapeHtml(state.databaseMode)} mode</span>
          </div>
        </div>
        <div class="userbar">
          <span>${escapeHtml(state.user.full_name)}</span>
          <label class="search-box">
            <span>Search</span>
            <input id="global-filter" value="${escapeHtml(state.filter)}" placeholder="supplier, part, order, report">
          </label>
          <button class="button-secondary" data-action="refresh" type="button">Refresh</button>
          <button class="button-secondary" data-action="logout" type="button">Logout</button>
        </div>
      </header>
      <div class="layout">
        <aside class="sidebar">
          <nav class="nav-list">
            ${nav.map(([id, label]) => `<button class="nav-button ${state.view === id ? "active" : ""}" data-view="${id}" type="button">${escapeHtml(label)}</button>`).join("")}
          </nav>
        </aside>
        <main class="main">
          ${state.message ? `<p class="message ${state.message.type}">${escapeHtml(state.message.text)}</p>` : ""}
          ${renderCurrentView()}
        </main>
      </div>
    </div>
  `;

  window.requestAnimationFrame(drawCharts);
}

function renderCurrentView() {
  switch (state.view) {
    case "procurement":
      return renderProcurement();
    case "logistics":
      return renderLogistics();
    case "quality":
      return renderQuality();
    case "equipment":
      return renderEquipment();
    case "compliance":
      return renderCompliance();
    case "audit":
      return renderAudit();
    default:
      return renderOverview();
  }
}

function viewHeader(title, subtitle, action = "") {
  return `
    <div class="view-header">
      <div>
        <h2>${escapeHtml(title)}</h2>
        <p>${escapeHtml(subtitle)}</p>
      </div>
      ${action}
    </div>
  `;
}

function section(title, body, action = "") {
  return `
    <section class="section">
      <div class="section-header">
        <h3>${escapeHtml(title)}</h3>
        ${action}
      </div>
      <div class="section-body">${body}</div>
    </section>
  `;
}

function filterRows(rows) {
  const needle = state.filter.trim().toLowerCase();
  if (!needle) {
    return rows;
  }

  return rows.filter((row) => JSON.stringify(row).toLowerCase().includes(needle));
}

function table(headers, rows) {
  const filteredRows = filterRows(rows);
  if (!rows.length) {
    return `<div class="empty">No records available.</div>`;
  }
  if (!filteredRows.length) {
    return `<div class="empty">No matching records for the current search.</div>`;
  }

  return `
    <div class="table-wrap">
      <table>
        <thead><tr>${headers.map((header) => `<th>${escapeHtml(header.label)}</th>`).join("")}</tr></thead>
        <tbody>
          ${filteredRows
            .map((row) => `<tr>${headers.map((header) => `<td>${header.render ? header.render(row) : escapeHtml(row[header.key])}</td>`).join("")}</tr>`)
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderOverview() {
  const metrics = state.dashboard?.metrics || {};
  const metricItems = [
    ["Suppliers", metrics.suppliers],
    ["Open orders", metrics.open_orders],
    ["Delayed", metrics.delayed_orders],
    ["Failed QC", metrics.failed_qc_reports],
    ["Pending certs", metrics.pending_certifications],
    ["IoT warnings", metrics.iot_warnings]
  ];

  return `
    ${viewHeader("Operational Overview", "Live dashboard covering supplier performance, shipments, quality, certifications, and IoT alerts.")}
    <div class="metric-grid">
      ${metricItems.map(([label, value]) => `<article class="metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value ?? 0)}</strong></article>`).join("")}
    </div>
    <div class="grid-two">
      ${section("Supplier performance", `<canvas id="supplier-chart" class="chart" aria-label="Supplier performance chart"></canvas>`)}
      ${section("QC outcomes", `<canvas id="qc-chart" class="chart" aria-label="QC outcome chart"></canvas>`)}
    </div>
    ${section("Alerts", renderAlerts())}
    ${section("Recent shipments", renderShipmentTable((state.dashboard?.shipments || []).slice(0, 6)))}
  `;
}

function renderAlerts() {
  const alerts = state.dashboard?.alerts || [];
  if (!alerts.length) {
    return `<div class="empty">No active alerts.</div>`;
  }

  return `<div class="alert-list">${alerts
    .map((alert) => `<div class="alert-item">${badge(alert.severity)}<div><strong>${escapeHtml(alert.type)}</strong><br><span>${escapeHtml(alert.message)}</span></div></div>`)
    .join("")}</div>`;
}

function renderProcurement() {
  const actions = canExport()
    ? `<div class="button-row"><button data-action="export" data-collection="suppliers" type="button">Export suppliers</button><button data-action="export" data-collection="purchase_orders" type="button">Export orders</button></div>`
    : "";
  return `
    ${viewHeader("Procurement", "Create suppliers and orders, then track the order lifecycle.", actions)}
    ${can("write:suppliers") ? section("Add supplier", supplierForm()) : ""}
    ${can("write:orders") ? section("Create purchase order", orderForm()) : ""}
    ${section("Suppliers", table([
      { label: "ID", key: "supplier_id" },
      { label: "Business", key: "business_name" },
      { label: "Accreditation", key: "accreditation_status" },
      { label: "Contact", render: (row) => `${escapeHtml(row.contact_name)}<br><span class="muted">${escapeHtml(row.contact_email)}</span>` }
    ], state.suppliers))}
    ${section("Orders", renderOrderTable(state.orders))}
  `;
}

function supplierForm() {
  return `
    <form class="form-grid" id="supplier-form">
      <label>Business name<input name="business_name" required></label>
      <label>Accreditation<input name="accreditation_status" placeholder="AS9100, ISO 9001"></label>
      <label>Contact email<input name="contact_email" type="email"></label>
      <label>Contact name<input name="contact_name"></label>
      <label>Phone<input name="contact_phone"></label>
      <label>Address<input name="address"></label>
      <button type="submit">Add supplier</button>
    </form>
  `;
}

function orderForm() {
  return `
    <form class="form-grid" id="order-form">
      <label>Supplier<select name="supplier_id" required>${state.suppliers.map((supplier) => `<option value="${supplier.supplier_id}">${escapeHtml(supplier.business_name)}</option>`).join("")}</select></label>
      <label>Part<select name="part_id" required>${state.parts.map((part) => `<option value="${part.part_id}">${escapeHtml(part.part_name)}</option>`).join("")}</select></label>
      <label>Quantity<input name="quantity" type="number" min="1" value="1" required></label>
      <label>Desired delivery<input name="desired_delivery_date" type="date" required></label>
      <label>Status<select name="status"><option>placed</option><option>confirmed</option><option>dispatched</option></select></label>
      <button type="submit">Create order</button>
    </form>
  `;
}

function renderOrderTable(rows) {
  return table([
    { label: "Order", key: "order_id" },
    { label: "Supplier", render: (row) => escapeHtml(row.supplier?.business_name || row.supplier_id) },
    { label: "Part lines", render: (row) => escapeHtml((row.lines || []).map((line) => `${line.quantity} x ${line.part?.part_name || line.part_id}`).join(", ")) },
    { label: "Desired", render: (row) => escapeHtml(row.desired_delivery_date) },
    { label: "Actual", render: (row) => escapeHtml(row.actual_delivery_date || "-") },
    { label: "Status", render: (row) => badge(row.status) }
  ], rows);
}

function renderLogistics() {
  return `
    ${viewHeader("Shipment Tracking", "Checkpoint, ETA, and condition updates for order-linked shipments.", canExport() ? `<button data-action="export" data-collection="shipments" type="button">Export shipments</button>` : "")}
    ${can("write:shipments") ? section("Add shipment event", shipmentEventForm()) : ""}
    ${section("Shipments", renderShipmentTable(state.shipments))}
  `;
}

function shipmentEventForm() {
  return `
    <form class="form-grid" id="shipment-event-form">
      <label>Shipment<select name="shipment_id" required>${state.shipments.map((shipment) => `<option value="${shipment.shipment_id}">${escapeHtml(shipment.tracking_number)} - order ${escapeHtml(shipment.order_id)}</option>`).join("")}</select></label>
      <label>Event type<input name="event_type" value="Checkpoint"></label>
      <label>Location<input name="location" required></label>
      <label>Status<select name="shipment_status"><option value="">Keep current</option><option>in_transit</option><option>delivered</option><option>delayed</option></select></label>
      <label class="span-2">Condition notes<input name="condition_notes" placeholder="temperature, vibration, seal, GPS notes"></label>
      <button type="submit">Add event</button>
    </form>
  `;
}

function renderShipmentTable(rows) {
  return table([
    { label: "Shipment", render: (row) => `${escapeHtml(row.tracking_number)}<br><span class="muted">#${escapeHtml(row.shipment_id)}</span>` },
    { label: "Order", render: (row) => escapeHtml(row.order_id) },
    { label: "Supplier", render: (row) => escapeHtml(row.supplier?.business_name || row.order?.supplier_id || "-") },
    { label: "Port", key: "port_of_entry" },
    { label: "ETA", render: (row) => escapeHtml(row.eta || "-") },
    { label: "Latest update", render: (row) => row.latest_event ? `${escapeHtml(row.latest_event.location)}<br><span class="muted">${fmtDate(row.latest_event.event_timestamp)}</span>` : "-" },
    { label: "Status", render: (row) => badge(row.shipment_status) }
  ], rows);
}

function renderQuality() {
  const actions = canExport()
    ? `<div class="button-row"><button data-action="export" data-collection="qc_reports" type="button">Export QC</button><button data-action="export" data-collection="certifications" type="button">Export certs</button></div>`
    : "";
  return `
    ${viewHeader("Quality Control", "Create versioned QC reports and lock certifications after approval.", actions)}
    ${can("write:qc") ? section("Create QC report", qcForm()) : ""}
    ${can("write:certifications") ? section("Create certification", certificationForm()) : ""}
    ${section("QC reports", renderQcTable(state.qcReports))}
    ${section("Certifications", renderCertificationTable(state.certifications))}
  `;
}

function qcForm() {
  return `
    <form class="form-grid" id="qc-form">
      <label>Order<select name="order_id" required>${state.orders.map((order) => `<option value="${order.order_id}">Order ${escapeHtml(order.order_id)}</option>`).join("")}</select></label>
      <label>Supplier<select name="supplier_id" required>${state.suppliers.map((supplier) => `<option value="${supplier.supplier_id}">${escapeHtml(supplier.business_name)}</option>`).join("")}</select></label>
      <label>Part<select name="part_id" required>${state.parts.map((part) => `<option value="${part.part_id}">${escapeHtml(part.part_name)}</option>`).join("")}</select></label>
      <label>Report type<select name="report_type"><option>visual</option><option>dimensional</option><option>ndt</option><option>environmental</option></select></label>
      <label>Outcome<select name="outcome"><option>PASS</option><option>FAIL</option></select></label>
      <label class="span-2">Notes<input name="notes" placeholder="inspection result details"></label>
      <button type="submit">Create QC report</button>
    </form>
  `;
}

function certificationForm() {
  return `
    <form class="form-grid" id="certification-form">
      <label>Supplier<select name="supplier_id" required>${state.suppliers.map((supplier) => `<option value="${supplier.supplier_id}">${escapeHtml(supplier.business_name)}</option>`).join("")}</select></label>
      <label>Part<select name="part_id" required>${state.parts.map((part) => `<option value="${part.part_id}">${escapeHtml(part.part_name)}</option>`).join("")}</select></label>
      <label>Batch origin<input name="batch_origin" required></label>
      <label>Test summary<input name="summary" value="PENDING"></label>
      <label>Digital signature<input name="digital_signature" value="SHA256:pending"></label>
      <button type="submit">Create certification</button>
    </form>
  `;
}

function renderQcTable(rows) {
  return table([
    { label: "Report", render: (row) => `${escapeHtml(row.report_id)}<br><span class="muted">v${escapeHtml(row.version)}</span>` },
    { label: "Supplier", render: (row) => escapeHtml(row.supplier?.business_name || row.supplier_id) },
    { label: "Part", render: (row) => escapeHtml(row.part?.part_name || row.part_id) },
    { label: "Type", key: "report_type" },
    { label: "Outcome", render: (row) => badge(row.outcome) },
    { label: "Approved", render: (row) => row.is_approved ? badge("PASS") : badge("pending") },
    { label: "Action", render: (row) => can("approve:qc") && !row.is_approved ? `<button data-action="approve-qc" data-id="${escapeHtml(row.report_id)}" type="button">Approve</button>` : "-" }
  ], rows);
}

function renderCertificationTable(rows) {
  return table([
    { label: "Certificate", key: "cert_id" },
    { label: "Supplier", render: (row) => escapeHtml(row.supplier?.business_name || row.supplier_id) },
    { label: "Part", render: (row) => escapeHtml(row.part?.part_name || row.part_id) },
    { label: "Batch", key: "batch_origin" },
    { label: "Approved", render: (row) => row.is_immutable ? badge("completed") : badge("pending") },
    { label: "Approval date", render: (row) => fmtDate(row.approval_date) },
    { label: "Action", render: (row) => can("approve:certifications") && !row.is_immutable ? `<button data-action="approve-cert" data-id="${escapeHtml(row.cert_id)}" type="button">Lock</button>` : "-" }
  ], rows);
}

function renderEquipment() {
  return `
    ${viewHeader("Equipment & IoT", "Monitor sensor thresholds and submit new telemetry readings.", canExport() ? `<button data-action="export" data-collection="iot_sensor_logs" type="button">Export IoT</button>` : "")}
    ${can("write:iot") ? section("Add IoT reading", iotForm()) : ""}
    <div class="grid-two">
      ${section("Sensor trend", `<canvas id="iot-chart" class="chart" aria-label="IoT sensor trend chart"></canvas>`)}
      ${section("Machine status", renderEquipmentStatus())}
    </div>
    ${section("IoT logs", renderIotTable(state.iotLogs))}
  `;
}

function iotForm() {
  return `
    <form class="form-grid" id="iot-form">
      <label>Equipment<select name="equipment_id" required>${state.equipment.map((item) => `<option value="${item.equipment_id}">${escapeHtml(item.equipment_name)}</option>`).join("")}</select></label>
      <label>Temperature C<input name="temperature_c" type="number" step="0.1" value="72"></label>
      <label>Vibration mm/s<input name="vibration_mm_s" type="number" step="0.1" value="1.4"></label>
      <label>Pressure bar<input name="pressure_bar" type="number" step="0.1" value="3.8"></label>
      <button type="submit">Submit reading</button>
    </form>
  `;
}

function renderEquipmentStatus() {
  const items = state.dashboard?.iotStatus || [];
  if (!items.length) {
    return `<div class="empty">No equipment status data.</div>`;
  }
  return `<div class="alert-list">${items
    .map((item) => `<div class="alert-item">${badge(item.status)}<div><strong>${escapeHtml(item.equipment_name)}</strong><br><span>${escapeHtml(item.facility)}</span></div></div>`)
    .join("")}</div>`;
}

function renderIotTable(rows) {
  return table([
    { label: "Log", key: "log_id" },
    { label: "Equipment", render: (row) => escapeHtml(row.equipment?.equipment_name || row.equipment_id) },
    { label: "Timestamp", render: (row) => fmtDate(row.timestamp) },
    { label: "Temperature", render: (row) => escapeHtml(row.readings?.temperature_c ?? "-") },
    { label: "Vibration", render: (row) => escapeHtml(row.readings?.vibration_mm_s ?? "-") },
    { label: "Status", render: (row) => badge(row.status) }
  ], rows);
}

function renderCompliance() {
  return `
    ${viewHeader("Compliance", "Read-only certification review with auditor flagging for non-compliance cases.", canExport() ? `<button data-action="export" data-collection="certifications" type="button">Export certs</button>` : "")}
    ${can("flag:compliance") ? section("Raise compliance flag", complianceFlagForm()) : ""}
    ${section("Certification records", renderCertificationTable(state.certifications))}
    ${section("Compliance flags", table([
      { label: "Flag", key: "flag_id" },
      { label: "Entity", render: (row) => `${escapeHtml(row.entity_type)} ${escapeHtml(row.entity_id)}` },
      { label: "Severity", render: (row) => badge(row.severity) },
      { label: "Note", key: "note" },
      { label: "Status", render: (row) => badge(row.status) }
    ], state.complianceFlags))}
  `;
}

function complianceFlagForm() {
  return `
    <form class="form-grid" id="flag-form">
      <label>Entity type<select name="entity_type"><option>Certification</option><option>QCReport</option><option>Supplier</option></select></label>
      <label>Entity ID<input name="entity_id" placeholder="CERT-2026-00003" required></label>
      <label>Severity<select name="severity"><option>Medium</option><option>High</option><option>Low</option></select></label>
      <label class="span-3">Note<input name="note" required></label>
      <button type="submit">Raise flag</button>
    </form>
  `;
}

function renderAudit() {
  return `
    ${viewHeader("Audit Log", "EmpID-attributed access and mutation records.", `<button data-action="export" data-collection="audit_logs" type="button">Export CSV</button>`)}
    ${section("Recent audit events", table([
      { label: "Log", key: "log_id" },
      { label: "EmpID", key: "emp_id" },
      { label: "Action", key: "action_type" },
      { label: "Entity", render: (row) => `${escapeHtml(row.entity_type)} ${escapeHtml(row.entity_id)}` },
      { label: "Time", render: (row) => fmtDate(row.action_timestamp) },
      { label: "Outcome", render: (row) => badge(row.outcome) },
      { label: "Details", key: "details" }
    ], state.auditLogs))}
  `;
}

function drawCharts() {
  drawSupplierChart();
  drawQcChart();
  drawIotChart();
}

function setupCanvas(id) {
  const canvas = document.getElementById(id);
  if (!canvas) {
    return null;
  }
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(320, Math.floor(rect.width * dpr));
  canvas.height = Math.max(220, Math.floor(rect.height * dpr));
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  return { canvas, ctx, width: rect.width, height: rect.height };
}

function drawSupplierChart() {
  const setup = setupCanvas("supplier-chart");
  if (!setup) {
    return;
  }
  const { ctx, width, height } = setup;
  const data = state.dashboard?.supplierPerformance || [];
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#667085";
  ctx.font = "12px system-ui";
  const max = 100;
  const barWidth = Math.max(24, (width - 60) / Math.max(data.length, 1) - 14);
  data.forEach((item, index) => {
    const x = 42 + index * (barWidth + 14);
    const onTimeHeight = ((item.on_time_rate || 0) / max) * (height - 72);
    const defectHeight = ((item.defect_rate || 0) / max) * (height - 72);
    ctx.fillStyle = "#0f766e";
    ctx.fillRect(x, height - 42 - onTimeHeight, barWidth / 2, onTimeHeight);
    ctx.fillStyle = "#b91c1c";
    ctx.fillRect(x + barWidth / 2 + 3, height - 42 - defectHeight, barWidth / 2, defectHeight);
    ctx.fillStyle = "#344054";
    ctx.fillText(String(item.supplier_id), x, height - 18);
  });
  ctx.fillStyle = "#0f766e";
  ctx.fillText("On time %", 12, 18);
  ctx.fillStyle = "#b91c1c";
  ctx.fillText("Defect %", 92, 18);
}

function drawQcChart() {
  const setup = setupCanvas("qc-chart");
  if (!setup) {
    return;
  }
  const { ctx, width, height } = setup;
  const summary = state.dashboard?.qcSummary?.by_outcome || {};
  const pass = summary.PASS || 0;
  const fail = summary.FAIL || 0;
  const total = Math.max(pass + fail, 1);
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) / 3;
  ctx.clearRect(0, 0, width, height);
  let start = -Math.PI / 2;
  [
    ["PASS", pass, "#0f766e"],
    ["FAIL", fail, "#b91c1c"]
  ].forEach(([label, value, color]) => {
    const angle = (value / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.fillStyle = color;
    ctx.arc(cx, cy, radius, start, start + angle);
    ctx.closePath();
    ctx.fill();
    start += angle;
    ctx.fillStyle = color;
    ctx.fillText(`${label}: ${value}`, 18, label === "PASS" ? 20 : 42);
  });
  ctx.fillStyle = "#17202a";
  ctx.font = "700 18px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(`${total}`, cx, cy + 6);
  ctx.textAlign = "start";
  ctx.font = "12px system-ui";
}

function drawIotChart() {
  const setup = setupCanvas("iot-chart");
  if (!setup) {
    return;
  }
  const { ctx, width, height } = setup;
  const rows = [...state.iotLogs].reverse().slice(-12);
  ctx.clearRect(0, 0, width, height);
  ctx.strokeStyle = "#d7dde5";
  ctx.beginPath();
  ctx.moveTo(36, 16);
  ctx.lineTo(36, height - 34);
  ctx.lineTo(width - 16, height - 34);
  ctx.stroke();

  if (!rows.length) {
    ctx.fillStyle = "#667085";
    ctx.fillText("No IoT readings loaded", 48, 48);
    return;
  }

  const values = rows.map((row) => Number(row.readings?.temperature_c || 0));
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 90);
  const plotWidth = width - 62;
  const plotHeight = height - 58;
  ctx.strokeStyle = "#2563eb";
  ctx.lineWidth = 2;
  ctx.beginPath();
  values.forEach((value, index) => {
    const x = 36 + (plotWidth / Math.max(values.length - 1, 1)) * index;
    const y = height - 34 - ((value - min) / Math.max(max - min, 1)) * plotHeight;
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.stroke();
  ctx.fillStyle = "#344054";
  ctx.fillText("Temperature C", 44, 22);
}

function formValues(form) {
  return Object.fromEntries(new FormData(form).entries());
}

async function submitForm(form) {
  const values = formValues(form);
  const id = form.id;

  if (id === "supplier-form") {
    await api("/api/suppliers", { method: "POST", body: values });
  }
  if (id === "order-form") {
    await api("/api/orders", { method: "POST", body: values });
  }
  if (id === "shipment-event-form") {
    const shipmentId = values.shipment_id;
    delete values.shipment_id;
    await api(`/api/shipments/${shipmentId}/events`, { method: "POST", body: values });
  }
  if (id === "qc-form") {
    await api("/api/qc-reports", {
      method: "POST",
      body: {
        ...values,
        result_data: { notes: values.notes }
      }
    });
  }
  if (id === "certification-form") {
    await api("/api/certifications", {
      method: "POST",
      body: {
        ...values,
        test_results: { summary: values.summary }
      }
    });
  }
  if (id === "iot-form") {
    await api("/api/iot", {
      method: "POST",
      body: {
        equipment_id: values.equipment_id,
        readings: {
          temperature_c: Number(values.temperature_c || 0),
          vibration_mm_s: Number(values.vibration_mm_s || 0),
          pressure_bar: Number(values.pressure_bar || 0)
        }
      }
    });
  }
  if (id === "flag-form") {
    await api("/api/compliance-flags", { method: "POST", body: values });
  }

  setMessage("success", "Saved. Dashboard data refreshed.");
  await refreshData();
}

async function login(form) {
  const values = formValues(form);
  const payload = await api("/api/auth/login", { method: "POST", body: values });
  state.token = payload.token;
  state.user = payload.user;
  state.databaseMode = payload.database_mode;
  state.message = null;
  localStorage.setItem("aeronetb_token", state.token);
  await refreshData();
}

function logout(render = true) {
  state.token = "";
  state.user = null;
  localStorage.removeItem("aeronetb_token");
  if (render) {
    state.message = null;
    renderLogin();
  }
}

async function downloadExport(collectionName) {
  const response = await fetch(`/api/export/${collectionName}`, {
    headers: { Authorization: `Bearer ${state.token}` }
  });
  if (!response.ok) {
    const payload = await response.json();
    throw new Error(payload.error || "Export failed.");
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${collectionName}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

document.addEventListener("submit", async (event) => {
  event.preventDefault();
  state.message = null;
  const form = event.target;
  try {
    if (form.id === "login-form") {
      await login(form);
    } else {
      await submitForm(form);
    }
  } catch (error) {
    setMessage("error", error.message);
    state.user ? renderShell() : renderLogin();
  }
});

document.addEventListener("click", async (event) => {
  const button = event.target.closest("button");
  if (!button) {
    return;
  }

  if (button.dataset.demoUser) {
    const select = document.querySelector('select[name="auth_id"]');
    if (select) {
      select.value = button.dataset.demoUser;
    }
    return;
  }

  if (button.dataset.view) {
    state.view = button.dataset.view;
    localStorage.setItem("aeronetb_view", state.view);
    state.message = null;
    renderShell();
    return;
  }

  try {
    if (button.dataset.action === "logout") {
      logout();
    }
    if (button.dataset.action === "refresh") {
      state.message = null;
      await refreshData();
    }
    if (button.dataset.action === "approve-qc") {
      await api(`/api/qc-reports/${button.dataset.id}/approve`, { method: "POST" });
      setMessage("success", "QC report approved.");
      await refreshData();
    }
    if (button.dataset.action === "approve-cert") {
      await api(`/api/certifications/${button.dataset.id}/approve`, { method: "POST" });
      setMessage("success", "Certification locked as immutable.");
      await refreshData();
    }
    if (button.dataset.action === "export") {
      await downloadExport(button.dataset.collection);
    }
  } catch (error) {
    setMessage("error", error.message);
    renderShell();
  }
});

document.addEventListener("input", (event) => {
  if (event.target.id !== "global-filter") {
    return;
  }
  state.filter = event.target.value;
  renderShell();
  const input = document.getElementById("global-filter");
  if (input) {
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }
});

loadSession();
