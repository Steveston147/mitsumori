export const TAX_MODE_OPTIONS = [
  { value: "included", label: "税込10%" },
  { value: "excluded", label: "税別10%" },
  { value: "exempt", label: "非課税" },
];

function hasValue(value) {
  return (
    value !== null &&
    value !== undefined &&
    String(value).trim() !== ""
  );
}

export function calcCostLine({ unitPrice, quantity, taxMode }) {
  if (!hasValue(unitPrice)) {
    return {
      ok: true,
      status: "empty",
      taxAmount: 0,
      total: 0,
    };
  }

  const price = Number(unitPrice);
  const count = Number(quantity);

  if (
    !Number.isFinite(price) ||
    price < 0 ||
    !Number.isInteger(count) ||
    count <= 0
  ) {
    return {
      ok: false,
      status: "invalid",
      taxAmount: 0,
      total: 0,
    };
  }

  const amount = price * count;
  let taxAmount = 0;
  let total = amount;

  if (taxMode === "excluded") {
    taxAmount = Math.round(amount * 0.1);
    total = amount + taxAmount;
  } else if (taxMode === "included") {
    taxAmount = Math.round((amount * 10) / 110);
  } else if (taxMode !== "exempt") {
    return {
      ok: false,
      status: "invalid",
      taxAmount: 0,
      total: 0,
    };
  }

  return {
    ok: true,
    status: "calculated",
    amount,
    taxAmount,
    total,
  };
}

export function calcCostGroup(lines = []) {
  const results = lines.map((line) => calcCostLine(line));
  const invalid = results.some((result) => !result.ok);

  return {
    ok: !invalid,
    hasInput: results.some((result) => result.status === "calculated"),
    totalTax: results.reduce((sum, result) => sum + result.taxAmount, 0),
    total: results.reduce((sum, result) => sum + result.total, 0),
    results,
  };
}
