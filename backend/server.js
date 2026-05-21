import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { config } from "./src/config.js";
import {
  closeDb,
  findOne,
  getDbMode,
  initDb,
  insertOne,
  list,
  nextNumericId,
  nextStringId,
  updateOne
} from "./src/db.js";
import {
  buildDashboard,
  buildReferenceData,
  enrichCertificationsFromReference,
  enrichIotFromReference,
  enrichOrdersFromReference,
  enrichQcReportsFromReference,
  enrichShipmentsFromReference,
  toCsv
} from "./src/domain.js";
import { createSessionToken, hasPermission, publicEmployee, verifyPassword, verifySessionToken } from "./src/security.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, "..", "frontend");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon"
};

class ApiError extends Error {
  constructor(status, message, details = null) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

function headers(extra = {}) {
  return {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "same-origin",
    "Cache-Control": "no-store",
    ...extra
  };
}

function send(res, status, body, contentType = "application/json; charset=utf-8", extraHeaders = {}) {
  res.writeHead(status, headers({ "Content-Type": contentType, ...extraHeaders }));
  res.end(body);
}

function sendJson(res, status, payload) {
  send(res, status, JSON.stringify(payload, null, 2));
}

async function readJson(req) {
  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1_000_000) {
      throw new ApiError(413, "Request body is too large.");
    }
    chunks.push(chunk);
  }

  if (!chunks.length) {
    return {};
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new ApiError(400, "Request body must be valid JSON.");
  }
}

function requireField(value, label) {
  if (value === undefined || value === null || value === "") {
    throw new ApiError(400, `${label} is required.`);
  }
  return value;
}

function toInt(value, label) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed)) {
    throw new ApiError(400, `${label} must be a number.`);
  }
  return parsed;
}

function cleanString(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function assertPermission(user, permission) {
  if (!hasPermission(user, permission)) {
    throw new ApiError(403, `Role ${user.role} cannot perform ${permission}.`);
  }
}

async function audit(user, actionType, entityType, entityId, outcome = "Success", details = "") {
  if (!user?.emp_id) {
    return;
  }

  await insertOne("audit_logs", {
    log_id: await nextNumericId("audit_logs"),
    emp_id: user.emp_id,
    action_type: actionType,
    entity_type: entityType,
    entity_id: String(entityId),
    action_timestamp: new Date().toISOString(),
    outcome,
    details
  });
}

async function requireUser(req) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";
  const payload = verifySessionToken(token, config.sessionSecret);
  if (!payload) {
    throw new ApiError(401, "Authentication required.");
  }

  const employee = await findOne("employees", { emp_id: payload.emp_id });
  if (!employee) {
    throw new ApiError(401, "Authenticated user no longer exists.");
  }
  return employee;
}

async function login(req, res) {
  const body = await readJson(req);
  const authId = cleanString(body.auth_id || body.authId);
  const password = String(body.password || "");
  const employee = await findOne("employees", { auth_id: authId });

  if (!employee || !verifyPassword(password, employee)) {
    throw new ApiError(401, "Invalid login details.");
  }

  await audit(employee, "LOGIN", "Employee", employee.emp_id, "Success", "Role-based dashboard login.");

  sendJson(res, 200, {
    token: createSessionToken(employee, config.sessionSecret),
    user: publicEmployee(employee),
    database_mode: getDbMode()
  });
}

async function getDashboard(res, user) {
  assertPermission(user, "read:dashboard");
  const dashboard = await buildDashboard();
  await audit(user, "VIEW", "Dashboard", "summary");
  sendJson(res, 200, dashboard);
}

async function getSuppliers(res, user) {
  assertPermission(user, "read:suppliers");
  const suppliers = await list("suppliers", {}, { sort: { business_name: 1 } });
  await audit(user, "VIEW", "Supplier", "list");
  sendJson(res, 200, suppliers);
}

