import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { MetricCard, SidebarNavButton } from "./ProfessionalUiPrimitives";
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

function extractAmount(labels) {
  const candidates = Array.from(document.querySelectorAll(".container *"));
  for (const element of candidates) {
    const label = element.textContent?.trim() || "";
    if (!labels.some((text) => label === text || label.startsWith(text))) continue;
    const scope = element.closest(".card, .box, .build-up-review-panel, .build-up-workspace, section, article, div");
    const text = scope?.textContent || element.parentElement?.textContent || "";
    const amounts = Array.from(text.matchAll(/(?:¥|￥)?\s*([\d,]+)\s*円/g));
    if (amounts.length) return `${Number(amounts.at(-1)[1].replaceAll(",", "")).toLocaleString("ja-JP")}円`;
  }
  return "—";
}

function getMetrics() {
  const studentInput = Array.from(document.querySelectorAll("input"))
    .find((input) => input.closest("label, div")?.textContent?.includes("学生人数"));
  const studentCount = studentInput?.value ? `${studentInput.value}名` : "—";
  return {
    estimateTotal: extractAmount(["見積金額合計", "見積総額", "合計金額", "総額"]),
    directExpense: extractAmount(["直接経費合計", "入力済み直接経費", "直接経費"]),
    studentCount,
  };
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

function Sidebar({ mode, completion, activeItem, onNavigate }) {
  const percent = completion.total
    ? Math.min(100, Math.round((completion.completed / completion.total) * 100))
    : 0;

  const navigate = (item, action) => {
    onNavigate(item);
    action();
  };

  return (
    <aside className="estimate-sidebar no-print" aria-label="見積管理メニュー">
      <div className="estimate-sidebar-brand">
        <span className="estimate-sidebar-logo" aria-hidden="true">ME</span>
        <div><strong>Mitsumori</strong><span>見積管理</span></div>
      </div>

      <nav className="estimate-sidebar-nav">
        <SidebarNavButton icon="概" active={activeItem === "overview"} onClick={() => navigate("overview", () => window.scrollTo({ top: 0, behavior: "smooth" }))}>見積概要</SidebarNavButton>
        <SidebarNavButton icon="係" active={activeItem === "factor"} onClick={() => navigate("factor", () => activateMode(0))}>係数方式</SidebarNavButton>
        <SidebarNavButton icon="積" active={activeItem === "build-up"} onClick={() => navigate("build-up", () => activateMode(1))}>積み上げ方式</SidebarNavButton>
        <SidebarNavButton icon="確" active={activeItem === "check"} onClick={() => navigate("check", () => scrollToElement(findSectionByText("見積確定チェック")))}>見積確定チェック</SidebarNavButton>
        <SidebarNavButton icon="X" active={activeItem === "excel"} onClick={() => navigate("excel", () => scrollToElement(findSectionByText("Excel")))}>Excelファイル</SidebarNavButton>
      </nav>

      <div className="estimate-sidebar-status">
        <span>現在の方式</span><strong>{mode}</strong>
        <div className="estimate-sidebar-progress" aria-label={`入力状況 ${percent}%`}><span style={{ width: `${percent}%` }} /></div>
        <small>{completion.completed} / {completion.total} 項目入力</small>
      </div>

      <div className="estimate-sidebar-note"><strong>Excelを正本として管理</strong><span>作業の区切りでExcelへ出力してください。</span></div>
    </aside>
  );
}

function Header() {
  return (
    <header className="app-hero app-hero-v2 no-print">
      <div className="app-hero-copy">
        <div className="app-hero-meta"><span className="app-product-kicker">CUSTOM PROGRAM ESTIMATE</span><span className="app-context-badge">内部業務用</span></div>
        <h1>短期留学プログラム見積管理</h1>
        <p>案件の基礎情報から費用入力、最終確認、Excel保存までを一つの画面で管理します。</p>
      </div>
      <div className="app-header-summary" aria-label="アプリの管理方針"><span>計算方式</span><strong>係数方式・積み上げ方式</strong><small>既存の計算ロジックとExcel形式を維持</small></div>
    </header>
  );
}

function StatusBar({ mode, completion, metrics }) {
  const percent = useMemo(() => completion.total ? Math.min(100, Math.round((completion.completed / completion.total) * 100)) : 0, [completion]);
  return (
    <section className="workflow-status workflow-status-v2 no-print" aria-label="作業状況">
      <MetricCard icon="方" label="現在の見積方式" value={mode} note="方式はいつでも切り替えられます" />
      <MetricCard icon="進" label="入力状況の目安" value={`${completion.completed} / ${completion.total}`} note={`${percent}% 入力済み`} tone="slate"><div className="workflow-progress-track"><span style={{ width: `${percent}%` }} /></div></MetricCard>
      <MetricCard icon="保" label="保存状態" value="ブラウザ内で作業中" note="確定後はExcel出力で保存" tone="teal" />
      <MetricCard icon="見" label="見積金額合計" value={metrics.estimateTotal} note="既存画面の計算結果を表示" tone="green" />
      <MetricCard icon="直" label="直接経費合計" value={metrics.directExpense} note="積み上げ方式の表示値" tone="amber" />
      <MetricCard icon="人" label="参加学生数" value={metrics.studentCount} note="基礎情報の入力値" tone="slate" />
    </section>
  );
}

export default function ProfessionalUiShell() {
  const [headerTarget, setHeaderTarget] = useState(null);
  const [statusTarget, setStatusTarget] = useState(null);
  const [sidebarTarget, setSidebarTarget] = useState(null);
  const [mode, setMode] = useState(() => getVisibleMode());
  const [completion, setCompletion] = useState(() => getCompletion());
  const [metrics, setMetrics] = useState(() => getMetrics());
  const [activeItem, setActiveItem] = useState("overview");

  useEffect(() => {
    const refresh = () => {
      const nextMode = getVisibleMode();
      setMode(nextMode);
      setCompletion(getCompletion());
      setMetrics(getMetrics());
      if (nextMode.includes("係数")) setActiveItem((current) => current === "build-up" ? "factor" : current);
      if (nextMode.includes("積み上げ")) setActiveItem((current) => current === "factor" ? "build-up" : current);
    };
    const container = document.querySelector(".container");
    if (!container) return undefined;
    const observer = new MutationObserver(refresh);
    observer.observe(container, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["class", "hidden", "value"] });
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
      sidebarMount.remove(); headerMount.remove(); statusMount.remove();
    };
  }, []);

  return (
    <>
      {sidebarTarget ? createPortal(<Sidebar mode={mode} completion={completion} activeItem={activeItem} onNavigate={setActiveItem} />, sidebarTarget) : null}
      {headerTarget ? createPortal(<Header />, headerTarget) : null}
      {statusTarget ? createPortal(<StatusBar mode={mode} completion={completion} metrics={metrics} />, statusTarget) : null}
    </>
  );
}
