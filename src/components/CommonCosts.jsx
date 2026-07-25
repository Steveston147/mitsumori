import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { yen } from "../lib/format.js";
import { TAX_MODE_OPTIONS } from "../lib/costing.js";
import { useEstimateSectionState } from "../state/useEstimateSectionState.js";

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
      { key: "communication", label: "通信・郵送費", basis: "fixed", unitPrice: "", taxMode: "included" },
      { key: "other", label: "その他共通経費", basis: "fixed", unitPrice: "", taxMode: "included" },
      { key: "travelInsurance", label: "訪日保険", basis: "participant", unitPrice: "", quantity: participants, quantityEdited: false, taxMode: "included" },
      { key: "liabilityInsurance", label: "第三者損害賠償保険", basis: "participant", unitPrice: "", quantity: participants, quantityEdited: false, taxMode: "included" },
      { key: "certificateFolder", label: "証書フォルダー", basis: "participant", unitPrice: "", quantity: participants, quantityEdited: false, taxMode: "included" },
      { key: "souvenir", label: "お土産", basis: "participant", unitPrice: "", quantity: participants, quantityEdited: false, taxMode: "included" },
      { key: "optional1", label: "その他1", editableLabel: true, basis: "fixed", unitPrice: "", taxMode: "included" },
      { key: "optional2", label: "その他2", editableLabel: true, basis: "fixed", unitPrice: "", taxMode: "included" },
    ],
  };
}

function readStudentCount() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(PROGRAM_INFO_KEY) || "{}");
    const count = Number(saved.studentCount);
    return Number.isInteger(count) && count > 0 ? String(count) : "15";
  } catch { return "15"; }
}

function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

