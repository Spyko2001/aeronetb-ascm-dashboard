import { config } from "./config.js";
import { collections, seedData } from "./seed-data.js";
import { hashPassword, roleLabels, rolePermissions } from "./security.js";

let pgPool = null;
let mongoClient = null;
let mongoDb = null;
let mongoConnectionWarning = "";
let memoryStore = new Map();
let memoryCounters = new Map();

const relationalTables = {
  suppliers: {
    table: "suppliers",
    id: "supplier_id",
    columns: ["supplier_id", "business_name", "address", "contact_name", "contact_email", "contact_phone", "accreditation_status"]
  },
  parts: {
    table: "parts",
    id: "part_id",
    columns: ["part_id", "part_name", "part_category", "description", "spec_tensile_strength", "spec_fatigue_limit", "spec_process_details"]
  },
  supplier_parts: {
    table: "supplier_parts",
    id: "supplier_part_id",
    columns: ["supplier_part_id", "supplier_id", "part_id", "supplier_part_code", "customisation_notes"]
  },
  purchase_orders: {
    table: "purchase_orders",
    id: "order_id",
    columns: ["order_id", "supplier_id", "order_date", "desired_delivery_date", "actual_delivery_date", "status"]
  },
  purchase_order_lines: {
    table: "purchase_order_lines",
    id: "order_line_id",
    columns: ["order_line_id", "order_id", "part_id", "supplier_part_id", "quantity"]
  },
  shipments: {
    table: "shipments",
    id: "shipment_id",
    columns: ["shipment_id", "order_id", "tracking_number", "port_of_entry", "shipment_status", "eta"]
  },
  shipment_events: {
    table: "shipment_events",
    id: "event_id",
    columns: ["event_id", "shipment_id", "event_timestamp", "event_type", "location", "condition_notes"]
  },
  employees: {
    table: "employees",
    id: "emp_id",
    columns: ["emp_id", "full_name", "job_title", "department", "email", "phone", "access_level", "auth_id", "role", "password_salt", "password_hash"]
  },
  equipment: {
    table: "equipment",
    id: "equipment_id",
    columns: ["equipment_id", "equipment_name", "equipment_type", "facility", "assigned_emp_id"]
  },
  audit_logs: {
    table: "audit_logs",
    id: "log_id",
    columns: ["log_id", "emp_id", "action_type", "entity_type", "entity_id", "action_timestamp", "outcome", "details"]
  }
};

const documentCollections = new Set(["qc_reports", "certifications", "iot_sensor_logs", "compliance_flags"]);

const idFields = Object.fromEntries([
  ...Object.entries(relationalTables).map(([collectionName, definition]) => [collectionName, definition.id]),
  ["compliance_flags", "flag_id"]
]);

const stringIdCollections = {
  QC: ["qc_reports", "report_id"],
  CERT: ["certifications", "cert_id"],
  IOT: ["iot_sensor_logs", "log_id"]
};

function clone(value) {
  return structuredClone(value);
}

function prepareSeedData() {
  const prepared = clone(seedData);
  prepared.employees = prepared.employees.map((employee) => {
    const { demoPassword = "demo123", ...safeEmployee } = employee;
    const { salt, hash } = hashPassword(demoPassword);
    return {
      ...safeEmployee,
      password_salt: salt,
      password_hash: hash
    };
  });
  return prepared;
}

function valueAtPath(document, dottedPath) {
  return dottedPath.split(".").reduce((value, key) => (value == null ? undefined : value[key]), document);
}

function matchesFilter(document, filter = {}) {
  return Object.entries(filter).every(([key, expected]) => {
    const actual = valueAtPath(document, key);

    if (expected instanceof RegExp) {
      return expected.test(String(actual ?? ""));
    }

    if (expected && typeof expected === "object" && !Array.isArray(expected)) {
      if ("$in" in expected) {
        return expected.$in.includes(actual);
      }
      if ("$ne" in expected) {
        return actual !== expected.$ne;
      }
      if ("$lte" in expected) {
        return actual <= expected.$lte;
      }
      if ("$gte" in expected) {
        return actual >= expected.$gte;
      }
    }

    return actual === expected;
  });
}

