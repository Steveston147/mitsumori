import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  clearCurrentEstimate,
  readProjectHistory,
  removeProject,
  restoreProject,
} from "../state/projectHistory.js";
import "./ProjectWorkspace.css";

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function currentProjectName() {
  try {
    const info = JSON.parse(window.localStorage.getItem("mitsumori.programBasicInfo") || "{}");
    return info.programName || "名称未設定の見積";
  } catch {
    return "名称未設定の見積";
  }
}

function WorkspacePanel() {
  const [history, setHistory] = useState(() => readProjectHistory());
  const [name, setName] = useState(() => currentProjectName());

  useEffect(() => {
    const refresh = () => {
      setHistory(readProjectHistory());
      setName(currentProjectName());
    };
    window.addEventListener("mitsumori-project-history-change", refresh);
    window.addEventListener("program-basic-info-change", refresh);
    return () => {
      window.removeEventListener("mitsumori-project-history-change", refresh);
      window.removeEventListener("program-basic-info-change", refresh);
    };
  }, []);

  const recent = useMemo(() => history.slice(0, 6), [history]);

  function newEstimate() {
    if (!window.confirm("新しい見積を開始します。現在の入力内容は消去されます。保存が必要な場合は先にExcelへエクスポートしてください。")) return;
    clearCurrentEstimate();
    window.location.reload();
  }

  function openExcel() {
    document.querySelector("[data-estimate-excel-import] input[type='file']")?.click();
  }

  function saveExcel() {
    document.querySelector("[data-estimate-excel-export] button")?.click();
  }

  function openRecent(entry) {
    if (!window.confirm(`「${entry.name}」を開きます。現在の入力内容は置き換えられます。続けますか？`)) return;
    restoreProject(entry);
    window.sessionStorage.setItem("mitsumori.importMessage", `${entry.name}を最近使った案件から復元しました。`);
    window.location.reload();
  }

  return (
    <section className="project-workspace no-print">
      <div className="project-workspace-heading">
        <div>
          <span>現在編集中</span>
          <strong>{name}</strong>
        </div>
        <div className="project-workspace-actions">
          <button type="button" className="btn secondary" onClick={newEstimate}>新規見積</button>
          <button type="button" className="btn secondary" onClick={openExcel}>Excelを開く</button>
          <button type="button" className="btn" onClick={saveExcel}>Excelに保存</button>
        </div>
      </div>

      <div className="project-recent-title">最近使った案件</div>
      {recent.length === 0 ? (
        <div className="project-recent-empty">Excelを保存または読み込むと、ここに最近の案件が表示されます。</div>
      ) : (
        <div className="project-recent-list">
          {recent.map((entry) => (
            <div className="project-recent-item" key={entry.id}>
              <button type="button" className="project-recent-open" onClick={() => openRecent(entry)}>
                <strong>{entry.name}</strong>
                <span>{formatDate(entry.updatedAt)}・{entry.source === "import" ? "Excel読込" : "Excel保存"}</span>
              </button>
              <button
                type="button"
                className="project-recent-remove"
                aria-label={`${entry.name}を履歴から削除`}
                onClick={() => removeProject(entry.id)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function ProjectWorkspace() {
  const [target, setTarget] = useState(null);

  useEffect(() => {
    const container = document.querySelector(".container");
    const tabs = container?.querySelector(".mode-tabs");
    if (!container || !tabs) return;
    const mount = document.createElement("div");
    mount.setAttribute("data-project-workspace", "");
    container.insertBefore(mount, tabs);
    setTarget(mount);
    return () => mount.remove();
  }, []);

  return target ? createPortal(<WorkspacePanel />, target) : null;
}
