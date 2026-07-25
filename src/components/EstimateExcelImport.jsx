import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./EstimateExcelImport.css";

const SUPPORTED_SCHEMAS = new Set(["mitsumori-estimate-v1"]);
const IMPORT_MESSAGE_KEY = "mitsumori.importMessage";
const ESTIMATE_STATE_PREFIX = "mitsumori.estimateState.";
const textDecoder = new TextDecoder("utf-8");

function readUint16(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readUint32(bytes, offset) {
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
}

function extractStoredZipFiles(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  const files = new Map();
  let offset = 0;
  while (offset + 30 <= bytes.length) {
    const signature = readUint32(bytes, offset);
    if (signature !== 0x04034b50) break;
    const compression = readUint16(bytes, offset + 8);
    const compressedSize = readUint32(bytes, offset + 18);
    const fileNameLength = readUint16(bytes, offset + 26);
    const extraLength = readUint16(bytes, offset + 28);
    const nameStart = offset + 30;
    const dataStart = nameStart + fileNameLength + extraLength;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > bytes.length) throw new Error("Excelファイルが途中で切れています。");
    if (compression !== 0) throw new Error("このExcelは本アプリが出力したバックアップ形式ではありません。");
    const name = textDecoder.decode(bytes.slice(nameStart, nameStart + fileNameLength));
    files.set(name, bytes.slice(dataStart, dataEnd));
    offset = dataEnd;
  }
  return files;
}

function parseInlineWorksheet(xmlText) {
  const documentXml = new DOMParser().parseFromString(xmlText, "application/xml");
  if (documentXml.querySelector("parsererror")) throw new Error("TransferDataシートを解析できませんでした。");
  return Array.from(documentXml.getElementsByTagNameNS("*", "row")).map((row) =>
    Array.from(row.getElementsByTagNameNS("*", "c")).map((cell) =>
      Array.from(cell.getElementsByTagNameNS("*", "t")).map((node) => node.textContent || "").join("")
    )
  );
}

function parseBackupPayload(arrayBuffer) {
  const files = extractStoredZipFiles(arrayBuffer);
  const transferSheet = files.get("xl/worksheets/sheet4.xml");
  if (!transferSheet) throw new Error("TransferDataシートが見つかりません。");
  const rows = parseInlineWorksheet(textDecoder.decode(transferSheet));
  const chunks = rows
    .filter((row) => /^payloadJson_\d+$/.test(row[0] || ""))
    .sort((a, b) => Number(a[0].split("_").pop()) - Number(b[0].split("_").pop()));
  if (!chunks.length) throw new Error("復元用データが見つかりません。");
  let payload;
  try {
    payload = JSON.parse(chunks.map((row) => row[1] || "").join(""));
  } catch {
    throw new Error("復元用データが破損しています。");
  }
  if (!SUPPORTED_SCHEMAS.has(payload?.schemaVersion)) throw new Error(`未対応のデータ形式です: ${payload?.schemaVersion || "不明"}`);
  if (!payload.storage || typeof payload.storage !== "object") throw new Error("バックアップに必要なデータが不足しています。");
  const hasReactState = Object.keys(payload.storage).some((key) => key.startsWith(ESTIMATE_STATE_PREFIX));
  if (!hasReactState) throw new Error("このExcelにはReact State復元データがありません。最新版の画面から再度エクスポートしてください。");
  return payload;
}

function restoreStorage(storage) {
  Object.entries(storage).forEach(([key, value]) => {
    if (!key.startsWith("mitsumori.")) return;
    window.localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
  });
}

function ImportPanel() {
  const inputRef = useRef(null);
  const [message, setMessage] = useState(() => window.sessionStorage.getItem(IMPORT_MESSAGE_KEY) || "");

  useEffect(() => {
    if (message) window.sessionStorage.removeItem(IMPORT_MESSAGE_KEY);
  }, [message]);

  async function handleFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const payload = parseBackupPayload(await file.arrayBuffer());
      const name = payload.programBasicInfo?.programName || file.name;
      if (!window.confirm(`「${name}」を読み込みます。現在の入力内容は置き換えられます。続けますか？`)) return;
      restoreStorage(payload.storage);
      window.sessionStorage.setItem(IMPORT_MESSAGE_KEY, `${name}をReact Stateから復元しました。`);
      window.location.reload();
    } catch (error) {
      console.error(error);
      setMessage(error instanceof Error ? error.message : "Excelの読込に失敗しました。");
    }
  }

  return (
    <section className="estimate-import-panel no-print">
      <div>
        <strong>Excelから復元</strong>
        <p>このアプリで出力した.xlsxから、各費用ブロックのReact Stateを直接復元します。</p>
      </div>
      <input ref={inputRef} className="estimate-import-file" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={handleFile} />
      <button className="btn secondary estimate-import-button" type="button" onClick={() => inputRef.current?.click()}>Excelを読み込む</button>
      {message && <div className="estimate-import-message" role="status">{message}</div>}
    </section>
  );
}

export default function EstimateExcelImport() {
  const [target, setTarget] = useState(null);
  useEffect(() => {
    const exportMount = document.querySelector("[data-estimate-excel-export]");
    if (!exportMount?.parentElement) return;
    const mount = document.createElement("div");
    mount.setAttribute("data-estimate-excel-import", "");
    exportMount.insertAdjacentElement("afterend", mount);
    setTarget(mount);
    return () => mount.remove();
  }, []);
  return target ? createPortal(<ImportPanel />, target) : null;
}
