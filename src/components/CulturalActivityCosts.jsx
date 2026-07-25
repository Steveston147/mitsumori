import React, { useEffect } from "react";
import { yen } from "../lib/format.js";
import { calcCostGroup, calcCostLine, TAX_MODE_OPTIONS } from "../lib/costing.js";
import { useEstimateSectionState } from "../state/useEstimateSectionState.js";

const MAX_ACTIVITY_DETAILS = 20;
const PRESET_LINES = [
  { key: "activityFee", label: "文化体験費用" },
  { key: "largeBus", label: "大型バス" },
  { key: "toll", label: "高速料金" },
  { key: "parking", label: "駐車場" },
];

function createCostLine(key, label, custom = false) {
  return { key, label, custom, unitPrice: "", quantity: "1", taxMode: "included" };
}

export function createCulturalActivity() {
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
  return Math.min(Math.floor(count), MAX_ACTIVITY_DETAILS);
}

export default function CulturalActivityCosts({ count, activities, onChange }) {
  const [savedActivities, setSavedActivities] = useEstimateSectionState("culturalActivities", activities?.length ? activities : [createCulturalActivity()]);
  useEffect(() => { onChange?.(savedActivities); }, [savedActivities, onChange]);

  const visibleCount = getVisibleCount(count);
  const requestedCount = Number(count);
  const visibleActivities = Array.from({ length: visibleCount }, (_, index) => savedActivities[index] ?? createCulturalActivity());
  const summaries = visibleActivities.map((activity) => calcCostGroup(activity.lines));
  const sectionTotal = summaries.reduce((sum, summary) => sum + summary.total, 0);
  const sectionTax = summaries.reduce((sum, summary) => sum + summary.totalTax, 0);
  const hasInput = summaries.some((summary) => summary.hasInput);

  function updateActivity(activityIndex, updater) {
    setSavedActivities((current) => {
      const next = [...current];
      while (next.length <= activityIndex) next.push(createCulturalActivity());
      next[activityIndex] = updater(next[activityIndex]);
      return next;
    });
  }
  const updateDestination = (activityIndex, destination) => updateActivity(activityIndex, (activity) => ({ ...activity, destination }));
  const updateLine = (activityIndex, lineIndex, field, value) => updateActivity(activityIndex, (activity) => ({
    ...activity,
    lines: activity.lines.map((line, index) => index === lineIndex ? { ...line, [field]: value } : line),
  }));

  return (
    <div className="col-12">
      <div className="hr" />
      <label>日本文化体験別の直接経費</label>
      <div className="small">文化体験回数に合わせて入力欄を表示します。回数を減らした場合も入力内容を保持します。</div>
      {requestedCount > MAX_ACTIVITY_DETAILS && <div className="warn">詳細入力は最大{MAX_ACTIVITY_DETAILS}回分まで表示しています。</div>}
      {visibleCount === 0 && <div className="cost-empty">日本文化体験が1回以上の場合に、体験別の経費入力欄を表示します。</div>}
      {visibleActivities.map((activity, activityIndex) => {
        const summary = summaries[activityIndex];
        return <section className="visit-card" key={activityIndex}>
          <div className="visit-card-header"><h3>日本文化体験{activityIndex + 1}</h3><strong>小計：{summary.hasInput ? yen(Math.round(summary.total)) : "-"}</strong></div>
          <label htmlFor={`activity-destination-${activityIndex}`}>行先・体験名</label>
          <input id={`activity-destination-${activityIndex}`} value={activity.destination} placeholder="例：茶道体験（個人名は入力しない）" onChange={(e) => updateDestination(activityIndex, e.target.value)} />
          <div className="cost-table-wrap"><table className="table visit-cost-table"><thead><tr><th>経費項目</th><th>単価</th><th>数量・人数</th><th>税区分</th><th>消費税</th><th>小計</th></tr></thead><tbody>
            {activity.lines.map((line, lineIndex) => {
              const lineResult = calcCostLine(line);
              return <tr key={line.key} className={!lineResult.ok ? "cost-line-invalid" : undefined}>
                <td>{line.custom ? <input value={line.label} placeholder={`任意項目${lineIndex - PRESET_LINES.length + 1}`} onChange={(e) => updateLine(activityIndex, lineIndex, "label", e.target.value)} /> : line.label}</td>
                <td><input type="number" min="0" step="1000" value={line.unitPrice} placeholder="金額" onChange={(e) => updateLine(activityIndex, lineIndex, "unitPrice", e.target.value)} /></td>
                <td><input type="number" min="0.01" step="1" value={line.quantity} onChange={(e) => updateLine(activityIndex, lineIndex, "quantity", e.target.value)} /></td>
                <td><select value={line.taxMode} onChange={(e) => updateLine(activityIndex, lineIndex, "taxMode", e.target.value)}>{TAX_MODE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></td>
                <td>{lineResult.status === "calculated" ? yen(Math.round(lineResult.taxAmount)) : "-"}</td>
                <td>{lineResult.status === "calculated" ? yen(Math.round(lineResult.total)) : "-"}</td>
              </tr>;
            })}
          </tbody></table></div>
          {!summary.ok && <div className="warn">単価は0円以上、数量は0より大きい数字で入力してください。</div>}
        </section>;
      })}
      {visibleCount > 0 && <div className="visit-section-total"><div><span>日本文化体験の消費税合計</span><strong>{hasInput ? yen(Math.round(sectionTax)) : "-"}</strong></div><div><span>日本文化体験の直接経費合計</span><strong>{hasInput ? yen(Math.round(sectionTotal)) : "-"}</strong></div></div>}
    </div>
  );
}
