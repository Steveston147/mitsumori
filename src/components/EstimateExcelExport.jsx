import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import "./EstimateExcelExport.css";

const SCHEMA_VERSION = "mitsumori-estimate-v1";

function xmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function safeJsonParse(value, fallback = null) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function getFieldValue(control) {
  if (!control) return "";
  if (control.type === "checkbox") return control.checked ? "true" : "false";
  return control.value ?? "";
}

function collectInputs() {
  const rows = [];
  const seen = new Set();

  document.querySelectorAll("label").forEach((label, index) => {
    const container = label.parentElement;
    const control = container?.querySelector("input, select, textarea");
    if (!control) return;

    const key = `${label.textContent.trim()}::${control.name || control.id || index}`;
    if (seen.has(key)) return;
    seen.add(key);

    const mode = control.closest('[hidden]')?.querySelector?.(".mode-title")?.textContent?.trim()
      || control.closest('[data-program-basic-info]') ? "共通情報" : "見積入力";

    rows.push({
      section: mode,
      label: label.textContent.trim(),
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
    const heading = table.previousElementSibling?.textContent?.trim()
      || table.closest(".col-12")?.querySelector("label")?.textContent?.trim()
      || `Table ${index + 1}`;
    const rows = Array.from(table.rows).map((row) =>
      Array.from(row.cells).map((cell) => cell.textContent.replace(/\s+/g, " ").trim())
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
    const label = header.querySelector("span")?.textContent?.trim() || "積み上げ合計";
    const value = header.querySelector("strong")?.textContent?.trim() || "";
    rows.push([label, value]);
  });

  return rows;
}

function getBackupPayload() {
  const storage = {};
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key?.startsWith("mitsumori.")) continue;
    storage[key] = safeJsonParse(window.localStorage.getItem(key), window.localStorage.getItem(key));
  }

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

function cell(value, type = "String") {
  return `<Cell><Data ss:Type="${type}">${xmlEscape(value)}</Data></Cell>`;
}

function row(values) {
  return `<Row>${values.map((value) => cell(value)).join("")}</Row>`;
}

function worksheet(name, rows) {
  return `<Worksheet ss:Name="${xmlEscape(name.slice(0, 31))}"><Table>${rows.join("")}</Table></Worksheet>`;
}

function buildWorkbook(payload) {
  const summaryRows = [
    row(["項目", "内容"]),
    row(["スキーマ", payload.schemaVersion]),
    row(["出力日時", payload.exportedAt]),
    ...Object.entries(payload.programBasicInfo || {}).map(([key, value]) => row([key, value])),
    ...payload.summary.map(([label, value]) => row([label, value])),
  ];

  const inputRows = [
    row(["区分", "項目", "値", "入力種別"]),
    ...payload.inputs.map((item) => row([item.section, item.label, item.value, item.type])),
  ];

  const tableRows = [row(["表名", "列1", "列2", "列3", "列4", "列5"])];
  payload.tables.forEach((table) => {
    tableRows.push(row([table.heading]));
    table.rows.forEach((values) => tableRows.push(row(["", ...values.slice(0, 5)])));
    tableRows.push(row([]));
  });

  const transferRows = [
    row(["このシートはアプリ間連携・バックアップ用です。セルB2のJSONを編集しないでください。"]),
    row(["schemaVersion", payload.schemaVersion]),
    row(["payloadJson", JSON.stringify(payload)]),
  ];

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Vertical="Center"/><Font ss:FontName="Aptos" ss:Size="10"/></Style>
 </Styles>
 ${worksheet("Summary", summaryRows)}
 ${worksheet("Inputs", inputRows)}
 ${worksheet("Calculation Tables", tableRows)}
 ${worksheet("TransferData", transferRows)}
</Workbook>`;
}

function makeFilename(payload) {
  const name = payload.programBasicInfo?.programName || "estimate";
  const safeName = String(name).replace(/[\\/:*?"<>|]/g, "_").trim() || "estimate";
  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15);
  return `${safeName}_${stamp}.xls`;
}

function downloadExcel() {
  const payload = getBackupPayload();
  const workbook = buildWorkbook(payload);
  const blob = new Blob([workbook], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = makeFilename(payload);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function ExportPanel() {
  const [message, setMessage] = useState("");

  function handleExport() {
    try {
      downloadExcel();
      setMessage("Excelを出力しました。");
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
        <p>共通情報、入力値、計算表、再利用用JSONを1つのExcelファイルに保存します。</p>
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
