import { getDbMode, list } from "./db.js";

const collectionLabels = {
  suppliers: "Supplier",
  parts: "Part",
  purchase_orders: "Purchase Order",
  shipments: "Shipment",
  qc_reports: "QC Report",
  certifications: "Certification",
  iot_sensor_logs: "IoT Sensor Log",
  audit_logs: "Audit Log"
};

function mapBy(items, key) {
  return new Map(items.map((item) => [item[key], item]));
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function latestBy(items, groupKey, timestampKey) {
  const grouped = new Map();
  for (const item of items) {
    const key = item[groupKey];
    const current = grouped.get(key);
    if (!current || String(item[timestampKey]) > String(current[timestampKey])) {
      grouped.set(key, item);
    }
  }
  return grouped;
}

export function computeIotStatus(readings = {}) {
  const temperature = Number(readings.temperature_c ?? 0);
  const vibration = Number(readings.vibration_mm_s ?? 0);
  const pressure = Number(readings.pressure_bar ?? 0);
  const drift = Number(readings.calibration_drift_um ?? 0);

  if (temperature >= 85 || vibration >= 4.5 || pressure >= 7 || drift >= 5) {
    return "Critical";
  }
  if (temperature >= 78 || vibration >= 2.8 || pressure >= 5.5 || drift >= 3) {
    return "Warning";
  }
  return "OK";
}

export async function buildReferenceData() {
  const [
    suppliers,
    parts,
    supplierParts,
    orders,
    orderLines,
    shipments,
    shipmentEvents,
    employees,
    equipment,
    qcReports,
    certifications,
    iotLogs,
    complianceFlags,
    auditLogs
  ] = await Promise.all([
    list("suppliers", {}, { sort: { business_name: 1 } }),
    list("parts", {}, { sort: { part_name: 1 } }),
    list("supplier_parts", {}, { sort: { supplier_part_id: 1 } }),
    list("purchase_orders", {}, { sort: { order_id: -1 } }),
    list("purchase_order_lines", {}, { sort: { order_line_id: 1 } }),
    list("shipments", {}, { sort: { shipment_id: -1 } }),
    list("shipment_events", {}, { sort: { event_timestamp: -1 } }),
    list("employees", {}, { sort: { emp_id: 1 } }),
    list("equipment", {}, { sort: { equipment_id: 1 } }),
    list("qc_reports", {}, { sort: { created_at: -1 } }),
    list("certifications", {}, { sort: { certification_date: -1 } }),
    list("iot_sensor_logs", {}, { sort: { timestamp: -1 } }),
    list("compliance_flags", {}, { sort: { created_at: -1 } }),
    list("audit_logs", {}, { sort: { action_timestamp: -1 }, limit: 100 })
  ]);

  return {
    suppliers,
    parts,
    supplierParts,
    orders,
    orderLines,
    shipments,
    shipmentEvents,
    employees,
    equipment,
    qcReports,
    certifications,
    iotLogs,
    complianceFlags,
    auditLogs,
    supplierById: mapBy(suppliers, "supplier_id"),
    partById: mapBy(parts, "part_id"),
    employeeById: mapBy(employees, "emp_id"),
    orderById: mapBy(orders, "order_id"),
    equipmentById: mapBy(equipment, "equipment_id")
  };
}

export function enrichOrdersFromReference(ref) {
  return ref.orders.map((order) => {
    const lines = ref.orderLines
      .filter((line) => line.order_id === order.order_id)
      .map((line) => ({
        ...line,
        part: ref.partById.get(line.part_id) || null
      }));

    return {
      ...order,
      supplier: ref.supplierById.get(order.supplier_id) || null,
      lines,
      total_quantity: lines.reduce((total, line) => total + Number(line.quantity || 0), 0)
    };
  });
}

export function enrichShipmentsFromReference(ref) {
  const eventsByShipment = new Map();
  for (const event of ref.shipmentEvents) {
    const events = eventsByShipment.get(event.shipment_id) || [];
    events.push(event);
    eventsByShipment.set(event.shipment_id, events);
  }

  return ref.shipments.map((shipment) => {
    const order = ref.orderById.get(shipment.order_id) || null;
    const events = eventsByShipment.get(shipment.shipment_id) || [];
    const latestEvent = events[0] || null;

    return {
      ...shipment,
      order,
      supplier: order ? ref.supplierById.get(order.supplier_id) || null : null,
      latest_event: latestEvent,
      events
    };
  });
}

export function enrichQcReportsFromReference(ref) {
  return ref.qcReports.map((report) => ({
    ...report,
    supplier: ref.supplierById.get(report.supplier_id) || null,
    part: ref.partById.get(report.part_id) || null,
    inspector: ref.employeeById.get(report.inspector_emp_id) || null
  }));
}

export function enrichCertificationsFromReference(ref) {
  return ref.certifications.map((certification) => ({
    ...certification,
    supplier: ref.supplierById.get(certification.supplier_id) || null,
    part: ref.partById.get(certification.part_id) || null,
    inspector: ref.employeeById.get(certification.inspector_emp_id) || null,
    approved_by: ref.employeeById.get(certification.approved_by_emp_id) || null
  }));
}

export function enrichIotFromReference(ref) {
  return ref.iotLogs.map((log) => ({
    ...log,
    equipment: ref.equipmentById.get(log.equipment_id) || null,
    status: computeIotStatus(log.readings)
  }));
}

export async function buildDashboard() {
  const ref = await buildReferenceData();
  const orders = enrichOrdersFromReference(ref);
  const shipments = enrichShipmentsFromReference(ref);
  const qcReports = enrichQcReportsFromReference(ref);
  const certifications = enrichCertificationsFromReference(ref);
  const latestIot = latestBy(ref.iotLogs, "equipment_id", "timestamp");
  const today = todayIso();

  const delayedOrders = orders.filter((order) => {
    return !["completed", "delivered"].includes(order.status) && order.desired_delivery_date < today;
  });

  const failedQc = qcReports.filter((report) => report.outcome === "FAIL");
  const pendingCertifications = certifications.filter((certification) => !certification.is_immutable);

  const supplierPerformance = ref.suppliers.map((supplier) => {
    const supplierOrders = orders.filter((order) => order.supplier_id === supplier.supplier_id);
    const deliveredOrders = supplierOrders.filter((order) => order.actual_delivery_date);
    const onTimeOrders = deliveredOrders.filter((order) => order.actual_delivery_date <= order.desired_delivery_date);
    const supplierQc = qcReports.filter((report) => report.supplier_id === supplier.supplier_id);
    const supplierFails = supplierQc.filter((report) => report.outcome === "FAIL");

    return {
      supplier_id: supplier.supplier_id,
      business_name: supplier.business_name,
      orders: supplierOrders.length,
      delivered: deliveredOrders.length,
      on_time_rate: deliveredOrders.length ? Math.round((onTimeOrders.length / deliveredOrders.length) * 100) : 0,
      defect_rate: supplierQc.length ? Math.round((supplierFails.length / supplierQc.length) * 100) : 0
    };
  });

  const qcByOutcome = qcReports.reduce((summary, report) => {
    summary[report.outcome] = (summary[report.outcome] || 0) + 1;
    return summary;
  }, {});

  const qcByType = qcReports.reduce((summary, report) => {
    summary[report.report_type] = (summary[report.report_type] || 0) + 1;
    return summary;
  }, {});

  const iotStatus = ref.equipment.map((equipment) => {
    const latestLog = latestIot.get(equipment.equipment_id) || null;
    return {
      ...equipment,
      latest_log: latestLog,
      status: latestLog ? computeIotStatus(latestLog.readings) : "No Data"
    };
  });

  const criticalIot = iotStatus.filter((item) => ["Warning", "Critical"].includes(item.status));

  const alerts = [
    ...delayedOrders.map((order) => ({
      severity: "High",
      type: "Delayed order",
      message: `Order ${order.order_id} from ${order.supplier?.business_name || "unknown supplier"} is past desired delivery.`
    })),
    ...failedQc.slice(0, 4).map((report) => ({
      severity: "High",
      type: "QC failure",
      message: `${report.report_id} failed for ${report.part?.part_name || "part"} from ${report.supplier?.business_name || "supplier"}.`
    })),
    ...criticalIot.map((equipment) => ({
      severity: equipment.status === "Critical" ? "High" : "Medium",
      type: "IoT threshold",
      message: `${equipment.equipment_name} is ${equipment.status.toLowerCase()} based on latest sensor reading.`
    })),
    ...pendingCertifications.map((certification) => ({
      severity: "Medium",
      type: "Certification pending",
      message: `${certification.cert_id} is not immutable yet.`
    }))
  ];

  return {
    generated_at: new Date().toISOString(),
    database_mode: getDbMode(),
    metrics: {
      suppliers: ref.suppliers.length,
      open_orders: orders.filter((order) => !["completed", "delivered"].includes(order.status)).length,
      delayed_orders: delayedOrders.length,
      failed_qc_reports: failedQc.length,
      pending_certifications: pendingCertifications.length,
      iot_warnings: criticalIot.length
    },
    supplierPerformance,
    shipments: shipments.slice(0, 8),
    qcSummary: {
      by_outcome: qcByOutcome,
      by_type: qcByType
    },
    iotStatus,
    alerts,
    compliance_flags: ref.complianceFlags
  };
}

export function toCsv(collectionName, records) {
  if (!records.length) {
    return "";
  }

  const headers = Object.keys(records[0]).filter((key) => typeof records[0][key] !== "object");
  const lines = [headers.join(",")];

  for (const record of records) {
    lines.push(
      headers
        .map((header) => {
          const value = String(record[header] ?? "");
          return `"${value.replaceAll('"', '""')}"`;
        })
        .join(",")
    );
  }

  const label = collectionLabels[collectionName] || collectionName;
  return `# ${label} export\n${lines.join("\n")}\n`;
}
