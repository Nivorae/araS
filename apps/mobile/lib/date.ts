// Read/write "YYYY-MM-DD" via local date parts, never `toISOString()` — that
// converts a LOCAL date/midnight to UTC, which lands on the PREVIOUS day for
// a positive-offset timezone (e.g. Taiwan, UTC+8). Every date picker in the
// app (EntryForm, InsuranceForm, LoanFormFields, DividendForm, entry
// transfer) reads/writes dates through these three functions so the fix
// lives in one place.
export function parseISODate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d);
}

export function toISODate(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function formatDisplayDate(s: string): string {
  if (!s) return "選擇日期";
  const d = parseISODate(s);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}
