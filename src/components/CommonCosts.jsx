import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { yen } from "../lib/format.js";
import { TAX_MODE_OPTIONS } from "../lib/costing.js";

const BASIS_OPTIONS = [
  { value: "fixed", label: "案件全体" },
  { value: "participant", label: "1人あたり" },
  { value: "day", label: "1日あたり" },
];

const INITIAL_VALUES = {
  participants: "15",
  days: "1",
  lines: [
    { key: "venue", label: "会場・施設使用料", basis: "fixed", unitPrice: "", taxMode: "included" },
    { key: "staff", label: "職員・運営スタッフ費", basis: "day", unitPrice: "", taxMode: "included" },
    { key: "materials", label: "教材・印刷・消耗品費", basis: "participant", unitPrice: "", taxMode: "included" },
    { key: "communication", label: "通信・郵送・事務費", basis: "fixed", unitPrice: "", taxMode: "included" },
    { key: "other", label: "その他共通経費", basis: "fixed", unitPrice: "", taxMode: "included" },
  ],
};

function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

export function calcCommonCosts({ participants, days, lines }) {
  const participantCount = Number(participants);
  const dayCount = Number(days);

  if (
    !Number.isFinite(participantCount) ||
    participantCount <= 0 ||
    !Number.isInteger(participantCount) ||
    !Number.isFinite(dayCount) ||
    dayCount <= 0 ||
    !Number.isInteger(dayCount)
  ) {
    return { ok: false, status: "invalid", rows: [], subtotal: 0, taxAmount: 0, total: 0 };
  }

  const rows = lines.map((line) => {
    if (!hasValue(line.unitPrice)) {
      return { ...line, ok: true, status: "empty", quantity: 0, subtotal: 0, taxAmount: 0, total: 0 };
    }

    const unitPrice = Number(line.unitPrice);
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      return { ...line, ok: false, status: "invalid", quantity: 0, subtotal: 0, taxAmount: 0, total: 0 };
    }

    const quantity =
      line.basis === "fixed" ? 1 : line.basis === "participant" ? participantCount : line.basis === "day" ? dayCount : null;

    if (quantity === null) {
      return { ...line, ok: false, status: "invalid", quantity: 0, subtotal: 0, taxAmount: 0, total: 0 };
    }

    const subtotal = unitPrice * quantity;
    let taxAmount = 0;
    let total = subtotal;

    if (line.taxMode === "excluded") {
      taxAmount = Math.round(subtotal * 0.1);
      total = subtotal + taxAmount;
    } else if (line.taxMode === "included") {
      taxAmount = Math.round((subtotal * 10) / 110);
    } else if (line.taxMode !== "exempt") {
      return { ...line, ok: false, status: "invalid", quantity: 0, subtotal: 0, taxAmount: 0, total: 0 };
    }

    return { ...line, ok: true, status: "calculated", quantity, subtotal, taxAmount, total };
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

function CommonCostsCalculator() {
  const [values, setValues] = useState(INITIAL_VALUES);
  const result = useMemo(() => calcCommonCosts(values), [values]);

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
      <label>案件全体の共通経費</label>
      <div className="small">
        案件全体・1人あたり・1日あたりの計算単位を経費項目ごとに選択できます。
      </div>

      <section className="visit-card">
        <div className="visit-card-header">
          <h3>共通経費</h3>
          <strong>合計：{result.status === "calculated" ? yen(Math.round(result.total)) : "-"}</strong>
        </div>

        <div className="cost-input-grid">
          <label>
            参加人数
            <input
              type="number"
              min="1"
              step="1"
              value={values.participants}
              onChange={(event) => update("participants", event.target.value)}
            />
          </label>
          <label>
            実施日数
            <input
              type="number"
              min="1"
              step="1"
              value={values.days}
              onChange={(event) => update("days", event.target.value)}
            />
          </label>
        </div>

        <div className="cost-table-wrap">
          <table className="table visit-cost-table">
            <thead>
              <tr>
                <th>経費項目</th>
                <th>計算単位</th>
                <th>単価</th>
                <th>数量</th>
                <th>税区分</th>
                <th>小計</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row, index) => (
                <tr key={row.key} className={!row.ok ? "cost-line-invalid" : undefined}>
                  <td>{row.label}</td>
                  <td>
                    <select
                      value={values.lines[index].basis}
                      aria-label={`${row.label}の計算単位`}
                      onChange={(event) => updateLine(index, "basis", event.target.value)}
                    >
                      {BASIS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={values.lines[index].unitPrice}
                      placeholder="金額"
                      aria-label={`${row.label}の単価`}
                      onChange={(event) => updateLine(index, "unitPrice", event.target.value)}
                    />
                  </td>
                  <td>{row.status === "calculated" ? row.quantity : "-"}</td>
                  <td>
                    <select
                      value={values.lines[index].taxMode}
                      aria-label={`${row.label}の税区分`}
                      onChange={(event) => updateLine(index, "taxMode", event.target.value)}
                    >
                      {TAX_MODE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </td>
                  <td>{row.status === "calculated" ? yen(Math.round(row.total)) : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!result.ok && (
          <div className="warn">
            参加人数と実施日数は1以上の整数、各単価は0円以上で入力してください。
          </div>
        )}

        <table className="table">
          <tbody>
            <tr><th>税計算前金額</th><td>{result.status === "calculated" ? yen(Math.round(result.subtotal)) : "-"}</td></tr>
            <tr><th>消費税</th><td>{result.status === "calculated" ? yen(Math.round(result.taxAmount)) : "-"}</td></tr>
            <tr><th>共通経費合計</th><td><strong>{result.status === "calculated" ? yen(Math.round(result.total)) : "-"}</strong></td></tr>
            <tr><th>1人あたり参考額</th><td>{result.status === "calculated" ? yen(Math.round(result.total / Number(values.participants))) : "-"}</td></tr>
          </tbody>
        </table>

        <button className="btn secondary" type="button" onClick={reset}>共通経費をリセット</button>
      </section>

      <div className="small">
        ※ 消費税は各行で1円未満を四捨五入します。現時点では他の直接経費との総合計への自動加算は行いません。
      </div>
    </div>
  );
}

export default function CommonCosts() {
  const [target, setTarget] = useState(null);

  useEffect(() => {
    const roadmap = document.querySelector(".build-up-roadmap");
    setTarget(roadmap?.parentElement ?? null);
  }, []);

  return target ? createPortal(<CommonCostsCalculator />, target) : null;
}
