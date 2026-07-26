import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { evaluateBuildUpSection, readBuildUpSectionState } from "../lib/buildUpStatus.js";
import { ESTIMATE_SECTION_CHANGE_EVENT } from "../state/useEstimateSectionState.js";
import "./FinalEstimateCheck.css";

const SECTION_DEFINITIONS = [
  { key: "company", title: "企業・施設訪問", countLabel: "企業訪問（回数）" },
  { key: "culture", title: "日本文化体験", countLabel: "日本文化体験（回数）" },
  { key: "japanese", title: "日本語講座" },
  { key: "collaboration", title: "学生共修・学内文化活動" },
  { key: "common", title: "共通経費" },
];

const VIEW_KEY = "mitsumori.buildUpWorkspaceView";
const CHECKED_FINGERPRINT_KEY = "mitsumori.finalCheckFingerprint";
const CHECKED_AT_KEY = "mitsumori.finalCheckAt";

function safeParse(value, fallback = {}) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function findBuildUpRoot() {
  return [...document.querySelectorAll("h2.mode-title")]
    .find((heading) => heading.textContent.trim() === "積み上げ方式")
    ?.parentElement ?? null;
}

function findInputValue(root, labelText) {
  if (!root) return "";
  const label = [...root.querySelectorAll("label")].find((candidate) =>
    candidate.childNodes[0]?.textContent?.trim() === labelText
      || candidate.textContent.trim() === labelText
  );
  return label?.querySelector("input, select")?.value
    ?? label?.parentElement?.querySelector("input, select")?.value
    ?? "";
}

function collectFingerprint() {
  const storage = {};
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (key?.startsWith("mitsumori.")) storage[key] = window.localStorage.getItem(key);
  }
  const controls = [...document.querySelectorAll("input, select, textarea")].map((control, index) => ({
    index,
    name: control.name || control.id || "",
    type: control.type || control.tagName,
    value: control.type === "checkbox" ? control.checked : control.value,
  }));
  return JSON.stringify({ storage, controls });
}

function validateBasicInfo() {
  const info = safeParse(window.localStorage.getItem("mitsumori.programBasicInfo"));
  const issues = [];
  const warnings = [];
  const required = [
    ["universityName", "大学・団体名"],
    ["programName", "プログラム名"],
    ["startDate", "開始日"],
    ["endDate", "終了日"],
  ];
  required.forEach(([key, label]) => {
    if (!String(info[key] ?? "").trim()) {
      issues.push({ section: "basic", title: "基礎情報", message: `${label}を入力してください。` });
    }
  });

  const students = Number(info.studentCount);
  const escorts = Number(info.escortCount);
  if (!Number.isInteger(students) || students < 1) {
    issues.push({ section: "basic", title: "基礎情報", message: "参加学生数は1名以上の整数で入力してください。" });
  }
  if (!Number.isInteger(escorts) || escorts < 0) {
    issues.push({ section: "basic", title: "基礎情報", message: "引率者数は0名以上の整数で入力してください。" });
  }
  if (info.startDate && info.endDate && info.startDate > info.endDate) {
    issues.push({ section: "basic", title: "基礎情報", message: "終了日は開始日以降に設定してください。" });
  }
  if (!String(info.campus ?? "").trim()) {
    warnings.push({ section: "basic", title: "基礎情報", message: "実施キャンパスが未入力です。" });
  }
  return { issues, warnings };
}

function runEstimateCheck(root) {
  const basic = validateBasicInfo();
  const errors = [...basic.issues];
  const warnings = [...basic.warnings];
  const sectionResults = SECTION_DEFINITIONS.map((section) => {
    const count = section.countLabel ? findInputValue(root, section.countLabel) : null;
    const status = evaluateBuildUpSection({
      sectionKey: section.key,
      count,
      state: readBuildUpSectionState(section.key),
    });
    if (status.tone === "attention") {
      errors.push({ section: section.key, title: section.title, message: status.detail || "入力内容を確認してください。" });
    } else if (status.tone === "progress" || status.tone === "empty") {
      warnings.push({ section: section.key, title: section.title, message: status.detail || "入力状況を確認してください。" });
    }
    return { ...section, status };
  });

  return {
    errors,
    warnings,
    sectionResults,
    checkedAt: new Date().toISOString(),
    fingerprint: collectFingerprint(),
  };
}

