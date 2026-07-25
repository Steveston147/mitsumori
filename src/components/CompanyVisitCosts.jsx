import React, { useEffect } from "react";
import { yen } from "../lib/format.js";
import { calcCostGroup, calcCostLine, TAX_MODE_OPTIONS } from "../lib/costing.js";
import { useEstimateSectionState } from "../state/useEstimateSectionState.js";

const MAX_VISIT_DETAILS = 20;
const PRESET_LINES = [
  { key: "honorarium", label: "企業への謝礼" },
  { key: "largeBus", label: "大型バス" },
  { key: "toll", label: "高速料金" },
  { key: "parking", label: "駐車場" },
  { key: "kvhFee", label: "KVH費用" },
  { key: "kvhTransport", label: "KVH交通費" },
];

function createCostLine(key, label, custom = false) {
  return { key, label, custom, unitPrice: "", quantity: "1", taxMode: "included" };
}

export function createCompanyVisit() {
  return {
    destination: "",
    lines: [
      ...PRESET_LINES.map(({ key, label }) => createCostLine(key, label)),
      createCostLine("custom1", "", true),
      createCostLine("custom2", "", true),
      createCostLine("custom3", "", true),
    ],
  };
}

function getVisibleCount(value) {
  const count = Number(value);
  if (!Number.isFinite(count) || count <= 0) return 0;
  return Math.min(Math.floor(count), MAX_VISIT_DETAILS);
}

export default function CompanyVisitCosts({ count, visits, onChange }) {
  const [savedVisits, setSavedVisits] = useEstimateSectionState("companyVisits", visits?.length ? visits : [createCompanyVisit()]);
  useEffect(() => { onChange?.(savedVisits); }, [savedVisits, onChange]);

  const visibleCount = getVisibleCount(count);
  const requestedCount = Number(count);
  const visibleVisits = Array.from({ length: visibleCount }, (_, index) => savedVisits[index] ?? createCompanyVisit());
  const summaries = visibleVisits.map((visit) => calcCostGroup(visit.lines));
  const sectionTotal = summaries.reduce((sum, summary) => sum + summary.total, 0);
  const sectionTax = summaries.reduce((sum, summary) => sum + summary.totalTax, 0);
  const hasInput = summaries.some((summary) => summary.hasInput);

  function updateVisit(visitIndex, updater) {
    setSavedVisits((current) => {
      const next = [...current];
      while (next.length <= visitIndex) next.push(createCompanyVisit());
      next[visitIndex] = updater(next[visitIndex]);
      return next;
    });
  }
  const updateDestination = (visitIndex, destination) => updateVisit(visitIndex, (visit) => ({ ...visit, destination }));
  const updateLine = (visitIndex, lineIndex, field, value) => updateVisit(visitIndex, (visit) => ({
    ...visit,
    lines: visit.lines.map((line, index) => index === lineIndex ? { ...line, [field]: value } : line),
  }));

  return (
    <div className="col-12">
      <div className="hr" />
      <label>企業訪問別の直接経費</label>
      <div className="small">企業訪問回数に合わせて入力欄を表示します。回数を減らした場合も入力内容を保持します。</div>
      {requestedCount > MAX_VISIT_DETAILS && <div className="warn">詳細入力は最大{MAX_VISIT_DETAILS}回分まで表示しています。</div>}
      {visibleCount === 0 && <div className="cost-empty">企業訪問が1回以上の場合に、訪問別の経費入力欄を表示します。</div>}
      {visibleVisits.map((visit, visitIndex) => {
        const summary = summaries[visitIndex];
        return <section className="visit-card" key={visitIndex}>
          <div className="visit-card-header"><h3>企業訪問{visitIndex + 1}</h3><strong>小計：{summary.hasInput ? yen(Math.round(summary.total)) : "-"}</strong></div>
          <label htmlFor={`visit-destination-${visitIndex}`}>行先</label>
          <input id={`visit-destination-${visitIndex}`} value={visit.destination} placeholder="例：企業訪問先（個人名は入力しない）" onChange={(e) => updateDestination(visitIndex, e.target.value)} />
          <div className="cost-table-wrap"><table className="table visit-cost-table"><thead><tr><th>経費項目</th><th>単価</th><th>数量</th><th>税区分</th><th>消費税</th><th>小計</th></tr></thead><tbody>
            {visit.lines.map((line, lineIndex) => {
              const lineResult = calcCostLine(line);
              return <tr key={line.key} className={!lineResult.ok ? "cost-line-invalid" : undefined}>
                <td>{line.custom ? <input value={line.label} placeholder={`任意項目${lineIndex - PRESET_LINES.length + 1}`} onChange={(e) => updateLine(visitIndex, lineIndex, "label", e.target.value)} /> : line.label}</td>
                <td><input type="number" min="0" step="1000" value={line.unitPrice} placeholder="金額" onChange={(e) => updateLine(visitIndex, lineIndex, "unitPrice", e.target.value)} /></td>
                <td><input type="number" min="0.01" step="1" value={line.quantity} onChange={(e) => updateLine(visitIndex, lineIndex, "quantity", e.target.value)} /></td>
                <td><select value={line.taxMode} onChange={(e) => updateLine(visitIndex, lineIndex, "taxMode", e.target.value)}>{TAX_MODE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></td>
                <td>{lineResult.status === "calculated" ? yen(Math.round(lineResult.taxAmount)) : "-"}</td>
                <td>{lineResult.status === "calculated" ? yen(Math.round(lineResult.total)) : "-"}</td>
              </tr>;
            })}
          </tbody></table></div>
          {!summary.ok && <div className="warn">単価は0円以上、数量は0より大きい数字で入力してください。</div>}
        </section>;
      })}
      {visibleCount > 0 && <div className="visit-section-total"><div><span>企業訪問の消費税合計</span><strong>{hasInput ? yen(Math.round(sectionTax)) : "-"}</strong></div><div><span>企業訪問の直接経費合計</span><strong>{hasInput ? yen(Math.round(sectionTotal)) : "-"}</strong></div></div>}
    </div>
  );
}