function compareBySort(sort = {}) {
  const entries = Object.entries(sort);
  return (left, right) => {
    for (const [field, direction] of entries) {
      const leftValue = valueAtPath(left, field);
      const rightValue = valueAtPath(right, field);
      if (leftValue < rightValue) {
        return direction < 0 ? 1 : -1;
      }
      if (leftValue > rightValue) {
        return direction < 0 ? -1 : 1;
      }
    }
    return 0;
  };
}

function ensureMemoryCollection(name) {
  if (!memoryStore.has(name)) {
    memoryStore.set(name, []);
  }
  return memoryStore.get(name);
}

function resetMemoryStore(prepared = prepareSeedData()) {
  memoryStore = new Map();
  memoryCounters = new Map();

  for (const collectionName of collections) {
    memoryStore.set(collectionName, prepared[collectionName] || []);
  }

  initialiseMemoryCounters();
}

function initialiseMemoryCounters() {
  for (const [collectionName, field] of Object.entries(idFields)) {
    const maxValue = ensureMemoryCollection(collectionName).reduce((max, document) => {
      const value = Number(document[field] || 0);
      return Math.max(max, value);
    }, 0);
    memoryCounters.set(`${collectionName}:${field}`, maxValue);
  }

  for (const [prefix, [collectionName, field]] of Object.entries(stringIdCollections)) {
    const maxValue = ensureMemoryCollection(collectionName).reduce((max, document) => {
      const match = String(document[field] || "").match(/(\d+)$/);
      return Math.max(max, match ? Number(match[1]) : 0);
    }, 0);
    memoryCounters.set(`string:${prefix}`, maxValue);
  }
}

function usePostgres(collectionName) {
  return Boolean(pgPool && relationalTables[collectionName]);
}

function useMongo(collectionName) {
  return Boolean(mongoDb && documentCollections.has(collectionName));
}

function pgConnectionOptions() {
  const options = { connectionString: config.databaseUrl };
  if (config.databaseUrl.includes("sslmode=require") || process.env.PGSSLMODE === "require") {
    options.ssl = { rejectUnauthorized: false };
  }
  return options;
}

async function connectPostgres() {
  if (!config.databaseUrl) {
    return;
  }

  const { Pool } = await import("pg");
  pgPool = new Pool(pgConnectionOptions());
  await pgPool.query("SELECT 1");
  console.log("Connected to PostgreSQL");
  await ensurePostgresSchema();
}

async function connectMongo() {
  if (!config.mongoUri) {
    return;
  }

  const { MongoClient, ServerApiVersion } = await import("mongodb");
  mongoClient = new MongoClient(config.mongoUri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: false,
      deprecationErrors: true
    }
  });
  await mongoClient.connect();
  mongoDb = mongoClient.db(config.mongoDbName);
  console.log("Connected to MongoDB Atlas");
  await ensureMongoCollectionsAndIndexes();
}

async function connectMongoWithFallback() {
  try {
    await connectMongo();
  } catch (error) {
    mongoConnectionWarning = `${error.name || "MongoDB error"}: ${error.message || "connection failed"}`;
    console.warn(`MongoDB connection failed; continuing with in-memory document collections. ${mongoConnectionWarning}`);
    if (mongoClient) {
      await mongoClient.close().catch(() => {});
    }
    mongoClient = null;
    mongoDb = null;
  }
}

