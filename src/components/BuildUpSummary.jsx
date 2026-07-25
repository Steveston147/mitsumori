import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { yen } from "../lib/format.js";

const LABELS = [
  { key: "company", label: "企業訪問", match: "企業訪問の直接経費合計" },
  { key: "culture", label: "日本文化体験", match: "日本文化体験の直接経費合計" },
  { key: "japanese", label: "日本語講座", match: "日本語講座合計" },
  { key: "collaboration", label: "学生共修", match: "学生共修合計" },
  { key: "common", label: "共通経費", match: "共通経費合計" },
];

function parseYen(text) {
  if (!text || text.trim() === "-") return 0;
  const value = Number(text.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(value) ? value : 0;
}

function findAmount(root, match) {
  const candidates = root.querySelectorAll("th, span");
  for (const candidate of candidates) {
    if (candidate.closest("[data-build-up-summary]")) continue;
    if (candidate.textContent.trim() !== match) continue;

    const row = candidate.closest("tr");
    if (row) {
      const cells = row.querySelectorAll("td");
      return parseYen(cells[cells.length - 1]?.textContent ?? "");
    }

    const parent = candidate.parentElement;
    if (parent) {
      return parseYen(parent.querySelector("strong")?.textContent ?? "");
    }
  }
  return 0;
}

function BuildUpSummaryCalculator({ root }) {
  const [amounts, setAmounts] = useState(() =>
    Object.fromEntries(LABELS.map(({ key }) => [key, 0]))
  );
  const [participants, setParticipants] = useState("15");
  const [managementRate, setManagementRate] = useState("10");

  useEffect(() => {
    function refresh() {
      setAmounts(
        Object.fromEntries(
          LABELS.map(({ key, match }) => [key, findAmount(root, match)])
        )
      );
    }

    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(root, {
      subtree: true,
      childList: true,
      characterData: true,
    });
    return () => observer.disconnect();
  }, [root]);

  const result = useMemo(() => {
    const directCost = Object.values(amounts).reduce((sum, value) => sum + value, 0);
    const rate = Number(managementRate);
    const count = Number(participants);
    const validRate = Number.isFinite(rate) && rate >= 0;
    const validCount = Number.isInteger(count) && count > 0;
    const managementFee = validRate ? Math.round(directCost * (rate / 100)) : 0;
    const total = directCost + managementFee;

    return {
      ok: validRate && validCount,
      directCost,
      managementFee,
      total,
      perParticipant: validCount ? total / count : 0,
    };
  }, [amounts, managementRate, participants]);

  return (
    <div className="col-12" data-build-up-summary>
      <div className="hr" />
      <label>積み上げ方式の総合計</label>
      <div className="small">
        各費用欄の合計を自動集計し、管理費を加えて案件全体と1人あたりの参考額を表示します。
      </div>

      <section className="visit-card">
        <div className="visit-card-header">
          <h3>総合計</h3>
          <strong>{result.ok ? yen(Math.round(result.total)) : "-"}</strong>
        </div>

        <div className="cost-input-grid">
          <label>
            参加人数
            <input
              type="number"
              min="1"
              step="1"
              value={participants}
              onChange={(event) => setParticipants(event.target.value)}
            />
          </label>
          <label>
            管理費率（%）
            <input
              type="number"
              min="0"
              step="0.1"
              value={managementRate}
              onChange={(event) => setManagementRate(event.target.value)}
            />
          </label>
        </div>

        <table className="table">
          <tbody>
            {LABELS.map(({ key, label }) => (
              <tr key={key}>
                <th>{label}</th>
                <td>{yen(Math.round(amounts[key]))}</td>
              </tr>
            ))}
            <tr>
              <th>直接経費合計</th>
              <td>{yen(Math.round(result.directCost))}</td>
            </tr>
            <tr>
              <th>管理費</th>
              <td>{result.ok ? yen(Math.round(result.managementFee)) : "-"}</td>
            </tr>
            <tr className="print-total">
              <th>案件全体合計</th>
              <td>{result.ok ? yen(Math.round(result.total)) : "-"}</td>
            </tr>
            <tr className="print-total">
              <th>1人あたり参考額</th>
              <td>{result.ok ? yen(Math.round(result.perParticipant)) : "-"}</td>
            </tr>
          </tbody>
        </table>

        {!result.ok && (
          <div className="warn">
            参加人数は1以上の整数、管理費率は0%以上で入力してください。
          </div>
        )}
      </section>

      <div className="small">
        ※ この総合計は積み上げ方式の内部試算です。正式見積の確定前に各費用と管理費率を確認してください。
      </div>
    </div>
  );
}

export default function BuildUpSummary() {
  const [target, setTarget] = useState(null);

  useEffect(() => {
    const roadmap = document.querySelector(".build-up-roadmap");
    setTarget(roadmap?.parentElement ?? null);
  }, []);

  return target ? createPortal(<BuildUpSummaryCalculator root={target} />, target) : null;
}
