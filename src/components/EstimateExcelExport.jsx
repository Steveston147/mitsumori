import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import "./EstimateExcelExport.css";

const BACKUP_SCHEMA_VERSION = "mitsumori-estimate-v1";
const TRANSFER_SCHEMA_VERSION = "mitsumori-transfer-v2";
const JSON_CHUNK_SIZE = 28000;
const textEncoder = new TextEncoder();

function safeJsonParse(value, fallback = null) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function getFieldValue(control) {
  if (control.type === "checkbox") return control.checked ? "true" : "false";
  return control.value ?? "";
}

function getInputSection(control) {
  if (control.closest("[data-program-basic-info]")) return "共通情報";
  const modeRoot = control.closest("div[hidden]");
  return modeRoot?.querySelector(".mode-title")?.textContent?.trim() || "見積入力";
}

function collectInputs() {
  const rows = [];
  const seen = new Set();
  document.querySelectorAll("label").forEach((label, index) => {
    const control = label.parentElement?.querySelector("input, select, textarea");
    if (!control) return;
    const labelText = label.textContent.trim();
    const key = `${labelText}::${control.name || control.id || index}`;
    if (seen.has(key)) return;
    seen.add(key);
    rows.push({ section: getInputSection(control), label: labelText, value: getFieldValue(control), type: control.tagName.toLowerCase() });
  });
  return rows;
}

function collectTables() {
  const tables = [];
  document.querySelectorAll("table").forEach((table, index) => {
    if (table.closest(".print-summary")) return;
    const heading = table.closest(".col-12")?.querySelector("label")?.textContent?.trim() || `Table ${index + 1}`;
    const rows = Array.from(table.rows).map((row) => Array.from(row.cells).map((cell) => cell.textContent.replace(/\s+/g, " ").trim()));
    if (rows.length) tables.push({ heading, rows });
  });
  return tables;
}

function collectSummary() {
  const rows = [];
  document.querySelectorAll(".kpi .box").forEach((box) => {
    const label = box.querySelector(".title")?.textContent?.trim();
    const value = box.querySelector(".value")?.textContent?.trim();
    if (label) rows.push([label, value || ""]);
  });
  document.querySelectorAll("[data-build-up-summary] .visit-card-header").forEach((header) => {
    rows.push([header.querySelector("span")?.textContent?.trim() || "積み上げ合計", header.querySelector("strong")?.textContent?.trim() || ""]);
  });
  return rows;
}

function collectStorage() {
  const storage = {};
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key?.startsWith("mitsumori.")) continue;
    const rawValue = window.localStorage.getItem(key);
    storage[key] = safeJsonParse(rawValue, rawValue);
  }
  return storage;
}

