import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { evaluateBuildUpSection, readBuildUpSectionState } from "../lib/buildUpStatus.js";
import { ESTIMATE_SECTION_CHANGE_EVENT } from "../state/useEstimateSectionState.js";
import "./BuildUpWorkspace.css";

const VIEW_KEY = "mitsumori.buildUpWorkspaceView";

const SECTIONS = [
  {
    key: "company",
    title: "企業・施設訪問",
    description: "訪問先ごとの謝礼、交通、ガイドなどを入力",
    match: "企業訪問の直接経費合計",
  },
  {
    key: "culture",
    title: "日本文化体験",
    description: "体験ごとの実施費、入場料、交通費を入力",
    match: "日本文化体験の直接経費合計",
  },
  {
    key: "japanese",
    title: "日本語講座",
    description: "時間単価、授業時間、回数、クラス数を設定",
    match: "日本語講座合計",
  },
  {
    key: "collaboration",
    title: "学生共修・学内文化活動",
    description: "学生との共修、体験、移動などの費用を入力",
    match: "学生共修・学内文化活動合計",
  },
  {
    key: "common",
    title: "共通経費",
    description: "保険、通信、証書、共通の実施経費を入力",
    match: "共通経費合計",
  },
  {
    key: "summary",
    title: "見積サマリー",
    description: "直接経費、管理費、売上高、粗利を確認",
    match: "売上高",
  },
];

