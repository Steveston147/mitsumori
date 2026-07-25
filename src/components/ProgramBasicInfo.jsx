import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

const STORAGE_KEY = "mitsumori.programBasicInfo";

const DEFAULT_INFO = {
  programName: "",
  universityName: "",
  startDate: "",
  endDate: "",
  studentCount: "15",
  escortCount: "0",
  campus: "",
  accommodationName: "",
  checkInDate: "",
  checkOutDate: "",
  firstCancellationFeeDate: "",
  cancellationPolicyNote: "",
  accommodationArrangement: "未定",
};

const LEGACY_COMMON_LABELS = [
  "案件名（メモ用）",
  "案件名（積み上げ方式用・メモ）",
  "参加人数（見込み）",
  "実施期間（週）",
];

function loadInfo() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved ? { ...DEFAULT_INFO, ...JSON.parse(saved) } : DEFAULT_INFO;
  } catch {
    return DEFAULT_INFO;
  }
}

function countDays(startDate, endDate) {
  if (!startDate || !endDate) return null;
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const milliseconds = end.getTime() - start.getTime();
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return null;
  return Math.floor(milliseconds / 86400000) + 1;
}

function findLabels(labelText) {
  return Array.from(document.querySelectorAll("label")).filter(
    (candidate) => candidate.textContent.trim() === labelText
  );
}