function numberFromText(value) {
  const normalized = String(value ?? "").replace(/[￥¥円,\s]/g, "");
  const match = normalized.match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function findSummaryAmount(summary, patterns) {
  const row = summary.find(([label]) => patterns.some((pattern) => String(label).includes(pattern)));
  return row ? numberFromText(row[1]) : null;
}

function makeProjectId(programBasicInfo) {
  const existing = programBasicInfo.projectId || programBasicInfo.estimateId || programBasicInfo.programId;
  if (existing) return String(existing);
  const name = String(programBasicInfo.programName || "estimate").trim().toLowerCase().replace(/[^a-z0-9\u3040-\u30ff\u3400-\u9fff]+/g, "-").replace(/^-|-$/g, "");
  return `mitsumori-${name || "project"}`;
}

function buildTransferDataV2({ exportedAt, programBasicInfo, inputs, summary, tables, storage }) {
  const estimateStates = Object.entries(storage)
    .filter(([key]) => key.startsWith("mitsumori.estimateState."))
    .map(([key, value]) => ({ sectionId: key.replace("mitsumori.estimateState.", ""), data: value }));
  const participants = Number(programBasicInfo.participants || programBasicInfo.participantCount || programBasicInfo.numberOfParticipants) || findSummaryAmount(summary, ["参加人数", "人数"]);
  const totalAmount = findSummaryAmount(summary, ["総額", "合計", "見積額"]);
  const perPersonAmount = findSummaryAmount(summary, ["1人", "一人", "一名", "参加者単価"]);
  const methodText = `${storage["mitsumori.estimateMode"] || ""} ${inputs.map((item) => `${item.label}:${item.value}`).join(" ")}`;
  const estimateMethod = methodText.includes("積み上げ") || methodText.includes("build") ? "build-up" : methodText.includes("係数") || methodText.includes("factor") ? "factor" : "unknown";
  return {
    schemaVersion: TRANSFER_SCHEMA_VERSION,
    compatibility: { minimumReaderVersion: "1.0", calculationAuthority: "mitsumori" },
    source: { application: "mitsumori", exportFormat: "xlsx-transfer-data", exportedAt },
    project: {
      projectId: makeProjectId(programBasicInfo),
      programName: programBasicInfo.programName || "",
      clientName: programBasicInfo.clientName || programBasicInfo.universityName || programBasicInfo.organizationName || "",
      startDate: programBasicInfo.startDate || "",
      endDate: programBasicInfo.endDate || "",
      participants,
      basicInfo: programBasicInfo,
    },
    estimate: { method: estimateMethod, currency: "JPY", totalAmount, perPersonAmount, participants },
    costSections: estimateStates,
    presentation: { summary: summary.map(([label, value]) => ({ label, value })), inputs, tables },
    metadata: { createdAt: programBasicInfo.createdAt || exportedAt, updatedAt: exportedAt },
  };
}

function getBackupPayload() {
  const storage = collectStorage();
  const exportedAt = new Date().toISOString();
  const programBasicInfo = storage["mitsumori.programBasicInfo"] || {};
  const inputs = collectInputs();
  const summary = collectSummary();
  const tables = collectTables();
  const base = { exportedAt, programBasicInfo, inputs, summary, tables, storage };
  return { schemaVersion: BACKUP_SCHEMA_VERSION, ...base, transferDataV2: buildTransferDataV2(base) };
}

function splitText(text, size = JSON_CHUNK_SIZE) {
  const chunks = [];
  for (let offset = 0; offset < text.length; offset += size) chunks.push(text.slice(offset, offset + size));
  return chunks;
}

function xmlEscape(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function columnName(index) {
  let value = index + 1;
  let name = "";
  while (value > 0) { value -= 1; name = String.fromCharCode(65 + (value % 26)) + name; value = Math.floor(value / 26); }
  return name;
}

function worksheetXml(rows, widths) {
  const maxCols = Math.max(1, ...rows.map((row) => row.length));
  const cols = widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join("");
  const sheetRows = rows.map((row, rowIndex) => `<row r="${rowIndex + 1}">${row.map((value, colIndex) => `<c r="${columnName(colIndex)}${rowIndex + 1}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`).join("")}</row>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${columnName(maxCols - 1)}${Math.max(rows.length, 1)}"/><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols>${cols}</cols><sheetData>${sheetRows}</sheetData></worksheet>`;
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeUint16(target, offset, value) { target[offset] = value & 0xff; target[offset + 1] = (value >>> 8) & 0xff; }
function writeUint32(target, offset, value) { target[offset] = value & 0xff; target[offset + 1] = (value >>> 8) & 0xff; target[offset + 2] = (value >>> 16) & 0xff; target[offset + 3] = (value >>> 24) & 0xff; }
function concatBytes(parts) { const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0)); let offset = 0; parts.forEach((part) => { result.set(part, offset); offset += part.length; }); return result; }

function createZip(files) {
  const localParts = [];
  const centralParts = [];
  let localOffset = 0;
  files.forEach(({ name, content }) => {
    const nameBytes = textEncoder.encode(name);
    const dataBytes = typeof content === "string" ? textEncoder.encode(content) : content;
    const checksum = crc32(dataBytes);
    const localHeader = new Uint8Array(30 + nameBytes.length);
    writeUint32(localHeader, 0, 0x04034b50); writeUint16(localHeader, 4, 20); writeUint16(localHeader, 6, 0x0800); writeUint16(localHeader, 8, 0); writeUint32(localHeader, 14, checksum); writeUint32(localHeader, 18, dataBytes.length); writeUint32(localHeader, 22, dataBytes.length); writeUint16(localHeader, 26, nameBytes.length); localHeader.set(nameBytes, 30);
    localParts.push(localHeader, dataBytes);
    const centralHeader = new Uint8Array(46 + nameBytes.length);
    writeUint32(centralHeader, 0, 0x02014b50); writeUint16(centralHeader, 4, 20); writeUint16(centralHeader, 6, 20); writeUint16(centralHeader, 8, 0x0800); writeUint32(centralHeader, 16, checksum); writeUint32(centralHeader, 20, dataBytes.length); writeUint32(centralHeader, 24, dataBytes.length); writeUint16(centralHeader, 28, nameBytes.length); writeUint32(centralHeader, 42, localOffset); centralHeader.set(nameBytes, 46);
    centralParts.push(centralHeader); localOffset += localHeader.length + dataBytes.length;
  });
  const centralDirectory = concatBytes(centralParts);
  const endRecord = new Uint8Array(22);
  writeUint32(endRecord, 0, 0x06054b50); writeUint16(endRecord, 8, files.length); writeUint16(endRecord, 10, files.length); writeUint32(endRecord, 12, centralDirectory.length); writeUint32(endRecord, 16, localOffset);
  return concatBytes([...localParts, centralDirectory, endRecord]);
}

function buildXlsx(payload) {
  const summaryRows = [["項目", "内容"], ["スキーマ", payload.schemaVersion], ["連携スキーマ", payload.transferDataV2.schemaVersion], ["出力日時", payload.exportedAt], ...Object.entries(payload.programBasicInfo), ...payload.summary];
  const inputRows = [["区分", "項目", "値", "入力種別"], ...payload.inputs.map((item) => [item.section, item.label, item.value, item.type])];
  const calculationRows = [["表名", "列1", "列2", "列3", "列4", "列5"]];
  payload.tables.forEach((table) => { calculationRows.push([table.heading]); table.rows.forEach((values) => calculationRows.push(["", ...values.slice(0, 5)])); calculationRows.push([]); });
  const backupChunks = splitText(JSON.stringify(payload));
  const transferChunks = splitText(JSON.stringify(payload.transferDataV2));
  const transferRows = [
    ["アプリ間連携・バックアップ用データです。JSONチャンクを編集しないでください。"],
    ["schemaVersion", payload.schemaVersion], ["chunkCount", backupChunks.length],
    ...backupChunks.map((chunk, index) => [`payloadJson_${index + 1}`, chunk]),
    [], ["transferSchemaVersion", payload.transferDataV2.schemaVersion], ["transferChunkCount", transferChunks.length],
    ...transferChunks.map((chunk, index) => [`transferV2Json_${index + 1}`, chunk]),
  ];
  const sheets = [
    { name: "Summary", rows: summaryRows, widths: [30, 60] },
    { name: "Inputs", rows: inputRows, widths: [18, 38, 40, 14] },
    { name: "Calculation Tables", rows: calculationRows, widths: [34, 28, 28, 22, 22, 22] },
    { name: "TransferData", rows: transferRows, widths: [24, 120] },
  ];
  const workbookSheets = sheets.map((sheet, index) => `<sheet name="${xmlEscape(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("");
  const workbookRels = sheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("");
  const contentOverrides = sheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("");
  const files = [
    { name: "[Content_Types].xml", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${contentOverrides}</Types>` },
    { name: "_rels/.rels", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { name: "xl/workbook.xml", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${workbookSheets}</sheets></workbook>` },
    { name: "xl/_rels/workbook.xml.rels", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${workbookRels}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    { name: "xl/styles.xml", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="10"/><name val="Aptos"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>` },
    ...sheets.map((sheet, index) => ({ name: `xl/worksheets/sheet${index + 1}.xml`, content: worksheetXml(sheet.rows, sheet.widths) })),
  ];
  return createZip(files);
}

function makeFilename(payload) {
  const name = payload.programBasicInfo?.programName || "estimate";
  const safeName = String(name).replace(/[\\/:*?"<>|]/g, "_").trim() || "estimate";
  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15);
  return `${safeName}_${stamp}.xlsx`;
}

function downloadExcel() {
  const payload = getBackupPayload();
  const blob = new Blob([buildXlsx(payload)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = makeFilename(payload); document.body.appendChild(anchor); anchor.click(); anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function ExportPanel() {
  const [message, setMessage] = useState("");
  function handleExport() {
    try { downloadExcel(); setMessage("Excel（.xlsx）を出力しました。TransferData v2を含みます。"); }
    catch (error) { console.error(error); setMessage("Excel出力に失敗しました。入力内容を確認してください。"); }
    window.setTimeout(() => setMessage(""), 2500);
  }
  return <section className="estimate-export-panel no-print"><div><strong>Excelバックアップ／アプリ間連携</strong><p>共通情報、入力値、計算表、復元データ、別アプリ連携用TransferData v2を.xlsxに保存します。</p></div><button className="btn estimate-export-button" type="button" onClick={handleExport}>Excelにエクスポート</button>{message && <div className="estimate-export-message" role="status">{message}</div>}</section>;
}

export default function EstimateExcelExport() {
  const [target, setTarget] = useState(null);
  useEffect(() => {
    const container = document.querySelector(".container");
    const tabs = container?.querySelector(".mode-tabs");
    if (!container || !tabs) return;
    const mount = document.createElement("div");
    mount.setAttribute("data-estimate-excel-export", "");
    container.insertBefore(mount, tabs); setTarget(mount);
    return () => mount.remove();
  }, []);
  return target ? createPortal(<ExportPanel />, target) : null;
}
