import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import "./ProfessionalUiShell.css";
import "./ProfessionalUiPolish.css";

function getVisibleMode() {
  return document.querySelector(".mode-tab.active")?.textContent?.trim() || "見積方式を選択";
}

function getCompletion() {
  const visibleRoot = Array.from(document.querySelectorAll(".container > div[hidden]"))
    .find((element) => !element.hidden);
  if (!visibleRoot) return { completed: 0, total: 0 };

  const controls = Array.from(visibleRoot.querySelectorAll("input, select, textarea"))
    .filter((control) => control.type !== "hidden" && !control.disabled);
  const meaningful = controls.filter((control) => {
    if (control.type === "checkbox" || control.type === "radio") return control.checked;
    return String(control.value ?? "").trim() !== "";
  });
  return { completed: meaningful.length, total: controls.length };
}

function Header() {
  return (
    <header className="app-hero no-print">
      <div className="app-hero-copy">
        <div className="app-hero-meta">
          <span className="app-product-kicker">CUSTOM PROGRAM ESTIMATE</span>
          <span className="app-context-badge">内部業務用</span>
        </div>
        <h1>短期留学プログラム見積管理</h1>
        <p>案件情報、費用内訳、見積結果を一つの流れで整理する、短期受入プログラム向けの内部業務用ツールです。</p>
        <div className="app-capability-list" aria-label="主な機能">
          <span>係数方式</span>
          <span>積み上げ方式</span>
          <span>Excel保存・再読込</span>
        </div>
      </div>
      <div className="app-hero-visual" aria-hidden="true">
        <svg viewBox="0 0 240 150" role="img">
          <rect x="18" y="22" width="154" height="104" rx="16" />
          <path d="M44 52h64M44 70h92M44 88h78" />
          <circle cx="182" cy="52" r="28" />
          <path d="M168 52l10 10 19-24" />
          <rect x="130" y="96" width="84" height="32" rx="10" />
          <path d="M148 112h48" />
        </svg>
      </div>
    </header>
  );
}

function StatusBar() {
  const [mode, setMode] = useState(() => getVisibleMode());
  const [completion, setCompletion] = useState(() => getCompletion());

  useEffect(() => {
    const refresh = () => {
      setMode(getVisibleMode());
      setCompletion(getCompletion());
    };
    const container = document.querySelector(".container");
    if (!container) return undefined;
    const observer = new MutationObserver(refresh);
    observer.observe(container, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["class", "hidden"],
    });
    document.addEventListener("input", refresh, true);
    document.addEventListener("change", refresh, true);
    refresh();
    return () => {
      observer.disconnect();
      document.removeEventListener("input", refresh, true);
      document.removeEventListener("change", refresh, true);
    };
  }, []);

  const percent = useMemo(() => {
    if (!completion.total) return 0;
    return Math.min(100, Math.round((completion.completed / completion.total) * 100));
  }, [completion]);

  return (
    <section className="workflow-status no-print" aria-label="作業状況">
      <div className="workflow-status-main">
        <span className="workflow-label">現在の見積方式</span>
        <strong>{mode}</strong>
      </div>
      <div className="workflow-progress" aria-label={`入力状況 ${percent}%`}>
        <div className="workflow-progress-copy">
          <span>入力状況の目安</span>
          <strong>{completion.completed} / {completion.total} 項目</strong>
        </div>
        <div className="workflow-progress-track">
          <span style={{ width: `${percent}%` }} />
        </div>
      </div>
      <div className="workflow-guide">
        <span className="workflow-guide-dot" />
        入力内容はブラウザ内に保持されます。作業の区切りでExcelへ保存してください。
      </div>
      <div className="workflow-steps" aria-label="基本的な作業手順">
        <span><b>1</b> 基礎情報</span>
        <span><b>2</b> 条件・費用入力</span>
        <span><b>3</b> サマリー確認</span>
        <span><b>4</b> Excel保存</span>
      </div>
    </section>
  );
}

export default function ProfessionalUiShell() {
  const [headerTarget, setHeaderTarget] = useState(null);
  const [statusTarget, setStatusTarget] = useState(null);

  useEffect(() => {
    const container = document.querySelector(".container");
    const originalTitle = container?.querySelector(":scope > h1");
    const tabs = container?.querySelector(".mode-tabs");
    if (!container || !originalTitle || !tabs) return undefined;

    container.classList.add("professional-app-shell");
    originalTitle.classList.add("legacy-app-title");

    const headerMount = document.createElement("div");
    headerMount.setAttribute("data-professional-header", "");
    container.insertBefore(headerMount, originalTitle);

    const statusMount = document.createElement("div");
    statusMount.setAttribute("data-workflow-status", "");
    container.insertBefore(statusMount, tabs);

    setHeaderTarget(headerMount);
    setStatusTarget(statusMount);

    return () => {
      container.classList.remove("professional-app-shell");
      originalTitle.classList.remove("legacy-app-title");
      headerMount.remove();
      statusMount.remove();
    };
  }, []);

  return (
    <>
      {headerTarget ? createPortal(<Header />, headerTarget) : null}
      {statusTarget ? createPortal(<StatusBar />, statusTarget) : null}
    </>
  );
}
