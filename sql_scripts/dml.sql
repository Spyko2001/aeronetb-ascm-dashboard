INSERT INTO roles (role_id, role_name) VALUES
  ('procurement_officer', 'Procurement Officer'),
  ('quality_inspector', 'Quality Inspector'),
  ('supply_chain_manager', 'Supply Chain Manager'),
  ('equipment_engineer', 'Equipment Engineer'),
  ('auditor_regulator', 'Auditor / Regulator');

INSERT INTO permissions (permission_id, permission_name, scope) VALUES
  ('read_dashboard', 'read:dashboard', 'dashboard'),
  ('read_suppliers', 'read:suppliers', 'suppliers'),
  ('write_suppliers', 'write:suppliers', 'suppliers'),
  ('read_parts', 'read:parts', 'parts'),
  ('read_orders', 'read:orders', 'orders'),
  ('write_orders', 'write:orders', 'orders'),
  ('read_shipments', 'read:shipments', 'shipments'),
  ('write_shipments', 'write:shipments', 'shipments'),
  ('read_qc', 'read:qc', 'qc'),
  ('write_qc', 'write:qc', 'qc'),
  ('approve_qc', 'approve:qc', 'qc'),
  ('read_certifications', 'read:certifications', 'certifications'),
  ('write_certifications', 'write:certifications', 'certifications'),
  ('approve_certifications', 'approve:certifications', 'certifications'),
  ('read', 'read:*', '*'),
  ('export_reports', 'export:reports', 'reports'),
  ('read_equipment', 'read:equipment', 'equipment'),
  ('read_iot', 'read:iot', 'iot'),
  ('write_iot', 'write:iot', 'iot'),
  ('flag_compliance', 'flag:compliance', 'compliance');

INSERT INTO role_permissions (role_id, permission_id) VALUES
  ('procurement_officer', 'read_dashboard'),
  ('procurement_officer', 'read_suppliers'),
  ('procurement_officer', 'write_suppliers'),
  ('procurement_officer', 'read_parts'),
  ('procurement_officer', 'read_orders'),
  ('procurement_officer', 'write_orders'),
  ('procurement_officer', 'read_shipments'),
  ('procurement_officer', 'write_shipments'),
  ('procurement_officer', 'read_qc'),
  ('procurement_officer', 'read_certifications'),
  ('quality_inspector', 'read_dashboard'),
  ('quality_inspector', 'read_suppliers'),
  ('quality_inspector', 'read_parts'),
  ('quality_inspector', 'read_orders'),
  ('quality_inspector', 'read_shipments'),
  ('quality_inspector', 'read_qc'),
  ('quality_inspector', 'write_qc'),
  ('quality_inspector', 'approve_qc'),
  ('quality_inspector', 'read_certifications'),
  ('quality_inspector', 'write_certifications'),
  ('quality_inspector', 'approve_certifications'),
  ('supply_chain_manager', 'read'),
  ('supply_chain_manager', 'write_shipments'),
  ('supply_chain_manager', 'export_reports'),
  ('equipment_engineer', 'read_dashboard'),
  ('equipment_engineer', 'read_equipment'),
  ('equipment_engineer', 'read_iot'),
  ('equipment_engineer', 'write_iot'),
  ('equipment_engineer', 'read_shipments'),
  ('auditor_regulator', 'read'),
  ('auditor_regulator', 'flag_compliance'),
  ('auditor_regulator', 'export_reports');

INSERT INTO employees (emp_id, full_name, job_title, department, email, phone, access_level, auth_id, role, password_salt, password_hash) VALUES
  (201, 'Priya Raman', 'Procurement Officer', 'Procurement', 'priya.raman@aeronetb.example', '+44-20-5555-0101', 'read/write', 'priya.procurement', 'procurement_officer', 'coursework-demo-salt', '45fc75124f860b618b515ec08ed58969334017ecb3d332c5dbc7c35aa3831401'),
  (202, 'Lena Ortiz', 'Quality Inspector', 'Quality', 'lena.ortiz@aeronetb.example', '+44-20-5555-0102', 'read/write/approve', 'lena.inspector', 'quality_inspector', 'coursework-demo-salt', '45fc75124f860b618b515ec08ed58969334017ecb3d332c5dbc7c35aa3831401'),
  (203, 'Marcus Chen', 'Supply Chain Manager', 'Supply Chain', 'marcus.chen@aeronetb.example', '+44-20-5555-0103', 'read/write/audit', 'marcus.manager', 'supply_chain_manager', 'coursework-demo-salt', '45fc75124f860b618b515ec08ed58969334017ecb3d332c5dbc7c35aa3831401'),
  (204, 'Irene Novak', 'Equipment Engineer', 'Engineering', 'irene.novak@aeronetb.example', '+44-20-5555-0104', 'read/write', 'irene.engineer', 'equipment_engineer', 'coursework-demo-salt', '45fc75124f860b618b515ec08ed58969334017ecb3d332c5dbc7c35aa3831401'),
  (205, 'Omar Haddad', 'Auditor / Regulator', 'Compliance', 'omar.haddad@aeronetb.example', '+44-20-5555-0105', 'read/audit', 'omar.auditor', 'auditor_regulator', 'coursework-demo-salt', '45fc75124f860b618b515ec08ed58969334017ecb3d332c5dbc7c35aa3831401');