async function createSupplier(req, res, user) {
  assertPermission(user, "write:suppliers");
  const body = await readJson(req);
  const supplier = {
    supplier_id: await nextNumericId("suppliers"),
    business_name: cleanString(requireField(body.business_name, "business_name")),
    address: cleanString(body.address),
    contact_name: cleanString(body.contact_name),
    contact_email: cleanString(body.contact_email),
    contact_phone: cleanString(body.contact_phone),
    accreditation_status: cleanString(body.accreditation_status, "Pending")
  };

  await insertOne("suppliers", supplier);
  await audit(user, "CREATE", "Supplier", supplier.supplier_id);
  sendJson(res, 201, supplier);
}

async function getParts(res, user) {
  assertPermission(user, "read:parts");
  const parts = await list("parts", {}, { sort: { part_name: 1 } });
  await audit(user, "VIEW", "Part", "list");
  sendJson(res, 200, parts);
}

async function getOrders(res, user, orderId = null) {
  assertPermission(user, "read:orders");
  const ref = await buildReferenceData();
  const orders = enrichOrdersFromReference(ref);
  const payload = orderId ? orders.find((order) => order.order_id === orderId) : orders;

  if (!payload) {
    throw new ApiError(404, "Order not found.");
  }

  await audit(user, "VIEW", "PurchaseOrder", orderId || "list");
  sendJson(res, 200, payload);
}

async function createOrder(req, res, user) {
  assertPermission(user, "write:orders");
  const body = await readJson(req);
  const supplierId = toInt(requireField(body.supplier_id, "supplier_id"), "supplier_id");
  const partId = toInt(requireField(body.part_id, "part_id"), "part_id");
  const supplier = await findOne("suppliers", { supplier_id: supplierId });
  const part = await findOne("parts", { part_id: partId });

  if (!supplier || !part) {
    throw new ApiError(400, "supplier_id and part_id must reference existing records.");
  }

  const order = {
    order_id: await nextNumericId("purchase_orders"),
    supplier_id: supplierId,
    order_date: cleanString(body.order_date, new Date().toISOString().slice(0, 10)),
    desired_delivery_date: cleanString(requireField(body.desired_delivery_date, "desired_delivery_date")),
    actual_delivery_date: body.actual_delivery_date || null,
    status: cleanString(body.status, "placed").toLowerCase()
  };

  const supplierPart = await findOne("supplier_parts", { supplier_id: supplierId, part_id: partId });
  const orderLine = {
    order_line_id: await nextNumericId("purchase_order_lines"),
    order_id: order.order_id,
    part_id: partId,
    supplier_part_id: supplierPart?.supplier_part_id || null,
    quantity: Math.max(1, toInt(requireField(body.quantity, "quantity"), "quantity"))
  };

  await insertOne("purchase_orders", order);
  await insertOne("purchase_order_lines", orderLine);
  await audit(user, "CREATE", "PurchaseOrder", order.order_id, "Success", `Created order line ${orderLine.order_line_id}.`);

  sendJson(res, 201, { ...order, lines: [{ ...orderLine, part }] });
}

async function updateOrderStatus(req, res, user, orderId) {
  assertPermission(user, "write:orders");
  const body = await readJson(req);
  const status = cleanString(requireField(body.status, "status")).toLowerCase();
  const allowed = ["placed", "confirmed", "dispatched", "delivered", "completed"];
  if (!allowed.includes(status)) {
    throw new ApiError(400, `status must be one of ${allowed.join(", ")}.`);
  }

  const updates = { status };
  if (["delivered", "completed"].includes(status)) {
    updates.actual_delivery_date = cleanString(body.actual_delivery_date, new Date().toISOString().slice(0, 10));
  }

  const updated = await updateOne("purchase_orders", { order_id: orderId }, updates);
  if (!updated) {
    throw new ApiError(404, "Order not found.");
  }

  await audit(user, "UPDATE", "PurchaseOrder", orderId, "Success", `Status changed to ${status}.`);
  sendJson(res, 200, updated);
}

