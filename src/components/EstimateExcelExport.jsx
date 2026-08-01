import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import "./EstimateExcelExport.css";

const SCHEMA_VERSION = "mitsumori-estimate-v1";
const JSON_CHUNK_SIZE = 28000;
const textEncoder = new TextEncoder();
const SUBMISSION_CATEGORIES = [
  ["企業・施設訪問", "企業訪問の直接経費合計"],
  ["日本文化体験", "日本文化体験の直接経費合計"],
  ["日本語講座", "日本語講座合計"],
  ["学生共修・学内文化活動", "学生共修・学内文化活動合計"],
  ["共通経費", "共通経費合計"],
];

function safeJsonParse(value, fallback = null) {
  try { return value ? JSON.parse(value) : fallback; } catch { return fallback; }
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
    const raw = window.localStorage.getItem(key);
    storage[key] = safeJsonParse(raw, raw);
  }
  return storage;
}

function getBackupPayload() {
  const storage = collectStorage();
  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    programBasicInfo: storage["mitsumori.programBasicInfo"] || {},
    inputs: collectInputs(),
    summary: collectSummary(),
    tables: collectTables(),
    storage,
  };
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

function findTableValue(payload, targetLabel) {
  for (const table of payload.tables) {
    for (const row of table.rows) {
      if (row[0] === targetLabel) return row[row.length - 1] || "";
    }
  }
  return "";
}

function findSummaryValue(payload, targetLabel) {
  const row = payload.summary.find(([label]) => label === targetLabel);
  return row?.[1] || findTableValue(payload, targetLabel);
}

function formatDate(value) {
  if (!value) return "";
  const [year, month, day] = String(value).split("-");
  return year && month && day ? `${year}年${Number(month)}月${Number(day)}日` : value;
}

function buildSubmissionRows(payload) {
  const info = payload.programBasicInfo || {};
  const participants = [info.studentCount && `学生 ${info.studentCount}名`, info.escortCount && `引率 ${info.escortCount}名`].filter(Boolean).join("／");
  const period = [formatDate(info.startDate), formatDate(info.endDate)].filter(Boolean).join(" ～ ");
  const categoryRows = SUBMISSION_CATEGORIES.map(([label, source]) => [label, findTableValue(payload, source) || "¥0"]);
  const directCost = findTableValue(payload, "直接経費合計");
  const estimateTotal = findSummaryValue(payload, "売上高") || directCost || "¥0";
  return [
    ["御見積書", ""],
    ["提出先", info.universityName || ""],
    ["プログラム名称", info.programName || ""],
    ["実施期間", period],
    ["参加予定人数", participants],
    ["実施キャンパス", info.campus || ""],
    ["", ""],
    ["費用項目", "金額（税込）"],
    ...categoryRows,
    ["見積金額合計", estimateTotal],
    ["", ""],
    ["備考", "本見積は入力時点の条件に基づく概算です。実施内容・人数・手配条件の変更により金額が変動する場合があります。"],
    ["作成日", formatDate(new Date().toISOString().slice(0, 10))],
  ];
}

function submissionWorksheetXml(rows) {
  const rowXml = rows.map((row, index) => {
    const number = index + 1;
    const style = number === 1 ? 1 : number === 8 ? 2 : number === 14 ? 3 : number === 12 ? 4 : 0;
    const height = number === 1 ? 30 : number === 13 ? 34 : 20;
    const cells = row.map((value, colIndex) => `<c r="${columnName(colIndex)}${number}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`).join("");
    return `<row r="${number}" ht="${height}" customHeight="1">${cells}</row>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:B${rows.length}"/><sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="20"/><cols><col min="1" max="1" width="28" customWidth="1"/><col min="2" max="2" width="68" customWidth="1"/></cols><sheetData>${rowXml}</sheetData><mergeCells count="1"><mergeCell ref="A1:B1"/></mergeCells><pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.2" footer="0.2"/><pageSetup orientation="portrait" paperSize="9" fitToWidth="1" fitToHeight="1"/></worksheet>`;
}

function crc32(bytes) { let crc = 0xffffffff; for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); } return (crc ^ 0xffffffff) >>> 0; }
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
    const local = new Uint8Array(30 + nameBytes.length);
    writeUint32(local, 0, 0x04034b50); writeUint16(local, 4, 20); writeUint16(local, 6, 0x0800); writeUint32(local, 14, checksum); writeUint32(local, 18, dataBytes.length); writeUint32(local, 22, dataBytes.length); writeUint16(local, 26, nameBytes.length); local.set(nameBytes, 30);
    localParts.push(local, dataBytes);
    const central = new Uint8Array(46 + nameBytes.length);
    writeUint32(central, 0, 0x02014b50); writeUint16(central, 4, 20); writeUint16(central, 6, 20); writeUint16(central, 8, 0x0800); writeUint32(central, 16, checksum); writeUint32(central, 20, dataBytes.length); writeUint32(central, 24, dataBytes.length); writeUint16(central, 28, nameBytes.length); writeUint32(central, 42, localOffset); central.set(nameBytes, 46);
    centralParts.push(central);
    localOffset += local.length + dataBytes.length;
  });
  const directory = concatBytes(centralParts);
  const end = new Uint8Array(22);
  writeUint32(end, 0, 0x06054b50); writeUint16(end, 8, files.length); writeUint16(end, 10, files.length); writeUint32(end, 12, directory.length); writeUint32(end, 16, localOffset);
  return concatBytes([...localParts, directory, end]);
}