function updateLegacyInputs(labelText, value) {
  findLabels(labelText).forEach((label) => {
    const input = label.parentElement?.querySelector("input, select");
    if (!input || String(input.value) === String(value)) return;

    const prototype = input.tagName === "SELECT"
      ? window.HTMLSelectElement.prototype
      : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
    setter?.call(input, String(value));
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function hideLegacyCommonFields() {
  LEGACY_COMMON_LABELS.forEach((labelText) => {
    findLabels(labelText).forEach((label) => {
      const field = label.closest(".col-3, .col-4, .col-8, .col-12");
      if (field && !field.closest("[data-program-basic-info]")) {
        field.hidden = true;
      }
    });
  });
}

function Field({ label, children, className = "col-4" }) {
  return (
    <div className={className}>
      <label>{label}</label>
      {children}
    </div>
  );
}

function ProgramBasicInfoForm() {
  const [info, setInfo] = useState(loadInfo);

  const durationDays = useMemo(
    () => countDays(info.startDate, info.endDate),
    [info.startDate, info.endDate]
  );
  const durationWeeks = durationDays ? Math.max(1, Math.ceil(durationDays / 7)) : null;
  const totalCount = Math.max(0, Number(info.studentCount) || 0)
    + Math.max(0, Number(info.escortCount) || 0);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(info));
    window.dispatchEvent(
      new CustomEvent("program-basic-info-change", {
        detail: { ...info, durationDays, durationWeeks, totalCount },
      })
    );

    updateLegacyInputs("案件名（メモ用）", info.programName);
    updateLegacyInputs("案件名（積み上げ方式用・メモ）", info.programName);
    updateLegacyInputs("参加人数（見込み）", info.studentCount);
    updateLegacyInputs("参加人数", info.studentCount);
    if (durationWeeks) {
      updateLegacyInputs("実施期間（週）", durationWeeks);
      updateLegacyInputs("実施期間", durationWeeks);
    }
    hideLegacyCommonFields();
  }, [info, durationDays, durationWeeks, totalCount]);

  useEffect(() => {
    hideLegacyCommonFields();
    const observer = new MutationObserver(hideLegacyCommonFields);
    observer.observe(document.body, { subtree: true, childList: true });
    return () => observer.disconnect();
  }, []);

  function update(key, value) {
    setInfo((current) => ({ ...current, [key]: value }));
  }

  function reset() {
    setInfo(DEFAULT_INFO);
  }

  return (
    <section className="card no-print" data-program-basic-info>
      <div className="grid">
        <div className="col-12">
          <label>プログラム基礎情報（係数方式・積み上げ方式共通）</label>
          <div className="small">
            見積方式を切り替えても同じ情報を利用します。入力内容はこのブラウザにのみ保存されます。
          </div>
        </div>

        <Field label="プログラム名称" className="col-8">
          <input
            value={info.programName}
            onChange={(event) => update("programName", event.target.value)}
            placeholder="例：2027 Winter Custom Program"
          />
        </Field>
        <Field label="大学名・機関名">
          <input
            value={info.universityName}
            onChange={(event) => update("universityName", event.target.value)}
            placeholder="例：INHA University"
          />
        </Field>

        <Field label="開始日">
          <input
            type="date"
            value={info.startDate}
            onChange={(event) => update("startDate", event.target.value)}
          />
        </Field>
        <Field label="終了日">
          <input
            type="date"
            min={info.startDate || undefined}
            value={info.endDate}
            onChange={(event) => update("endDate", event.target.value)}
          />
        </Field>
        <Field label="期間（自動計算）">
          <input
            value={durationDays ? `${durationDays}日間（${durationWeeks}週間扱い）` : ""}
            readOnly
            placeholder="開始日・終了日から自動計算"
          />
        </Field>

        <Field label="学生人数">
          <input
            type="number"
            min="1"
            step="1"
            value={info.studentCount}
            onChange={(event) => update("studentCount", event.target.value)}
          />
        </Field>
        <Field label="引率者人数">
          <input
            type="number"
            min="0"
            step="1"
            value={info.escortCount}
            onChange={(event) => update("escortCount", event.target.value)}
          />
        </Field>
        <Field label="総人数（自動計算）">
          <input value={`${totalCount}人`} readOnly />
        </Field>

        <Field label="実施キャンパス・主な実施場所">
          <input
            value={info.campus}
            onChange={(event) => update("campus", event.target.value)}
            placeholder="例：OIC / 衣笠 / 京都市内"
          />
        </Field>
        <Field label="宿舎名" className="col-8">
          <input
            value={info.accommodationName}
            onChange={(event) => update("accommodationName", event.target.value)}
            placeholder="例：OICセミナーハウス、ホテル、先方手配"
          />
        </Field>

        <Field label="チェックイン日">
          <input
            type="date"
            value={info.checkInDate}
            onChange={(event) => update("checkInDate", event.target.value)}
          />
        </Field>
        <Field label="チェックアウト日">
          <input
            type="date"
            min={info.checkInDate || undefined}
            value={info.checkOutDate}
            onChange={(event) => update("checkOutDate", event.target.value)}
          />
        </Field>
        <Field label="初回キャンセル料発生日">
          <input
            type="date"
            value={info.firstCancellationFeeDate}
            onChange={(event) => update("firstCancellationFeeDate", event.target.value)}
          />
          <div className="small">
            この日以降、最初のキャンセル料が発生する日。別アプリのアラート基準に利用できます。
          </div>
        </Field>

        <Field label="宿舎手配主体">
          <select
            value={info.accommodationArrangement}
            onChange={(event) => update("accommodationArrangement", event.target.value)}
          >
            <option value="未定">未定</option>
            <option value="当社手配">当社手配</option>
            <option value="大学手配">大学手配</option>
            <option value="先方直接手配">先方直接手配</option>
          </select>
        </Field>
        <Field label="キャンセル条件メモ" className="col-8">
          <input
            value={info.cancellationPolicyNote}
            onChange={(event) => update("cancellationPolicyNote", event.target.value)}
            placeholder="例：60日前20％、30日前50％、7日前100％"
          />
        </Field>

        <div className="col-12">
          <button className="btn secondary" type="button" onClick={reset}>
            基礎情報をリセット
          </button>
        </div>
      </div>
    </section>
  );
}

export default function ProgramBasicInfo() {
  const [target, setTarget] = useState(null);

  useEffect(() => {
    const container = document.querySelector(".container");
    const tabs = container?.querySelector(".mode-tabs");
    if (!container || !tabs) return;

    const mount = document.createElement("div");
    mount.setAttribute("data-program-basic-info-mount", "");
    container.insertBefore(mount, tabs);
    setTarget(mount);

    return () => mount.remove();
  }, []);

  return target ? createPortal(<ProgramBasicInfoForm />, target) : null;
}
