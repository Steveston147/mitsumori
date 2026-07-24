import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { yen } from "../lib/format.js";
import { TAX_MODE_OPTIONS } from "../lib/costing.js";

const INITIAL_VALUES = {
  students: "1",
  sessions: "1",
  lines: [
    { key: "honorarium", label: "学生協力費", unitPrice: "", taxMode: "included" },
    { key: "transport", label: "交通費", unitPrice: "", taxMode: "included" },
    { key: "meal", label: "食費・軽食", unitPrice: "", taxMode: "included" },
  ],
};

function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

export function calcStudentCollaborationCost({ students, sessions, lines }) {
  const studentCount = Number(students);
  const sessionCount = Number(sessions);

  if (
    !Number.isFinite(studentCount) ||
    studentCount <= 0 ||
    !Number.isInteger(studentCount) ||
    !Number.isFinite(sessionCount) ||
    sessionCount <= 0 ||
    !Number.isInteger(sessionCount)
  ) {
    return { ok: false, status: "invalid", rows: [], subtotal: 0, taxAmount: 0, total: 0 };
  }

  const rows = lines.map((line) => {
    if (!hasValue(line.unitPrice)) {
      return { ...line, ok: true, status: "empty", subtotal: 0, taxAmount: 0, total: 0 };
    }

    const unitPrice = Number(line.unitPrice);
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      return { ...line, ok: false, status: "invalid", subtotal: 0, taxAmount: 0, total: 0 };
    }

    const subtotal = unitPrice * studentCount * sessionCount;
    let taxAmount = 0;
    let total = subtotal;

    if (line.taxMode === "excluded") {
      taxAmount = Math.round(subtotal * 0.1);
      total = subtotal + taxAmount;
    } else if (line.taxMode === "included") {
      taxAmount = Math.round((subtotal * 10) / 110);
    } else if (line.taxMode !== "exempt") {
      return { ...line, ok: false, status: "invalid", subtotal: 0, taxAmount: 0, total: 0 };
    }

    return { ...line, ok: true, status: "calculated", subtotal, taxAmount, total };
  });

  const hasInput = rows.some((row) => row.status === "calculated");
  const ok = rows.every((row) => row.ok);

  return {
    ok,
    status: !ok ? "invalid" : hasInput ? "calculated" : "empty",
    rows,
    subtotal: rows.reduce((sum, row) => sum + row.subtotal, 0),
    taxAmount: rows.reduce((sum, row) => sum + row.taxAmount, 0),
    total: rows.reduce((sum, row) => sum + row.total, 0),
  };
}

function StudentCalculator() {
  const [values, setValues] = useState(INITIAL_VALUES);
  const result = useMemo(() => calcStudentCollaborationCost(values), [values]);

  function update(field, value) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function updateLine(index, field, value) {
    setValues((current) => ({
      ...current,
      lines: current.lines.map((line, lineIndex) =>
        lineIndex === index ? { ...line, [field]: value } : line
      ),
    }));
  }

  function reset() {
    setValues(INITIAL_VALUES);
  }

  return (
    <div className="col-12">
      <div className="hr" />
      <label>学生共修の直接経費</label>
      <div className="small">
        1人1回あたり単価 × 協力学生数 × 実施回数で計算します。
      </div>

      <section className="visit-card">
        <div className="visit-card-header">
          <h3>学生共修</h3>
          <strong>
            合計：{result.status === "calculated" ? yen(Math.round(result.total)) : "-"}
          </strong>
        </div>

        <div className="cost-input-grid">
          <label>
            協力学生数
            <input
              type="number"
              min="1"
              step="1"
              value={values.students}
              onChange={(event) => update("students", event.target.value)}
            />
          </label>
          <label>
            実施回数
            <input
              type="number"
              min="1"
              step="1"
              value={values.sessions}
              onChange={(event) => update("sessions", event.target.value)}
            />
          </label>
        </div>

        <div className="cost-table-wrap">
          <table className="table visit-cost-table">
            <thead>
              <tr>
                <th>経費項目</th>
                <th>1人1回あたり単価</th>
                <th>税区分</th>
                <th>消費税</th>
                <th>小計</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row, index) => (
                <tr key={row.key} className={!row.ok ? "cost-line-invalid" : undefined}>
                  <td>{row.label}</td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={values.lines[index].unitPrice}
                      placeholder="金額"
                      aria-label={`${row.label}の1人1回あたり単価`}
                      onChange={(event) => updateLine(index, "unitPrice", event.target.value)}
                    />
                  </td>
                  <td>
                    <select
                      value={values.lines[index].taxMode}
                      aria-label={`${row.label}の税区分`}
                      onChange={(event) => updateLine(index, "taxMode", event.target.value)}
                    >
                      {TAX_MODE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>{row.status === "calculated" ? yen(Math.round(row.taxAmount)) : "-"}</td>
                  <td>{row.status === "calculated" ? yen(Math.round(row.total)) : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!result.ok && (
          <div className="warn">
            協力学生数と実施回数は1以上の整数、各単価は0円以上で入力してください。
          </div>
        )}

        <table className="table">
          <tbody>
            <tr>
              <th>計算条件</th>
              <td>{values.students}人 × {values.sessions}回</td>
            </tr>
            <tr>
              <th>税計算前金額</th>
              <td>{result.status === "calculated" ? yen(Math.round(result.subtotal)) : "-"}</td>
            </tr>
            <tr>
              <th>消費税</th>
              <td>{result.status === "calculated" ? yen(Math.round(result.taxAmount)) : "-"}</td>
            </tr>
            <tr>
              <th>学生共修合計</th>
              <td><strong>{result.status === "calculated" ? yen(Math.round(result.total)) : "-"}</strong></td>
            </tr>
          </tbody>
        </table>

        <button className="btn secondary" type="button" onClick={reset}>
          学生共修をリセット
        </button>
      </section>

      <div className="small">
        ※ 消費税は各行で1円未満を四捨五入します。学生共修の直接経費だけを計算し、
        共通経費・販管費・全体原価への自動加算は行いません。
      </div>
    </div>
  );
}

export default function StudentCollaborationCosts() {
  const [target, setTarget] = useState(null);

  useEffect(() => {
    const roadmap = document.querySelector(".build-up-roadmap");
    setTarget(roadmap?.parentElement ?? null);
  }, []);

  return target ? createPortal(<StudentCalculator />, target) : null;
}
