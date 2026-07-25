const SECTION_STORAGE_KEYS = Object.freeze({
  company: "companyVisits",
  culture: "culturalActivities",
  japanese: "japaneseCourse",
  collaboration: "studentCollaboration",
  common: "commonCosts",
});

const VALID_TAX_MODES = new Set(["included", "excluded", "exempt"]);
const VALID_CALC_MODES = new Set(["perSession", "perPerson"]);
const VALID_COMMON_BASES = new Set(["fixed", "participant", "day"]);

function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function isFiniteAtLeast(value, minimum) {
  if (!hasValue(value)) return false;
  const number = Number(value);
  return Number.isFinite(number) && number >= minimum;
}

function isPositiveInteger(value) {
  if (!hasValue(value)) return false;
  const number = Number(value);
  return Number.isInteger(number) && number > 0;
}

function countDetail({ completedCount = 0, missingCount = 0, warningCount = 0 }) {
  const parts = [];
  if (completedCount > 0) parts.push(`入力済み${completedCount}`);
  if (missingCount > 0) parts.push(`未入力${missingCount}`);
  if (warningCount > 0) parts.push(`要確認${warningCount}`);
  return parts.join("・");
}

function result(label, tone, metrics = {}, detail = "") {
  const normalized = {
    completedCount: metrics.completedCount || 0,
    missingCount: metrics.missingCount || 0,
    warningCount: metrics.warningCount || 0,
  };
  return {
    label,
    tone,
    ...normalized,
    detail: detail || countDetail(normalized),
  };
}

function evaluateVisitSection(count, state, noun) {
  const requestedCount = Number(count);
  if (!Number.isInteger(requestedCount) || requestedCount < 0) {
    return result("要確認", "attention", { warningCount: 1 }, "実施回数を確認してください");
  }
  if (requestedCount === 0) {
    return result("対象外", "excluded", {}, `${noun}回数 0回`);
  }

  const entries = Array.isArray(state) ? state : [];
  let completedCount = 0;
  let missingCount = 0;
  let warningCount = 0;
  let hasInput = false;

  for (let index = 0; index < requestedCount; index += 1) {
    const entry = entries[index] || {};
    const destinationComplete = hasValue(entry.destination);
    if (destinationComplete) {
      completedCount += 1;
      hasInput = true;
    } else {
      missingCount += 1;
    }

    const lines = Array.isArray(entry.lines) ? entry.lines : [];
    const enteredLines = lines.filter((line) => hasValue(line?.unitPrice));
    if (enteredLines.length === 0) {
      missingCount += 1;
      continue;
    }

    hasInput = true;
    let costGroupValid = true;
    enteredLines.forEach((line) => {
      const valid = isFiniteAtLeast(line.unitPrice, 0)
        && isPositiveInteger(line.quantity)
        && VALID_TAX_MODES.has(line.taxMode)
        && (!line.custom || hasValue(line.label));
      if (!valid) {
        costGroupValid = false;
        warningCount += 1;
      }
    });

    if (costGroupValid) completedCount += 1;
  }

  const metrics = { completedCount, missingCount, warningCount };
  if (warningCount > 0) return result("要確認", "attention", metrics);
  if (!hasInput) return result("未入力", "empty", metrics);
  if (missingCount > 0) return result("入力中", "progress", metrics);
  return result("入力済み", "complete", metrics);
}

function evaluateJapaneseCourse(state) {
  const values = state && typeof state === "object" ? state : {};
  const rateEntered = hasValue(values.hourlyRate);
  const setupChanged = String(values.hoursPerSession ?? "2") !== "2"
    || String(values.sessions ?? "1") !== "1"
    || String(values.classes ?? "1") !== "1"
    || String(values.taxMode ?? "included") !== "included";

  if (!rateEntered) {
    const supportingInvalid = !isFiniteAtLeast(values.hoursPerSession ?? "2", Number.EPSILON)
      || !isPositiveInteger(values.sessions ?? "1")
      || !isPositiveInteger(values.classes ?? "1")
      || !VALID_TAX_MODES.has(values.taxMode ?? "included");
    if (supportingInvalid) {
      return result("要確認", "attention", { missingCount: 1, warningCount: 1 }, "時間単価と入力条件を確認してください");
    }
    return result(
      setupChanged ? "入力中" : "未入力",
      setupChanged ? "progress" : "empty",
      { missingCount: 1 },
      "時間単価が未入力"
    );
  }

  let warningCount = 0;
  if (!isFiniteAtLeast(values.hourlyRate, 0)) warningCount += 1;
  if (!isFiniteAtLeast(values.hoursPerSession, Number.EPSILON)) warningCount += 1;
  if (!isPositiveInteger(values.sessions)) warningCount += 1;
  if (!isPositiveInteger(values.classes)) warningCount += 1;
  if (!VALID_TAX_MODES.has(values.taxMode)) warningCount += 1;

  if (warningCount > 0) {
    return result("要確認", "attention", { warningCount }, `${warningCount}項目を確認してください`);
  }
  return result("入力済み", "complete", { completedCount: 1 }, "講座条件を入力済み");
}

