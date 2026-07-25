import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { yen } from "../lib/format.js";
import { TAX_MODE_OPTIONS } from "../lib/costing.js";

const PROGRAM_INFO_KEY = "mitsumori.programBasicInfo";

const BASIS_OPTIONS = [
  { value: "fixed", label: "案件全体" },
  { value: "participant", label: "人数単位" },
  { value: "day", label: "1日あたり" },
];

function createInitialValues(participants = "15") {
  return {
    participants,
    days: "1",
    lines: [
      {
        key: "communication",
        label: "通信・郵送費",
        basis: "fixed",
        unitPrice: "",
        taxMode: "included",
      },
      {
        key: "other",
        label: "その他共通経費",
        basis: "fixed",
        unitPrice: "",
        taxMode: "included",
      },
      {
        key: "travelInsurance",
        label: "訪日保険",
        basis: "participant",
        unitPrice: "",
        quantity: participants,
        quantityEdited: false,
        taxMode: "included",
      },
      {
        key: "liabilityInsurance",
        label: "第三者損害賠償保険",
        basis: "participant",
        unitPrice: "",
        quantity: participants,
        quantityEdited: false,
        taxMode: "included",
      },
      {
        key: "certificateFolder",
        label: "証書フォルダー",
        basis: "participant",
        unitPrice: "",
        quantity: participants,
        quantityEdited: false,
        taxMode: "included",
      },
      {
        key: "souvenir",
        label: "お土産",
        basis: "participant",
        unitPrice: "",
        quantity: participants,
        quantityEdited: false,
        taxMode: "included",
      },
      {
        key: "optional1",
        label: "その他1",
        editableLabel: true,
        basis: "fixed",
        unitPrice: "",
        taxMode: "included",
      },
      {
        key: "optional2",
        label: "その他2",
        editableLabel: true,
        basis: "fixed",
        unitPrice: "",
        taxMode: "included",
      },
    ],
  };
}

function readStudentCount() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(PROGRAM_INFO_KEY) || "{}");
    const count = Number(saved.studentCount);
    return Number.isInteger(count) && count > 0 ? String(count) : "15";
  } catch {
    return "15";
  }
}

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

    let quantity;
    if (line.basis === "fixed") {
      quantity = 1;
    } else if (line.basis === "day") {
      quantity = dayCount;
    } else if (line.basis === "participant") {
      quantity = hasValue(line.quantity) ? Number(line.quantity) : participantCount;
    } else {
      quantity = null;
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
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
  const [values, setValues] = useState(() => createInitialValues(readStudentCount()));
  const result = useMemo(() => calcCommonCosts(values), [values]);

  useEffect(() => {
    function syncParticipants(event) {
      const nextCount = String(event?.detail?.studentCount ?? readStudentCount());
      const count = Number(nextCount);
      if (!Number.isInteger(count) || count <= 0) return;

      setValues((current) => ({
        ...current,
        participants: nextCount,
        lines: current.lines.map((line) =>
          line.basis === "participant" && !line.quantityEdited
            ? { ...line, quantity: nextCount }
            : line
        ),
      }));
    }

    window.addEventListener("program-basic-info-change", syncParticipants);
    return () => window.removeEventListener("program-basic-info-change", syncParticipants);
  }, []);

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

  function updateQuantity(index, value) {
    setValues((current) => ({
      ...current,
      lines: current.lines.map((line, lineIndex) =>
        lineIndex === index
          ? { ...line, quantity: value, quantityEdited: true }
          : line
      ),
    }));
  }

  function reset() {
    setValues(createInitialValues(readStudentCount()));
  }

  return (
    <div className="col-12">
      <div className="hr" />
      <label>案件全体の共通経費</label>
      <div className="small">
        人数単位の保険・フォルダー・お土産は、参加留学生人数を初期値として自動入力します。引率者分を含める場合は数量を直接修正できます。
      </div>

      <section className="visit-card">
        <div className="visit-card-header">
          <h3>共通経費</h3>
          <strong>合計：{result.status === "calculated" ? yen(Math.round(result.total)) : "-"}</strong>
        </div>

        <div className="cost-input-grid">
          <label>
            参加留学生人数（共通基礎情報から自動反映）
            <input type="number" value={values.participants} readOnly />
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
                  <td>
                    {row.editableLabel ? (
                      <input
                        value={values.lines[index].label}
                        placeholder={`${row.key === "optional1" ? "その他1" : "その他2"}（任意）`}
                        aria-label={`${row.key}の項目名`}
                        onChange={(event) => updateLine(index, "label", event.target.value)}
                      />
                    ) : (
                      row.label
                    )}
                  </td>
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
                  <td>
                    {values.lines[index].basis === "participant" ? (
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={values.lines[index].quantity ?? values.participants}
                        aria-label={`${row.label}の数量`}
                        onChange={(event) => updateQuantity(index, event.target.value)}
                      />
                    ) : (
                      row.status === "calculated" ? row.quantity : values.lines[index].basis === "fixed" ? 1 : values.days
                    )}
                  </td>
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
            実施日数と人数単位の数量は1以上の整数、各単価は0円以上で入力してください。
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
        ※ 消費税は各行で1円未満を四捨五入します。人数を手修正した行は、参加留学生人数が変わっても自動上書きしません。
      </div>
    </div>
  );
}

export default function CommonCosts() {
  const [target, setTarget] = useState(null);

  useEffect(() => {
    const roadmap = document.querySelector(".build-up-roadmap");
    if (roadmap) {
      roadmap.textContent = "印刷・PDFと全項目の総合計は今後のPRで追加します。";
    }
    setTarget(roadmap?.parentElement ?? null);
  }, []);

  return target ? createPortal(<CommonCostsCalculator />, target) : null;
}