function formatCheckedAt(value) {
  if (!value) return "未実施";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "時刻不明";
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function ResultList({ title, items, tone, onOpen }) {
  if (items.length === 0) return null;
  return (
    <section className={`final-check-list ${tone}`}>
      <h4>{title}（{items.length}件）</h4>
      {items.map((item, index) => (
        <button
          type="button"
          key={`${item.section}-${index}`}
          onClick={() => onOpen(item.section)}
        >
          <span>{item.title}</span>
          <strong>{item.message}</strong>
          <em>修正する →</em>
        </button>
      ))}
    </section>
  );
}

export default function FinalEstimateCheck() {
  const [root, setRoot] = useState(null);
  const [target, setTarget] = useState(null);
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState(null);
  const [revision, setRevision] = useState(0);
  const allowNextExport = useRef(false);

  useEffect(() => {
    const buildUpRoot = findBuildUpRoot();
    const workspaceMount = buildUpRoot?.querySelector("[data-build-up-workspace-mount]");
    if (!buildUpRoot || !workspaceMount) return undefined;
    const mount = document.createElement("div");
    mount.dataset.finalEstimateCheckMount = "";
    workspaceMount.insertAdjacentElement("afterend", mount);
    setRoot(buildUpRoot);
    setTarget(mount);
    return () => mount.remove();
  }, []);

  const currentFingerprint = useMemo(() => collectFingerprint(), [revision]);
  const lastFingerprint = window.sessionStorage.getItem(CHECKED_FINGERPRINT_KEY) || "";
  const lastCheckedAt = window.sessionStorage.getItem(CHECKED_AT_KEY) || "";
  const checkIsCurrent = Boolean(lastFingerprint && lastFingerprint === currentFingerprint);

  function executeCheck() {
    if (!root) return null;
    const next = runEstimateCheck(root);
    window.sessionStorage.setItem(CHECKED_FINGERPRINT_KEY, next.fingerprint);
    window.sessionStorage.setItem(CHECKED_AT_KEY, next.checkedAt);
    setResult(next);
    setRevision((value) => value + 1);
    return next;
  }

  function requestCheck() {
    executeCheck();
    setOpen(true);
  }

  function openSection(section) {
    setOpen(false);
    if (section === "basic") {
      document.querySelector("[data-program-basic-info]")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    window.sessionStorage.setItem(VIEW_KEY, section);
    window.dispatchEvent(new CustomEvent("mitsumori-final-check-open-section", { detail: { section } }));
    root?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function continueExport() {
    allowNextExport.current = true;
    setOpen(false);
    document.querySelector("[data-estimate-excel-export] button")?.click();
  }

  useEffect(() => {
    const markChanged = () => setRevision((value) => value + 1);
    root?.addEventListener("input", markChanged, true);
    root?.addEventListener("change", markChanged, true);
    window.addEventListener(ESTIMATE_SECTION_CHANGE_EVENT, markChanged);
    window.addEventListener("program-basic-info-change", markChanged);
    return () => {
      root?.removeEventListener("input", markChanged, true);
      root?.removeEventListener("change", markChanged, true);
      window.removeEventListener(ESTIMATE_SECTION_CHANGE_EVENT, markChanged);
      window.removeEventListener("program-basic-info-change", markChanged);
    };
  }, [root]);

  useEffect(() => {
    const interceptExport = (event) => {
      const button = event.target instanceof Element
        ? event.target.closest("[data-estimate-excel-export] button")
        : null;
      if (!button) return;
      if (allowNextExport.current) {
        allowNextExport.current = false;
        return;
      }
      const next = runEstimateCheck(root);
      window.sessionStorage.setItem(CHECKED_FINGERPRINT_KEY, next.fingerprint);
      window.sessionStorage.setItem(CHECKED_AT_KEY, next.checkedAt);
      setResult(next);
      setRevision((value) => value + 1);
      if (next.errors.length === 0 && next.warnings.length === 0) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      setOpen(true);
    };
    document.addEventListener("click", interceptExport, true);
    return () => document.removeEventListener("click", interceptExport, true);
  }, [root]);

  const status = result
    ? result.errors.length > 0
      ? "error"
      : result.warnings.length > 0
        ? "warning"
        : "complete"
    : checkIsCurrent
      ? "complete"
      : "pending";

  if (!target) return null;

  return (
    <>
      {createPortal(
        <section className={`final-check-entry ${status} no-print`}>
          <div>
            <span>最終ステップ</span>
            <strong>Excel出力前の見積確定チェック</strong>
            <p>
              {status === "complete"
                ? `確認済みです。最終チェック：${formatCheckedAt(result?.checkedAt || lastCheckedAt)}`
                : status === "error"
                  ? `${result.errors.length}件の修正が必要です。`
                  : status === "warning"
                    ? `${result.warnings.length}件の確認事項があります。`
                    : "基礎情報と費用入力を点検して、Excel出力できる状態か確認します。"}
            </p>
          </div>
          <button type="button" onClick={requestCheck}>見積確定チェック</button>
        </section>,
        target
      )}

      {open && result
        ? createPortal(
            <div className="final-check-backdrop" role="presentation" onMouseDown={() => setOpen(false)}>
              <section className="final-check-dialog" role="dialog" aria-modal="true" aria-labelledby="final-check-title" onMouseDown={(event) => event.stopPropagation()}>
                <header>
                  <div>
                    <span>Excel出力前確認</span>
                    <h3 id="final-check-title">
                      {result.errors.length > 0
                        ? "修正が必要です"
                        : result.warnings.length > 0
                          ? "確認事項があります"
                          : "見積データを出力できます"}
                    </h3>
                    <p>最終チェック：{formatCheckedAt(result.checkedAt)}</p>
                  </div>
                  <button type="button" className="final-check-close" onClick={() => setOpen(false)} aria-label="閉じる">×</button>
                </header>

                <div className="final-check-summary">
                  <div><span>エラー</span><strong>{result.errors.length}</strong></div>
                  <div><span>警告</span><strong>{result.warnings.length}</strong></div>
                  <div><span>確認対象</span><strong>{SECTION_DEFINITIONS.length + 1}</strong></div>
                </div>

                {result.errors.length === 0 && result.warnings.length === 0
                  ? <div className="final-check-success">必須項目と費用入力に問題はありません。</div>
                  : null}

                <ResultList title="修正が必要" items={result.errors} tone="error" onOpen={openSection} />
                <ResultList title="確認事項" items={result.warnings} tone="warning" onOpen={openSection} />

                <footer>
                  <button type="button" className="secondary" onClick={() => setOpen(false)}>閉じる</button>
                  {result.errors.length === 0
                    ? <button type="button" className="primary" onClick={continueExport}>
                        {result.warnings.length > 0 ? "確認してExcel出力" : "Excel出力"}
                      </button>
                    : null}
                </footer>
              </section>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
