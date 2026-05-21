const collections = ["qc_reports", "certifications", "iot_sensor_logs", "compliance_flags", "counters"];

for (const name of collections) {
  if (!db.getCollectionNames().includes(name)) {
    db.createCollection(name);
  }
}

db.runCommand({
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

db.runCommand({
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

db.runCommand({
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

db.runCommand({
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

db.qc_reports.createIndex({ report_id: 1 }, { unique: true });
db.qc_reports.createIndex({ supplier_id: 1, part_id: 1, outcome: 1 });
db.certifications.createIndex({ cert_id: 1 }, { unique: true });
db.iot_sensor_logs.createIndex({ equipment_id: 1, timestamp: -1 });
db.compliance_flags.createIndex({ flag_id: 1 }, { unique: true });
db.compliance_flags.createIndex({ created_at: -1 });

print("AeroNetB MongoDB document collections, validators, and indexes are ready.");