INSERT INTO employee_roles (emp_id, role_id) VALUES
  (201, 'procurement_officer'),
  (202, 'quality_inspector'),
  (203, 'supply_chain_manager'),
  (204, 'equipment_engineer'),
  (205, 'auditor_regulator');

INSERT INTO procurement_officer_profiles (emp_id, region_or_portfolio, authorisation_limit) VALUES
  (201, 'Europe composite suppliers', 250000);

INSERT INTO quality_inspector_profiles (emp_id, inspector_certification_ids, inspection_specialisation, digital_signature_stamp) VALUES
  (202, 'NDT-UK-411, DIM-CMM-208', 'NDT and dimensional analysis', 'LORTIZ-QA-SIGN');

INSERT INTO supply_chain_manager_profiles (emp_id, assigned_product_lines, reporting_level, dashboard_kpi_preferences) VALUES
  (203, 'Fuselage, Wing assemblies', 'Global manager', 'on_time_delivery, defect_rate, delay_risk');

INSERT INTO equipment_engineer_profiles (emp_id, engineering_license, assigned_facility, machine_groups_responsible) VALUES
  (204, 'ENG-MAINT-778', 'Derby assembly plant', 'Autoclaves, CNC cells, Transit containers');

INSERT INTO auditor_regulator_profiles (emp_id, agency_name, accreditation_license_id, audit_scope, read_only_flag) VALUES
  (205, 'Internal compliance office', 'AUD-2026-55', 'Supplier certification and material traceability', TRUE);

INSERT INTO suppliers (supplier_id, business_name, address, contact_name, contact_email, contact_phone, accreditation_status) VALUES
  (1, 'Helios Aero Composites', 'Bremen, Germany', 'Klara Weber', 'supply@helios-aero.example', '+49-421-555-0191', 'AS9100, ISO 9001'),
  (2, 'Aegean Precision Alloys', 'Volos, Greece', 'Nikos Markou', 'orders@aegean-alloys.example', '+30-24210-55521', 'ISO 9001'),
  (3, 'NorthStar Avionics Materials', 'Montreal, Canada', 'Maya Deschamps', 'quality@northstar-materials.example', '+1-514-555-0144', 'AS9100'),
  (4, 'Pacific AeroForge', 'Jurong, Singapore', 'Lee Wei Chen', 'sales@pacific-aeroforge.example', '+65-5550-0188', 'Pending renewal');

INSERT INTO parts (part_id, part_name, part_category, description, spec_tensile_strength, spec_fatigue_limit, spec_process_details) VALUES
  (101, 'A320 fuselage panel', 'Fuselage', 'Composite panel for narrow-body aircraft fuselage sections.', 560, 310, 'Autoclave cure, ultrasonic NDT, anti-corrosion finish'),
  (102, 'Wing rib assembly', 'Wing assemblies', 'Load-bearing rib assembly for mid-span wing sections.', 620, 340, '5-axis machining, anodized finish, dimensional CMM'),
  (103, 'Titanium fastener kit', 'Fasteners', 'High-strength titanium fasteners for structural joints.', 980, 520, 'Heat treatment, thread rolling, batch hardness testing'),
  (104, 'Composite landing gear door', 'Landing systems', 'Lightweight composite door with embedded inspection points.', 540, 295, 'Resin transfer moulding, surface finish inspection'),
  (105, 'Sensorized shipping container', 'Transit equipment', 'Reusable container with shock, temperature, GPS, and pressure sensors.', 240, 150, 'Sensor calibration, seal verification, battery test');

