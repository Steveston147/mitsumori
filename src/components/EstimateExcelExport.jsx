import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import * as XLSX from "xlsx";
import "./EstimateExcelExport.css";

const SCHEMA_VERSION = "mitsumori-estimate-v1";
const JSON_CHUNK_SIZE = 28000;

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

function setColumnWidths(sheet, widths) {
  sheet["!cols"] = widths.map((wch) => ({ wch }));
}

function buildWorkbook(payload) {
  const workbook = XLSX.utils.book_new();

  const summaryRows = [
    ["項目", "内容"],
    ["スキーマ", payload.schemaVersion],
    ["出力日時", payload.exportedAt],
    ...Object.entries(payload.programBasicInfo),
    ...payload.summary,
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
  setColumnWidths(summarySheet, [30, 60]);
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

  const inputRows = [
    ["区分", "項目", "値", "入力種別"],
    ...payload.inputs.map((item) => [item.section, item.label, item.value, item.type]),
  ];
  const inputsSheet = XLSX.utils.aoa_to_sheet(inputRows);
  setColumnWidths(inputsSheet, [18, 38, 40, 14]);
  XLSX.utils.book_append_sheet(workbook, inputsSheet, "Inputs");

  const tableRows = [["表名", "列1", "列2", "列3", "列4", "列5"]];
  payload.tables.forEach((table) => {
    tableRows.push([table.heading]);
    table.rows.forEach((values) => tableRows.push(["", ...values.slice(0, 5)]));
    tableRows.push([]);
  });
  const calculationSheet = XLSX.utils.aoa_to_sheet(tableRows);
  setColumnWidths(calculationSheet, [34, 28, 28, 22, 22, 22]);
  XLSX.utils.book_append_sheet(workbook, calculationSheet, "Calculation Tables");

  const jsonChunks = splitText(JSON.stringify(payload));
  const transferRows = [
    ["アプリ間連携・バックアップ用データです。JSONチャンクを編集しないでください。"],
    ["schemaVersion", payload.schemaVersion],
    ["chunkCount", jsonChunks.length],
    ...jsonChunks.map((chunk, index) => [`payloadJson_${index + 1}`, chunk]),
  ];
  const transferSheet = XLSX.utils.aoa_to_sheet(transferRows);
  setColumnWidths(transferSheet, [24, 120]);
  XLSX.utils.book_append_sheet(workbook, transferSheet, "TransferData");

  return workbook;
}

function makeFilename(payload) {
  const name = payload.programBasicInfo?.programName || "estimate";
  const safeName = String(name).replace(/[\\/:*?"<>|]/g, "_").trim() || "estimate";
  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15);
  return `${safeName}_${stamp}.xlsx`;
}

function downloadExcel() {
  const payload = getBackupPayload();
  const workbook = buildWorkbook(payload);
  XLSX.writeFile(workbook, makeFilename(payload), {
    bookType: "xlsx",
    compression: true,
  });
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
