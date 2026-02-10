import React, { useMemo, useState } from "react";
import { calcEstimate, DEFAULTS, PREP_COMPLEXITY } from "./lib/rules.js";
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

export default function App() {
  const [programName, setProgramName] =
    useState("（例）カスタムプログラム見積");
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

  const [useManualMgmtFee, setUseManualMgmtFee] = useState(false);
  const [managementFeePerStudentManual, setManagementFeePerStudentManual] =
    useState("");

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
    setProgramName("（例）カスタムプログラム見積");
    setWeeks(2);
    setParticipants(15);
    setHasJapaneseLesson(true);
    setCulturalTimes(5);
    setPrepComplexity("新規");
    setLecture("無");
    setCompanyVisitTimes(1);
    setBaseWeeklyPrice(DEFAULTS.baseWeeklyPrice);
    setInsurancePerStudent(DEFAULTS.insurancePerStudent);
    setUseManualMgmtFee(false);
    setManagementFeePerStudentManual("");
  }

  return (
    <div className="container">
      <h1>カスタムプログラム 見積（係数方式）</h1>
      <p className="sub">
        原価積み上げ無し。<b>基準金額 × 条件1〜7の掛率</b>
        で「参加者1人あたり」を算出し、最後に保険＋管理手数料（いずれも1人あたり）を加算します。
      </p>

      <div className="card">
        <div className="grid">
          <div className="col-12">
            <label>案件名（メモ用）</label>
            <input
              value={programName}
              onChange={(e) => setProgramName(e.target.value)}
              placeholder="例：OU 2026 Summer Custom Program"
            />
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
            <div className="small">初期値：25,000円</div>
          </div>

          <div className="col-4">
            <NumberInput
              label="保険（1人あたり）"
              value={insurancePerStudent}
              min={0}
              step={500}
              onChange={setInsurancePerStudent}
            />
            <div className="small">初期値：8,000円</div>
          </div>

          <div className="col-4">
            <label>管理手数料（1人あたり）</label>
            <div className="row">
              <button
                className={"btn secondary"}
                type="button"
                onClick={() => setUseManualMgmtFee(false)}
              >
                自動
              </button>
              <button
                className={"btn secondary"}
                type="button"
                onClick={() => setUseManualMgmtFee(true)}
              >
                手入力
              </button>
            </div>
            <div className="small">
              1〜5週は自動（20k/30k/40k/50k/60k）。6週以上は未定義なので手入力推奨。
            </div>
          </div>

          {useManualMgmtFee && (
            <div className="col-4">
              <NumberInput
                label="管理手数料（手入力・1人あたり）"
                value={managementFeePerStudentManual}
                min={0}
                step={1000}
                onChange={setManagementFeePerStudentManual}
                placeholder="例：70000"
              />
            </div>
          )}

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
