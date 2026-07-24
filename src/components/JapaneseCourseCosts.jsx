import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { yen } from "../lib/format.js";
import { TAX_MODE_OPTIONS } from "../lib/costing.js";

const INITIAL_VALUES = {
  hourlyRate: "",
  hoursPerSession: "2",
  sessions: "1",
  classes: "1",
  taxMode: "included",
};

function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

export function calcJapaneseCourseCost({
  hourlyRate,
  hoursPerSession,
  sessions,
  classes,
  taxMode,
}) {
  if (!hasValue(hourlyRate)) {
    return { ok: true, status: "empty", subtotal: 0, taxAmount: 0, total: 0 };
  }

  const rate = Number(hourlyRate);
  const hours = Number(hoursPerSession);
  const sessionCount = Number(sessions);
  const classCount = Number(classes);

  if (
    !Number.isFinite(rate) ||
    rate < 0 ||
    !Number.isFinite(hours) ||
    hours <= 0 ||
    !Number.isFinite(sessionCount) ||
    sessionCount <= 0 ||
    !Number.isInteger(sessionCount) ||
    !Number.isFinite(classCount) ||
    classCount <= 0 ||
    !Number.isInteger(classCount)
  ) {
    return { ok: false, status: "invalid", subtotal: 0, taxAmount: 0, total: 0 };
  }

  const subtotal = rate * hours * sessionCount * classCount;
  let taxAmount = 0;
  let total = subtotal;

  if (taxMode === "excluded") {
    taxAmount = Math.round(subtotal * 0.1);
    total = subtotal + taxAmount;
  } else if (taxMode === "included") {
    taxAmount = Math.round((subtotal * 10) / 110);
  } else if (taxMode !== "exempt") {
    return { ok: false, status: "invalid", subtotal: 0, taxAmount: 0, total: 0 };
  }

  return {
    ok: true,
    status: "calculated",
    subtotal,
    taxAmount,
    total,
  };
}

function CourseCalculator() {
  const [values, setValues] = useState(INITIAL_VALUES);
  const result = useMemo(() => calcJapaneseCourseCost(values), [values]);

  function update(field, value) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function reset() {
    setValues(INITIAL_VALUES);
  }

  return (
    <div className="col-12">
      <div className="hr" />
      <label>日本語講座の直接経費</label>
      <div className="small">
        時間単価 × 1回の時間数 × 回数 × クラス数で講師費用を計算します。
      </div>

      <section className="visit-card">
        <div className="visit-card-header">
          <h3>日本語講座</h3>
          <strong>
            合計：{result.status === "calculated" ? yen(Math.round(result.total)) : "-"}
          </strong>
        </div>

        <div className="cost-input-grid">
          <label>
            時間単価
            <input
              type="number"
              min="0"
              step="1000"
              value={values.hourlyRate}
              placeholder="金額"
              onChange={(event) => update("hourlyRate", event.target.value)}
            />
          </label>
          <label>
            1回の時間数
            <input
              type="number"
              min="0.25"
              step="0.25"
              value={values.hoursPerSession}
              onChange={(event) => update("hoursPerSession", event.target.value)}
            />
          </label>
          <label>
            回数
            <input
              type="number"
              min="1"
              step="1"
              value={values.sessions}
              onChange={(event) => update("sessions", event.target.value)}
            />
          </label>
          <label>
            クラス数
            <input
              type="number"
              min="1"
              step="1"
              value={values.classes}
              onChange={(event) => update("classes", event.target.value)}
            />
          </label>
          <label>
            税区分
            <select
              value={values.taxMode}
              onChange={(event) => update("taxMode", event.target.value)}
            >
              {TAX_MODE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {!result.ok && (
          <div className="warn">
            時間単価は0円以上、時間数は0より大きい数字、回数とクラス数は1以上の整数で入力してください。
          </div>
        )}

        <table className="table">
          <tbody>
            <tr>
              <th>計算式</th>
              <td>
                {result.status === "calculated"
                  ? `${yen(Number(values.hourlyRate))} × ${values.hoursPerSession}時間 × ${values.sessions}回 × ${values.classes}クラス`
                  : "-"}
              </td>
            </tr>
            <tr>
              <th>税計算前金額</th>
              <td>
                {result.status === "calculated" ? yen(Math.round(result.subtotal)) : "-"}
              </td>
            </tr>
            <tr>
              <th>消費税</th>
              <td>
                {result.status === "calculated" ? yen(Math.round(result.taxAmount)) : "-"}
              </td>
            </tr>
            <tr>
              <th>日本語講座合計</th>
              <td>
                <strong>
                  {result.status === "calculated" ? yen(Math.round(result.total)) : "-"}
                </strong>
              </td>
            </tr>
          </tbody>
        </table>

        <button className="btn secondary" type="button" onClick={reset}>
          日本語講座をリセット
        </button>
      </section>

      <div className="small">
        ※ 消費税は1円未満を四捨五入します。日本語講座の直接経費だけを計算し、
        共通経費・販管費・全体原価への自動加算は行いません。
      </div>
    </div>
  );
}

export default function JapaneseCourseCosts() {
  const [target, setTarget] = useState(null);

  useEffect(() => {
    const roadmap = document.querySelector(".build-up-roadmap");
    setTarget(roadmap?.parentElement ?? null);
  }, []);

  return target ? createPortal(<CourseCalculator />, target) : null;
}
