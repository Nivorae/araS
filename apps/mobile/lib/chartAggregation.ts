import type { Transaction } from "@repo/shared";

export type Range = "5w" | "5m" | "6m" | "1y" | "4y";

export interface LiquidityPoint {
  period: string;
  income: number;
  expense: number;
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

function getMondayOfWeek(date: Date): Date {
  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setUTCDate(date.getUTCDate() + diff);
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
}

/** Returns an internal grouping key for a date given a range. */
function dateToPeriodKey(date: Date, range: Range): string {
  if (range === "5w") {
    return getMondayOfWeek(date).toISOString().slice(0, 10);
  }
  if (range === "4y") {
    return `${date.getFullYear()}`;
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** Formats an internal key to a display label. */
function formatPeriodLabel(key: string, range: Range): string {
  if (range === "5w") {
    const d = new Date(`${key}T00:00:00`);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }
  if (range === "4y") return key;
  const parts = key.split("-");
  const m = Math.max(0, Math.min(11, parseInt(parts[1] ?? "1", 10) - 1));
  return MONTHS[m] ?? "Jan";
}

/** Builds the ordered list of internal period keys for a given range. */
function buildPeriods(range: Range): string[] {
  const now = new Date();
  const keys: string[] = [];

  if (range === "5w") {
    const d = getMondayOfWeek(now);
    d.setDate(d.getDate() - 28);
    for (let i = 0; i < 5; i++) {
      keys.push(d.toISOString().slice(0, 10));
      d.setDate(d.getDate() + 7);
    }
  } else if (range === "5m") {
    const d = new Date(now.getFullYear(), now.getMonth() - 4, 1);
    for (let i = 0; i < 5; i++) {
      keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
      d.setMonth(d.getMonth() + 1);
    }
  } else if (range === "6m") {
    const d = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    for (let i = 0; i < 6; i++) {
      keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
      d.setMonth(d.getMonth() + 1);
    }
  } else if (range === "1y") {
    const d = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    for (let i = 0; i < 12; i++) {
      keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
      d.setMonth(d.getMonth() + 1);
    }
  } else {
    for (let i = 3; i >= 0; i--) {
      keys.push(`${now.getFullYear() - i}`);
    }
  }

  return keys;
}

/** Aggregates transactions into per-period income/expense totals. */
export function aggregateTransactions(transactions: Transaction[], range: Range): LiquidityPoint[] {
  const keys = buildPeriods(range);
  const map = new Map<string, { income: number; expense: number }>();
  keys.forEach((k) => map.set(k, { income: 0, expense: 0 }));

  for (const t of transactions) {
    const d = new Date(t.date);
    const key = dateToPeriodKey(d, range);
    if (!map.has(key)) continue;
    const entry = map.get(key)!;
    if (t.type === "income") entry.income += t.amount;
    else if (t.type === "expense") entry.expense += t.amount;
  }

  return keys.map((key) => ({
    period: formatPeriodLabel(key, range),
    income: map.get(key)!.income,
    expense: map.get(key)!.expense,
  }));
}
