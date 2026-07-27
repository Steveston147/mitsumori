function parseDisplayedNumber(value) {
  if (typeof value !== "string") return null;
  const normalized = value.replaceAll(",", "").replace(/[^\d.-]/g, "");
  if (!normalized) return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

export function calculatePerPersonEstimate(estimateTotal, studentCount) {
  const total = parseDisplayedNumber(estimateTotal);
  const students = parseDisplayedNumber(studentCount);

  if (total === null || students === null || total < 0 || students <= 0) {
    return {
      amount: null,
      display: "算出できません",
      available: false,
    };
  }

  const amount = Math.round(total / students);
  return {
    amount,
    display: `${amount.toLocaleString("ja-JP")}円`,
    available: true,
  };
}
