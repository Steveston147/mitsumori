import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import "./ProfessionalUiShell.css";
import "./ProfessionalUiPolish.css";
import "./ProfessionalUiV2.css";

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

function scrollToElement(element) {
  if (!element) return;
  element.scrollIntoView({ behavior: "smooth", block: "start" });
}

function activateMode(index) {
  const tabs = Array.from(document.querySelectorAll(".mode-tab"));
  const tab = tabs[index];
  if (!tab) return;
  tab.click();
  window.setTimeout(() => scrollToElement(document.querySelector(".mode-tabs")), 50);
}

function findSectionByText(text) {
  const candidates = Array.from(document.querySelectorAll("h2, h3, .card-title, button"));
  return candidates.find((element) => element.textContent?.includes(text));
}

function Sidebar({ mode, completion }) {
  const percent = completion.total
    ? Math.min(100, Math.round((completion.completed / completion.total) * 100))
    : 0;

  return (
    <aside className="estimate-sidebar no-print" aria-label="見積管理メニュー">
      <div className="estimate-sidebar-brand">
        <span className="estimate-sidebar-logo" aria-hidden="true">ME</span>
        <div>
          <strong>Mitsumori</strong>
          <span>見積管理</span>
        </div>
      </div>

      <nav className="estimate-sidebar-nav">
        <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
          <span aria-hidden="true">概</span>見積概要
        </button>
        <button type="button" onClick={() => activateMode(0)}>
          <span aria-hidden="true">係</span>係数方式
        </button>
        <button type="button" onClick={() => activateMode(1)}>
          <span aria-hidden="true">積</span>積み上げ方式
        </button>
        <button type="button" onClick={() => scrollToElement(findSectionByText("見積確定チェック"))}>
          <span aria-hidden="true">確</span>見積確定チェック
        </button>
        <button type="button" onClick={() => scrollToElement(findSectionByText("Excel"))}>
          <span aria-hidden="true">X</span>Excelファイル
        </button>
      </nav>

      <div className="estimate-sidebar-status">
        <span>現在の方式</span>
        <strong>{mode}</strong>
        <div className="estimate-sidebar-progress" aria-label={`入力状況 ${percent}%`}>
          <span style={{ width: `${percent}%` }} />
        </div>
        <small>{completion.completed} / {completion.total} 項目入力</small>
      </div>

      <div className="estimate-sidebar-note">
        <strong>Excelを正本として管理</strong>
        <span>作業の区切りでExcelへ出力してください。</span>
      </div>
    </aside>
  );
}

function Header() {
  return (
    <header className="app-hero app-hero-v2 no-print">
      <div className="app-hero-copy">
        <div className="app-hero-meta">
          <span className="app-product-kicker">CUSTOM PROGRAM ESTIMATE</span>
          <span className="app-context-badge">内部業務用</span>
        </div>
        <h1>短期留学プログラム見積管理</h1>
        <p>案件の基礎情報から費用入力、最終確認、Excel保存までを一つの画面で管理します。</p>
      </div>
      <div className="app-header-summary" aria-label="アプリの管理方針">
        <span>計算方式</span>
        <strong>係数方式・積み上げ方式</strong>
        <small>既存の計算ロジックとExcel形式を維持</small>
      </div>
    </header>
  );
}

function StatusBar({ mode, completion }) {
  const percent = useMemo(() => {
    if (!completion.total) return 0;
    return Math.min(100, Math.round((completion.completed / completion.total) * 100));
  }, [completion]);

  return (
    <section className="workflow-status workflow-status-v2 no-print" aria-label="作業状況">
      <article>
        <span className="workflow-label">現在の見積方式</span>
        <strong>{mode}</strong>
        <small>方式はいつでも切り替えられます</small>
      </article>
      <article>
        <div className="workflow-progress-copy">
          <span>入力状況の目安</span>
          <strong>{completion.completed} / {completion.total}</strong>
        </div>
        <div className="workflow-progress-track">
          <span style={{ width: `${percent}%` }} />
        </div>
        <small>{percent}% 入力済み</small>
      </article>
      <article>
        <span className="workflow-label">保存状態</span>
        <strong>ブラウザ内で作業中</strong>
        <small>確定後はExcel出力で保存</small>
      </article>
    </section>
  );
}

export default function ProfessionalUiShell() {
  const [headerTarget, setHeaderTarget] = useState(null);
  const [statusTarget, setStatusTarget] = useState(null);
  const [sidebarTarget, setSidebarTarget] = useState(null);
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

  useEffect(() => {
    const container = document.querySelector(".container");
    const originalTitle = container?.querySelector(":scope > h1");
    const tabs = container?.querySelector(".mode-tabs");
    if (!container || !originalTitle || !tabs) return undefined;

    container.classList.add("professional-app-shell", "professional-app-shell-v2");
    document.body.classList.add("estimate-ui-v2");
    originalTitle.classList.add("legacy-app-title");

    const sidebarMount = document.createElement("div");
    sidebarMount.setAttribute("data-estimate-sidebar", "");
    document.body.prepend(sidebarMount);

    const headerMount = document.createElement("div");
    headerMount.setAttribute("data-professional-header", "");
    container.insertBefore(headerMount, originalTitle);

    const statusMount = document.createElement("div");
    statusMount.setAttribute("data-workflow-status", "");
    container.insertBefore(statusMount, tabs);

    setSidebarTarget(sidebarMount);
    setHeaderTarget(headerMount);
    setStatusTarget(statusMount);

    return () => {
      container.classList.remove("professional-app-shell", "professional-app-shell-v2");
      document.body.classList.remove("estimate-ui-v2");
      originalTitle.classList.remove("legacy-app-title");
      sidebarMount.remove();
      headerMount.remove();
      statusMount.remove();
    };
  }, []);

  return (
    <>
      {sidebarTarget ? createPortal(<Sidebar mode={mode} completion={completion} />, sidebarTarget) : null}
      {headerTarget ? createPortal(<Header />, headerTarget) : null}
      {statusTarget ? createPortal(<StatusBar mode={mode} completion={completion} />, statusTarget) : null}
    </>
  );
}
