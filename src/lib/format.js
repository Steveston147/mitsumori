export function yen(n) {
  if (typeof n !== "number" || !Number.isFinite(n)) return "-";
  return n.toLocaleString("ja-JP") + "円";
}

export function num(n, digits = 2) {
  if (typeof n !== "number" || !Number.isFinite(n)) return "-";
  return n.toFixed(digits);
}