async function getShipments(res, user) {
  assertPermission(user, "read:shipments");
  const ref = await buildReferenceData();
  const shipments = enrichShipmentsFromReference(ref);
  await audit(user, "VIEW", "Shipment", "list");
  sendJson(res, 200, shipments);
}

async function createShipmentEvent(req, res, user, shipmentId) {
  assertPermission(user, "write:shipments");
  const body = await readJson(req);
  const shipment = await findOne("shipments", { shipment_id: shipmentId });
  if (!shipment) {
    throw new ApiError(404, "Shipment not found.");
  }

  const event = {
    event_id: await nextNumericId("shipment_events"),
    shipment_id: shipmentId,
    event_timestamp: cleanString(body.event_timestamp, new Date().toISOString()),
    event_type: cleanString(body.event_type, "Checkpoint"),
    location: cleanString(requireField(body.location, "location")),
    condition_notes: cleanString(body.condition_notes)
  };

  await insertOne("shipment_events", event);
  if (body.shipment_status) {
    await updateOne("shipments", { shipment_id: shipmentId }, { shipment_status: cleanString(body.shipment_status).toLowerCase() });
  }
  await audit(user, "UPDATE", "Shipment", shipmentId, "Success", `Added shipment event ${event.event_id}.`);
  sendJson(res, 201, event);
}

async function getQcReports(res, user) {
  assertPermission(user, "read:qc");
  const ref = await buildReferenceData();
  const reports = enrichQcReportsFromReference(ref);
  await audit(user, "VIEW", "QCReport", "list");
  sendJson(res, 200, reports);
}

async function createQcReport(req, res, user) {
  assertPermission(user, "write:qc");
  const body = await readJson(req);
  const orderId = toInt(requireField(body.order_id, "order_id"), "order_id");
  const partId = toInt(requireField(body.part_id, "part_id"), "part_id");
  const supplierId = toInt(requireField(body.supplier_id, "supplier_id"), "supplier_id");

  const [order, part, supplier] = await Promise.all([
    findOne("purchase_orders", { order_id: orderId }),
    findOne("parts", { part_id: partId }),
    findOne("suppliers", { supplier_id: supplierId })
  ]);
  if (!order || !part || !supplier) {
    throw new ApiError(400, "QC report references must exist before the report is created.");
  }

  const reportType = cleanString(body.report_type, "visual").toLowerCase();
  const existingReports = await list("qc_reports", { order_id: orderId, part_id: partId, report_type: reportType });
  const version = existingReports.reduce((max, report) => Math.max(max, Number(report.version || 0)), 0) + 1;
  const report = {
    report_id: await nextStringId("QC"),
    order_id: orderId,
    part_id: partId,
    supplier_id: supplierId,
    inspector_emp_id: user.emp_id,
    report_type: reportType,
    inspection_date: cleanString(body.inspection_date, new Date().toISOString()),
    outcome: cleanString(body.outcome, "PASS").toUpperCase(),
    result_data: typeof body.result_data === "object" && body.result_data ? body.result_data : { notes: cleanString(body.notes) },
    version,
    is_approved: false,
    created_at: new Date().toISOString()
  };

  await insertOne("qc_reports", report);
  await audit(user, "CREATE", "QCReport", report.report_id, "Success", `QC report version ${version} created.`);
  sendJson(res, 201, report);
}

async function approveQcReport(res, user, reportId) {
  assertPermission(user, "approve:qc");
  const updated = await updateOne("qc_reports", { report_id: reportId }, { is_approved: true, approved_at: new Date().toISOString() });
  if (!updated) {
    throw new ApiError(404, "QC report not found.");
  }

  await audit(user, "APPROVE", "QCReport", reportId);
  sendJson(res, 200, updated);
}

