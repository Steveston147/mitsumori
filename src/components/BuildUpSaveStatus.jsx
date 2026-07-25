import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import "./BuildUpSaveStatus.css";

const DIRTY_KEY = "mitsumori.buildUpDirtySinceExcel";
const LAST_SAVED_KEY = "mitsumori.buildUpLastExcelSavedAt";

function readDirty() {
  return window.sessionStorage.getItem(DIRTY_KEY) === "true";
}

function readLastOutput() {
  return window.sessionStorage.getItem(LAST_SAVED_KEY) || "";
}

function formatOutputTime(value) {
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

function findBuildUpRoot() {
  return [...document.querySelectorAll("h2.mode-title")]
    .find((heading) => heading.textContent.trim() === "積み上げ方式")
    ?.parentElement ?? null;
}

function SaveStatePanel({ dirty, lastOutput }) {
  return (
    <section
      className={`build-up-save-state ${dirty ? "is-dirty" : "is-saved"}`}
      data-build-up-save-status
    >
      <div className="build-up-save-state-copy">
        <span className="build-up-save-state-icon" aria-hidden="true">
          {dirty ? "!" : "✓"}
        </span>
        <div>
          <strong>
            {dirty
              ? "この内容はまだExcelファイルとして出力されていません"
              : "この内容は最新のExcel出力と一致しています"}
          </strong>
          <span>
            {dirty
              ? "入力内容はブラウザ内に自動反映されています。必要な時点でExcelを出力してください。"
              : `最終Excel出力：${formatOutputTime(lastOutput)}`}
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
  const [target, setTarget] = useState(null);
  const [buildUpRoot, setBuildUpRoot] = useState(null);
  const [visible, setVisible] = useState(false);
  const [dirty, setDirty] = useState(() => readDirty());
  const [lastOutput, setLastOutput] = useState(() => readLastOutput());

  useEffect(() => {
    let cancelled = false;
    let frameId = 0;

    const mountOutsideWorkspace = () => {
      const root = findBuildUpRoot();
      if (!root) {
        frameId = window.requestAnimationFrame(mountOutsideWorkspace);
        return;
      }

      const mount = document.createElement("div");
      mount.dataset.buildUpSaveStatusMount = "";
      root.insertAdjacentElement("afterend", mount);

      if (cancelled) {
        mount.remove();
        return;
      }

      const exportButton = document.querySelector("[data-estimate-excel-export] button");
      if (exportButton) exportButton.textContent = "Excelを出力";

      const exportDescription = document.querySelector("[data-estimate-excel-export] p");
      if (exportDescription) {
        exportDescription.textContent =
          "共通情報、入力値、計算表、再利用用データをExcelファイルとして出力します。";
      }

      setBuildUpRoot(root);
      setTarget(mount);
      setVisible(!root.hidden);
    };

    mountOutsideWorkspace();

    return () => {
      cancelled = true;
      if (frameId) window.cancelAnimationFrame(frameId);
      document.querySelector("[data-build-up-save-status-mount]")?.remove();
    };
  }, []);

  useEffect(() => {
    if (!buildUpRoot) return undefined;

    const refreshVisibility = () => setVisible(!buildUpRoot.hidden);

    const markDirty = (event) => {
      if (!(event.target instanceof Element) || !buildUpRoot.contains(event.target)) return;
      window.sessionStorage.setItem(DIRTY_KEY, "true");
      setDirty(true);
    };

    const markOutput = (event) => {
      if (!(event.target instanceof Element)) return;
      if (!event.target.closest("[data-estimate-excel-export] button")) return;
      const outputAt = new Date().toISOString();
      window.sessionStorage.setItem(DIRTY_KEY, "false");
      window.sessionStorage.setItem(LAST_SAVED_KEY, outputAt);
      setDirty(false);
      setLastOutput(outputAt);
    };

    const visibilityObserver = new MutationObserver(refreshVisibility);
    visibilityObserver.observe(buildUpRoot, {
      attributes: true,
      attributeFilter: ["hidden"],
    });

    buildUpRoot.addEventListener("input", markDirty, true);
    buildUpRoot.addEventListener("change", markDirty, true);
    document.addEventListener("click", markOutput, true);
    refreshVisibility();

    return () => {
      visibilityObserver.disconnect();
      buildUpRoot.removeEventListener("input", markDirty, true);
      buildUpRoot.removeEventListener("change", markDirty, true);
      document.removeEventListener("click", markOutput, true);
    };
  }, [buildUpRoot]);

  if (!target || !visible) return null;

  return createPortal(
    <SaveStatePanel dirty={dirty} lastOutput={lastOutput} />,
    target
  );
}
