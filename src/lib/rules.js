export const DEFAULTS = {
  // 実際の価格をソースコードに保存しない。利用時に毎回入力する。
  baseWeeklyPrice: "",
  insurancePerStudent: "",
};

export const PREP_COMPLEXITY = {
  レギュラー: 1.0,
  継続: 1.2,
  新規: 1.35,
  "複雑（新・継）": 1.5,
};

export const LECTURE_FACTOR = {
  無: 1.0,
  有: 1.5,
};

// 条件1：実施期間（1週=1.0、2週=2.0 ...）→ 実質「週数」そのもの
export function weekFactor(weeks) {
  const w = Number(weeks);
  if (!Number.isFinite(w) || w <= 0) return null;
  return w;
}

// 条件2：参加者数見込み
export function participantFactor(count) {
  const n = Number(count);
  if (!Number.isFinite(n) || n <= 0) return null;

  if (n <= 10) return 1.5;
  if (n <= 15) return 1.3;
  if (n <= 20) return 1.2;
  if (n <= 25) return 1.0;
  if (n <= 30) return 0.9; // 目安（表では括弧）
  return 0.8; // 31〜（表では括弧）
}

// 条件3：日本語講座（有/無 + 期間で係数）
export function japaneseLessonFactor(hasJapaneseLesson, weeks) {
  if (!hasJapaneseLesson) return 1.0;

  const w = Number(weeks);
  if (!Number.isFinite(w) || w <= 0) return null;

  if (w <= 2) return 1.3;
  if (w <= 5) return 1.6;
  return 2.0; // 5週間〜
}

// 条件4：文化体験（回数）
export function culturalFactor(times) {
  const t = Number(times);
  if (!Number.isFinite(t) || t < 0) return null;

  if (t === 0) return 1.0;
  if (t <= 3) return 1.2;
  if (t <= 6) return 1.4;
  if (t <= 9) return 1.6;
  if (t <= 14) return 1.8;
  if (t <= 20) return 2.0;
  if (t <= 30) return 3.0;

  // 31以上は表外。いったん最大に丸め、警告を出す側で扱う
  return 3.0;
}

// 条件7：企業訪問（回数）
export function companyVisitFactor(times) {
  const t = Number(times);
  if (!Number.isFinite(t) || t < 0) return null;

  if (t === 0) return 1.0;
  if (t <= 3) return 1.2;
  if (t <= 6) return 1.4;
  return 1.6; // 7〜9（9超は表外だが最大に丸める）
}

export function calcCostCheck({
  costItems = {},
  participants,
  estimatedRevenue,
}) {
  const hasValue = (value) =>
    value !== null &&
    value !== undefined &&
    String(value).trim() !== "";

  const enteredItems = Object.entries(costItems).filter(([, value]) =>
    hasValue(value)
  );

  if (enteredItems.length === 0) {
    return { ok: false, status: "empty" };
  }

  const invalidItems = enteredItems.filter(([, value]) => {
    const amount = Number(value);
    return !Number.isFinite(amount) || amount < 0;
  });

  if (invalidItems.length > 0) {
    return {
      ok: false,
      status: "invalid",
      message: "原価は0円以上の数字で入力してください。",
    };
  }

  const participantCount = Number(participants);
  if (!Number.isFinite(participantCount) || participantCount <= 0) {
    return {
      ok: false,
      status: "invalid",
      message: "参加人数を正しく入力してください。",
    };
  }

  const revenue = Number(estimatedRevenue);
  if (!Number.isFinite(revenue) || revenue <= 0) {
    return {
      ok: false,
      status: "estimate-unavailable",
      message: "見積金額の入力を完了すると原価と比較できます。",
    };
  }

  const totalCost = enteredItems.reduce(
    (sum, [, value]) => sum + Number(value),
    0
  );
  const costPerParticipant = totalCost / participantCount;
  const balance = revenue - totalCost;
  const costRate = (totalCost / revenue) * 100;

  return {
    ok: true,
    status: balance >= 0 ? "covered" : "shortfall",
    estimatedRevenue: revenue,
    totalCost,
    costPerParticipant,
    balance,
    costRate,
  };
}

export function calcEstimate(input) {
  const warnings = [];

  const weeks = Number(input.weeks);
  const participants = Number(input.participants);

  const fWeek = weekFactor(weeks);
  const fPart = participantFactor(participants);
  const fJp = japaneseLessonFactor(Boolean(input.hasJapaneseLesson), weeks);
  const fCulture = culturalFactor(input.culturalTimes);
  const fPrep = PREP_COMPLEXITY[input.prepComplexity] ?? null;
  const fLecture = LECTURE_FACTOR[input.lecture] ?? null;
  const fCompany = companyVisitFactor(input.companyVisitTimes);

  if (Number(input.culturalTimes) > 30) {
    warnings.push(
      "文化体験回数が30を超えています（表外）。係数は最大(3.0)で計算しています。"
    );
  }
  if (Number(input.companyVisitTimes) > 9) {
    warnings.push(
      "企業訪問回数が9を超えています（表外）。係数は最大(1.6)で計算しています。"
    );
  }

  const baseWeeklyPrice = Number(input.baseWeeklyPrice);
  if (!Number.isFinite(baseWeeklyPrice) || baseWeeklyPrice <= 0) {
    warnings.push("基準金額（1週あたり）が不正です。");
  }

  const insurance = Number(input.insurancePerStudent);
  if (!Number.isFinite(insurance) || insurance < 0) {
    warnings.push("保険（1人あたり）が不正です。");
  }

  // 管理手数料（1人あたり）
  // 実際の金額をコードに固定しないため、必ず利用時に入力する。
  let mgmtFee = null;
  if (input.useManualMgmtFee) {
    const m = Number(input.managementFeePerStudentManual);
    if (!Number.isFinite(m) || m < 0) {
      warnings.push("管理手数料（手入力）が不正です。");
    } else {
      mgmtFee = m;
    }
  } else {
    warnings.push("管理手数料を入力してください。");
  }

  const factors = {
    "条件1 実施期間": fWeek,
    "条件2 参加者数": fPart,
    "条件3 日本語講座": fJp,
    "条件4 文化体験": fCulture,
    "条件5 準備の複雑度": fPrep,
    "条件6 講義": fLecture,
    "条件7 企業訪問": fCompany,
  };

  const factorList = Object.entries(factors);

  // バリデーション：係数が欠けると計算しない
  const invalid = factorList.some(
    ([, v]) => typeof v !== "number" || !Number.isFinite(v)
  );

  if (
    invalid ||
    mgmtFee === null ||
    !Number.isFinite(baseWeeklyPrice) ||
    !Number.isFinite(insurance) ||
    !Number.isFinite(participants) ||
    participants <= 0
  ) {
    return {
      ok: false,
      warnings,
      factors,
      baseWeeklyPrice,
      weeks,
      participants,
    };
  }

  const productFactor = factorList.reduce((acc, [, v]) => acc * v, 1);

  // 参加者1人あたり（係数部分）
  const variablePerStudent = baseWeeklyPrice * productFactor;

  // 定額（1人あたり）
  const fixedPerStudent = insurance + mgmtFee;

  // 参加者1人あたり合計
  const totalPerStudent = variablePerStudent + fixedPerStudent;

  // 全体合計
  const totalProgram = totalPerStudent * participants;

  return {
    ok: true,
    warnings,
    factors,
    baseWeeklyPrice,
    weeks,
    participants,
    productFactor,
    variablePerStudent,
    insurancePerStudent: insurance,
    managementFeePerStudent: mgmtFee,
    fixedPerStudent,
    totalPerStudent,
    totalProgram,
  };
}