async function getCertifications(res, user) {
  assertPermission(user, "read:certifications");
  const ref = await buildReferenceData();
  const certifications = enrichCertificationsFromReference(ref);
  await audit(user, "VIEW", "Certification", "list");
  sendJson(res, 200, certifications);
}

async function createCertification(req, res, user) {
  assertPermission(user, "write:certifications");
  const body = await readJson(req);
  const partId = toInt(requireField(body.part_id, "part_id"), "part_id");
  const supplierId = toInt(requireField(body.supplier_id, "supplier_id"), "supplier_id");
  const [part, supplier] = await Promise.all([findOne("parts", { part_id: partId }), findOne("suppliers", { supplier_id: supplierId })]);

  if (!part || !supplier) {
    throw new ApiError(400, "Certification references must exist before the certification is created.");
  }

  const certification = {
    cert_id: await nextStringId("CERT"),
    part_id: partId,
    supplier_id: supplierId,
    inspector_emp_id: user.emp_id,
    certification_date: cleanString(body.certification_date, new Date().toISOString().slice(0, 10)),
    test_results: typeof body.test_results === "object" && body.test_results ? body.test_results : { summary: cleanString(body.summary, "PENDING") },
    batch_origin: cleanString(requireField(body.batch_origin, "batch_origin")),
    digital_signature: cleanString(body.digital_signature, "SHA256:pending"),
    is_immutable: false,
    approval_date: null,
    approved_by_emp_id: null
  };

  await insertOne("certifications", certification);
  await audit(user, "CREATE", "Certification", certification.cert_id);
  sendJson(res, 201, certification);
}

async function updateCertification(req, res, user, certId) {
  assertPermission(user, "write:certifications");
  const current = await findOne("certifications", { cert_id: certId });
  if (!current) {
    throw new ApiError(404, "Certification not found.");
  }
  if (current.is_immutable) {
    throw new ApiError(409, "Approved certifications are immutable and cannot be edited.");
  }

  const body = await readJson(req);
  const updates = {
    test_results: typeof body.test_results === "object" && body.test_results ? body.test_results : current.test_results,
    batch_origin: cleanString(body.batch_origin, current.batch_origin),
    digital_signature: cleanString(body.digital_signature, current.digital_signature)
  };

  const updated = await updateOne("certifications", { cert_id: certId }, updates);
  await audit(user, "UPDATE", "Certification", certId);
  sendJson(res, 200, updated);
}

async function approveCertification(res, user, certId) {
  assertPermission(user, "approve:certifications");
  const current = await findOne("certifications", { cert_id: certId });
  if (!current) {
    throw new ApiError(404, "Certification not found.");
  }
  if (current.is_immutable) {
    throw new ApiError(409, "Certification is already immutable.");
  }

  const updated = await updateOne("certifications", { cert_id: certId }, {
    is_immutable: true,
    approval_date: new Date().toISOString(),
    approved_by_emp_id: user.emp_id
  });

  await audit(user, "APPROVE", "Certification", certId, "Success", "Certification locked as immutable.");
  sendJson(res, 200, updated);
}

async function getEquipment(res, user) {
  assertPermission(user, "read:equipment");
  const equipment = await list("equipment", {}, { sort: { equipment_id: 1 } });
  await audit(user, "VIEW", "Equipment", "list");
  sendJson(res, 200, equipment);
}

async function getIotLogs(res, user) {
  assertPermission(user, "read:iot");
  const ref = await buildReferenceData();
  const iotLogs = enrichIotFromReference(ref);
  await audit(user, "VIEW", "IoTSensorLog", "list");
  sendJson(res, 200, iotLogs);
}

