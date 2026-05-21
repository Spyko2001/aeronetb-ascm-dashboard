DROP TABLE IF EXISTS role_permissions CASCADE;
DROP TABLE IF EXISTS employee_roles CASCADE;
DROP TABLE IF EXISTS procurement_officer_profiles CASCADE;
DROP TABLE IF EXISTS quality_inspector_profiles CASCADE;
DROP TABLE IF EXISTS supply_chain_manager_profiles CASCADE;
DROP TABLE IF EXISTS equipment_engineer_profiles CASCADE;
DROP TABLE IF EXISTS auditor_regulator_profiles CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS equipment CASCADE;
DROP TABLE IF EXISTS shipment_events CASCADE;
DROP TABLE IF EXISTS shipments CASCADE;
DROP TABLE IF EXISTS purchase_order_lines CASCADE;
DROP TABLE IF EXISTS purchase_orders CASCADE;
DROP TABLE IF EXISTS supplier_parts CASCADE;
DROP TABLE IF EXISTS parts CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;
DROP TABLE IF EXISTS employees CASCADE;
DROP TABLE IF EXISTS roles CASCADE;
DROP TABLE IF EXISTS permissions CASCADE;

CREATE TABLE suppliers (
  supplier_id INTEGER PRIMARY KEY,
  business_name VARCHAR(200) NOT NULL,
  address TEXT,
  contact_name VARCHAR(150),
  contact_email VARCHAR(150),
  contact_phone VARCHAR(30),
  accreditation_status VARCHAR(100)
);

CREATE TABLE parts (
  part_id INTEGER PRIMARY KEY,
  part_name VARCHAR(200) NOT NULL,
  part_category VARCHAR(100),
  description TEXT,
  spec_tensile_strength NUMERIC(8, 2),
  spec_fatigue_limit NUMERIC(8, 2),
  spec_process_details TEXT
);

CREATE TABLE supplier_parts (
  supplier_part_id INTEGER PRIMARY KEY,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(supplier_id),
  part_id INTEGER NOT NULL REFERENCES parts(part_id),
  supplier_part_code VARCHAR(100),
  customisation_notes TEXT,
  UNIQUE (supplier_id, part_id, supplier_part_code)
);

CREATE TABLE purchase_orders (
  order_id INTEGER PRIMARY KEY,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(supplier_id),
  order_date DATE NOT NULL,
  desired_delivery_date DATE NOT NULL,
  actual_delivery_date DATE,
  status VARCHAR(20) NOT NULL CHECK (status IN ('placed', 'confirmed', 'dispatched', 'delivered', 'completed'))
);

CREATE TABLE purchase_order_lines (
  order_line_id INTEGER PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES purchase_orders(order_id) ON DELETE CASCADE,
  part_id INTEGER NOT NULL REFERENCES parts(part_id),
  supplier_part_id INTEGER REFERENCES supplier_parts(supplier_part_id),
  quantity INTEGER NOT NULL CHECK (quantity > 0)
);

CREATE TABLE shipments (
  shipment_id INTEGER PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES purchase_orders(order_id),
  tracking_number VARCHAR(100) UNIQUE,
  port_of_entry VARCHAR(100),
  shipment_status VARCHAR(30),
  eta DATE
);

CREATE TABLE shipment_events (
  event_id INTEGER PRIMARY KEY,
  shipment_id INTEGER NOT NULL REFERENCES shipments(shipment_id) ON DELETE CASCADE,
  event_timestamp TIMESTAMPTZ NOT NULL,
  event_type VARCHAR(50),
  location VARCHAR(200),
  condition_notes TEXT
);

CREATE TABLE roles (
  role_id VARCHAR(80) PRIMARY KEY,
  role_name VARCHAR(120) NOT NULL
);

CREATE TABLE permissions (
  permission_id VARCHAR(120) PRIMARY KEY,
  permission_name VARCHAR(120) NOT NULL,
  scope VARCHAR(120)
);

CREATE TABLE role_permissions (
  role_id VARCHAR(80) NOT NULL REFERENCES roles(role_id) ON DELETE CASCADE,
  permission_id VARCHAR(120) NOT NULL REFERENCES permissions(permission_id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE employees (
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

CREATE TABLE employee_roles (
  emp_id INTEGER NOT NULL REFERENCES employees(emp_id) ON DELETE CASCADE,
  role_id VARCHAR(80) NOT NULL REFERENCES roles(role_id) ON DELETE CASCADE,
  PRIMARY KEY (emp_id, role_id)
);

CREATE TABLE procurement_officer_profiles (
  emp_id INTEGER PRIMARY KEY REFERENCES employees(emp_id) ON DELETE CASCADE,
  region_or_portfolio VARCHAR(150),
  authorisation_limit NUMERIC(12, 2)
);

CREATE TABLE quality_inspector_profiles (
  emp_id INTEGER PRIMARY KEY REFERENCES employees(emp_id) ON DELETE CASCADE,
  inspector_certification_ids TEXT,
  inspection_specialisation VARCHAR(150),
  digital_signature_stamp TEXT
);

CREATE TABLE supply_chain_manager_profiles (
  emp_id INTEGER PRIMARY KEY REFERENCES employees(emp_id) ON DELETE CASCADE,
  assigned_product_lines TEXT,
  reporting_level VARCHAR(80),
  dashboard_kpi_preferences TEXT
);

CREATE TABLE equipment_engineer_profiles (
  emp_id INTEGER PRIMARY KEY REFERENCES employees(emp_id) ON DELETE CASCADE,
  engineering_license VARCHAR(100),
  assigned_facility VARCHAR(150),
  machine_groups_responsible TEXT
);

CREATE TABLE auditor_regulator_profiles (
  emp_id INTEGER PRIMARY KEY REFERENCES employees(emp_id) ON DELETE CASCADE,
  agency_name VARCHAR(150),
  accreditation_license_id VARCHAR(100),
  audit_scope VARCHAR(150),
  read_only_flag BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE equipment (
  equipment_id INTEGER PRIMARY KEY,
  equipment_name VARCHAR(200),
  equipment_type VARCHAR(100),
  facility VARCHAR(150),
  assigned_emp_id INTEGER REFERENCES employees(emp_id)
);

CREATE TABLE audit_logs (
  log_id INTEGER PRIMARY KEY,
  emp_id INTEGER NOT NULL REFERENCES employees(emp_id),
  action_type VARCHAR(50),
  entity_type VARCHAR(100),
  entity_id VARCHAR(100),
  action_timestamp TIMESTAMPTZ NOT NULL,
  outcome VARCHAR(40),
  details TEXT
);

CREATE INDEX idx_purchase_orders_supplier ON purchase_orders(supplier_id);
CREATE INDEX idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX idx_shipments_order ON shipments(order_id);
CREATE INDEX idx_shipment_events_time ON shipment_events(event_timestamp DESC);
CREATE INDEX idx_audit_logs_time ON audit_logs(action_timestamp DESC);
