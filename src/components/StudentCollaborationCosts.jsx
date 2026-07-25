import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { yen } from "../lib/format.js";
import { TAX_MODE_OPTIONS } from "../lib/costing.js";
import { useEstimateSectionState } from "../state/useEstimateSectionState.js";

const CALC_MODE_OPTIONS = [
  { value: "perSession", label: "1回あたり定額" },
  { value: "perPerson", label: "1人あたり" },
];

const INITIAL_VALUES = {
  participants: "15",
  sessions: "1",
  lines: [
    { key: "activityFee", label: "共修・体験実施費", unitPrice: "", calcMode: "perSession", taxMode: "included" },
    { key: "admission", label: "入場料・拝観料", unitPrice: "", calcMode: "perPerson", taxMode: "included" },
    { key: "transport", label: "交通・移動費", unitPrice: "", calcMode: "perSession", taxMode: "included" },
    { key: "other", label: "その他", unitPrice: "", calcMode: "perSession", taxMode: "included" },
  ],
};

function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

export function calcStudentCollaborationCost({ participants, sessions, lines }) {
  const participantCount = Number(participants);
  const sessionCount = Number(sessions);
  if (!Number.isInteger(participantCount) || participantCount <= 0 || !Number.isInteger(sessionCount) || sessionCount <= 0) {
    return { ok: false, status: "invalid", rows: [], subtotal: 0, taxAmount: 0, total: 0 };
  }
  const rows = lines.map((line) => {
    if (!hasValue(line.unitPrice)) return { ...line, ok: true, status: "empty", multiplier: 0, subtotal: 0, taxAmount: 0, total: 0 };
    const unitPrice = Number(line.unitPrice);
    if (!Number.isFinite(unitPrice) || unitPrice < 0 || !["perSession", "perPerson"].includes(line.calcMode)) {
      return { ...line, ok: false, status: "invalid", multiplier: 0, subtotal: 0, taxAmount: 0, total: 0 };
    }
    const multiplier = line.calcMode === "perPerson" ? participantCount * sessionCount : sessionCount;
    const subtotal = unitPrice * multiplier;
    let taxAmount = 0;
    let total = subtotal;
    if (line.taxMode === "excluded") { taxAmount = Math.round(subtotal * 0.1); total += taxAmount; }
    else if (line.taxMode === "included") taxAmount = Math.round((subtotal * 10) / 110);
    else if (line.taxMode !== "exempt") return { ...line, ok: false, status: "invalid", multiplier: 0, subtotal: 0, taxAmount: 0, total: 0 };
    return { ...line, ok: true, status: "calculated", multiplier, subtotal, taxAmount, total };
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

function StudentCalculator() {
  const [values, setValues] = useEstimateSectionState("studentCollaboration", INITIAL_VALUES);
  const result = useMemo(() => calcStudentCollaborationCost(values), [values]);
  const update = (field, value) => setValues((current) => ({ ...current, [field]: value }));
  const updateLine = (index, field, value) => setValues((current) => ({ ...current, lines: current.lines.map((line, lineIndex) => lineIndex === index ? { ...line, [field]: value } : line) }));

  return (
    <div className="col-12">
      <div className="hr" />
      <label>学生共修・学内文化活動の直接経費</label>
      <div className="small">基本は「1回あたり定額 × 実施回数」で計算します。人数に応じる項目だけ「1人あたり」を選択できます。</div>
      <section className="visit-card">
        <div className="visit-card-header"><h3>学生共修・学内文化活動</h3><strong>合計：{result.status === "calculated" ? yen(Math.round(result.total)) : "-"}</strong></div>
        <div className="cost-input-grid">
          <label>参加人数<input type="number" min="1" step="1" value={values.participants} onChange={(e) => update("participants", e.target.value)} /></label>
          <label>実施回数<input type="number" min="1" step="1" value={values.sessions} onChange={(e) => update("sessions", e.target.value)} /></label>
        </div>
        <div className="cost-table-wrap"><table className="table visit-cost-table"><thead><tr><th>経費項目</th><th>計算方式</th><th>単価</th><th>税区分</th><th>計算条件</th><th>消費税</th><th>小計</th></tr></thead><tbody>
          {result.rows.map((row, index) => <tr key={row.key} className={!row.ok ? "cost-line-invalid" : undefined}>
            <td>{row.label}</td>
            <td><select value={values.lines[index].calcMode} onChange={(e) => updateLine(index, "calcMode", e.target.value)}>{CALC_MODE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></td>
            <td><input type="number" min="0" step="100" value={values.lines[index].unitPrice} placeholder="金額" onChange={(e) => updateLine(index, "unitPrice", e.target.value)} /></td>
            <td><select value={values.lines[index].taxMode} onChange={(e) => updateLine(index, "taxMode", e.target.value)}>{TAX_MODE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></td>
            <td>{row.status === "calculated" ? row.calcMode === "perPerson" ? `${values.participants}人 × ${values.sessions}回` : `${values.sessions}回` : "-"}</td>
            <td>{row.status === "calculated" ? yen(Math.round(row.taxAmount)) : "-"}</td>
            <td>{row.status === "calculated" ? yen(Math.round(row.total)) : "-"}</td>
          </tr>)}
        </tbody></table></div>
        {!result.ok && <div className="warn">参加人数と実施回数は1以上の整数、各単価は0円以上で入力してください。</div>}
        <table className="table"><tbody>
          <tr><th>税計算前金額</th><td>{result.status === "calculated" ? yen(Math.round(result.subtotal)) : "-"}</td></tr>
          <tr><th>消費税</th><td>{result.status === "calculated" ? yen(Math.round(result.taxAmount)) : "-"}</td></tr>
          <tr><th>学生共修・学内文化活動合計</th><td><strong>{result.status === "calculated" ? yen(Math.round(result.total)) : "-"}</strong></td></tr>
        </tbody></table>
        <button className="btn secondary" type="button" onClick={() => setValues(INITIAL_VALUES)}>学生共修をリセット</button>
      </section>
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
