import React, { useMemo, useState } from "react";
import {
  calcCostCheck,
  calcEstimate,
  DEFAULTS,
  PREP_COMPLEXITY,
} from "./lib/rules.js";
import { yen, num } from "./lib/format.js";

function Select({ label, value, onChange, options }) {
  return (
    <div>
      <label>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function NumberInput({ label, value, onChange, min, step, placeholder }) {
  return (
    <div>
      <label>{label}</label>
      <input
        type="number"
        value={value}
        min={min}
        step={step}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <div>
      <label>{label}</label>
      <select
        value={checked ? "true" : "false"}
        onChange={(e) => onChange(e.target.value === "true")}
      >
        <option value="false">無</option>
        <option value="true">有</option>
      </select>
    </div>
  );
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** 係数表示用：浮動小数点誤差を隠して綺麗に表示する */
function roundFactor(x, dp = 3) {
  if (typeof x !== "number" || !Number.isFinite(x)) return String(x);
  // dp桁で四捨五入し、末尾ゼロも含めて固定表示（例: 4.212）
  return x.toFixed(dp);
}

const STANDARD_SCENARIO_COUNTS = [10, 15, 20, 25, 30];

const COST_ITEM_DEFINITIONS = [
  { key: "honoraria", label: "講師謝金" },
  { key: "culture", label: "文化体験費" },
  { key: "visits", label: "企業・施設訪問費" },
  { key: "transport", label: "交通費・ガイド費" },
  { key: "staff", label: "職員・学生スタッフ費" },
  { key: "venue", label: "会場・間接費" },
  { key: "other", label: "その他経費" },
];

function createEmptyCostItems() {
  return Object.fromEntries(COST_ITEM_DEFINITIONS.map(({ key }) => [key, ""]));
}

export default function App() {
  const [programName, setProgramName] = useState("");
  const [weeks, setWeeks] = useState(2);
  const [participants, setParticipants] = useState(15);

  const [hasJapaneseLesson, setHasJapaneseLesson] = useState(true);
  const [culturalTimes, setCulturalTimes] = useState(5);
  const [prepComplexity, setPrepComplexity] = useState("新規");

  const [lecture, setLecture] = useState("無");
  const [companyVisitTimes, setCompanyVisitTimes] = useState(1);

  const [baseWeeklyPrice, setBaseWeeklyPrice] = useState(
    DEFAULTS.baseWeeklyPrice
  );
  const [insurancePerStudent, setInsurancePerStudent] = useState(
    DEFAULTS.insurancePerStudent
  );

  const [useManualMgmtFee] = useState(true);
  const [managementFeePerStudentManual, setManagementFeePerStudentManual] =
    useState("");
  const [costItems, setCostItems] = useState(createEmptyCostItems);

  const input = useMemo(
    () => ({
      programName,
      weeks,
      participants,
      hasJapaneseLesson,
      culturalTimes,
      prepComplexity,
      lecture,
      companyVisitTimes,
      baseWeeklyPrice,
      insurancePerStudent,
      useManualMgmtFee,
      managementFeePerStudentManual,
    }),
    [
      programName,
      weeks,
      participants,
      hasJapaneseLesson,
      culturalTimes,
      prepComplexity,
      lecture,
      companyVisitTimes,
      baseWeeklyPrice,
      insurancePerStudent,
      useManualMgmtFee,
      managementFeePerStudentManual,
    ]
  );

  const result = useMemo(() => calcEstimate(input), [input]);
  const estimatedRevenue = result.ok ? result.totalProgram : null;

  const costCheck = useMemo(
    () =>
      calcCostCheck({
        costItems,
        participants,
        estimatedRevenue,
      }),
    [costItems, participants, estimatedRevenue]
  );

  const scenarioRows = useMemo(() => {
    const currentParticipants = Number(participants);
    const counts = [...STANDARD_SCENARIO_COUNTS];

    if (
      Number.isInteger(currentParticipants) &&
      currentParticipants > 0 &&
      !counts.includes(currentParticipants)
    ) {
      counts.push(currentParticipants);
      counts.sort((a, b) => a - b);
    }

    return counts.map((count) => ({
      count,
      isCurrent: count === currentParticipants,
      estimate: calcEstimate({ ...input, participants: count }),
    }));
  }, [input, participants]);

  const breakdownLines = useMemo(() => {
    const f = result.factors ?? {};
    const lines = [];
    lines.push(`■ ${programName}`);
    lines.push(`週数: ${weeks} / 人数: ${participants}`);
    lines.push("");
    lines.push("【係数】");
    for (const [k, v] of Object.entries(f)) lines.push(`${k}: ${v}`);
    if (result.ok) {
      lines.push("");
      lines.push(`基準金額（1週）: ${baseWeeklyPrice}`);
      // ★ここで表示だけ丸める（計算値はそのまま）
      lines.push(`係数積（product）: ${roundFactor(result.productFactor, 3)}`);
      lines.push(
        `係数部分（1人あたり）: ${Math.round(result.variablePerStudent)}`
      );
      lines.push(`保険（1人）: ${result.insurancePerStudent}`);
      lines.push(`管理手数料（1人）: ${result.managementFeePerStudent}`);
      lines.push(`合計（1人あたり）: ${Math.round(result.totalPerStudent)}`);
      lines.push(`全体合計（人数分）: ${Math.round(result.totalProgram)}`);
      if (costCheck.ok) {
        lines.push("");
        lines.push("【原価確認】");
        lines.push(`原価合計: ${Math.round(costCheck.totalCost)}`);
        lines.push(
          `1人あたり原価: ${Math.round(costCheck.costPerParticipant)}`
        );
        lines.push(`参考差額: ${Math.round(costCheck.balance)}`);
        lines.push(`原価率: ${costCheck.costRate.toFixed(1)}%`);
      }
    } else {
      lines.push("");
      lines.push("※ 入力に不足/未設定があるため、計算できません。");
    }
    return lines.join("\n");
    // ★依存配列を補強（入力が変わったら確実に更新）
  }, [
    result,
    programName,
    weeks,
    participants,
    baseWeeklyPrice,
    hasJapaneseLesson,
    culturalTimes,
    prepComplexity,
    lecture,
    companyVisitTimes,
    insurancePerStudent,
    useManualMgmtFee,
    managementFeePerStudentManual,
    costCheck,
  ]);

  const [copyMsg, setCopyMsg] = useState("");

  async function onCopy() {
    const ok = await copyText(breakdownLines);
    setCopyMsg(
      ok
        ? "コピーしました。"
        : "コピーできませんでした（ブラウザ権限を確認してください）。"
    );
    setTimeout(() => setCopyMsg(""), 1500);
  }

  function onReset() {
    setProgramName("");
    setWeeks(2);
    setParticipants(15);
    setHasJapaneseLesson(true);
    setCulturalTimes(5);
    setPrepComplexity("新規");
    setLecture("無");
    setCompanyVisitTimes(1);
    setBaseWeeklyPrice(DEFAULTS.baseWeeklyPrice);
    setInsurancePerStudent(DEFAULTS.insurancePerStudent);
    setManagementFeePerStudentManual("");
    setCostItems(createEmptyCostItems());
  }

  function updateCostItem(key, value) {
    setCostItems((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="container">
      <h1>カスタムプログラム 見積（係数方式）</h1>
      <p className="sub">
        原価積み上げ無し。<b>基準金額 × 条件1〜7の掛率</b>
        で「参加者1人あたり」を算出し、最後に保険＋管理手数料（いずれも1人あたり）を加算します。
      </p>

      <div className="privacy-note">
        <strong>安全な利用について</strong>
        <div>
          入力内容はこのブラウザ内だけで計算され、サーバーへの送信・保存は行いません。
          氏名、メールアドレス、学籍番号などの個人情報は入力しないでください。
        </div>
      </div>

      <div className="card">
        <div className="grid">
          <div className="col-12">
            <label>案件名（メモ用）</label>
            <input
              value={programName}
              onChange={(e) => setProgramName(e.target.value)}
              placeholder="例：2027冬・2週間（個人名は入力しない）"
            />
            <div className="small">
              大学担当者名、参加者名、メールアドレス等は入力しないでください。
            </div>
          </div>

          <div className="col-3">
            <NumberInput
              label="実施期間（週）"
              value={weeks}
              min={1}
              step={1}
              onChange={setWeeks}
            />
            <div className="small">
              条件1：1週=1.0、2週=2.0…（週数そのまま）
            </div>
          </div>

          <div className="col-3">
            <NumberInput
              label="参加人数（見込み）"
              value={participants}
              min={1}
              step={1}
              onChange={setParticipants}
            />
            <div className="small">条件2：人数帯で掛率</div>
          </div>

          <div className="col-3">
            <Toggle
              label="日本語講座"
              checked={hasJapaneseLesson}
              onChange={setHasJapaneseLesson}
            />
            <div className="small">条件3：有の場合、週数で自動判定</div>
          </div>

          <div className="col-3">
            <NumberInput
              label="文化体験（回数）"
              value={culturalTimes}
              min={0}
              step={1}
              onChange={setCulturalTimes}
            />
            <div className="small">条件4：0 / 1〜3 / 4〜6 / …</div>
          </div>

          <div className="col-4">
            <Select
              label="準備の複雑度"
              value={prepComplexity}
              onChange={setPrepComplexity}
              options={Object.keys(PREP_COMPLEXITY).map((k) => ({
                value: k,
                label: `${k}（${PREP_COMPLEXITY[k]}）`,
              }))}
            />
            <div className="small">条件5</div>
          </div>

          <div className="col-4">
            <Select
              label="講義"
              value={lecture}
              onChange={setLecture}
              options={[
                { value: "無", label: "無（1.0）" },
                { value: "有", label: "有（1.5）" },
              ]}
            />
            <div className="small">条件6</div>
          </div>

          <div className="col-4">
            <NumberInput
              label="企業訪問（回数）"
              value={companyVisitTimes}
              min={0}
              step={1}
              onChange={setCompanyVisitTimes}
            />
            <div className="small">条件7：0 / 1〜3 / 4〜6 / 7〜9</div>
          </div>

          <div className="col-4">
            <NumberInput
              label="基準金額（1週あたり）"
              value={baseWeeklyPrice}
              min={1}
              step={1000}
              onChange={setBaseWeeklyPrice}
            />
            <div className="small">
              実価格はコードに保存されていません。利用時に入力してください。
            </div>
          </div>

          <div className="col-4">
            <NumberInput
              label="保険（1人あたり）"
              value={insurancePerStudent}
              min={0}
              step={500}
              onChange={setInsurancePerStudent}
            />
            <div className="small">
              実価格はコードに保存されていません。利用時に入力してください。
            </div>
          </div>

          <div className="col-4">
            <label>管理手数料（1人あたり）</label>
            <div className="small">
              実際の管理手数料をコードに固定しないため、毎回手入力します。
            </div>
          </div>

          <div className="col-4">
            <NumberInput
              label="管理手数料（手入力・1人あたり）"
              value={managementFeePerStudentManual}
              min={0}
              step={1000}
              onChange={setManagementFeePerStudentManual}
              placeholder="金額を入力"
            />
          </div>

          <div className="col-12">
            {result.warnings?.length ? (
              <div className="warn">
                {result.warnings.map((w, i) => (
                  <div key={i}>• {w}</div>
                ))}
              </div>
            ) : (
              <div className="good">入力OK</div>
            )}
          </div>

          <div className="col-12">
            <div className="hr" />
          </div>

          <div className="col-12">
            <div className="kpi">
              <div className="box">
                <div className="title">参加者1人あたり（合計）</div>
                <div className="value">
                  {result.ok ? yen(Math.round(result.totalPerStudent)) : "-"}
                </div>
                <div className="small">
                  係数部分{" "}
                  {result.ok ? yen(Math.round(result.variablePerStudent)) : "-"}{" "}
                  ＋ 定額（保険+管理）
                  {result.ok ? yen(Math.round(result.fixedPerStudent)) : "-"}
                </div>
              </div>
              <div className="box">
                <div className="title">全体合計（人数分）</div>
                <div className="value">
                  {result.ok ? yen(Math.round(result.totalProgram)) : "-"}
                </div>
                <div className="small">人数 {participants} 人</div>
              </div>
            </div>
          </div>

          <div className="col-12">
            <div className="hr" />
            <label>金額の内訳（1人あたり）</label>
            <table className="table">
              <thead>
                <tr>
                  <th>項目</th>
                  <th>計算・金額</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>基準金額（1週）</td>
                  <td>
                    {result.ok ? yen(Math.round(result.baseWeeklyPrice)) : "-"}
                  </td>
                </tr>
                <tr>
                  <td>係数積</td>
                  <td>
                    {result.ok
                      ? `${roundFactor(result.productFactor, 3)} 倍`
                      : "-"}
                  </td>
                </tr>
                <tr>
                  <td>係数部分</td>
                  <td>
                    {result.ok
                      ? `${yen(Math.round(result.baseWeeklyPrice))} × ${roundFactor(
                          result.productFactor,
                          3
                        )} = ${yen(Math.round(result.variablePerStudent))}`
                      : "-"}
                  </td>
                </tr>
                <tr>
                  <td>保険</td>
                  <td>
                    {result.ok
                      ? yen(Math.round(result.insurancePerStudent))
                      : "-"}
                  </td>
                </tr>
                <tr>
                  <td>管理手数料</td>
                  <td>
                    {result.ok
                      ? yen(Math.round(result.managementFeePerStudent))
                      : "-"}
                  </td>
                </tr>
                <tr>
                  <td>
                    <strong>合計</strong>
                  </td>
                  <td>
                    <strong>
                      {result.ok
                        ? yen(Math.round(result.totalPerStudent))
                        : "-"}
                    </strong>
                  </td>
                </tr>
              </tbody>
            </table>
            <div className="small">
              ※ 正式な見積を確定する前に、入力金額と係数の妥当性を確認してください。
            </div>
          </div>

          <div className="col-12">
            <div className="hr" />
            <label>原価確認（任意・案件全体）</label>
            <div className="small">
              金額だけを入力してください。取引先名、担当者名などは入力しないでください。
              未入力項目は0円として合計し、全項目が未入力の場合は判定しません。
            </div>
            <div className="cost-input-grid">
              {COST_ITEM_DEFINITIONS.map(({ key, label }) => (
                <NumberInput
                  key={key}
                  label={`${label}（全体）`}
                  value={costItems[key]}
                  min={0}
                  step={1000}
                  placeholder="金額を入力"
                  onChange={(value) => updateCostItem(key, value)}
                />
              ))}
            </div>

            {costCheck.status === "empty" && (
              <div className="cost-empty">
                原価を1項目以上入力すると、見積総額との比較を表示します。
              </div>
            )}

            {!costCheck.ok && costCheck.message && (
              <div className="warn">{costCheck.message}</div>
            )}

            {costCheck.ok && (
              <>
                <table className="table">
                  <thead>
                    <tr>
                      <th>確認項目</th>
                      <th>金額・比率</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>見積総額</td>
                      <td>{yen(Math.round(costCheck.estimatedRevenue))}</td>
                    </tr>
                    <tr>
                      <td>原価合計</td>
                      <td>{yen(Math.round(costCheck.totalCost))}</td>
                    </tr>
                    <tr>
                      <td>1人あたり原価</td>
                      <td>{yen(Math.round(costCheck.costPerParticipant))}</td>
                    </tr>
                    <tr>
                      <td>参考差額</td>
                      <td>{yen(Math.round(costCheck.balance))}</td>
                    </tr>
                    <tr>
                      <td>原価率</td>
                      <td>{num(costCheck.costRate, 1)}%</td>
                    </tr>
                  </tbody>
                </table>
                <div
                  className={
                    costCheck.status === "shortfall" ? "warn" : "good"
                  }
                >
                  {costCheck.status === "shortfall"
                    ? "原価合計が見積総額を上回っています。入力金額と見積条件を確認してください。"
                    : "見積総額が入力済みの原価合計を上回っています。"}
                </div>
              </>
            )}
          </div>

          <div className="col-12">
            <div className="hr" />
            <label>参加人数別シミュレーション</label>
            <table className="table">
              <thead>
                <tr>
                  <th>参加人数</th>
                  <th>人数係数</th>
                  <th>1人あたり</th>
                  <th>全体合計</th>
                </tr>
              </thead>
              <tbody>
                {scenarioRows.map(({ count, isCurrent, estimate }) => (
                  <tr
                    key={count}
                    className={isCurrent ? "scenario-current" : undefined}
                  >
                    <td>
                      {count}人
                      {isCurrent && (
                        <span className="current-badge">入力中</span>
                      )}
                    </td>
                    <td>
                      {typeof estimate.factors?.["条件2 参加者数"] === "number"
                        ? num(estimate.factors["条件2 参加者数"], 2)
                        : "-"}
                    </td>
                    <td>
                      {estimate.ok
                        ? yen(Math.round(estimate.totalPerStudent))
                        : "-"}
                    </td>
                    <td>
                      {estimate.ok
                        ? yen(Math.round(estimate.totalProgram))
                        : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="small">
              ※ その他の条件と入力金額はそのままに、参加人数だけを変更して比較しています。
            </div>
          </div>

          <div className="col-12">
            <div className="hr" />
            <label>掛率の内訳</label>
            <table className="table">
              <thead>
                <tr>
                  <th>条件</th>
                  <th>掛率</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(result.factors ?? {}).map(([k, v]) => (
                  <tr key={k}>
                    <td>{k}</td>
                    <td>{typeof v === "number" ? num(v, 2) : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="small">
              ※「係数積」は、上の掛率をすべて掛けた値です。
            </div>
          </div>

          <div className="col-12">
            <label>コピー用（内訳テキスト）</label>
            <textarea value={breakdownLines} readOnly />
            <div className="row">
              <button className="btn" type="button" onClick={onCopy}>
                内訳をコピー
              </button>
              <button className="btn secondary" type="button" onClick={onReset}>
                リセット
              </button>
            </div>
            {copyMsg && <div className="small">{copyMsg}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
