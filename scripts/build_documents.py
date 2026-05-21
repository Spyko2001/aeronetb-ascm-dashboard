from __future__ import annotations

import html
import os
import struct
from datetime import datetime, timezone
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
ASSETS = DOCS / "assets"

EMU_PER_INCH = 914400
MAX_IMAGE_WIDTH_EMU = int(6.4 * EMU_PER_INCH)


def png_size(path: Path) -> tuple[int, int]:
    with path.open("rb") as handle:
        sig = handle.read(8)
        if sig != b"\x89PNG\r\n\x1a\n":
            raise ValueError(f"{path} is not a PNG")
        length = struct.unpack(">I", handle.read(4))[0]
        chunk_type = handle.read(4)
        if chunk_type != b"IHDR" or length < 8:
            raise ValueError(f"{path} has no IHDR")
        width, height = struct.unpack(">II", handle.read(8))
        return width, height


def esc(value: object) -> str:
    return html.escape(str(value), quote=True)


def paragraph(text: str = "", style: str | None = None, bold: bool = False) -> str:
    p_style = f'<w:pPr><w:pStyle w:val="{style}"/></w:pPr>' if style else ""
    r_pr = "<w:rPr><w:b/></w:rPr>" if bold else ""
    return f"<w:p>{p_style}<w:r>{r_pr}<w:t xml:space=\"preserve\">{esc(text)}</w:t></w:r></w:p>"


def heading(text: str, level: int = 1) -> str:
    return paragraph(text, f"Heading{min(max(level, 1), 3)}")


def bullet(text: str) -> str:
    return (
        '<w:p><w:pPr><w:pStyle w:val="BodyText"/>'
        '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr>'
        f'<w:r><w:t xml:space="preserve">{esc(text)}</w:t></w:r></w:p>'
    )


def page_break() -> str:
    return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'


def table(rows: list[list[str]]) -> str:
    column_count = max(len(row) for row in rows)
    table_width = 9638
    column_width = table_width // column_count
    grid = "".join(f'<w:gridCol w:w="{column_width}"/>' for _ in range(column_count))
    body = [
        f'<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="{table_width}" w:type="dxa"/>'
        '<w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="D7DDE5"/>'
        '<w:left w:val="single" w:sz="4" w:space="0" w:color="D7DDE5"/>'
        '<w:bottom w:val="single" w:sz="4" w:space="0" w:color="D7DDE5"/>'
        '<w:right w:val="single" w:sz="4" w:space="0" w:color="D7DDE5"/>'
        '<w:insideH w:val="single" w:sz="4" w:space="0" w:color="D7DDE5"/>'
        f'<w:insideV w:val="single" w:sz="4" w:space="0" w:color="D7DDE5"/></w:tblBorders></w:tblPr><w:tblGrid>{grid}</w:tblGrid>'
    ]
    for row_index, row in enumerate(rows):
        body.append("<w:tr>")
        for cell in row + [""] * (column_count - len(row)):
            shade = '<w:shd w:fill="EEF2F6"/>' if row_index == 0 else ""
            body.append(f'<w:tc><w:tcPr><w:tcW w:w="{column_width}" w:type="dxa"/>{shade}</w:tcPr>{paragraph(cell, bold=row_index == 0)}</w:tc>')
        body.append("</w:tr>")
    body.append("</w:tbl>")
    return "".join(body)


