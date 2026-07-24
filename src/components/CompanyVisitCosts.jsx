import React from "react";
import { yen } from "../lib/format.js";
import {
  calcCostGroup,
  calcCostLine,
  TAX_MODE_OPTIONS,
} from "../lib/costing.js";

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
  return {
    key,
    label,
    custom,
    unitPrice: "",
    quantity: "1",
    taxMode: "included",
  };
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
  const visibleCount = getVisibleCount(count);
  const requestedCount = Number(count);
  const visibleVisits = Array.from(
    { length: visibleCount },
    (_, index) => visits[index] ?? createCompanyVisit()
  );
  const summaries = visibleVisits.map((visit) => calcCostGroup(visit.lines));
  const sectionTotal = summaries.reduce(
    (sum, summary) => sum + summary.total,
    0
  );
  const sectionTax = summaries.reduce(
    (sum, summary) => sum + summary.totalTax,
    0
  );
  const hasInput = summaries.some((summary) => summary.hasInput);

  function updateVisit(visitIndex, updater) {
    onChange((current) => {
      const next = [...current];
      while (next.length <= visitIndex) {
        next.push(createCompanyVisit());
      }
      next[visitIndex] = updater(next[visitIndex]);
      return next;
    });
  }

  function updateDestination(visitIndex, destination) {
    updateVisit(visitIndex, (visit) => ({ ...visit, destination }));
  }

  function updateLine(visitIndex, lineIndex, field, value) {
    updateVisit(visitIndex, (visit) => ({
      ...visit,
      lines: visit.lines.map((line, index) =>
        index === lineIndex ? { ...line, [field]: value } : line
      ),
    }));
  }

  return (
    <div className="col-12">
      <div className="hr" />
      <label>企業訪問別の直接経費</label>
      <div className="small">
        企業訪問回数に合わせて入力欄を表示します。回数を減らした場合は一時的に非表示となり、
        同じ回数まで戻すと入力内容を復元します。
      </div>

      {requestedCount > MAX_VISIT_DETAILS && (
        <div className="warn">
          詳細入力は最大{MAX_VISIT_DETAILS}回分まで表示しています。
        </div>
      )}

      {visibleCount === 0 && (
        <div className="cost-empty">
          企業訪問が1回以上の場合に、訪問別の経費入力欄を表示します。
        </div>
      )}

      {visibleVisits.map((visit, visitIndex) => {
        const summary = summaries[visitIndex];

        return (
          <section className="visit-card" key={visitIndex}>
            <div className="visit-card-header">
              <h3>企業訪問{visitIndex + 1}</h3>
              <strong>
                小計：{summary.hasInput ? yen(Math.round(summary.total)) : "-"}
              </strong>
            </div>

            <label htmlFor={`visit-destination-${visitIndex}`}>行先</label>
            <input
              id={`visit-destination-${visitIndex}`}
              value={visit.destination}
              placeholder="例：企業訪問先（個人名は入力しない）"
              onChange={(event) =>
                updateDestination(visitIndex, event.target.value)
              }
            />

            <div className="cost-table-wrap">
              <table className="table visit-cost-table">
                <thead>
                  <tr>
                    <th>経費項目</th>
                    <th>単価</th>
                    <th>数量</th>
                    <th>税区分</th>
                    <th>消費税</th>
                    <th>小計</th>
                  </tr>
                </thead>
                <tbody>
                  {visit.lines.map((line, lineIndex) => {
                    const lineResult = calcCostLine(line);

                    return (
                      <tr
                        key={line.key}
                        className={!lineResult.ok ? "cost-line-invalid" : undefined}
                      >
                        <td>
                          {line.custom ? (
                            <input
                              value={line.label}
                              aria-label={`企業訪問${visitIndex + 1} 任意項目${
                                lineIndex - PRESET_LINES.length + 1
                              }の名称`}
                              placeholder={`任意項目${
                                lineIndex - PRESET_LINES.length + 1
                              }`}
                              onChange={(event) =>
                                updateLine(
                                  visitIndex,
                                  lineIndex,
                                  "label",
                                  event.target.value
                                )
                              }
                            />
                          ) : (
                            line.label
                          )}
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            step="1000"
                            value={line.unitPrice}
                            aria-label={`${line.label || "任意項目"}の単価`}
                            placeholder="金額"
                            onChange={(event) =>
                              updateLine(
                                visitIndex,
                                lineIndex,
                                "unitPrice",
                                event.target.value
                              )
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0.01"
                            step="1"
                            value={line.quantity}
                            aria-label={`${line.label || "任意項目"}の数量`}
                            onChange={(event) =>
                              updateLine(
                                visitIndex,
                                lineIndex,
                                "quantity",
                                event.target.value
                              )
                            }
                          />
                        </td>
                        <td>
                          <select
                            value={line.taxMode}
                            aria-label={`${line.label || "任意項目"}の税区分`}
                            onChange={(event) =>
                              updateLine(
                                visitIndex,
                                lineIndex,
                                "taxMode",
                                event.target.value
                              )
                            }
                          >
                            {TAX_MODE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          {lineResult.status === "calculated"
                            ? yen(Math.round(lineResult.taxAmount))
                            : "-"}
                        </td>
                        <td>
                          {lineResult.status === "calculated"
                            ? yen(Math.round(lineResult.total))
                            : "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {!summary.ok && (
              <div className="warn">
                単価は0円以上、数量は0より大きい数字で入力してください。
              </div>
            )}
          </section>
        );
      })}

      {visibleCount > 0 && (
        <div className="visit-section-total">
          <div>
            <span>企業訪問の消費税合計</span>
            <strong>{hasInput ? yen(Math.round(sectionTax)) : "-"}</strong>
          </div>
          <div>
            <span>企業訪問の直接経費合計</span>
            <strong>{hasInput ? yen(Math.round(sectionTotal)) : "-"}</strong>
          </div>
        </div>
      )}

      <div className="small">
        ※ 消費税は各行で1円未満を四捨五入します。PR7では企業訪問の直接経費だけを計算し、
        共通経費・販管費・全体原価への自動加算は行いません。
      </div>
    </div>
  );
}
