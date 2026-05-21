import assert from "node:assert/strict";
import { once } from "node:events";
import { spawn } from "node:child_process";
import { after, before, test } from "node:test";

const port = 19000 + Number(process.pid % 1000);
const baseUrl = `http://127.0.0.1:${port}`;
let server;

async function waitForServer(child) {
  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });

  const started = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Server did not start.\n${output}`)), 10000);
    child.stdout.on("data", (chunk) => {
      if (chunk.toString().includes("AeroNetB ASCM listening")) {
        clearTimeout(timer);
        resolve();
      }
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`Server exited with ${code}.\n${output}`));
    });
  });

  await started;
}

async function request(path, { token = "", method = "GET", body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : await response.text();
  return { response, payload };
}

async function login(authId) {
  const { response, payload } = await request("/api/auth/login", {
    method: "POST",
    body: { auth_id: authId, password: "demo123" }
  });
  assert.equal(response.status, 200);
  assert.ok(payload.token);
  return payload.token;
}

before(async () => {
  server = spawn(process.execPath, ["backend/server.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      HOST: "127.0.0.1",
      DATABASE_URL: "",
      MONGODB_URI: "",
      AUTO_SEED: "true"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  await waitForServer(server);
});

after(async () => {
  if (!server || server.exitCode !== null) {
    return;
  }
  server.kill("SIGTERM");
  await once(server, "exit");
});

test("health and dashboard expose seeded demo data", async () => {
  const { response: healthResponse, payload: health } = await request("/api/health");
  assert.equal(healthResponse.status, 200);
  assert.equal(health.ok, true);

  const token = await login("marcus.manager");
  const { response, payload } = await request("/api/dashboard", { token });
  assert.equal(response.status, 200);
  assert.equal(payload.metrics.suppliers, 4);
  assert.ok(payload.alerts.length > 0);
});

test("RBAC blocks auditor writes and allows procurement supplier creation", async () => {
  const auditorToken = await login("omar.auditor");
  const blocked = await request("/api/suppliers", {
    token: auditorToken,
    method: "POST",
    body: { business_name: "Blocked Supplier" }
  });
  assert.equal(blocked.response.status, 403);

  const procurementToken = await login("priya.procurement");
  const created = await request("/api/suppliers", {
    token: procurementToken,
    method: "POST",
    body: {
      business_name: "Test Aero Components",
      accreditation_status: "ISO 9001",
      contact_email: "test.supplier@example.com"
    }
  });
  assert.equal(created.response.status, 201);
  assert.equal(created.payload.business_name, "Test Aero Components");
});

test("QC reports are versioned and certifications become immutable", async () => {
  const inspectorToken = await login("lena.inspector");
  const report = await request("/api/qc-reports", {
    token: inspectorToken,
    method: "POST",
    body: {
      order_id: 5002,
      supplier_id: 2,
      part_id: 101,
      report_type: "ndt",
      outcome: "FAIL",
      notes: "Integration test retest failure"
    }
  });
  assert.equal(report.response.status, 201);
  assert.equal(report.payload.version, 3);

  const certificate = await request("/api/certifications", {
    token: inspectorToken,
    method: "POST",
    body: {
      supplier_id: 1,
      part_id: 101,
      batch_origin: "Batch-TEST-001",
      summary: "PASS",
      digital_signature: "SHA256:test"
    }
  });
  assert.equal(certificate.response.status, 201);

  const approved = await request(`/api/certifications/${certificate.payload.cert_id}/approve`, {
    token: inspectorToken,
    method: "POST"
  });
  assert.equal(approved.response.status, 200);
  assert.equal(approved.payload.is_immutable, true);

  const update = await request(`/api/certifications/${certificate.payload.cert_id}`, {
    token: inspectorToken,
    method: "PATCH",
    body: { batch_origin: "Batch-CHANGED" }
  });
  assert.equal(update.response.status, 409);
});

test("engineer telemetry and manager export work", async () => {
  const engineerToken = await login("irene.engineer");
  const reading = await request("/api/iot", {
    token: engineerToken,
    method: "POST",
    body: {
      equipment_id: 3001,
      readings: { temperature_c: 83.5, vibration_mm_s: 3.1, pressure_bar: 4.4 }
    }
  });
  assert.equal(reading.response.status, 201);
  assert.match(reading.payload.log_id, /^IOT-2026-/);

  const managerToken = await login("marcus.manager");
  const exportResult = await request("/api/export/audit_logs", { token: managerToken });
  assert.equal(exportResult.response.status, 200);
  assert.match(exportResult.payload, /log_id,emp_id/);
});