def image_block(rel_id: str, image_name: str, image_path: Path, caption: str, doc_pr_id: int) -> str:
    width_px, height_px = png_size(image_path)
    width_emu = width_px * 9525
    height_emu = height_px * 9525
    if width_emu > MAX_IMAGE_WIDTH_EMU:
        ratio = MAX_IMAGE_WIDTH_EMU / width_emu
        width_emu = MAX_IMAGE_WIDTH_EMU
        height_emu = int(height_emu * ratio)

    return f"""
<w:p>
  <w:pPr><w:jc w:val="center"/></w:pPr>
  <w:r>
    <w:drawing>
      <wp:inline distT="0" distB="0" distL="0" distR="0">
        <wp:extent cx="{width_emu}" cy="{height_emu}"/>
        <wp:effectExtent l="0" t="0" r="0" b="0"/>
        <wp:docPr id="{doc_pr_id}" name="{esc(image_name)}"/>
        <wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>
        <a:graphic>
          <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
            <pic:pic>
              <pic:nvPicPr><pic:cNvPr id="{doc_pr_id}" name="{esc(image_name)}"/><pic:cNvPicPr/></pic:nvPicPr>
              <pic:blipFill><a:blip r:embed="{rel_id}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>
              <pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="{width_emu}" cy="{height_emu}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>
            </pic:pic>
          </a:graphicData>
        </a:graphic>
      </wp:inline>
    </w:drawing>
  </w:r>
</w:p>
{paragraph(caption, style="Caption")}
"""


def styles_xml() -> str:
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="24"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:before="360" w:after="160"/></w:pPr><w:rPr><w:b/><w:sz w:val="32"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:before="300" w:after="120"/></w:pPr><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:before="220" w:after="100"/></w:pPr><w:rPr><w:b/><w:sz w:val="25"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Caption"><w:name w:val="caption"/><w:basedOn w:val="Normal"/><w:pPr><w:jc w:val="center"/><w:spacing w:after="160"/></w:pPr><w:rPr><w:i/><w:sz w:val="20"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="BodyText"><w:name w:val="Body Text"/><w:basedOn w:val="Normal"/></w:style>
  <w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/><w:basedOn w:val="TableNormal"/><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4" w:color="D7DDE5"/><w:left w:val="single" w:sz="4" w:color="D7DDE5"/><w:bottom w:val="single" w:sz="4" w:color="D7DDE5"/><w:right w:val="single" w:sz="4" w:color="D7DDE5"/><w:insideH w:val="single" w:sz="4" w:color="D7DDE5"/><w:insideV w:val="single" w:sz="4" w:color="D7DDE5"/></w:tblBorders></w:tblPr></w:style>
</w:styles>"""


def numbering_xml() -> str:
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum>
  <w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
</w:numbering>"""


def document_xml(body: str) -> str:
    return f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
  <w:body>
    {body}
    <w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>
  </w:body>
</w:document>"""


def content_types(image_count: int) -> str:
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>"""


def root_rels() -> str:
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>"""


def document_rels(images: list[tuple[str, str]]) -> str:
    rels = [
        '<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>',
        '<Relationship Id="rIdNumbering" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>',
    ]
    for rel_id, target in images:
        rels.append(f'<Relationship Id="{rel_id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="{target}"/>')
    return f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">{''.join(rels)}</Relationships>"""


def core_xml(title: str) -> str:
    now = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    return f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>{esc(title)}</dc:title><dc:creator>Spyros Kokkoris</dc:creator><cp:lastModifiedBy>Spyros Kokkoris</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">{now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">{now}</dcterms:modified>
</cp:coreProperties>"""


def app_xml() -> str:
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>LibreOffice-ready OOXML</Application></Properties>"""


def build_docx(path: Path, title: str, elements: list[tuple[str, object]]) -> None:
    image_rels: list[tuple[str, str]] = []
    media_files: list[tuple[Path, str]] = []
    body_parts: list[str] = []
    image_index = 1
    doc_pr_id = 1

    for kind, value in elements:
        if kind == "p":
            body_parts.append(paragraph(str(value)))
        elif kind == "h1":
            body_parts.append(heading(str(value), 1))
        elif kind == "h2":
            body_parts.append(heading(str(value), 2))
        elif kind == "h3":
            body_parts.append(heading(str(value), 3))
        elif kind == "bullet":
            body_parts.append(bullet(str(value)))
        elif kind == "table":
            body_parts.append(table(value))  # type: ignore[arg-type]
        elif kind == "break":
            body_parts.append(page_break())
        elif kind == "image":
            image_path, caption = value  # type: ignore[misc]
            rel_id = f"rIdImage{image_index}"
            image_name = f"image{image_index}.png"
            image_target = f"media/{image_name}"
            image_rels.append((rel_id, image_target))
            media_files.append((image_path, image_name))
            body_parts.append(image_block(rel_id, image_name, image_path, caption, doc_pr_id))
            image_index += 1
            doc_pr_id += 1
        else:
            raise ValueError(f"unknown element kind: {kind}")

    with ZipFile(path, "w", ZIP_DEFLATED) as docx:
        docx.writestr("[Content_Types].xml", content_types(len(media_files)))
        docx.writestr("_rels/.rels", root_rels())
        docx.writestr("docProps/core.xml", core_xml(title))
        docx.writestr("docProps/app.xml", app_xml())
        docx.writestr("word/document.xml", document_xml("".join(body_parts)))
        docx.writestr("word/_rels/document.xml.rels", document_rels(image_rels))
        docx.writestr("word/styles.xml", styles_xml())
        docx.writestr("word/numbering.xml", numbering_xml())
        for source, image_name in media_files:
            docx.write(source, f"word/media/{image_name}")