INSERT INTO supplier_parts (supplier_part_id, supplier_id, part_id, supplier_part_code, customisation_notes) VALUES
  (1001, 1, 101, 'HAC-FP-A320-RFID', 'Anti-corrosion coating and serialized RFID tags.'),
  (1002, 2, 101, 'APA-FP-A320-HT', 'Optimized heat treatment for lighter panel weight.'),
  (1003, 2, 103, 'APA-TI-FST-STD', 'Batch traceability certificate included.'),
  (1004, 3, 102, 'NSM-WR-DT', 'Digital twin simulation package supplied with delivery.'),
  (1005, 4, 104, 'PAF-LGD-SHOCK', 'Shock sensor packaging for long transit legs.'),
  (1006, 4, 105, 'PAF-CON-IOT', 'Container firmware configured for AeroNetB telemetry.');

INSERT INTO purchase_orders (order_id, supplier_id, order_date, desired_delivery_date, actual_delivery_date, status) VALUES
  (5001, 1, '2026-04-15', '2026-05-14', '2026-05-13', 'completed'),
  (5002, 2, '2026-04-20', '2026-05-19', NULL, 'dispatched'),
  (5003, 3, '2026-05-01', '2026-05-27', NULL, 'confirmed'),
  (5004, 4, '2026-04-25', '2026-05-21', '2026-05-20', 'delivered'),
  (5005, 1, '2026-05-18', '2026-06-10', NULL, 'placed');

INSERT INTO purchase_order_lines (order_line_id, order_id, part_id, supplier_part_id, quantity) VALUES
  (9001, 5001, 101, 1001, 24),
  (9002, 5001, 103, 1003, 600),
  (9003, 5002, 101, 1002, 18),
  (9004, 5003, 102, 1004, 12),
  (9005, 5004, 104, 1005, 10),
  (9006, 5005, 101, 1001, 32);

INSERT INTO shipments (shipment_id, order_id, tracking_number, port_of_entry, shipment_status, eta) VALUES
  (7001, 5001, 'AER-DE-5001', 'Dover', 'delivered', '2026-05-13'),
  (7002, 5002, 'AER-GR-5002', 'Piraeus', 'in_transit', '2026-05-23'),
  (7003, 5003, 'AER-CA-5003', 'Liverpool', 'preparing', '2026-05-27'),
  (7004, 5004, 'AER-SG-5004', 'Felixstowe', 'delivered', '2026-05-20');

INSERT INTO shipment_events (event_id, shipment_id, event_timestamp, event_type, location, condition_notes) VALUES
  (8101, 7001, '2026-05-13T09:10:00Z', 'Delivered', 'Derby assembly plant', 'Container seal intact; temperature stable.'),
  (8102, 7002, '2026-05-20T06:45:00Z', 'Checkpoint', 'Piraeus outbound terminal', 'Shock sensor recorded warning during loading.'),
  (8103, 7002, '2026-05-21T10:20:00Z', 'ConditionUpdate', 'Mediterranean sea lane', 'Temperature 7.2C, vibration 2.9mm/s.'),
  (8104, 7003, '2026-05-18T16:30:00Z', 'Dispatched', 'Montreal consolidation hub', 'Awaiting air freight slot.'),
  (8105, 7004, '2026-05-20T13:00:00Z', 'Delivered', 'Derby receiving bay 4', 'Shock sensor clean, humidity within tolerance.');

INSERT INTO equipment (equipment_id, equipment_name, equipment_type, facility, assigned_emp_id) VALUES
  (3001, 'Autoclave AC-17', 'Composite curing autoclave', 'Derby assembly plant', 204),
  (3002, 'CNC Cell M5', '5-axis machining cell', 'Derby assembly plant', 204),
  (3003, 'Container Tracker CT-44', 'Transit IoT tracker', 'Shipment 7002', 204),
  (3004, 'CMM Inspection Bench Q2', 'Dimensional inspection', 'Quality lab', 202);

INSERT INTO audit_logs (log_id, emp_id, action_type, entity_type, entity_id, action_timestamp, outcome, details) VALUES
  (1, 205, 'VIEW', 'Certification', 'CERT-2026-00003', '2026-05-21T09:40:00Z', 'Success', 'Auditor reviewed pending certification.'),
  (2, 202, 'CREATE', 'QCReport', 'QC-2026-00004', '2026-05-21T09:10:00Z', 'Success', 'Version 2 NDT report created after retest.');