function buildXlsx(payload) {
  const summaryRows = [["項目", "内容"], ["スキーマ", payload.schemaVersion], ["出力日時", payload.exportedAt], ...Object.entries(payload.programBasicInfo), ...payload.summary];
  const inputRows = [["区分", "項目", "値", "入力種別"], ...payload.inputs.map((item) => [item.section, item.label, item.value, item.type])];
  const calculationRows = [["表名", "列1", "列2", "列3", "列4", "列5"]];
  payload.tables.forEach((table) => { calculationRows.push([table.heading]); table.rows.forEach((values) => calculationRows.push(["", ...values.slice(0, 5)])); calculationRows.push([]); });
  const chunks = splitText(JSON.stringify(payload));
  const transferRows = [["アプリ間連携・バックアップ用データです。JSONチャンクを編集しないでください。"], ["schemaVersion", payload.schemaVersion], ["chunkCount", chunks.length], ...chunks.map((chunk, index) => [`payloadJson_${index + 1}`, chunk])];
  const sheets = [
    { name: "提出用見積", xml: submissionWorksheetXml(buildSubmissionRows(payload)) },
    { name: "Summary", rows: summaryRows, widths: [30, 60] },
    { name: "Inputs", rows: inputRows, widths: [18, 38, 40, 14] },
    { name: "Calculation Tables", rows: calculationRows, widths: [34, 28, 28, 22, 22, 22] },
    { name: "TransferData", rows: transferRows, widths: [24, 120] },
  ];
  const workbookSheets = sheets.map((sheet, index) => `<sheet name="${xmlEscape(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("");
  const workbookRels = sheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("");
  const overrides = sheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("");
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="3"><font><sz val="10"/><name val="Aptos"/></font><font><b/><sz val="18"/><name val="Aptos"/></font><font><b/><sz val="10"/><name val="Aptos"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEFF3F8"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFB8C2CC"/></left><right style="thin"><color rgb="FFB8C2CC"/></right><top style="thin"><color rgb="FFB8C2CC"/></top><bottom style="thin"><color rgb="FFB8C2CC"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  const files = [
    { name: "[Content_Types].xml", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${overrides}</Types>` },
    { name: "_rels/.rels", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { name: "xl/workbook.xml", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${workbookSheets}</sheets></workbook>` },
    { name: "xl/_rels/workbook.xml.rels", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${workbookRels}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    { name: "xl/styles.xml", content: styles },
    ...sheets.map((sheet, index) => ({ name: `xl/worksheets/sheet${index + 1}.xml`, content: sheet.xml || worksheetXml(sheet.rows, sheet.widths) })),
  ];
  return createZip(files);
}

function makeFilename(payload) {
  const safeName = String(payload.programBasicInfo?.programName || "estimate").replace(/[\\/:*?"<>|]/g, "_").trim() || "estimate";
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
    try { downloadExcel(); setMessage("提出用見積を含むExcel（.xlsx）を出力しました。"); }
    catch (error) { console.error(error); setMessage("Excel出力に失敗しました。入力内容を確認してください。"); }
    window.setTimeout(() => setMessage(""), 2500);
  }
  return <section className="estimate-export-panel no-print"><div><strong>提出用見積／Excelバックアップ</strong><p>提出用見積、共通情報、入力値、計算表、再利用用データを1つの.xlsxファイルに保存します。</p></div><button className="btn estimate-export-button" type="button" onClick={handleExport}>Excelにエクスポート</button>{message && <div className="estimate-export-message" role="status">{message}</div>}</section>;
}

export default function EstimateExcelExport() {
  const [target, setTarget] = useState(null);
  useEffect(() => {
    const container = document.querySelector(".container");
    const tabs = container?.querySelector(".mode-tabs");
    if (!container || !tabs) return;
    const mount = document.createElement("div");
    mount.setAttribute("data-estimate-excel-export", "");
    container.insertBefore(mount, tabs);
    setTarget(mount);
    return () => mount.remove();
  }, []);
  return target ? createPortal(<ExportPanel />, target) : null;
}