async function createIotLog(req, res, user) {
  assertPermission(user, "write:iot");
  const body = await readJson(req);
  const equipmentId = toInt(requireField(body.equipment_id, "equipment_id"), "equipment_id");
  const equipment = await findOne("equipment", { equipment_id: equipmentId });
  if (!equipment) {
    throw new ApiError(400, "equipment_id must reference existing equipment.");
  }

  const readings = body.readings && typeof body.readings === "object"
    ? body.readings
    : {
        temperature_c: Number(body.temperature_c || 0),
        vibration_mm_s: Number(body.vibration_mm_s || 0),
        pressure_bar: Number(body.pressure_bar || 0)
      };

  const log = {
    log_id: await nextStringId("IOT"),
    equipment_id: equipmentId,
    timestamp: cleanString(body.timestamp, new Date().toISOString()),
    readings
  };

  await insertOne("iot_sensor_logs", log);
  await audit(user, "CREATE", "IoTSensorLog", log.log_id);
  sendJson(res, 201, log);
}

async function getComplianceFlags(res, user) {
  assertPermission(user, "read:certifications");
  const flags = await list("compliance_flags", {}, { sort: { created_at: -1 } });
  await audit(user, "VIEW", "ComplianceFlag", "list");
  sendJson(res, 200, flags);
}

async function createComplianceFlag(req, res, user) {
  assertPermission(user, "flag:compliance");
  const body = await readJson(req);
  const flag = {
    flag_id: await nextNumericId("compliance_flags"),
    created_by_emp_id: user.emp_id,
    entity_type: cleanString(requireField(body.entity_type, "entity_type")),
    entity_id: cleanString(requireField(body.entity_id, "entity_id")),
    severity: cleanString(body.severity, "Medium"),
    note: cleanString(requireField(body.note, "note")),
    created_at: new Date().toISOString(),
    status: "open"
  };

  await insertOne("compliance_flags", flag);
  await audit(user, "CREATE", "ComplianceFlag", flag.flag_id, "Success", `Flagged ${flag.entity_type} ${flag.entity_id}.`);
  sendJson(res, 201, flag);
}

async function getAuditLogs(res, user) {
  assertPermission(user, "read:audit");
  const auditLogs = await list("audit_logs", {}, { sort: { action_timestamp: -1 }, limit: 150 });
  sendJson(res, 200, auditLogs);
}

async function exportCollection(res, user, collectionName) {
  if (!hasPermission(user, "export:reports") && !hasPermission(user, "read:*")) {
    throw new ApiError(403, "This role cannot export reports.");
  }

  const allowed = new Set(["suppliers", "purchase_orders", "shipments", "qc_reports", "certifications", "iot_sensor_logs", "audit_logs"]);
  if (!allowed.has(collectionName)) {
    throw new ApiError(404, "Export collection not found.");
  }

  let records = await list(collectionName, {}, { sort: { action_timestamp: -1 } });
  if (collectionName === "qc_reports") {
    records = enrichQcReportsFromReference(await buildReferenceData());
  }
  if (collectionName === "certifications") {
    records = enrichCertificationsFromReference(await buildReferenceData());
  }

  await audit(user, "EXPORT", collectionName, "csv");
  send(res, 200, toCsv(collectionName, records), "text/csv; charset=utf-8", {
    "Content-Disposition": `attachment; filename="${collectionName}.csv"`
  });
}

