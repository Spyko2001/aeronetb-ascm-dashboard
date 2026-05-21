export const seedData = {
  suppliers: [
    {
      supplier_id: 1,
      business_name: "Helios Aero Composites",
      address: "Bremen, Germany",
      contact_name: "Klara Weber",
      contact_email: "supply@helios-aero.example",
      contact_phone: "+49-421-555-0191",
      accreditation_status: "AS9100, ISO 9001"
    },
    {
      supplier_id: 2,
      business_name: "Aegean Precision Alloys",
      address: "Volos, Greece",
      contact_name: "Nikos Markou",
      contact_email: "orders@aegean-alloys.example",
      contact_phone: "+30-24210-55521",
      accreditation_status: "ISO 9001"
    },
    {
      supplier_id: 3,
      business_name: "NorthStar Avionics Materials",
      address: "Montreal, Canada",
      contact_name: "Maya Deschamps",
      contact_email: "quality@northstar-materials.example",
      contact_phone: "+1-514-555-0144",
      accreditation_status: "AS9100"
    },
    {
      supplier_id: 4,
      business_name: "Pacific AeroForge",
      address: "Jurong, Singapore",
      contact_name: "Lee Wei Chen",
      contact_email: "sales@pacific-aeroforge.example",
      contact_phone: "+65-5550-0188",
      accreditation_status: "Pending renewal"
    }
  ],
  parts: [
    {
      part_id: 101,
      part_name: "A320 fuselage panel",
      part_category: "Fuselage",
      description: "Composite panel for narrow-body aircraft fuselage sections.",
      spec_tensile_strength: 560,
      spec_fatigue_limit: 310,
      spec_process_details: "Autoclave cure, ultrasonic NDT, anti-corrosion finish"
    },
    {
      part_id: 102,
      part_name: "Wing rib assembly",
      part_category: "Wing assemblies",
      description: "Load-bearing rib assembly for mid-span wing sections.",
      spec_tensile_strength: 620,
      spec_fatigue_limit: 340,
      spec_process_details: "5-axis machining, anodized finish, dimensional CMM"
    },
    {
      part_id: 103,
      part_name: "Titanium fastener kit",
      part_category: "Fasteners",
      description: "High-strength titanium fasteners for structural joints.",
      spec_tensile_strength: 980,
      spec_fatigue_limit: 520,
      spec_process_details: "Heat treatment, thread rolling, batch hardness testing"
    },
    {
      part_id: 104,
      part_name: "Composite landing gear door",
      part_category: "Landing systems",
      description: "Lightweight composite door with embedded inspection points.",
      spec_tensile_strength: 540,
      spec_fatigue_limit: 295,
      spec_process_details: "Resin transfer moulding, surface finish inspection"
    },
    {
      part_id: 105,
      part_name: "Sensorized shipping container",
      part_category: "Transit equipment",
      description: "Reusable container with shock, temperature, GPS, and pressure sensors.",
      spec_tensile_strength: 240,
      spec_fatigue_limit: 150,
      spec_process_details: "Sensor calibration, seal verification, battery test"
    }
  ],
  supplier_parts: [
    {
      supplier_part_id: 1001,
      supplier_id: 1,
      part_id: 101,
      supplier_part_code: "HAC-FP-A320-RFID",
      customisation_notes: "Anti-corrosion coating and serialized RFID tags."
    },
    {
      supplier_part_id: 1002,
      supplier_id: 2,
      part_id: 101,
      supplier_part_code: "APA-FP-A320-HT",
      customisation_notes: "Optimized heat treatment for lighter panel weight."
    },
    {
      supplier_part_id: 1003,
      supplier_id: 2,
      part_id: 103,
      supplier_part_code: "APA-TI-FST-STD",
      customisation_notes: "Batch traceability certificate included."
    },
    {
      supplier_part_id: 1004,
      supplier_id: 3,
      part_id: 102,
      supplier_part_code: "NSM-WR-DT",
      customisation_notes: "Digital twin simulation package supplied with delivery."
    },
    {
      supplier_part_id: 1005,
      supplier_id: 4,
      part_id: 104,
      supplier_part_code: "PAF-LGD-SHOCK",
      customisation_notes: "Shock sensor packaging for long transit legs."
    },
    {
      supplier_part_id: 1006,
      supplier_id: 4,
      part_id: 105,
      supplier_part_code: "PAF-CON-IOT",
      customisation_notes: "Container firmware configured for AeroNetB telemetry."
    }
  ],
  employees: [
    {
      emp_id: 201,
      full_name: "Priya Raman",
      job_title: "Procurement Officer",
      department: "Procurement",
      email: "priya.raman@aeronetb.example",
      phone: "+44-20-5555-0101",
      access_level: "read/write",
      auth_id: "priya.procurement",
      role: "procurement_officer",
      demoPassword: "demo123",
      profile: {
        region_or_portfolio: "Europe composite suppliers",
        authorisation_limit: 250000
      }
    },
    {
      emp_id: 202,
      full_name: "Lena Ortiz",
      job_title: "Quality Inspector",
      department: "Quality",
      email: "lena.ortiz@aeronetb.example",
      phone: "+44-20-5555-0102",
      access_level: "read/write/approve",
      auth_id: "lena.inspector",
      role: "quality_inspector",
      demoPassword: "demo123",
      profile: {
        inspector_certification_ids: ["NDT-UK-411", "DIM-CMM-208"],
        inspection_specialisation: "NDT and dimensional analysis",
        digital_signature_stamp: "LORTIZ-QA-SIGN"
      }
    },
    {
      emp_id: 203,
      full_name: "Marcus Chen",
      job_title: "Supply Chain Manager",
      department: "Supply Chain",
      email: "marcus.chen@aeronetb.example",
      phone: "+44-20-5555-0103",
      access_level: "read/write/audit",
      auth_id: "marcus.manager",
      role: "supply_chain_manager",
      demoPassword: "demo123",
      profile: {
        assigned_product_lines: ["Fuselage", "Wing assemblies"],
        reporting_level: "Global manager",
        dashboard_kpi_preferences: ["on_time_delivery", "defect_rate", "delay_risk"]
      }
    },
    {
      emp_id: 204,
      full_name: "Irene Novak",
      job_title: "Equipment Engineer",
      department: "Engineering",
      email: "irene.novak@aeronetb.example",
      phone: "+44-20-5555-0104",
      access_level: "read/write",
      auth_id: "irene.engineer",
      role: "equipment_engineer",
      demoPassword: "demo123",
      profile: {
        engineering_license: "ENG-MAINT-778",
        assigned_facility: "Derby assembly plant",
        machine_groups_responsible: ["Autoclaves", "CNC cells", "Transit containers"]
      }
    },
    {
      emp_id: 205,
      full_name: "Omar Haddad",
      job_title: "Auditor / Regulator",
      department: "Compliance",
      email: "omar.haddad@aeronetb.example",
      phone: "+44-20-5555-0105",
      access_level: "read/audit",
      auth_id: "omar.auditor",
      role: "auditor_regulator",
      demoPassword: "demo123",
      profile: {
        agency_name: "Internal compliance office",
        accreditation_license_id: "AUD-2026-55",
        audit_scope: "Supplier certification and material traceability",
        read_only_flag: true
      }
    }
  ],
  purchase_orders: [
    {
      order_id: 5001,
      supplier_id: 1,
      order_date: "2026-04-15",
      desired_delivery_date: "2026-05-14",
      actual_delivery_date: "2026-05-13",
      status: "completed"
    },
    {
      order_id: 5002,
      supplier_id: 2,
      order_date: "2026-04-20",
      desired_delivery_date: "2026-05-19",
      actual_delivery_date: null,
      status: "dispatched"
    },
    {
      order_id: 5003,
      supplier_id: 3,
      order_date: "2026-05-01",
      desired_delivery_date: "2026-05-27",
      actual_delivery_date: null,
      status: "confirmed"
    },
    {
      order_id: 5004,
      supplier_id: 4,
      order_date: "2026-04-25",
      desired_delivery_date: "2026-05-21",
      actual_delivery_date: "2026-05-20",
      status: "delivered"
    },
    {
      order_id: 5005,
      supplier_id: 1,
      order_date: "2026-05-18",
      desired_delivery_date: "2026-06-10",
      actual_delivery_date: null,
      status: "placed"
    }
  ],
  purchase_order_lines: [
    { order_line_id: 9001, order_id: 5001, part_id: 101, supplier_part_id: 1001, quantity: 24 },
    { order_line_id: 9002, order_id: 5001, part_id: 103, supplier_part_id: 1003, quantity: 600 },
    { order_line_id: 9003, order_id: 5002, part_id: 101, supplier_part_id: 1002, quantity: 18 },
    { order_line_id: 9004, order_id: 5003, part_id: 102, supplier_part_id: 1004, quantity: 12 },
    { order_line_id: 9005, order_id: 5004, part_id: 104, supplier_part_id: 1005, quantity: 10 },
    { order_line_id: 9006, order_id: 5005, part_id: 101, supplier_part_id: 1001, quantity: 32 }
  ],
  shipments: [
    {
      shipment_id: 7001,
      order_id: 5001,
      tracking_number: "AER-DE-5001",
      port_of_entry: "Dover",
      shipment_status: "delivered",
      eta: "2026-05-13"
    },
    {
      shipment_id: 7002,
      order_id: 5002,
      tracking_number: "AER-GR-5002",
      port_of_entry: "Piraeus",
      shipment_status: "in_transit",
      eta: "2026-05-23"
    },
    {
      shipment_id: 7003,
      order_id: 5003,
      tracking_number: "AER-CA-5003",
      port_of_entry: "Liverpool",
      shipment_status: "preparing",
      eta: "2026-05-27"
    },
    {
      shipment_id: 7004,
      order_id: 5004,
      tracking_number: "AER-SG-5004",
      port_of_entry: "Felixstowe",
      shipment_status: "delivered",
      eta: "2026-05-20"
    }
  ],
  shipment_events: [
    {
      event_id: 8101,
      shipment_id: 7001,
      event_timestamp: "2026-05-13T09:10:00Z",
      event_type: "Delivered",
      location: "Derby assembly plant",
      condition_notes: "Container seal intact; temperature stable."
    },
    {
      event_id: 8102,
      shipment_id: 7002,
      event_timestamp: "2026-05-20T06:45:00Z",
      event_type: "Checkpoint",
      location: "Piraeus outbound terminal",
      condition_notes: "Shock sensor recorded warning during loading."
    },
    {
      event_id: 8103,
      shipment_id: 7002,
      event_timestamp: "2026-05-21T10:20:00Z",
      event_type: "ConditionUpdate",
      location: "Mediterranean sea lane",
      condition_notes: "Temperature 7.2C, vibration 2.9mm/s."
    },
    {
      event_id: 8104,
      shipment_id: 7003,
      event_timestamp: "2026-05-18T16:30:00Z",
      event_type: "Dispatched",
      location: "Montreal consolidation hub",
      condition_notes: "Awaiting air freight slot."
    },
    {
      event_id: 8105,
      shipment_id: 7004,
      event_timestamp: "2026-05-20T13:00:00Z",
      event_type: "Delivered",
      location: "Derby receiving bay 4",
      condition_notes: "Shock sensor clean, humidity within tolerance."
    }
  ],
  equipment: [
    {
      equipment_id: 3001,
      equipment_name: "Autoclave AC-17",
      equipment_type: "Composite curing autoclave",
      facility: "Derby assembly plant",
      assigned_emp_id: 204
    },
    {
      equipment_id: 3002,
      equipment_name: "CNC Cell M5",
      equipment_type: "5-axis machining cell",
      facility: "Derby assembly plant",
      assigned_emp_id: 204
    },
    {
      equipment_id: 3003,
      equipment_name: "Container Tracker CT-44",
      equipment_type: "Transit IoT tracker",
      facility: "Shipment 7002",
      assigned_emp_id: 204
    },
    {
      equipment_id: 3004,
      equipment_name: "CMM Inspection Bench Q2",
      equipment_type: "Dimensional inspection",
      facility: "Quality lab",
      assigned_emp_id: 202
    }
  ],
  qc_reports: [
    {
      report_id: "QC-2026-00001",
      order_id: 5001,
      part_id: 101,
      supplier_id: 1,
      inspector_emp_id: 202,
      report_type: "dimensional",
      inspection_date: "2026-05-13T11:00:00Z",
      outcome: "PASS",
      result_data: {
        measured_length_mm: 250.03,
        tolerance_ok: true,
        ndt_method: "ultrasonic",
        defects_found: false
      },
      version: 1,
      is_approved: true,
      created_at: "2026-05-13T11:20:00Z"
    },
    {
      report_id: "QC-2026-00002",
      order_id: 5001,
      part_id: 103,
      supplier_id: 2,
      inspector_emp_id: 202,
      report_type: "visual",
      inspection_date: "2026-05-13T14:00:00Z",
      outcome: "PASS",
      result_data: {
        sample_size: 80,
        surface_marks: 0,
        thread_damage: false
      },
      version: 1,
      is_approved: true,
      created_at: "2026-05-13T14:15:00Z"
    },
    {
      report_id: "QC-2026-00003",
      order_id: 5002,
      part_id: 101,
      supplier_id: 2,
      inspector_emp_id: 202,
      report_type: "ndt",
      inspection_date: "2026-05-20T09:30:00Z",
      outcome: "FAIL",
      result_data: {
        ndt_method: "ultrasonic",
        defects_found: true,
        failure_cause: "Possible delamination around panel edge"
      },
      version: 1,
      is_approved: false,
      created_at: "2026-05-20T10:00:00Z"
    },
    {
      report_id: "QC-2026-00004",
      order_id: 5002,
      part_id: 101,
      supplier_id: 2,
      inspector_emp_id: 202,
      report_type: "ndt",
      inspection_date: "2026-05-21T08:45:00Z",
      outcome: "FAIL",
      result_data: {
        ndt_method: "ultrasonic",
        defects_found: true,
        failure_cause: "Retest confirms edge delamination"
      },
      version: 2,
      is_approved: false,
      created_at: "2026-05-21T09:10:00Z"
    },
    {
      report_id: "QC-2026-00005",
      order_id: 5004,
      part_id: 104,
      supplier_id: 4,
      inspector_emp_id: 202,
      report_type: "environmental",
      inspection_date: "2026-05-20T15:20:00Z",
      outcome: "PASS",
      result_data: {
        thermal_cycle_count: 12,
        humidity_ok: true,
        stress_test: "PASS"
      },
      version: 1,
      is_approved: false,
      created_at: "2026-05-20T15:55:00Z"
    }
  ],
  certifications: [
    {
      cert_id: "CERT-2026-00001",
      part_id: 101,
      supplier_id: 1,
      inspector_emp_id: 202,
      certification_date: "2026-05-14",
      test_results: {
        tensile_test: "PASS",
        fatigue_test: "PASS",
        surface_finish: "PASS"
      },
      batch_origin: "Batch-HAC-2026-19",
      digital_signature: "SHA256:7f4a-demo-hac",
      is_immutable: true,
      approval_date: "2026-05-14T10:00:00Z",
      approved_by_emp_id: 202
    },
    {
      cert_id: "CERT-2026-00002",
      part_id: 103,
      supplier_id: 2,
      inspector_emp_id: 202,
      certification_date: "2026-05-14",
      test_results: {
        tensile_test: "PASS",
        hardness_test: "PASS",
        thread_gauge: "PASS"
      },
      batch_origin: "Batch-APA-2026-44",
      digital_signature: "SHA256:9ac1-demo-apa",
      is_immutable: true,
      approval_date: "2026-05-14T13:30:00Z",
      approved_by_emp_id: 202
    },
    {
      cert_id: "CERT-2026-00003",
      part_id: 104,
      supplier_id: 4,
      inspector_emp_id: 202,
      certification_date: "2026-05-20",
      test_results: {
        thermal_cycle: "PASS",
        stress_test: "PASS",
        seal_integrity: "PENDING"
      },
      batch_origin: "Batch-PAF-2026-21",
      digital_signature: "SHA256:pending",
      is_immutable: false,
      approval_date: null,
      approved_by_emp_id: null
    }
  ],
  iot_sensor_logs: [
    {
      log_id: "IOT-2026-00001",
      equipment_id: 3001,
      timestamp: "2026-05-21T06:00:00Z",
      readings: {
        temperature_c: 74.5,
        vibration_mm_s: 1.1,
        pressure_bar: 3.8,
        cycle_count: 1840
      }
    },
    {
      log_id: "IOT-2026-00002",
      equipment_id: 3001,
      timestamp: "2026-05-21T08:00:00Z",
      readings: {
        temperature_c: 78.2,
        vibration_mm_s: 1.4,
        pressure_bar: 4.1,
        cycle_count: 1842
      }
    },
    {
      log_id: "IOT-2026-00003",
      equipment_id: 3002,
      timestamp: "2026-05-21T07:30:00Z",
      readings: {
        temperature_c: 66.1,
        vibration_mm_s: 2.2,
        spindle_load_pct: 62
      }
    },
    {
      log_id: "IOT-2026-00004",
      equipment_id: 3002,
      timestamp: "2026-05-21T09:30:00Z",
      readings: {
        temperature_c: 69.4,
        vibration_mm_s: 2.7,
        spindle_load_pct: 71
      }
    },
    {
      log_id: "IOT-2026-00005",
      equipment_id: 3003,
      timestamp: "2026-05-21T10:20:00Z",
      readings: {
        temperature_c: 7.2,
        vibration_mm_s: 2.9,
        pressure_bar: 1.1,
        gps_position: {
          lat: 36.8,
          lon: 21.7
        }
      }
    },
    {
      log_id: "IOT-2026-00006",
      equipment_id: 3004,
      timestamp: "2026-05-21T09:00:00Z",
      readings: {
        temperature_c: 22.0,
        vibration_mm_s: 0.3,
        calibration_drift_um: 1.4
      }
    }
  ],
  compliance_flags: [
    {
      flag_id: 1,
      created_by_emp_id: 205,
      entity_type: "Certification",
      entity_id: "CERT-2026-00003",
      severity: "Medium",
      note: "Seal integrity is still pending before final approval.",
      created_at: "2026-05-21T09:45:00Z",
      status: "open"
    }
  ],
  audit_logs: [
    {
      log_id: 1,
      emp_id: 205,
      action_type: "VIEW",
      entity_type: "Certification",
      entity_id: "CERT-2026-00003",
      action_timestamp: "2026-05-21T09:40:00Z",
      outcome: "Success",
      details: "Auditor reviewed pending certification."
    },
    {
      log_id: 2,
      emp_id: 202,
      action_type: "CREATE",
      entity_type: "QCReport",
      entity_id: "QC-2026-00004",
      action_timestamp: "2026-05-21T09:10:00Z",
      outcome: "Success",
      details: "Version 2 NDT report created after retest."
    }
  ]
};

export const collections = Object.keys(seedData);