def ddd_elements() -> list[tuple[str, object]]:
    return [
        ("h1", "AeroNetB Aerospace Supply Chain Management"),
        ("h2", "Database Design Document"),
        ("table", [["Field", "Value"], ["Module", "5CM506 Data Driven Systems"], ["Student Name", "Spyros Kokkoris"], ["Student ID", "100774175"], ["Submission Date", "May 2026"]]),
        ("break", ""),
        ("h1", "1. Introduction"),
        ("p", "AeroNetB Aerospace manufactures critical commercial aircraft components including fuselage sections and wing assemblies. The company relies on a global supplier network where each supplier may provide the same baseline part with different supplier-specific customisations, inspection evidence, shipment events, and certification records."),
        ("p", "The system replaces fragmented spreadsheets, legacy databases, and manual logs with one data-driven platform for supplier management, order tracking, shipment monitoring, QC reporting, certification control, IoT telemetry, role-based access, and audit logging."),
        ("h2", "1.1 System Objectives"),
        ("table", [["Objective", "Description"], ["O1", "Maintain central supplier, part, and order records with relational integrity."], ["O2", "Model supplier-specific part variability without duplicating baseline part data."], ["O3", "Store flexible QC reports, certification payloads, and IoT readings in document collections."], ["O4", "Enforce RBAC and audit logging across the API and dashboard."], ["O5", "Provide a live Render-hosted dashboard backed by PostgreSQL and MongoDB."]]),
        ("h1", "2. Requirements Analysis"),
        ("table", [["Requirement", "Description"], ["Supplier and part management", "Suppliers have accreditation and contact information. Parts have baseline specifications. Supplier-part offerings store supplier part codes and customisation notes."], ["Orders and shipments", "Purchase orders track status from placed to completed. Shipments store tracking numbers, ETA, ports of entry, and event updates."], ["Quality control", "QC reports vary by inspection type. Reports are versioned and linked to supplier, part, order, and inspector identifiers."], ["Certification", "Certification documents contain test results, batch origin, digital signature, and approval metadata. Approved records become immutable."], ["IoT monitoring", "Equipment and transit devices produce timestamped sensor readings including temperature, vibration, pressure, and GPS data."], ["RBAC and audit", "Users authenticate by auth ID. Permissions control read, write, approve, export, and audit actions. Important actions are logged with emp_id."]]),
        ("h1", "3. Conceptual Design"),
        ("p", "The conceptual model is technology-agnostic. It identifies the main business entities, attributes, and relationships. Dashed entities in the figure represent document-style domains linked through shared identifiers."),
        ("image", (ASSETS / "conceptual-er.png", "Figure 1 - Conceptual ER Model for AeroNetB ASCM")),
        ("h2", "3.1 Key Modelling Choices"),
        ("table", [["Choice", "Justification"], ["Separate Part from Supplier_Part", "The same baseline aerospace part can be sourced from multiple suppliers, but each supplier can add different features."], ["Use Shipment_Event", "Shipment location and condition updates are repeated over time, so they belong in a separate event entity."], ["Use Employee, Role, Permission, and Audit_Log", "The scenario requires every important action to be controlled by role and attributable to emp_id."], ["Use MongoDB for QC, certification, and IoT payloads", "These domains contain flexible nested fields, varying measurement structures, and high-volume telemetry."]]),
        ("h1", "4. Logical Design"),
        ("h2", "4.1 Relational Logical Model"),
        ("p", "The relational model is implemented in PostgreSQL. It stores structured master data, transaction data, identity data, role data, equipment records, and audit events."),
        ("image", (ASSETS / "relational-schema.png", "Figure 2 - PostgreSQL Relational Logical Model")),
        ("h2", "4.2 Document Logical Model"),
        ("p", "MongoDB stores flexible document data that changes shape or grows continuously. Documents retain shared IDs from PostgreSQL so the API can join data for dashboard responses."),
        ("image", (ASSETS / "mongodb-document-model.png", "Figure 3 - MongoDB Document Logical Model")),
        ("h2", "4.3 Cross-Database Consistency"),
        ("p", "PostgreSQL is the authoritative source for stable identifiers and relational integrity. MongoDB documents store those identifiers as logical references. The API checks relational records before creating QC reports, certifications, or IoT logs. Certification immutability and QC versioning are enforced in the backend service."),
        ("h1", "5. Conclusion"),
        ("p", "The final design satisfies the AeroNetB scenario by combining a normalised PostgreSQL schema with flexible MongoDB document collections. The model supports supplier-part variability, order and shipment lifecycle tracking, quality reporting, certification traceability, IoT monitoring, RBAC, and audit logging."),
        ("h1", "References"),
        ("p", "Connolly, T. and Begg, C. (2015) Database Systems: A Practical Approach to Design, Implementation and Management. 6th edn. Harlow: Pearson."),
        ("p", "Fowler, M. and Sadalage, P.J. (2012) NoSQL Distilled: A Brief Guide to the Emerging World of Polyglot Persistence. Addison-Wesley."),
        ("p", "MongoDB, Inc. (2024) MongoDB Documentation. Available at: https://www.mongodb.com/docs/"),
        ("p", "PostgreSQL Global Development Group (2024) PostgreSQL Documentation. Available at: https://www.postgresql.org/docs/"),
        ("p", "Sandhu, R., Ferraiolo, D. and Kuhn, R. (2000) The NIST Model for Role-Based Access Control."),
    ]