async function handleApi(req, res, url) {
  if (req.method === "OPTIONS") {
    send(res, 204, "", "text/plain");
    return;
  }

  if (url.pathname === "/api/health") {
    sendJson(res, 200, {
      ok: true,
      service: "AeroNetB ASCM",
      database_mode: getDbMode(),
      timestamp: new Date().toISOString()
    });
    return;
  }

  if (url.pathname === "/api/auth/login" && req.method === "POST") {
    await login(req, res);
    return;
  }

  const user = await requireUser(req);
  const segments = url.pathname.split("/").filter(Boolean).slice(1);
  const [resource, id, action] = segments;

  if (resource === "auth" && id === "me" && req.method === "GET") {
    sendJson(res, 200, { user: publicEmployee(user), database_mode: getDbMode() });
    return;
  }

  if (resource === "dashboard" && req.method === "GET") {
    await getDashboard(res, user);
    return;
  }

  if (resource === "suppliers") {
    if (req.method === "GET") {
      await getSuppliers(res, user);
      return;
    }
    if (req.method === "POST") {
      await createSupplier(req, res, user);
      return;
    }
  }

  if (resource === "parts" && req.method === "GET") {
    await getParts(res, user);
    return;
  }

  if (resource === "orders") {
    if (req.method === "GET") {
      await getOrders(res, user, id ? toInt(id, "order_id") : null);
      return;
    }
    if (req.method === "POST" && !id) {
      await createOrder(req, res, user);
      return;
    }
    if (req.method === "PATCH" && id) {
      await updateOrderStatus(req, res, user, toInt(id, "order_id"));
      return;
    }
  }

  if (resource === "shipments") {
    if (req.method === "GET") {
      await getShipments(res, user);
      return;
    }
    if (req.method === "POST" && id && action === "events") {
      await createShipmentEvent(req, res, user, toInt(id, "shipment_id"));
      return;
    }
  }

  if (resource === "qc-reports") {
    if (req.method === "GET") {
      await getQcReports(res, user);
      return;
    }
    if (req.method === "POST" && !id) {
      await createQcReport(req, res, user);
      return;
    }
    if (req.method === "POST" && id && action === "approve") {
      await approveQcReport(res, user, id);
      return;
    }
  }

  if (resource === "certifications") {
    if (req.method === "GET") {
      await getCertifications(res, user);
      return;
    }
    if (req.method === "POST" && !id) {
      await createCertification(req, res, user);
      return;
    }
    if (req.method === "PATCH" && id) {
      await updateCertification(req, res, user, id);
      return;
    }
    if (req.method === "POST" && id && action === "approve") {
      await approveCertification(res, user, id);
      return;
    }
  }

  if (resource === "equipment" && req.method === "GET") {
    await getEquipment(res, user);
    return;
  }

  if (resource === "iot") {
    if (req.method === "GET") {
      await getIotLogs(res, user);
      return;
    }
    if (req.method === "POST") {
      await createIotLog(req, res, user);
      return;
    }
  }

  if (resource === "compliance-flags") {
    if (req.method === "GET") {
      await getComplianceFlags(res, user);
      return;
    }
    if (req.method === "POST") {
      await createComplianceFlag(req, res, user);
      return;
    }
  }

  if (resource === "audit-logs" && req.method === "GET") {
    await getAuditLogs(res, user);
    return;
  }

  if (resource === "export" && req.method === "GET" && id) {
    await exportCollection(res, user, id);
    return;
  }

  throw new ApiError(404, "API endpoint not found.");
}

async function serveStatic(req, res, url) {
  const requestedPath = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const filePath = path.normalize(path.join(publicDir, requestedPath));

  if (!filePath.startsWith(publicDir)) {
    throw new ApiError(403, "Invalid static file path.");
  }

  let file = filePath;
  const stat = await fs.stat(file).catch(() => null);
  if (!stat) {
    file = path.join(publicDir, "index.html");
  } else if (stat.isDirectory()) {
    file = path.join(file, "index.html");
  }

  const extension = path.extname(file);
  const content = await fs.readFile(file);
  send(res, 200, content, mimeTypes[extension] || "application/octet-stream");
}

function handleError(res, error) {
  const status = error instanceof ApiError ? error.status : 500;
  const message = error instanceof ApiError ? error.message : "Unexpected server error.";
  if (status >= 500) {
    console.error(error);
  }
  sendJson(res, status, { error: message, details: error.details || null });
}

await initDb();

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }

    await serveStatic(req, res, url);
  } catch (error) {
    handleError(res, error);
  }
});

server.listen(config.port, config.host, () => {
  console.log(`AeroNetB ASCM listening on http://${config.host}:${config.port} (${getDbMode()} mode)`);
});

async function shutdown() {
  server.close();
  await closeDb();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