async function ensurePostgresSchema() {
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS suppliers (
      supplier_id INTEGER PRIMARY KEY,
      business_name VARCHAR(200) NOT NULL,
      address TEXT,
      contact_name VARCHAR(150),
      contact_email VARCHAR(150),
      contact_phone VARCHAR(30),
      accreditation_status VARCHAR(100)
    );

    CREATE TABLE IF NOT EXISTS parts (
      part_id INTEGER PRIMARY KEY,
      part_name VARCHAR(200) NOT NULL,
      part_category VARCHAR(100),
      description TEXT,
      spec_tensile_strength NUMERIC(8, 2),
      spec_fatigue_limit NUMERIC(8, 2),
      spec_process_details TEXT
    );

    CREATE TABLE IF NOT EXISTS supplier_parts (
      supplier_part_id INTEGER PRIMARY KEY,
      supplier_id INTEGER NOT NULL REFERENCES suppliers(supplier_id),
      part_id INTEGER NOT NULL REFERENCES parts(part_id),
      supplier_part_code VARCHAR(100),
      customisation_notes TEXT,
      UNIQUE (supplier_id, part_id, supplier_part_code)
    );

    CREATE TABLE IF NOT EXISTS purchase_orders (
      order_id INTEGER PRIMARY KEY,
      supplier_id INTEGER NOT NULL REFERENCES suppliers(supplier_id),
      order_date DATE NOT NULL,
      desired_delivery_date DATE NOT NULL,
      actual_delivery_date DATE,
      status VARCHAR(20) NOT NULL CHECK (status IN ('placed', 'confirmed', 'dispatched', 'delivered', 'completed'))
    );

    CREATE TABLE IF NOT EXISTS purchase_order_lines (
      order_line_id INTEGER PRIMARY KEY,
      order_id INTEGER NOT NULL REFERENCES purchase_orders(order_id) ON DELETE CASCADE,
      part_id INTEGER NOT NULL REFERENCES parts(part_id),
      supplier_part_id INTEGER REFERENCES supplier_parts(supplier_part_id),
      quantity INTEGER NOT NULL CHECK (quantity > 0)
    );

    CREATE TABLE IF NOT EXISTS shipments (
      shipment_id INTEGER PRIMARY KEY,
      order_id INTEGER NOT NULL REFERENCES purchase_orders(order_id),
      tracking_number VARCHAR(100) UNIQUE,
      port_of_entry VARCHAR(100),
      shipment_status VARCHAR(30),
      eta DATE
    );

    CREATE TABLE IF NOT EXISTS shipment_events (
      event_id INTEGER PRIMARY KEY,
      shipment_id INTEGER NOT NULL REFERENCES shipments(shipment_id) ON DELETE CASCADE,
      event_timestamp TIMESTAMPTZ NOT NULL,
      event_type VARCHAR(50),
      location VARCHAR(200),
      condition_notes TEXT
    );

    CREATE TABLE IF NOT EXISTS roles (
      role_id VARCHAR(80) PRIMARY KEY,
      role_name VARCHAR(120) NOT NULL
    );

    CREATE TABLE IF NOT EXISTS permissions (
      permission_id VARCHAR(120) PRIMARY KEY,
      permission_name VARCHAR(120) NOT NULL,
      scope VARCHAR(120)
    );

    CREATE TABLE IF NOT EXISTS role_permissions (
      role_id VARCHAR(80) NOT NULL REFERENCES roles(role_id) ON DELETE CASCADE,
      permission_id VARCHAR(120) NOT NULL REFERENCES permissions(permission_id) ON DELETE CASCADE,
      PRIMARY KEY (role_id, permission_id)
    );

    CREATE TABLE IF NOT EXISTS employees (
      emp_id INTEGER PRIMARY KEY,
      full_name VARCHAR(150) NOT NULL,
      job_title VARCHAR(100),
      department VARCHAR(100),
      email VARCHAR(150),
      phone VARCHAR(30),
      access_level VARCHAR(30),
      auth_id VARCHAR(100) UNIQUE NOT NULL,
      role VARCHAR(80) NOT NULL REFERENCES roles(role_id),
      password_salt TEXT NOT NULL,
      password_hash TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS employee_roles (
      emp_id INTEGER NOT NULL REFERENCES employees(emp_id) ON DELETE CASCADE,
      role_id VARCHAR(80) NOT NULL REFERENCES roles(role_id) ON DELETE CASCADE,
      PRIMARY KEY (emp_id, role_id)
    );

    CREATE TABLE IF NOT EXISTS procurement_officer_profiles (
      emp_id INTEGER PRIMARY KEY REFERENCES employees(emp_id) ON DELETE CASCADE,
      region_or_portfolio VARCHAR(150),
      authorisation_limit NUMERIC(12, 2)
    );

    CREATE TABLE IF NOT EXISTS quality_inspector_profiles (
      emp_id INTEGER PRIMARY KEY REFERENCES employees(emp_id) ON DELETE CASCADE,
      inspector_certification_ids TEXT,
      inspection_specialisation VARCHAR(150),
      digital_signature_stamp TEXT
    );

    CREATE TABLE IF NOT EXISTS supply_chain_manager_profiles (
      emp_id INTEGER PRIMARY KEY REFERENCES employees(emp_id) ON DELETE CASCADE,
      assigned_product_lines TEXT,
      reporting_level VARCHAR(80),
      dashboard_kpi_preferences TEXT
    );

    CREATE TABLE IF NOT EXISTS equipment_engineer_profiles (
      emp_id INTEGER PRIMARY KEY REFERENCES employees(emp_id) ON DELETE CASCADE,
      engineering_license VARCHAR(100),
      assigned_facility VARCHAR(150),
      machine_groups_responsible TEXT
    );

    CREATE TABLE IF NOT EXISTS auditor_regulator_profiles (
      emp_id INTEGER PRIMARY KEY REFERENCES employees(emp_id) ON DELETE CASCADE,
      agency_name VARCHAR(150),
      accreditation_license_id VARCHAR(100),
      audit_scope VARCHAR(150),
      read_only_flag BOOLEAN NOT NULL DEFAULT TRUE
    );

    CREATE TABLE IF NOT EXISTS equipment (
      equipment_id INTEGER PRIMARY KEY,
      equipment_name VARCHAR(200),
      equipment_type VARCHAR(100),
      facility VARCHAR(150),
      assigned_emp_id INTEGER REFERENCES employees(emp_id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      log_id INTEGER PRIMARY KEY,
      emp_id INTEGER NOT NULL REFERENCES employees(emp_id),
      action_type VARCHAR(50),
      entity_type VARCHAR(100),
      entity_id VARCHAR(100),
      action_timestamp TIMESTAMPTZ NOT NULL,
      outcome VARCHAR(40),
      details TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON purchase_orders(supplier_id);
    CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status);
    CREATE INDEX IF NOT EXISTS idx_shipments_order ON shipments(order_id);
    CREATE INDEX IF NOT EXISTS idx_shipment_events_time ON shipment_events(event_timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_time ON audit_logs(action_timestamp DESC);
  `);
}

async function ensureMongoCollectionsAndIndexes() {
  for (const name of [...documentCollections, "counters"]) {
    const exists = await mongoDb.listCollections({ name }).hasNext();
    if (!exists) {
      await mongoDb.createCollection(name);
    }
  }

  await mongoDb.command({
    collMod: "qc_reports",
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["report_id", "order_id", "part_id", "supplier_id", "inspector_emp_id", "report_type", "outcome", "version", "created_at"],
        properties: {
          report_id: { bsonType: "string" },
          order_id: { bsonType: "int" },
          part_id: { bsonType: "int" },
          supplier_id: { bsonType: "int" },
          inspector_emp_id: { bsonType: "int" },
          report_type: { enum: ["visual", "dimensional", "ndt", "environmental"] },
          outcome: { enum: ["PASS", "FAIL"] },
          result_data: { bsonType: "object" },
          version: { bsonType: "int", minimum: 1 },
          is_approved: { bsonType: "bool" }
        }
      }
    },
    validationLevel: "moderate"
  });

  await mongoDb.command({
    collMod: "certifications",
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["cert_id", "part_id", "supplier_id", "inspector_emp_id", "batch_origin", "is_immutable"],
        properties: {
          cert_id: { bsonType: "string" },
          part_id: { bsonType: "int" },
          supplier_id: { bsonType: "int" },
          inspector_emp_id: { bsonType: "int" },
          test_results: { bsonType: "object" },
          batch_origin: { bsonType: "string" },
          digital_signature: { bsonType: "string" },
          is_immutable: { bsonType: "bool" }
        }
      }
    },
    validationLevel: "moderate"
  });

  await mongoDb.command({
    collMod: "iot_sensor_logs",
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["log_id", "equipment_id", "timestamp", "readings"],
        properties: {
          log_id: { bsonType: "string" },
          equipment_id: { bsonType: "int" },
          timestamp: { bsonType: "string" },
          readings: { bsonType: "object" }
        }
      }
    },
    validationLevel: "moderate"
  });

  await mongoDb.command({
    collMod: "compliance_flags",
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["flag_id", "created_by_emp_id", "entity_type", "entity_id", "severity", "note", "created_at", "status"],
        properties: {
          flag_id: { bsonType: "int" },
          created_by_emp_id: { bsonType: "int" },
          entity_type: { bsonType: "string" },
          entity_id: { bsonType: "string" },
          severity: { enum: ["Low", "Medium", "High"] },
          note: { bsonType: "string" },
          status: { bsonType: "string" }
        }
      }
    },
    validationLevel: "moderate"
  });

  await mongoDb.collection("qc_reports").createIndex({ report_id: 1 }, { unique: true });
  await mongoDb.collection("qc_reports").createIndex({ supplier_id: 1, part_id: 1, outcome: 1 });
  await mongoDb.collection("certifications").createIndex({ cert_id: 1 }, { unique: true });
  await mongoDb.collection("iot_sensor_logs").createIndex({ equipment_id: 1, timestamp: -1 });
  await mongoDb.collection("compliance_flags").createIndex({ flag_id: 1 }, { unique: true });
  await mongoDb.collection("compliance_flags").createIndex({ created_at: -1 });
}

async function initialiseMongoCounters() {
  for (const [collectionName, field] of [["compliance_flags", "flag_id"]]) {
    const [latest] = await mongoDb.collection(collectionName).find({}).sort({ [field]: -1 }).limit(1).toArray();
    await mongoDb
      .collection("counters")
      .updateOne({ _id: `${collectionName}:${field}` }, { $max: { seq: Number(latest?.[field] || 0) } }, { upsert: true });
  }

  for (const [prefix, [collectionName, field]] of Object.entries(stringIdCollections)) {
    const documents = await mongoDb.collection(collectionName).find({}, { projection: { [field]: 1 } }).toArray();
    const maxValue = documents.reduce((max, document) => {
      const match = String(document[field] || "").match(/(\d+)$/);
      return Math.max(max, match ? Number(match[1]) : 0);
    }, 0);
    await mongoDb.collection("counters").updateOne({ _id: `string:${prefix}` }, { $max: { seq: maxValue } }, { upsert: true });
  }
}

function postgresDefinition(collectionName) {
  const definition = relationalTables[collectionName];
  if (!definition) {
    throw new Error(`No PostgreSQL table configured for ${collectionName}`);
  }
  return definition;
}

function assertColumn(definition, column) {
  if (!definition.columns.includes(column)) {
    throw new Error(`Column ${column} is not allowed for ${definition.table}`);
  }
}

function buildWhereClause(definition, filter, values) {
  const clauses = [];
  for (const [column, expected] of Object.entries(filter || {})) {
    assertColumn(definition, column);

    if (expected && typeof expected === "object" && !Array.isArray(expected)) {
      if ("$in" in expected) {
        const placeholders = expected.$in.map((value) => {
          values.push(value);
          return `$${values.length}`;
        });
        clauses.push(`${column} IN (${placeholders.join(", ")})`);
        continue;
      }
      if ("$ne" in expected) {
        values.push(expected.$ne);
        clauses.push(`${column} <> $${values.length}`);
        continue;
      }
      if ("$lte" in expected) {
        values.push(expected.$lte);
        clauses.push(`${column} <= $${values.length}`);
        continue;
      }
      if ("$gte" in expected) {
        values.push(expected.$gte);
        clauses.push(`${column} >= $${values.length}`);
        continue;
      }
    }

    values.push(expected);
    clauses.push(`${column} = $${values.length}`);
  }

  return clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "";
}

function buildOrderClause(definition, sort = {}) {
  const entries = Object.entries(sort).filter(([column]) => definition.columns.includes(column));
  if (!entries.length) {
    return "";
  }
  return ` ORDER BY ${entries.map(([column, direction]) => `${column} ${direction < 0 ? "DESC" : "ASC"}`).join(", ")}`;
}

async function listPostgres(collectionName, filter = {}, options = {}) {
  const definition = postgresDefinition(collectionName);
  const values = [];
  const where = buildWhereClause(definition, filter, values);
  const order = buildOrderClause(definition, options.sort);
  const limit = Number.isInteger(options.limit) ? ` LIMIT ${Number(options.limit)}` : "";
  const result = await pgPool.query(`SELECT ${definition.columns.join(", ")} FROM ${definition.table}${where}${order}${limit}`, values);
  return result.rows;
}

async function findOnePostgres(collectionName, filter = {}) {
  const [document] = await listPostgres(collectionName, filter, { limit: 1 });
  return document || null;
}

async function insertPostgres(collectionName, document, { ignoreConflict = false } = {}) {
  const definition = postgresDefinition(collectionName);
  const columns = definition.columns.filter((column) => document[column] !== undefined);
  columns.forEach((column) => assertColumn(definition, column));

  const values = columns.map((column) => document[column]);
  const placeholders = columns.map((_, index) => `$${index + 1}`);
  const conflict = ignoreConflict ? ` ON CONFLICT (${definition.id}) DO NOTHING` : "";
  const returning = ignoreConflict ? "" : " RETURNING *";
  const result = await pgPool.query(
    `INSERT INTO ${definition.table} (${columns.join(", ")}) VALUES (${placeholders.join(", ")})${conflict}${returning}`,
    values
  );

  return result.rows[0] || document;
}

async function updatePostgres(collectionName, filter, updates) {
  const definition = postgresDefinition(collectionName);
  const values = [];
  const setClauses = Object.entries(updates || {}).map(([column, value]) => {
    assertColumn(definition, column);
    values.push(value);
    return `${column} = $${values.length}`;
  });

  if (!setClauses.length) {
    return findOnePostgres(collectionName, filter);
  }

  const where = buildWhereClause(definition, filter, values);
  const result = await pgPool.query(`UPDATE ${definition.table} SET ${setClauses.join(", ")}${where} RETURNING *`, values);
  return result.rows[0] || null;
}

async function seedRoleData(prepared) {
  for (const [roleId, label] of Object.entries(roleLabels)) {
    await pgPool.query("INSERT INTO roles (role_id, role_name) VALUES ($1, $2) ON CONFLICT (role_id) DO UPDATE SET role_name = EXCLUDED.role_name", [
      roleId,
      label
    ]);
  }

  const permissions = [...new Set(Object.values(rolePermissions).flat())];
  for (const permission of permissions) {
    const permissionId = permission.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").toLowerCase() || "all";
    const [, scope = "*"] = permission.split(":");
    await pgPool.query(
      "INSERT INTO permissions (permission_id, permission_name, scope) VALUES ($1, $2, $3) ON CONFLICT (permission_id) DO UPDATE SET permission_name = EXCLUDED.permission_name, scope = EXCLUDED.scope",
      [permissionId, permission, scope]
    );
  }

  for (const [roleId, permissionsForRole] of Object.entries(rolePermissions)) {
    for (const permission of permissionsForRole) {
      const permissionId = permission.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").toLowerCase() || "all";
      await pgPool.query(
        "INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT (role_id, permission_id) DO NOTHING",
        [roleId, permissionId]
      );
    }
  }

}

async function seedProfileData(prepared) {
  for (const employee of prepared.employees) {
    const profile = employee.profile || {};
    if (employee.role === "procurement_officer") {
      await pgPool.query(
        "INSERT INTO procurement_officer_profiles (emp_id, region_or_portfolio, authorisation_limit) VALUES ($1, $2, $3) ON CONFLICT (emp_id) DO NOTHING",
        [employee.emp_id, profile.region_or_portfolio || "", profile.authorisation_limit || 0]
      );
    }
    if (employee.role === "quality_inspector") {
      await pgPool.query(
        "INSERT INTO quality_inspector_profiles (emp_id, inspector_certification_ids, inspection_specialisation, digital_signature_stamp) VALUES ($1, $2, $3, $4) ON CONFLICT (emp_id) DO NOTHING",
        [
          employee.emp_id,
          Array.isArray(profile.inspector_certification_ids) ? profile.inspector_certification_ids.join(", ") : "",
          profile.inspection_specialisation || "",
          profile.digital_signature_stamp || ""
        ]
      );
    }
    if (employee.role === "supply_chain_manager") {
      await pgPool.query(
        "INSERT INTO supply_chain_manager_profiles (emp_id, assigned_product_lines, reporting_level, dashboard_kpi_preferences) VALUES ($1, $2, $3, $4) ON CONFLICT (emp_id) DO NOTHING",
        [
          employee.emp_id,
          Array.isArray(profile.assigned_product_lines) ? profile.assigned_product_lines.join(", ") : "",
          profile.reporting_level || "",
          Array.isArray(profile.dashboard_kpi_preferences) ? profile.dashboard_kpi_preferences.join(", ") : ""
        ]
      );
    }
    if (employee.role === "equipment_engineer") {
      await pgPool.query(
        "INSERT INTO equipment_engineer_profiles (emp_id, engineering_license, assigned_facility, machine_groups_responsible) VALUES ($1, $2, $3, $4) ON CONFLICT (emp_id) DO NOTHING",
        [
          employee.emp_id,
          profile.engineering_license || "",
          profile.assigned_facility || "",
          Array.isArray(profile.machine_groups_responsible) ? profile.machine_groups_responsible.join(", ") : ""
        ]
      );
    }
    if (employee.role === "auditor_regulator") {
      await pgPool.query(
        "INSERT INTO auditor_regulator_profiles (emp_id, agency_name, accreditation_license_id, audit_scope, read_only_flag) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (emp_id) DO NOTHING",
        [employee.emp_id, profile.agency_name || "", profile.accreditation_license_id || "", profile.audit_scope || "", profile.read_only_flag !== false]
      );
    }
  }
}

async function seedPostgres(prepared, { force = false } = {}) {
  const { rows } = await pgPool.query("SELECT COUNT(*)::int AS count FROM suppliers");
  if (rows[0].count > 0 && !force) {
    return { seeded: false, reason: "PostgreSQL already contains suppliers" };
  }

  if (force) {
    await pgPool.query(`
      TRUNCATE TABLE
        role_permissions,
        employee_roles,
        procurement_officer_profiles,
        quality_inspector_profiles,
        supply_chain_manager_profiles,
        equipment_engineer_profiles,
        auditor_regulator_profiles,
        audit_logs,
        equipment,
        shipment_events,
        shipments,
        purchase_order_lines,
        purchase_orders,
        supplier_parts,
        parts,
        suppliers,
        employees,
        roles,
        permissions
      RESTART IDENTITY CASCADE
    `);
  }

  await seedRoleData(prepared);

  for (const collectionName of ["employees", "suppliers", "parts", "supplier_parts", "purchase_orders", "purchase_order_lines", "shipments", "shipment_events", "equipment", "audit_logs"]) {
    for (const document of prepared[collectionName] || []) {
      await insertPostgres(collectionName, document, { ignoreConflict: true });
    }
  }

  for (const employee of prepared.employees) {
    await pgPool.query("INSERT INTO employee_roles (emp_id, role_id) VALUES ($1, $2) ON CONFLICT (emp_id, role_id) DO NOTHING", [employee.emp_id, employee.role]);
  }
  await seedProfileData(prepared);
  return { seeded: true };
}

async function seedMongo(prepared, { force = false } = {}) {
  const qcCount = await mongoDb.collection("qc_reports").countDocuments();
  if (qcCount > 0 && !force) {
    await initialiseMongoCounters();
    return { seeded: false, reason: "MongoDB already contains QC reports" };
  }

  if (force) {
    for (const collectionName of documentCollections) {
      await mongoDb.collection(collectionName).deleteMany({});
    }
    await mongoDb.collection("counters").deleteMany({});
  }

  for (const collectionName of documentCollections) {
    const documents = prepared[collectionName] || [];
    if (documents.length > 0) {
      await mongoDb.collection(collectionName).insertMany(documents, { ordered: true });
    }
  }

  await initialiseMongoCounters();
  return { seeded: true };
}

export async function initDb({ autoSeed = config.autoSeed } = {}) {
  await connectPostgres();
  await connectMongoWithFallback();
  resetMemoryStore();

  if (autoSeed) {
    await seedDatabase();
  } else if (mongoDb) {
    await initialiseMongoCounters();
  }
}

export async function closeDb() {
  if (mongoClient) {
    await mongoClient.close();
  }
  if (pgPool) {
    await pgPool.end();
  }
}

export function getDbMode() {
  if (pgPool && mongoDb) {
    return "PostgreSQL + MongoDB";
  }
  if (pgPool) {
    return "PostgreSQL + memory documents";
  }
  if (mongoDb) {
    return "memory relational + MongoDB";
  }
  return "memory";
}

export function getDbWarning() {
  return mongoConnectionWarning;
}

export async function seedDatabase({ force = false } = {}) {
  const prepared = prepareSeedData();
  resetMemoryStore(prepared);
  const results = {};

  if (pgPool) {
    results.postgres = await seedPostgres(prepared, { force });
  }
  if (mongoDb) {
    results.mongodb = await seedMongo(prepared, { force });
  }

  if (!pgPool && !mongoDb) {
    return { seeded: true, mode: getDbMode() };
  }

  return { seeded: Object.values(results).some((result) => result.seeded), mode: getDbMode(), ...results };
}

export async function list(collectionName, filter = {}, options = {}) {
  if (usePostgres(collectionName)) {
    return listPostgres(collectionName, filter, options);
  }

  if (useMongo(collectionName)) {
    let cursor = mongoDb.collection(collectionName).find(filter);
    if (options.sort) {
      cursor = cursor.sort(options.sort);
    }
    if (options.limit) {
      cursor = cursor.limit(options.limit);
    }
    const documents = await cursor.toArray();
    return documents.map(({ _id, ...document }) => document);
  }

  let documents = ensureMemoryCollection(collectionName).filter((document) => matchesFilter(document, filter)).map(clone);
  if (options.sort) {
    documents = documents.sort(compareBySort(options.sort));
  }
  if (options.limit) {
    documents = documents.slice(0, options.limit);
  }
  return documents;
}

export async function findOne(collectionName, filter = {}) {
  if (usePostgres(collectionName)) {
    return findOnePostgres(collectionName, filter);
  }

  if (useMongo(collectionName)) {
    const document = await mongoDb.collection(collectionName).findOne(filter);
    if (!document) {
      return null;
    }
    const { _id, ...safeDocument } = document;
    return safeDocument;
  }

  const document = ensureMemoryCollection(collectionName).find((item) => matchesFilter(item, filter));
  return document ? clone(document) : null;
}

export async function insertOne(collectionName, document) {
  const newDocument = clone(document);
  if (usePostgres(collectionName)) {
    return insertPostgres(collectionName, newDocument);
  }

  if (useMongo(collectionName)) {
    await mongoDb.collection(collectionName).insertOne(newDocument);
    const { _id, ...safeDocument } = newDocument;
    return safeDocument;
  }

  ensureMemoryCollection(collectionName).push(newDocument);
  return clone(newDocument);
}

export async function updateOne(collectionName, filter, updates) {
  if (usePostgres(collectionName)) {
    return updatePostgres(collectionName, filter, updates);
  }

  if (useMongo(collectionName)) {
    const result = await mongoDb.collection(collectionName).findOneAndUpdate(filter, { $set: updates }, { returnDocument: "after" });
    const document = result?.value ?? result;
    if (!document) {
      return null;
    }
    const { _id, ...safeDocument } = document;
    return safeDocument;
  }

  const collection = ensureMemoryCollection(collectionName);
  const index = collection.findIndex((document) => matchesFilter(document, filter));
  if (index === -1) {
    return null;
  }

  collection[index] = { ...collection[index], ...clone(updates) };
  return clone(collection[index]);
}

export async function nextNumericId(collectionName, field = idFields[collectionName]) {
  if (!field) {
    throw new Error(`No numeric id field configured for ${collectionName}`);
  }

  const counterKey = `${collectionName}:${field}`;
  if (usePostgres(collectionName)) {
    const definition = postgresDefinition(collectionName);
    const { rows } = await pgPool.query(`SELECT COALESCE(MAX(${field}), 0)::int + 1 AS next_id FROM ${definition.table}`);
    return rows[0].next_id;
  }

  if (useMongo(collectionName)) {
    const result = await mongoDb
      .collection("counters")
      .findOneAndUpdate({ _id: counterKey }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: "after" });
    const document = result?.value ?? result;
    return document.seq;
  }

  const nextValue = (memoryCounters.get(counterKey) || 0) + 1;
  memoryCounters.set(counterKey, nextValue);
  return nextValue;
}

export async function nextStringId(prefix) {
  const counterKey = `string:${prefix}`;
  let nextValue;
  const [collectionName] = stringIdCollections[prefix] || [];

  if (collectionName && useMongo(collectionName)) {
    const result = await mongoDb
      .collection("counters")
      .findOneAndUpdate({ _id: counterKey }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: "after" });
    const document = result?.value ?? result;
    nextValue = document.seq;
  } else {
    nextValue = (memoryCounters.get(counterKey) || 0) + 1;
    memoryCounters.set(counterKey, nextValue);
  }

  return `${prefix}-2026-${String(nextValue).padStart(5, "0")}`;
}