def logbook_elements() -> list[tuple[str, object]]:
    return [
        ("h1", "AeroNetB ASCM Implementation Logbook"),
        ("h2", "5CM506 Data Driven Systems - D-II"),
        ("table", [["Field", "Value"], ["Student Name", "Spyros Kokkoris"], ["Student ID", "100774175"], ["System", "AeroNetB Aerospace Supply Chain Management Dashboard"], ["Deployment Mode", "Cloud deployment through Render Blueprint, with local fallback for testing"]]),
        ("h1", "1. Implementation Details"),
        ("table", [["Layer", "Technology", "Purpose"], ["Frontend", "HTML, CSS, JavaScript", "Role-based dashboard with charts, search, forms, and CSV export."], ["Backend", "Node.js HTTP API", "Authentication, RBAC, validation, cross-database responses, and audit logging."], ["Relational DB", "PostgreSQL on Render", "Suppliers, parts, orders, shipments, employees, roles, equipment, and audit logs."], ["Document DB", "MongoDB Atlas", "QC reports, certifications, IoT sensor logs, and compliance flags."], ["Deployment", "Render Blueprint", "Web service plus PostgreSQL database from render.yaml."]]),
        ("h2", "1.1 Access Instructions"),
        ("table", [["Item", "Value"], ["GitHub repository", "https://github.com/Spyko2001/aeronetb-ascm-dashboard"], ["Live Render app URL", "https://aeronetb-ascm-dashboard.onrender.com"], ["Live health endpoint", "https://aeronetb-ascm-dashboard.onrender.com/api/health"], ["Verified database mode", "PostgreSQL + MongoDB, database_warning: null"], ["PostgreSQL connection", "Managed by Render through DATABASE_URL; private value is not included."], ["MongoDB connection", "Managed by Render through MONGODB_URI; private value is not included."]]),
        ("h2", "1.2 Demo Accounts"),
        ("table", [["Role", "Auth ID", "Password"], ["Procurement Officer", "priya.procurement", "demo123"], ["Quality Inspector", "lena.inspector", "demo123"], ["Supply Chain Manager", "marcus.manager", "demo123"], ["Equipment Engineer", "irene.engineer", "demo123"], ["Auditor / Regulator", "omar.auditor", "demo123"]]),
        ("h1", "2. Refined Logical Models"),
        ("p", "The first-semester design was refined into a deployable hybrid model. PostgreSQL stores stable structured domains, while MongoDB stores flexible document domains. The backend validates cross-database references and combines records for the dashboard."),
        ("image", (ASSETS / "relational-schema.png", "Figure 1 - Refined PostgreSQL relational schema")),
        ("image", (ASSETS / "mongodb-document-model.png", "Figure 2 - Refined MongoDB document model")),
        ("h2", "2.1 Refinements From Task 1"),
        ("table", [["Refinement", "Implementation"], ["Explicit RBAC model", "Added roles, permissions, role_permissions, and employee_roles tables, with backend permission checks."], ["Versioned QC reports", "New QC submissions create a new MongoDB document version instead of overwriting previous results."], ["Immutable certifications", "Approved certifications have is_immutable=true and later updates return HTTP 409."], ["Audit coverage", "Login, view, create, update, approve, export, and flag actions create audit entries with emp_id."], ["Deployment readiness", "Render Blueprint, environment variables, automatic schema creation, automatic seeding, and local fallback."]]),
        ("h1", "3. Database Implementation"),
        ("table", [["Evidence File", "Description"], ["sql_scripts/ddl.sql", "PostgreSQL table definitions, keys, constraints, and indexes."], ["sql_scripts/dml.sql", "Dummy relational data for suppliers, parts, orders, shipments, employees, roles, profiles, equipment, and audit logs."], ["mongo_scripts/collections.js", "MongoDB collection creation, JSON Schema validators, and indexes."], ["backend/src/seed-data.js", "Runtime seed records used by the Node application for PostgreSQL and MongoDB bootstrap."]]),
        ("h1", "4. API Design and Development"),
        ("table", [["Method", "Endpoint", "Description", "Data Source"], ["POST", "/api/auth/login", "Authenticates a seeded user and returns a signed token.", "PostgreSQL employees"], ["GET", "/api/dashboard", "Returns KPIs, alerts, supplier performance, QC summary, shipments, and IoT status.", "PostgreSQL + MongoDB"], ["GET/POST", "/api/suppliers", "Lists or creates suppliers.", "PostgreSQL"], ["GET/POST/PATCH", "/api/orders", "Lists, creates, or updates purchase orders.", "PostgreSQL"], ["GET/POST", "/api/qc-reports", "Lists reports or creates a new versioned QC report.", "MongoDB"], ["GET/POST/PATCH", "/api/certifications", "Lists, creates, or updates pending certifications.", "MongoDB"], ["GET/POST", "/api/iot", "Lists or submits telemetry readings.", "MongoDB"], ["GET", "/api/audit-logs", "Lists recent audit trail events.", "PostgreSQL"]]),
        ("h1", "5. Dashboard Evidence"),
        ("image", (ASSETS / "screenshot-overview.png", "Figure 3 - Supply Chain Manager overview dashboard with KPIs and charts")),
        ("image", (ASSETS / "screenshot-procurement.png", "Figure 4 - Procurement view for supplier and order workflow")),
        ("image", (ASSETS / "screenshot-quality.png", "Figure 5 - Quality view for QC report and certification workflow")),
        ("image", (ASSETS / "screenshot-equipment.png", "Figure 6 - Equipment engineer IoT monitoring view")),
        ("image", (ASSETS / "screenshot-compliance.png", "Figure 7 - Auditor compliance and certification review view")),
        ("image", (ASSETS / "screenshot-audit.png", "Figure 8 - Audit log with emp_id-attributed actions")),
        ("h1", "6. Security and Compliance"),
        ("table", [["Control", "Implementation"], ["Authentication", "Users log in with auth ID and password. Stored passwords are PBKDF2 hashes with salts."], ["Session protection", "The API issues signed HMAC session tokens with expiry."], ["RBAC", "Every protected endpoint checks permissions in the backend before reading or mutating data."], ["Auditor restriction", "The auditor can read compliance data and raise flags but cannot mutate suppliers, orders, QC reports, or certifications."], ["Certification immutability", "Approved certifications have is_immutable=true. Later update attempts return HTTP 409."], ["Audit trail", "Important actions write records with emp_id, action type, entity, timestamp, outcome, and details."]]),
        ("h1", "7. Testing and Validation"),
        ("table", [["Test", "Expected Result", "Status"], ["npm run check", "JavaScript syntax checks pass.", "Passed"], ["npm test", "Integration tests pass against a local seeded service.", "Passed"], ["Auditor creates supplier", "Rejected with HTTP 403.", "Passed"], ["QC report retest", "New report receives next version number.", "Passed"], ["Approved certification update", "Rejected with HTTP 409.", "Passed"], ["CSV export", "Manager can export audit logs.", "Passed"]]),
        ("h1", "8. Deployment Explanation"),
        ("p", "Render was chosen because it deploys the Node.js service directly from GitHub and creates a PostgreSQL database from the same Blueprint file. MongoDB Atlas stores flexible QC, certification, IoT, and compliance documents. The Render service uses environment variables for private connection strings."),
        ("h1", "9. Demo Flow"),
        ("bullet", "Open the Render URL and show /api/health."),
        ("bullet", "Log in as Supply Chain Manager and show KPIs, alerts, charts, search, and CSV export."),
        ("bullet", "Log in as Procurement Officer and create a supplier or order."),
        ("bullet", "Log in as Quality Inspector and create/approve QC and certification records."),
        ("bullet", "Show certification immutability and QC versioning."),
        ("bullet", "Log in as Equipment Engineer and add an IoT reading."),
        ("bullet", "Log in as Auditor and show read-only compliance plus compliance flag creation."),
        ("bullet", "Show audit logs proving actions are attributed to emp_id."),
    ]


