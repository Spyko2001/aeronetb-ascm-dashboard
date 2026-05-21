import crypto from "node:crypto";

export const roleLabels = {
  procurement_officer: "Procurement Officer",
  quality_inspector: "Quality Inspector",
  supply_chain_manager: "Supply Chain Manager",
  equipment_engineer: "Equipment Engineer",
  auditor_regulator: "Auditor / Regulator"
};

export const rolePermissions = {
  procurement_officer: [
    "read:dashboard",
    "read:suppliers",
    "write:suppliers",
    "read:parts",
    "read:orders",
    "write:orders",
    "read:shipments",
    "write:shipments",
    "read:qc",
    "read:certifications"
  ],
  quality_inspector: [
    "read:dashboard",
    "read:suppliers",
    "read:parts",
    "read:orders",
    "read:shipments",
    "read:qc",
    "write:qc",
    "approve:qc",
    "read:certifications",
    "write:certifications",
    "approve:certifications"
  ],
  supply_chain_manager: ["read:*", "write:shipments", "export:reports"],
  equipment_engineer: ["read:dashboard", "read:equipment", "read:iot", "write:iot", "read:shipments"],
  auditor_regulator: ["read:*", "flag:compliance", "export:reports"]
};

function base64Url(input) {
  return Buffer.from(input).toString("base64url");
}

function sign(value, secret) {
  return crypto.createHmac("sha256", secret).update(value).digest("base64url");
}

export function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 32, "sha256").toString("hex");
  return { salt, hash };
}

export function verifyPassword(password, employee) {
  if (!employee?.password_salt || !employee?.password_hash) {
    return false;
  }

  const candidate = hashPassword(password, employee.password_salt).hash;
  const expected = Buffer.from(employee.password_hash, "hex");
  const actual = Buffer.from(candidate, "hex");

  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

export function createSessionToken(employee, secret, ttlSeconds = 8 * 60 * 60) {
  const payload = {
    emp_id: employee.emp_id,
    auth_id: employee.auth_id,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds
  };
  const body = base64Url(JSON.stringify(payload));
  return `${body}.${sign(body, secret)}`;
}

export function verifySessionToken(token, secret) {
  const [body, signature] = String(token || "").split(".");
  if (!body || !signature) {
    return null;
  }

  const expected = sign(body, secret);
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== actualBuffer.length || !crypto.timingSafeEqual(expectedBuffer, actualBuffer)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function hasPermission(employee, permission) {
  const permissions = rolePermissions[employee?.role] || [];
  const [action] = permission.split(":");

  return permissions.some((granted) => {
    if (granted === permission || granted === "*") {
      return true;
    }
    if (granted.endsWith(":*")) {
      return granted.split(":")[0] === action;
    }
    return false;
  });
}

export function publicEmployee(employee) {
  if (!employee) {
    return null;
  }

  const {
    password_hash: _passwordHash,
    password_salt: _passwordSalt,
    demoPassword: _demoPassword,
    ...safeEmployee
  } = employee;

  return {
    ...safeEmployee,
    role_label: roleLabels[employee.role] || employee.role,
    permissions: rolePermissions[employee.role] || []
  };
}