function parseYen(text) {
  if (!text || text.trim() === "-") return 0;
  const value = Number(text.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(value) ? value : 0;
}

function formatYen(value) {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function findBuildUpRoot() {
  const headings = [...document.querySelectorAll("h2.mode-title")];
  return headings.find((heading) => heading.textContent.trim() === "積み上げ方式")?.parentElement ?? null;
}

function findAmount(root, match) {
  if (!root) return 0;
  const candidates = root.querySelectorAll("th, span, h3");
  for (const candidate of candidates) {
    if (candidate.closest("[data-build-up-workspace]")) continue;
    if (candidate.textContent.trim() !== match) continue;
    const row = candidate.closest("tr");
    if (row) {
      const cells = row.querySelectorAll("td");
      return parseYen(cells[cells.length - 1]?.textContent ?? "");
    }
    const parent = candidate.parentElement;
    if (parent) return parseYen(parent.querySelector("strong")?.textContent ?? "");
  }
  return 0;
}

function findInputValue(root, labelText) {
  if (!root) return "";
  const label = [...root.querySelectorAll("label")].find(
    (candidate) => candidate.childNodes[0]?.textContent?.trim() === labelText || candidate.textContent.trim() === labelText
  );
  return label?.querySelector("input, select")?.value ?? label?.parentElement?.querySelector("input, select")?.value ?? "";
}

function classifySections(root) {
  if (!root) return;
  const card = root.querySelector(":scope > .card");
  const grid = card?.querySelector(":scope > .grid");
  if (!grid) return;

  const assignByLabel = (labelText, section) => {
    const label = [...grid.querySelectorAll("label")].find((item) => item.textContent.trim().startsWith(labelText));
    const container = label?.closest(".col-12, .col-8, .col-6, .col-4, .col-3");
    if (container) container.dataset.buildUpSection = section;
  };

  assignByLabel("案件名（積み上げ方式用・メモ）", "dashboard");
  assignByLabel("参加人数（見込み）", "dashboard");
  assignByLabel("企業訪問（回数）", "company");
  assignByLabel("日本文化体験（回数）", "culture");
  assignByLabel("企業訪問別の直接経費", "company");
  assignByLabel("日本文化体験別の直接経費", "culture");
  assignByLabel("日本語講座の直接経費", "japanese");
  assignByLabel("学生共修・学内文化活動の直接経費", "collaboration");
  assignByLabel("案件全体の共通経費", "common");

  const summary = grid.querySelector("[data-build-up-summary]");
  if (summary) summary.dataset.buildUpSection = "summary";

  const roadmap = grid.querySelector(".build-up-roadmap");
  const resetContainer = roadmap?.parentElement;
  if (resetContainer) resetContainer.dataset.buildUpSection = "dashboard";
}

function applyView(root, view) {
  if (!root) return;
  classifySections(root);
  root.dataset.buildUpActiveView = view;
  root.querySelectorAll("[data-build-up-section]").forEach((element) => {
    element.hidden = element.dataset.buildUpSection !== view;
  });
  const card = root.querySelector(":scope > .card");
  if (card) card.classList.toggle("build-up-editor-card", view !== "dashboard");
}

function readStatus(section, amount, root) {
  const countLabel = section.key === "company"
    ? "企業訪問（回数）"
    : section.key === "culture"
      ? "日本文化体験（回数）"
      : null;

  return evaluateBuildUpSection({
    sectionKey: section.key,
    amount,
    count: countLabel ? findInputValue(root, countLabel) : null,
    state: readBuildUpSectionState(section.key),
  });
}

function EditorFooter({ amount, onComplete }) {
  return (
    <section className="build-up-editor-footer no-print" data-build-up-workspace>
      <div className="build-up-editor-footer-status">
        <span className="build-up-save-indicator" aria-hidden="true">✓</span>
        <div>
          <strong>入力内容は自動反映されています</strong>
          <span>現在の小計：{formatYen(amount)}。Excelファイルへの保存は、見積画面の保存機能で行います。</span>
        </div>
      </div>
      <button className="build-up-complete" type="button" onClick={onComplete}>
        入力内容を反映して費用一覧へ戻る
      </button>
    </section>
  );
}

function ReviewOverview({ reviews, directCost, onOpen }) {
  const editableReviews = reviews.filter(({ section }) => section.key !== "summary");
  const attention = editableReviews.filter(({ status }) => status.tone === "attention");
  const progress = editableReviews.filter(({ status }) => status.tone === "progress");
  const empty = editableReviews.filter(({ status }) => status.tone === "empty");
  const complete = editableReviews.filter(({ status }) => status.tone === "complete");
  const excluded = editableReviews.filter(({ status }) => status.tone === "excluded");

  const reviewTone = attention.length > 0
    ? "attention"
    : progress.length > 0 || empty.length > 0
      ? "progress"
      : "complete";
  const reviewLabel = attention.length > 0
    ? "要確認あり"
    : progress.length > 0 || empty.length > 0
      ? "入力途中"
      : "確認完了";
  const nextReview = attention[0] ?? progress[0] ?? empty[0] ?? null;

  return (
    <section
      className={`build-up-review-overview ${reviewTone}`}
      aria-label="見積入力状況"
      style={{
        marginTop: 18,
        padding: 16,
        border: "1px solid var(--app-border, #d9e1ec)",
        borderRadius: 14,
        background: reviewTone === "attention" ? "#fffaf0" : reviewTone === "complete" ? "#f5fbf7" : "#f7faff",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div>
          <span className={`build-up-status ${reviewTone}`}>{reviewLabel}</span>
          <h3 style={{ marginTop: 10 }}>Excel出力前の確認状況</h3>
          <p>
            {attention.length > 0
              ? `要確認のカテゴリーが${attention.length}件あります。内容を確認してからExcelを出力してください。`
              : progress.length > 0 || empty.length > 0
                ? "未入力または入力途中のカテゴリーがあります。必要な費用だけ確認してください。"
                : "入力したカテゴリーに要確認項目はありません。見積サマリーで金額を確認できます。"}
          </p>
        </div>
        <div style={{ minWidth: 190, textAlign: "right" }}>
          <span style={{ display: "block", color: "var(--app-muted, #667085)", fontSize: 11 }}>直接経費合計</span>
          <strong style={{ display: "block", marginTop: 4, fontSize: 22, fontVariantNumeric: "tabular-nums" }}>{formatYen(directCost)}</strong>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 10, marginTop: 14 }}>
        {[
          ["入力済み", complete.length],
          ["入力中", progress.length],
          ["未入力", empty.length],
          ["要確認", attention.length],
          ["対象外", excluded.length],
        ].map(([label, count]) => (
          <div key={label} style={{ padding: "10px 12px", border: "1px solid var(--app-border, #d9e1ec)", borderRadius: 10, background: "#fff" }}>
            <span style={{ display: "block", color: "var(--app-muted, #667085)", fontSize: 11 }}>{label}</span>
            <strong style={{ display: "block", marginTop: 2, fontSize: 18 }}>{count}件</strong>
          </div>
        ))}
      </div>

      {nextReview ? (
        <button
          type="button"
          className="build-up-back"
          onClick={() => onOpen(nextReview.section.key)}
          style={{ marginTop: 14 }}
        >
          {nextReview.section.title}を確認する →
        </button>
      ) : (
        <button
          type="button"
          className="build-up-back"
          onClick={() => onOpen("summary")}
          style={{ marginTop: 14 }}
        >
          見積サマリーを確認する →
        </button>
      )}
    </section>
  );
}

function Workspace({ root }) {
  const [view, setView] = useState(() => window.sessionStorage.getItem(VIEW_KEY) || "dashboard");
  const [revision, setRevision] = useState(0);
  const [footerTarget, setFooterTarget] = useState(null);

  useEffect(() => {
    applyView(root, view);
    window.sessionStorage.setItem(VIEW_KEY, view);
    if (view !== "dashboard") {
      root.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [root, view]);

  useEffect(() => {
    const card = root.querySelector(":scope > .card");
    if (!card) return;
    const mount = document.createElement("div");
    mount.dataset.buildUpWorkspaceFooterMount = "";
    card.appendChild(mount);
    setFooterTarget(mount);
    return () => mount.remove();
  }, [root]);

  useEffect(() => {
    const refresh = () => {
      classifySections(root);
      applyView(root, view);
      setRevision((value) => value + 1);
    };
    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(root, { subtree: true, childList: true, characterData: true });
    root.addEventListener("input", refresh);
    root.addEventListener("change", refresh);
    window.addEventListener(ESTIMATE_SECTION_CHANGE_EVENT, refresh);
    return () => {
      observer.disconnect();
      root.removeEventListener("input", refresh);
      root.removeEventListener("change", refresh);
      window.removeEventListener(ESTIMATE_SECTION_CHANGE_EVENT, refresh);
    };
  }, [root, view]);

  const amounts = useMemo(
    () => Object.fromEntries(SECTIONS.map((section) => [section.key, findAmount(root, section.match)])),
    [root, revision]
  );

  const reviews = useMemo(
    () => SECTIONS.map((section) => ({
      section,
      status: readStatus(section, amounts[section.key], root),
    })),
    [amounts, root, revision]
  );

  const directCost = SECTIONS.filter((section) => section.key !== "summary").reduce(
    (sum, section) => sum + (amounts[section.key] || 0),
    0
  );

  const active = SECTIONS.find((section) => section.key === view);
  const returnToDashboard = () => setView("dashboard");

  if (view !== "dashboard") {
    return (
      <>
        <section className="build-up-workspace build-up-editor-heading no-print" data-build-up-workspace>
          <button className="build-up-back" type="button" onClick={returnToDashboard}>
            <span aria-hidden="true">←</span> 費用一覧に戻る
          </button>
          <div>
            <span className="build-up-eyebrow">積み上げ方式・個別編集</span>
            <h3>{active?.title}</h3>
            <p>{active?.description}</p>
          </div>
          <div className="build-up-editor-total">
            <span>現在の小計</span>
            <strong>{formatYen(amounts[view])}</strong>
          </div>
        </section>
        {footerTarget
          ? createPortal(
              <EditorFooter amount={amounts[view]} onComplete={returnToDashboard} />,
              footerTarget
            )
          : null}
      </>
    );
  }

  return (
    <section className="build-up-workspace no-print" data-build-up-workspace>
      <div className="build-up-workspace-intro">
        <div>
          <span className="build-up-eyebrow">積み上げ方式・費用ダッシュボード</span>
          <h3>入力する費用カテゴリーを選択</h3>
          <p>カードで入力状況を確認し、必要なカテゴリーだけを開きます。</p>
        </div>
        <div className="build-up-direct-total">
          <span>入力済み直接経費</span>
          <strong>{formatYen(directCost)}</strong>
        </div>
      </div>

      <ReviewOverview reviews={reviews} directCost={directCost} onOpen={setView} />

      <div className="build-up-category-grid">
        {reviews.map(({ section, status }) => {
          const action = section.key === "summary"
            ? "確認する"
            : status.tone === "complete"
              ? "編集する"
              : status.tone === "excluded"
                ? "変更する"
                : "設定する";
          return (
            <button
              type="button"
              className="build-up-category-card"
              key={section.key}
              onClick={() => setView(section.key)}
            >
              <span className={`build-up-status ${status.tone}`}>{status.label}</span>
              <span className="build-up-category-title">{section.title}</span>
              <span className="build-up-category-description">{section.description}</span>
              <span className="build-up-category-progress">{status.detail}</span>
              <span className="build-up-category-footer">
                <strong>{formatYen(amounts[section.key])}</strong>
                <span>{action} →</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default function BuildUpWorkspace() {
  const [root, setRoot] = useState(null);
  const [target, setTarget] = useState(null);

  useEffect(() => {
    const buildUpRoot = findBuildUpRoot();
    if (!buildUpRoot) return;
    const mount = document.createElement("div");
    mount.dataset.buildUpWorkspaceMount = "";
    const card = buildUpRoot.querySelector(":scope > .card");
    buildUpRoot.insertBefore(mount, card ?? null);
    setRoot(buildUpRoot);
    setTarget(mount);
    return () => mount.remove();
  }, []);

  return root && target ? createPortal(<Workspace root={root} />, target) : null;
}