def script_elements() -> list[tuple[str, object]]:
    sections = [
        ("Opening", "Hello, my name is Spyros Kokkoris, student ID 100774175. In this video I am presenting my 5CM506 Data Driven Systems implementation for the AeroNetB Aerospace Supply Chain Management scenario. The project continues the first-semester database design and turns it into a working cloud-hosted system with a web dashboard, backend APIs, PostgreSQL, and MongoDB."),
        ("Project Purpose", "AeroNetB manufactures aircraft components and depends on many specialised suppliers. The business problem is that supplier records, purchase orders, shipment updates, quality reports, certifications, and IoT logs are fragmented across different tools. My system brings these data areas together so the company can track orders, monitor supplier quality, inspect parts, lock certification records, and review audit trails from one dashboard."),
        ("Architecture", "The application uses a hybrid data architecture. PostgreSQL stores structured data such as suppliers, parts, supplier-part variants, purchase orders, shipments, users, roles, permissions, equipment, and audit logs. MongoDB stores flexible document data such as QC reports, certifications, IoT sensor readings, and compliance flags. This follows the polyglot persistence idea from the design document: stable relational data goes into a relational database, while variable JSON-style evidence goes into a document database."),
        ("Deployment", "The live application is deployed on Render at https://aeronetb-ascm-dashboard.onrender.com. The source code is public on GitHub at https://github.com/Spyko2001/aeronetb-ascm-dashboard. The Render health endpoint confirms that the live service is connected to both databases. During the demo, I show the endpoint /api/health returning database_mode as PostgreSQL plus MongoDB and database_warning as null."),
        ("Authentication And RBAC", "The application has five seeded demo users: procurement officer, quality inspector, supply chain manager, equipment engineer, and auditor. Each user logs in with an auth ID and the demo password demo123. Passwords are not stored as plain text in the runtime seed process; they are hashed using PBKDF2. After login, the server returns a signed session token. Every protected endpoint checks role permissions in the backend, not only in the interface."),
        ("Dashboard Overview", "I start the walkthrough as the supply chain manager. This overview shows KPI cards for suppliers, open orders, delayed orders, failed QC reports, pending certifications, and IoT warnings. It also shows supplier performance and QC outcome charts. The alerts panel highlights delayed orders, QC failures, pending certifications, and sensor warnings. The search box and export controls support the general dashboard features required by the assignment."),
        ("Procurement Workflow", "Next I log in as the procurement officer. This role can create supplier records and purchase orders. The procurement page shows supplier contact and accreditation data, then order data with supplier, part lines, desired delivery dates, actual delivery dates, and current status. This demonstrates that the dashboard is not static; it uses API-backed data and allows permitted users to create operational records."),
        ("Shipment Workflow", "The shipment view shows tracking numbers, linked orders, suppliers, port of entry, ETA, latest event location, and status. Shipment events are stored as separate records so multiple checkpoints and condition updates can be recorded over the shipment lifecycle. This supports the scenario requirement for real-time visibility across orders and shipments."),
        ("Quality Workflow", "Then I log in as the quality inspector. This role can create QC reports and certifications. QC reports are stored in MongoDB because their result data changes depending on the inspection type, for example visual, dimensional, NDT, or environmental testing. If a report is repeated for the same order, part, supplier, and report type, the system creates a new version instead of overwriting the old report. This preserves version history."),
        ("Certification Immutability", "The quality inspector can also create certifications and approve them. When a certification is approved, the system sets is_immutable to true and records approval metadata. Any later update attempt returns an error. This demonstrates the required immutability rule for approved certifications and digital signatures."),
        ("IoT Workflow", "Next I log in as the equipment engineer. This role sees equipment status and IoT telemetry. The IoT readings include values such as temperature, vibration, pressure, and GPS position. The system calculates warning or critical status from the latest readings, which supports the dashboard requirement for equipment monitoring and predictive maintenance alerts."),
        ("Auditor Workflow", "Finally I log in as the auditor. The auditor can review certification and compliance records but cannot modify core operational records. The auditor can raise a compliance flag if a record needs attention. This demonstrates read-only compliance access with a controlled exception for non-compliance flagging."),
        ("Audit Trail", "The audit log records important actions with employee ID, action type, entity type, entity ID, timestamp, outcome, and details. This is important because the scenario requires every access or modification to be attributable to the correct empId. I show audit records after logging in and performing actions across roles."),
        ("Source Code And Evidence", "The source code is organised into backend and frontend folders. The backend contains the API server, database layer, security logic, seed data, and domain aggregation code. The SQL scripts folder contains PostgreSQL DDL and DML evidence. The Mongo scripts folder contains collection setup, validators, and indexes. The documents include the database design document, implementation logbook, screenshots, and this presentation script."),
        ("Closing", "To conclude, the system demonstrates a working relational database, working MongoDB collections, API endpoints, role-based login, dashboard interaction, RBAC enforcement, audit logging, QC versioning, certification immutability, and cloud deployment on Render. This completes the second-semester implementation as a continuation of the first-semester design."),
    ]
    elements: list[tuple[str, object]] = [
        ("h1", "AeroNetB ASCM Video Presentation Script"),
        ("table", [["Field", "Value"], ["Student Name", "Spyros Kokkoris"], ["Student ID", "100774175"], ["Target Length", "Approximately 10 minutes"], ["Live App", "https://aeronetb-ascm-dashboard.onrender.com"]]),
    ]
    for title, text in sections:
        elements.append(("h2", title))
        elements.append(("p", text))
    return elements


def main() -> None:
    build_docx(DOCS / "100774175_DDD.docx", "100774175 DDD", ddd_elements())
    build_docx(DOCS / "100774175_Logbook.docx", "100774175 Logbook", logbook_elements())
    build_docx(DOCS / "100774175_videoDemo_script.docx", "100774175 Video Demo Script", script_elements())


if __name__ == "__main__":
    main()