export function calcCommonCosts({ participants, days, lines }) {
  const participantCount = Number(participants);
  const dayCount = Number(days);
  if (!Number.isInteger(participantCount) || participantCount <= 0 || !Number.isInteger(dayCount) || dayCount <= 0) {
    return { ok: false, status: "invalid", rows: [], subtotal: 0, taxAmount: 0, total: 0 };
  }
  const rows = lines.map((line) => {
    if (!hasValue(line.unitPrice)) return { ...line, ok: true, status: "empty", quantity: 0, subtotal: 0, taxAmount: 0, total: 0 };
    const unitPrice = Number(line.unitPrice);
    if (!Number.isFinite(unitPrice) || unitPrice < 0) return { ...line, ok: false, status: "invalid", quantity: 0, subtotal: 0, taxAmount: 0, total: 0 };
    let quantity = line.basis === "fixed" ? 1 : line.basis === "day" ? dayCount : line.basis === "participant" ? Number(hasValue(line.quantity) ? line.quantity : participantCount) : 0;
    if (!Number.isInteger(quantity) || quantity <= 0) return { ...line, ok: false, status: "invalid", quantity: 0, subtotal: 0, taxAmount: 0, total: 0 };
    const subtotal = unitPrice * quantity;
    let taxAmount = 0;
    let total = subtotal;
    if (line.taxMode === "excluded") { taxAmount = Math.round(subtotal * 0.1); total += taxAmount; }
    else if (line.taxMode === "included") taxAmount = Math.round((subtotal * 10) / 110);
    else if (line.taxMode !== "exempt") return { ...line, ok: false, status: "invalid", quantity: 0, subtotal: 0, taxAmount: 0, total: 0 };
    return { ...line, ok: true, status: "calculated", quantity, subtotal, taxAmount, total };
  });
  const ok = rows.every((row) => row.ok);
  const hasInput = rows.some((row) => row.status === "calculated");
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
  const initial = useMemo(() => createInitialValues(readStudentCount()), []);
  const [values, setValues] = useEstimateSectionState("commonCosts", initial);
  const result = useMemo(() => calcCommonCosts(values), [values]);

  useEffect(() => {
    function syncParticipants(event) {
      const nextCount = String(event?.detail?.studentCount ?? readStudentCount());
      const count = Number(nextCount);
      if (!Number.isInteger(count) || count <= 0) return;
      setValues((current) => ({
        ...current,
        participants: nextCount,
        lines: current.lines.map((line) => line.basis === "participant" && !line.quantityEdited ? { ...line, quantity: nextCount } : line),
      }));
    }
    window.addEventListener("program-basic-info-change", syncParticipants);
    return () => window.removeEventListener("program-basic-info-change", syncParticipants);
  }, [setValues]);

  const update = (field, value) => setValues((current) => ({ ...current, [field]: value }));
  const updateLine = (index, field, value) => setValues((current) => ({ ...current, lines: current.lines.map((line, i) => i === index ? { ...line, [field]: value } : line) }));
  const updateQuantity = (index, value) => setValues((current) => ({ ...current, lines: current.lines.map((line, i) => i === index ? { ...line, quantity: value, quantityEdited: true } : line) }));

  return (
    <div className="col-12">
      <div className="hr" />
      <label>案件全体の共通経費</label>
      <div className="small">人数単位の経費は参加留学生人数を初期値として自動入力します。</div>
      <section className="visit-card">
        <div className="visit-card-header"><h3>共通経費</h3><strong>合計：{result.status === "calculated" ? yen(Math.round(result.total)) : "-"}</strong></div>
        <div className="cost-input-grid">
          <label>参加留学生人数<input type="number" value={values.participants} readOnly /></label>
          <label>実施日数<input type="number" min="1" step="1" value={values.days} onChange={(e) => update("days", e.target.value)} /></label>
        </div>
        <div className="cost-table-wrap"><table className="table visit-cost-table"><thead><tr><th>経費項目</th><th>計算単位</th><th>単価</th><th>数量</th><th>税区分</th><th>小計</th></tr></thead><tbody>
          {result.rows.map((row, index) => <tr key={row.key} className={!row.ok ? "cost-line-invalid" : undefined}>
            <td>{row.editableLabel ? <input value={values.lines[index].label} onChange={(e) => updateLine(index, "label", e.target.value)} /> : row.label}</td>
            <td><select value={values.lines[index].basis} onChange={(e) => updateLine(index, "basis", e.target.value)}>{BASIS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></td>
            <td><input type="number" min="0" step="100" value={values.lines[index].unitPrice} placeholder="金額" onChange={(e) => updateLine(index, "unitPrice", e.target.value)} /></td>
            <td>{values.lines[index].basis === "participant" ? <input type="number" min="1" step="1" value={values.lines[index].quantity ?? values.participants} onChange={(e) => updateQuantity(index, e.target.value)} /> : row.status === "calculated" ? row.quantity : values.lines[index].basis === "fixed" ? 1 : values.days}</td>
            <td><select value={values.lines[index].taxMode} onChange={(e) => updateLine(index, "taxMode", e.target.value)}>{TAX_MODE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></td>
            <td>{row.status === "calculated" ? yen(Math.round(row.total)) : "-"}</td>
          </tr>)}
        </tbody></table></div>
        {!result.ok && <div className="warn">実施日数と数量は1以上の整数、各単価は0円以上で入力してください。</div>}
        <table className="table"><tbody>
          <tr><th>税計算前金額</th><td>{result.status === "calculated" ? yen(Math.round(result.subtotal)) : "-"}</td></tr>
          <tr><th>消費税</th><td>{result.status === "calculated" ? yen(Math.round(result.taxAmount)) : "-"}</td></tr>
          <tr><th>共通経費合計</th><td><strong>{result.status === "calculated" ? yen(Math.round(result.total)) : "-"}</strong></td></tr>
          <tr><th>1人あたり参考額</th><td>{result.status === "calculated" ? yen(Math.round(result.total / Number(values.participants))) : "-"}</td></tr>
        </tbody></table>
        <button className="btn secondary" type="button" onClick={() => setValues(createInitialValues(readStudentCount()))}>共通経費をリセット</button>
      </section>
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
