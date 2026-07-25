import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import "./BuildUpSaveStatus.css";

const DIRTY_KEY = "mitsumori.buildUpDirtySinceExcel";
const LAST_SAVED_KEY = "mitsumori.buildUpLastExcelSavedAt";

function readDirty() {
  return window.sessionStorage.getItem(DIRTY_KEY) === "true";
}

function readLastSaved() {
  return window.sessionStorage.getItem(LAST_SAVED_KEY) || "";
}

function formatSavedTime(value) {
  if (!value) return "まだExcel保存されていません";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "保存時刻を確認できません";
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function triggerExcelSave() {
  document.querySelector("[data-estimate-excel-export] button")?.click();
}

function SaveStatePanel({ compact = false }) {
  const [dirty, setDirty] = useState(() => readDirty());
  const [lastSaved, setLastSaved] = useState(() => readLastSaved());

  useEffect(() => {
    const refresh = () => {
      setDirty(readDirty());
      setLastSaved(readLastSaved());
    };
    window.addEventListener("mitsumori-build-up-save-state", refresh);
    return () => window.removeEventListener("mitsumori-build-up-save-state", refresh);
  }, []);

  return (
    <section className={`build-up-save-state ${dirty ? "is-dirty" : "is-saved"} ${compact ? "is-compact" : ""}`}>
      <div className="build-up-save-state-copy">
        <span className="build-up-save-state-icon" aria-hidden="true">{dirty ? "!" : "✓"}</span>
        <div>
          <strong>{dirty ? "ブラウザには反映済み・Excelには未保存" : "Excel保存後の変更はありません"}</strong>
          <span>{dirty ? "このまま編集を続けられます。区切りのよいところでExcelに保存してください。" : `最終Excel保存：${formatSavedTime(lastSaved)}`}</span>
        </div>
      </div>
      <button type="button" className="build-up-save-now" onClick={triggerExcelSave}>
        Excelに保存
      </button>
    </section>
  );
}

export default function BuildUpSaveStatus() {
  const [footerTarget, setFooterTarget] = useState(null);
  const [dashboardTarget, setDashboardTarget] = useState(null);

  useEffect(() => {
    const syncTargets = () => {
      setFooterTarget(document.querySelector("[data-build-up-workspace-footer-mount]"));
      const dashboard = document.querySelector("[data-build-up-active-view='dashboard'] [data-build-up-workspace]");
      setDashboardTarget(dashboard || null);
    };

    const markDirty = (event) => {
      if (!event.target.closest("[data-build-up-active-view]")) return;
      window.sessionStorage.setItem(DIRTY_KEY, "true");
      window.dispatchEvent(new CustomEvent("mitsumori-build-up-save-state"));
    };

    const markSaved = (event) => {
      if (!event.target.closest("[data-estimate-excel-export] button")) return;
      const savedAt = new Date().toISOString();
      window.sessionStorage.setItem(DIRTY_KEY, "false");
      window.sessionStorage.setItem(LAST_SAVED_KEY, savedAt);
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent("mitsumori-build-up-save-state"));
      }, 0);
    };

    const observer = new MutationObserver(syncTargets);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["data-build-up-active-view"],
    });
    document.addEventListener("input", markDirty, true);
    document.addEventListener("change", markDirty, true);
    document.addEventListener("click", markSaved, true);
    syncTargets();

    return () => {
      observer.disconnect();
      document.removeEventListener("input", markDirty, true);
      document.removeEventListener("change", markDirty, true);
      document.removeEventListener("click", markSaved, true);
    };
  }, []);

  return (
    <>
      {footerTarget ? createPortal(<SaveStatePanel compact />, footerTarget) : null}
      {dashboardTarget ? createPortal(<SaveStatePanel />, dashboardTarget) : null}
    </>
  );
}
