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
  if (!value) return "まだExcelファイルを出力していません";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "出力時刻を確認できません";
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function triggerExcelOutput() {
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
          <strong>
            {dirty
              ? "この内容はまだExcelファイルとして出力されていません"
              : "この内容は最新のExcel出力と一致しています"}
          </strong>
          <span>
            {dirty
              ? "入力内容はブラウザ内に自動反映されています。必要な時点でExcelを出力してください。"
              : `最終Excel出力：${formatSavedTime(lastSaved)}`}
          </span>
        </div>
      </div>
      <button type="button" className="build-up-save-now" onClick={triggerExcelOutput}>
        Excelを出力
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

      const exportButton = document.querySelector("[data-estimate-excel-export] button");
      if (exportButton) exportButton.textContent = "Excelを出力";

      const exportDescription = document.querySelector("[data-estimate-excel-export] p");
      if (exportDescription) {
        exportDescription.textContent = "共通情報、入力値、計算表、再利用用データをExcelファイルとして出力します。";
      }
    };

    const markDirty = (event) => {
      if (!event.target.closest("[data-build-up-active-view]")) return;
      window.sessionStorage.setItem(DIRTY_KEY, "true");
      window.dispatchEvent(new CustomEvent("mitsumori-build-up-save-state"));
    };

    const markOutput = (event) => {
      if (!event.target.closest("[data-estimate-excel-export] button")) return;
      const outputAt = new Date().toISOString();
      window.sessionStorage.setItem(DIRTY_KEY, "false");
      window.sessionStorage.setItem(LAST_SAVED_KEY, outputAt);
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
    document.addEventListener("click", markOutput, true);
    syncTargets();

    return () => {
      observer.disconnect();
      document.removeEventListener("input", markDirty, true);
      document.removeEventListener("change", markDirty, true);
      document.removeEventListener("click", markOutput, true);
    };
  }, []);

  return (
    <>
      {footerTarget ? createPortal(<SaveStatePanel compact />, footerTarget) : null}
      {dashboardTarget ? createPortal(<SaveStatePanel />, dashboardTarget) : null}
    </>
  );
}
