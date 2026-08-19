export function formatCurrency(amount: number, currency = "TWD"): string {
  return new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

// ─── Integer-with-thousands input ──────────────────────────────────────────
// Strips decimals and non-digit characters as the user types, keeping at most
// one leading "-" for negative adjustments, so the underlying value is always
// a clean integer string ready for parseInt.
export function toIntegerDigits(raw: string): string {
  const negative = raw.trim().startsWith("-");
  const digits = raw.replace(/[^0-9]/g, "");
  return (negative ? "-" : "") + digits;
}

// Renders an integer digit string (from toIntegerDigits) with comma
// separators for display, e.g. "1234567" -> "1,234,567".
export function formatThousands(digits: string): string {
  if (!digits) return "";
  const negative = digits.startsWith("-");
  const abs = negative ? digits.slice(1) : digits;
  const withCommas = abs.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return (negative ? "-" : "") + withCommas;
}
