import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import "./EstimateExcelExport.css";

const SCHEMA_VERSION = "mitsumori-estimate-v1";
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

    rows.push({
      section: getInputSection(control),
      label: labelText,
      value: getFieldValue(control),
      type: control.tagName.toLowerCase(),
    });
  });

  return rows;
}

function collectTables() {
  const tables = [];
  document.querySelectorAll("table").forEach((table, index) => {
    if (table.closest(".print-summary")) return;
    const heading = table.closest(".col-12")?.querySelector("label")?.textContent?.trim()
      || `Table ${index + 1}`;
    const rows = Array.from(table.rows).map((tableRow) =>
      Array.from(tableRow.cells).map((cell) => cell.textContent.replace(/\s+/g, " ").trim())
    );
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
    rows.push([
      header.querySelector("span")?.textContent?.trim() || "積み上げ合計",
      header.querySelector("strong")?.textContent?.trim() || "",
    ]);
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
  for (let offset = 0; offset < text.length; offset += size) {
    chunks.push(text.slice(offset, offset + size));
  }
  return chunks;
}

function xmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function columnName(index) {
  let value = index + 1;
  let name = "";
  while (value > 0) {
    value -= 1;
    name = String.fromCharCode(65 + (value % 26)) + name;
    value = Math.floor(value / 26);
  }
  return name;
}

function worksheetXml(rows, widths) {
  const maxCols = Math.max(1, ...rows.map((row) => row.length));
  const cols = widths.map((width, index) =>
    `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`
  ).join("");

  const sheetRows = rows.map((row, rowIndex) => {
    const cells = row.map((value, colIndex) => {
      const reference = `${columnName(colIndex)}${rowIndex + 1}`;
      return `<c r="${reference}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
    }).join("");
    return `<row r="${rowIndex + 1}">${cells}</row>`;
  }).join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:${columnName(maxCols - 1)}${Math.max(rows.length, 1)}"/>
  <sheetViews><sheetView workbookViewId="0"/></sheetViews>
  <sheetFormatPr defaultRowHeight="15"/>
  <cols>${cols}</cols>
  <sheetData>${sheetRows}</sheetData>
</worksheet>`;
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeUint16(target, offset, value) {
  target[offset] = value & 0xff;
  target[offset + 1] = (value >>> 8) & 0xff;
}

function writeUint32(target, offset, value) {
  target[offset] = value & 0xff;
  target[offset + 1] = (value >>> 8) & 0xff;
  target[offset + 2] = (value >>> 16) & 0xff;
  target[offset + 3] = (value >>> 24) & 0xff;
}

function concatBytes(parts) {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  parts.forEach((part) => {
    result.set(part, offset);
    offset += part.length;
  });
  return result;
}

function createZip(files) {
  const localParts = [];
  const centralParts = [];
  let localOffset = 0;

  files.forEach(({ name, content }) => {
    const nameBytes = textEncoder.encode(name);
    const dataBytes = typeof content === "string" ? textEncoder.encode(content) : content;
    const checksum = crc32(dataBytes);

    const localHeader = new Uint8Array(30 + nameBytes.length);
    writeUint32(localHeader, 0, 0x04034b50);
    writeUint16(localHeader, 4, 20);
    writeUint16(localHeader, 6, 0x0800);
    writeUint16(localHeader, 8, 0);
    writeUint16(localHeader, 10, 0);
    writeUint16(localHeader, 12, 0);
    writeUint32(localHeader, 14, checksum);
    writeUint32(localHeader, 18, dataBytes.length);
    writeUint32(localHeader, 22, dataBytes.length);
    writeUint16(localHeader, 26, nameBytes.length);
    writeUint16(localHeader, 28, 0);
    localHeader.set(nameBytes, 30);
    localParts.push(localHeader, dataBytes);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    writeUint32(centralHeader, 0, 0x02014b50);
    writeUint16(centralHeader, 4, 20);
    writeUint16(centralHeader, 6, 20);
    writeUint16(centralHeader, 8, 0x0800);
    writeUint16(centralHeader, 10, 0);
    writeUint16(centralHeader, 12, 0);
    writeUint16(centralHeader, 14, 0);
    writeUint32(centralHeader, 16, checksum);
    writeUint32(centralHeader, 20, dataBytes.length);
    writeUint32(centralHeader, 24, dataBytes.length);
    writeUint16(centralHeader, 28, nameBytes.length);
    writeUint16(centralHeader, 30, 0);
    writeUint16(centralHeader, 32, 0);
    writeUint16(centralHeader, 34, 0);
    writeUint16(centralHeader, 36, 0);
    writeUint32(centralHeader, 38, 0);
    writeUint32(centralHeader, 42, localOffset);
    centralHeader.set(nameBytes, 46);
    centralParts.push(centralHeader);

    localOffset += localHeader.length + dataBytes.length;
  });

  const centralDirectory = concatBytes(centralParts);
  const endRecord = new Uint8Array(22);
  writeUint32(endRecord, 0, 0x06054b50);
  writeUint16(endRecord, 4, 0);
  writeUint16(endRecord, 6, 0);
  writeUint16(endRecord, 8, files.length);
  writeUint16(endRecord, 10, files.length);
  writeUint32(endRecord, 12, centralDirectory.length);
  writeUint32(endRecord, 16, localOffset);
  writeUint16(endRecord, 20, 0);

  return concatBytes([...localParts, centralDirectory, endRecord]);
}

function buildXlsx(payload) {
  const summaryRows = [
    ["項目", "内容"],
    ["スキーマ", payload.schemaVersion],
    ["出力日時", payload.exportedAt],
    ...Object.entries(payload.programBasicInfo),
    ...payload.summary,
  ];
  const inputRows = [
    ["区分", "項目", "値", "入力種別"],
    ...payload.inputs.map((item) => [item.section, item.label, item.value, item.type]),
  ];
  const calculationRows = [["表名", "列1", "列2", "列3", "列4", "列5"]];
  payload.tables.forEach((table) => {
    calculationRows.push([table.heading]);
    table.rows.forEach((values) => calculationRows.push(["", ...values.slice(0, 5)]));
    calculationRows.push([]);
  });
  const chunks = splitText(JSON.stringify(payload));
  const transferRows = [
    ["アプリ間連携・バックアップ用データです。JSONチャンクを編集しないでください。"],
    ["schemaVersion", payload.schemaVersion],
    ["chunkCount", chunks.length],
    ...chunks.map((chunk, index) => [`payloadJson_${index + 1}`, chunk]),
  ];

  const sheets = [
    { name: "Summary", rows: summaryRows, widths: [30, 60] },
    { name: "Inputs", rows: inputRows, widths: [18, 38, 40, 14] },
    { name: "Calculation Tables", rows: calculationRows, widths: [34, 28, 28, 22, 22, 22] },
    { name: "TransferData", rows: transferRows, widths: [24, 120] },
  ];

  const workbookSheets = sheets.map((sheet, index) =>
    `<sheet name="${xmlEscape(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`
  ).join("");
  const workbookRels = sheets.map((_, index) =>
    `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`
  ).join("");
  const contentOverrides = sheets.map((_, index) =>
    `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
  ).join("");

  const files = [
    {
      name: "[Content_Types].xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  ${contentOverrides}
</Types>`,
    },
    {
      name: "_rels/.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
    },
    {
      name: "xl/workbook.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>${workbookSheets}</sheets>
</workbook>`,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${workbookRels}
  <Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
    },
    {
      name: "xl/styles.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="1"><font><sz val="10"/><name val="Aptos"/></font></fonts>
  <fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`,
    },
    ...sheets.map((sheet, index) => ({
      name: `xl/worksheets/sheet${index + 1}.xml`,
      content: worksheetXml(sheet.rows, sheet.widths),
    })),
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
  const bytes = buildXlsx(payload);
  const blob = new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = makeFilename(payload);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function ExportPanel() {
  const [message, setMessage] = useState("");

  function handleExport() {
    try {
      downloadExcel();
      setMessage("Excel（.xlsx）を出力しました。");
    } catch (error) {
      console.error(error);
      setMessage("Excel出力に失敗しました。入力内容を確認してください。");
    }
    window.setTimeout(() => setMessage(""), 2500);
  }

  return (
    <section className="estimate-export-panel no-print">
      <div>
        <strong>Excelバックアップ／アプリ間連携</strong>
        <p>共通情報、入力値、計算表、再利用用データを正式な.xlsxファイルに保存します。</p>
      </div>
      <button className="btn estimate-export-button" type="button" onClick={handleExport}>
        Excelにエクスポート
      </button>
      {message && <div className="estimate-export-message" role="status">{message}</div>}
    </section>
  );
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