function evaluateCollaboration(state) {
  const values = state && typeof state === "object" ? state : {};
  const lines = Array.isArray(values.lines) ? values.lines : [];
  const enteredLines = lines.filter((line) => hasValue(line?.unitPrice));
  const setupChanged = String(values.participants ?? "15") !== "15"
    || String(values.sessions ?? "1") !== "1";

  let warningCount = 0;
  if (!isPositiveInteger(values.participants ?? "15")) warningCount += 1;
  if (!isPositiveInteger(values.sessions ?? "1")) warningCount += 1;

  let completedCount = 0;
  enteredLines.forEach((line) => {
    const valid = isFiniteAtLeast(line.unitPrice, 0)
      && VALID_CALC_MODES.has(line.calcMode)
      && VALID_TAX_MODES.has(line.taxMode);
    if (valid) completedCount += 1;
    else warningCount += 1;
  });

  if (warningCount > 0) {
    return result("要確認", "attention", { completedCount, warningCount });
  }
  if (enteredLines.length === 0) {
    return result(
      setupChanged ? "入力中" : "未入力",
      setupChanged ? "progress" : "empty",
      { missingCount: 1 },
      "経費単価が未入力"
    );
  }
  return result("入力済み", "complete", { completedCount }, `${completedCount}項目入力済み`);
}

function evaluateCommonCosts(state) {
  const values = state && typeof state === "object" ? state : {};
  const lines = Array.isArray(values.lines) ? values.lines : [];
  const enteredLines = lines.filter((line) => hasValue(line?.unitPrice));
  const setupChanged = String(values.days ?? "1") !== "1";

  let warningCount = 0;
  if (!isPositiveInteger(values.participants ?? "15")) warningCount += 1;
  if (!isPositiveInteger(values.days ?? "1")) warningCount += 1;

  let completedCount = 0;
  enteredLines.forEach((line) => {
    const quantity = line.basis === "participant" ? line.quantity ?? values.participants : "1";
    const valid = isFiniteAtLeast(line.unitPrice, 0)
      && VALID_COMMON_BASES.has(line.basis)
      && VALID_TAX_MODES.has(line.taxMode)
      && (line.basis !== "participant" || isPositiveInteger(quantity))
      && (!line.editableLabel || hasValue(line.label));
    if (valid) completedCount += 1;
    else warningCount += 1;
  });

  if (warningCount > 0) {
    return result("要確認", "attention", { completedCount, warningCount });
  }
  if (enteredLines.length === 0) {
    return result(
      setupChanged ? "入力中" : "未入力",
      setupChanged ? "progress" : "empty",
      { missingCount: 1 },
      "経費単価が未入力"
    );
  }
  return result("入力済み", "complete", { completedCount }, `${completedCount}項目入力済み`);
}

export function readBuildUpSectionState(sectionKey, storage = window.localStorage) {
  const storageKey = SECTION_STORAGE_KEYS[sectionKey];
  if (!storageKey || !storage) return null;
  try {
    const raw = storage.getItem(`mitsumori.estimateState.${storageKey}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function evaluateBuildUpSection({ sectionKey, amount = 0, count = null, state = null }) {
  if (sectionKey === "summary") {
    return amount > 0
      ? result("確認可能", "complete", {}, "入力済み費用を確認できます")
      : result("入力待ち", "empty", {}, "費用入力後に確認できます");
  }
  if (sectionKey === "company") return evaluateVisitSection(count, state, "企業訪問");
  if (sectionKey === "culture") return evaluateVisitSection(count, state, "文化体験");
  if (sectionKey === "japanese") return evaluateJapaneseCourse(state);
  if (sectionKey === "collaboration") return evaluateCollaboration(state);
  if (sectionKey === "common") return evaluateCommonCosts(state);
  return result("未入力", "empty");
}
