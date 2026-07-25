import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { yen } from "../lib/format.js";

const LABELS = [
  { key: "company", label: "企業訪問", match: "企業訪問の直接経費合計" },
  { key: "culture", label: "日本文化体験", match: "日本文化体験の直接経費合計" },
  { key: "japanese", label: "日本語講座", match: "日本語講座合計" },
  {
    key: "collaboration",
    label: "学生共修・学内文化活動",
    match: "学生共修・学内文化活動合計",
  },
  { key: "common", label: "共通経費", match: "共通経費合計" },
];

const MANAGEMENT_FEE_BY_WEEKS = {
  1: 20000,
  2: 30000,
  3: 40000,
  4: 50000,
  5: 60000,
  6: 70000,
};

const CREOTECH_ALLOCATION_RATE = 0.9;
const UNIVERSITY_ALLOCATION_RATE = 0.1;

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

function sameAmounts(current, next) {
  return LABELS.every(({ key }) => current[key] === next[key]);
}

function BuildUpSummaryCalculator({ root, printTarget }) {
  const [amounts, setAmounts] = useState(() =>
    Object.fromEntries(LABELS.map(({ key }) => [key, 0]))
  );
  const [participants, setParticipants] = useState("15");
  const [weeks, setWeeks] = useState("1");

  useEffect(() => {
    function refresh() {
      const next = Object.fromEntries(
        LABELS.map(({ key, match }) => [key, findAmount(root, match)])
      );
      setAmounts((current) => (sameAmounts(current, next) ? current : next));
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
    const count = Number(participants);
    const weekCount = Number(weeks);
    const validCount = Number.isInteger(count) && count > 0;
    const managementFeePerParticipant = MANAGEMENT_FEE_BY_WEEKS[weekCount] ?? 0;
    const validWeeks = managementFeePerParticipant > 0;
    const managementFee = validCount && validWeeks
      ? managementFeePerParticipant * count
      : 0;
    const sales = directCost + managementFee;
    const creotechAllocation = managementFee * CREOTECH_ALLOCATION_RATE;
    const universityAllocation = managementFee * UNIVERSITY_ALLOCATION_RATE;
    const totalExpenses = directCost + universityAllocation;
    const grossProfitBeforeUniversityAllocation = sales - totalExpenses;
    const grossProfit = grossProfitBeforeUniversityAllocation + universityAllocation;

    return {
      ok: validCount && validWeeks,
      directCost,
      managementFeePerParticipant,
      managementFee,
      creotechAllocation,
      universityAllocation,
      sales,
      totalExpenses,
      grossProfitBeforeUniversityAllocation,
      grossProfit,
      perParticipant: validCount ? sales / count : 0,
    };
  }, [amounts, participants, weeks]);

  const printDate = new Intl.DateTimeFormat("ja-JP").format(new Date());

  const printSummary = (
    <section className="print-summary">
      <header className="print-header">
        <div>
          <h1>カスタムプログラム 積み上げ方式 見積サマリー</h1>
          <div className="print-subtitle">内部確認用・参考試算</div>
        </div>
        <div className="print-date">作成日：{printDate}</div>
      </header>

      <h2>基本条件</h2>
      <table className="print-table">
        <tbody>
          <tr>
            <th>実施期間</th>
            <td>{weeks}週間</td>
            <th>参加人数</th>
            <td>{participants}人</td>
          </tr>
        </tbody>
      </table>

      <h2>直接経費</h2>
      <table className="print-table">
        <tbody>
          {LABELS.map(({ key, label }) => (
            <tr key={key}>
              <th>{label}</th>
              <td>{yen(Math.round(amounts[key]))}</td>
            </tr>
          ))}
          <tr className="print-total">
            <th>直接経費合計</th>
            <td>{yen(Math.round(result.directCost))}</td>
          </tr>
        </tbody>
      </table>

      <h2>管理費・按分・粗利</h2>
      <table className="print-table">
        <tbody>
          <tr>
            <th>管理費（1人あたり）</th>
            <td>{result.ok ? yen(result.managementFeePerParticipant) : "-"}</td>
          </tr>
          <tr>
            <th>管理費合計</th>
            <td>{result.ok ? yen(Math.round(result.managementFee)) : "-"}</td>
          </tr>
          <tr>
            <th>クレオテック按分額（90％）</th>
            <td>{result.ok ? yen(Math.round(result.creotechAllocation)) : "-"}</td>
          </tr>
          <tr>
            <th>大学按分額（10％）</th>
            <td>{result.ok ? yen(Math.round(result.universityAllocation)) : "-"}</td>
          </tr>
          <tr className="print-total">
            <th>売上高</th>
            <td>{result.ok ? yen(Math.round(result.sales)) : "-"}</td>
          </tr>
          <tr>
            <th>総経費（大学按分額を含む）</th>
            <td>{result.ok ? yen(Math.round(result.totalExpenses)) : "-"}</td>
          </tr>
          <tr>
            <th>粗利（大学按分加算前）</th>
            <td>
              {result.ok
                ? yen(Math.round(result.grossProfitBeforeUniversityAllocation))
                : "-"}
            </td>
          </tr>
          <tr className="print-total">
            <th>粗利（大学按分額加算後）</th>
            <td>{result.ok ? yen(Math.round(result.grossProfit)) : "-"}</td>
          </tr>
          <tr className="print-total">
            <th>1人あたり参考額</th>
            <td>{result.ok ? yen(Math.round(result.perParticipant)) : "-"}</td>
          </tr>
        </tbody>
      </table>

      <p className="print-note">
        この資料は入力条件に基づく内部確認用の参考試算です。正式な見積を確定する前に、金額・実施条件・按分内容を確認してください。
      </p>
    </section>
  );

  return (
    <>
      <div className="col-12" data-build-up-summary>
        <div className="hr" />
        <label>積み上げ方式の総合計</label>
        <div className="small">
          各費用欄の合計を自動集計し、期間別の管理費、按分額、売上高、総経費、粗利を表示します。
        </div>

        <section className="visit-card">
          <div className="visit-card-header">
            <h3>売上高</h3>
            <strong>{result.ok ? yen(Math.round(result.sales)) : "-"}</strong>
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
              実施期間
              <select value={weeks} onChange={(event) => setWeeks(event.target.value)}>
                <option value="1">1週間</option>
                <option value="2">2週間</option>
                <option value="3">3週間</option>
                <option value="4">4週間</option>
                <option value="5">5週間</option>
                <option value="6">6週間</option>
              </select>
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
                <th>管理費（1人あたり）</th>
                <td>{result.ok ? yen(result.managementFeePerParticipant) : "-"}</td>
              </tr>
              <tr>
                <th>管理費合計</th>
                <td>{result.ok ? yen(Math.round(result.managementFee)) : "-"}</td>
              </tr>
              <tr>
                <th>クレオテック按分額（90％）</th>
                <td>{result.ok ? yen(Math.round(result.creotechAllocation)) : "-"}</td>
              </tr>
              <tr>
                <th>大学按分額（10％）</th>
                <td>{result.ok ? yen(Math.round(result.universityAllocation)) : "-"}</td>
              </tr>
              <tr className="print-total">
                <th>売上高</th>
                <td>{result.ok ? yen(Math.round(result.sales)) : "-"}</td>
              </tr>
              <tr>
                <th>総経費（大学按分額を含む）</th>
                <td>{result.ok ? yen(Math.round(result.totalExpenses)) : "-"}</td>
              </tr>
              <tr>
                <th>粗利（大学按分加算前）</th>
                <td>
                  {result.ok
                    ? yen(Math.round(result.grossProfitBeforeUniversityAllocation))
                    : "-"}
                </td>
              </tr>
              <tr className="print-total">
                <th>粗利（大学按分額加算後）</th>
                <td>{result.ok ? yen(Math.round(result.grossProfit)) : "-"}</td>
              </tr>
              <tr className="print-total">
                <th>1人あたり参考額</th>
                <td>{result.ok ? yen(Math.round(result.perParticipant)) : "-"}</td>
              </tr>
            </tbody>
          </table>

          {!result.ok && (
            <div className="warn">
              参加人数は1以上の整数で入力し、実施期間を選択してください。
            </div>
          )}
        </section>

        <div className="small">
          ※ 管理費は1週間20,000円を基準に、1週間延長するごとに1人あたり10,000円を加算します（最大6週間・70,000円）。管理費はクレオテック90％、大学10％で按分します。粗利は「売上高－総経費＋大学按分額」で計算します。
        </div>

        <div className="hr" />
        <label>印刷・PDF保存</label>
        <button
          className="btn"
          type="button"
          disabled={!result.ok}
          onClick={() => window.print()}
        >
          積み上げ見積を印刷・PDF保存
        </button>
        <div className="small">
          ブラウザの印刷画面で「PDFに保存」を選択できます。内部確認用として按分額と粗利も出力します。
        </div>
      </div>
      {printTarget ? createPortal(printSummary, printTarget) : null}
    </>
  );
}

export default function BuildUpSummary() {
  const [target, setTarget] = useState(null);
  const [printTarget, setPrintTarget] = useState(null);

  useEffect(() => {
    const roadmap = document.querySelector(".build-up-roadmap");
    setTarget(roadmap?.parentElement ?? null);
    setPrintTarget(document.querySelector(".container"));
  }, []);

  return target ? (
    createPortal(
      <BuildUpSummaryCalculator root={target} printTarget={printTarget} />,
      target
    )
  ) : null;
}
