export interface Params {
  currentAge: number;
  retirementAge: number;
  monthlyExpense: number;
  inflationRate: number;
  accRate: number;
  wdRate: number;
  swr: number;
  monthlyContrib: number;
  govPension: number;
}

export interface ModalContent {
  title: string;
  description: string;
  steps: { label: string; value?: string }[];
  result: { label: string; value: string };
}

export const STORAGE_KEY = "retirement_params_v1";

export const DEFAULTS: Params = {
  currentAge: 30,
  retirementAge: 65,
  monthlyExpense: 50000,
  inflationRate: 2.5,
  accRate: 7.0,
  wdRate: 5.0,
  swr: 4.0,
  monthlyContrib: 10000,
  govPension: 15000,
};

/** Sanitize loaded params: keep only valid numeric keys, merge over DEFAULTS. */
export function sanitizeParams(raw: unknown): Params {
  if (typeof raw !== "object" || raw === null) return { ...DEFAULTS };
  const r = raw as Record<string, unknown>;
  const out: Params = { ...DEFAULTS };
  (Object.keys(DEFAULTS) as (keyof Params)[]).forEach((k) => {
    const v = r[k];
    if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
  });
  return out;
}

export function fmtWan(v: number): string {
  if (v === 0) return "0";
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1e8) return `${sign}${(abs / 1e8).toFixed(1)}億`;
  if (abs >= 1e4) {
    const wan = abs / 1e4;
    return `${sign}${wan.toLocaleString("zh-TW", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })}萬`;
  }
  return `${sign}${Math.round(abs).toLocaleString("zh-TW")}`;
}

export function fmtY(v: number): string {
  if (v >= 1e8) return `${(v / 1e8).toFixed(0)}億`;
  if (v >= 1e4) return `${Math.round(v / 1e4).toLocaleString("zh-TW")}萬`;
  return v.toLocaleString("zh-TW", { maximumFractionDigits: 0 });
}
