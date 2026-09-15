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
export const SALARY_STORAGE_KEY = "retirement_salary_v1";
export const PASSIVE_INCOME_STORAGE_KEY = "retirement_passive_income_v1";

/** 月薪 + 每月被動收入。非有限或負數的輸入一律視為 0。 */
export function monthlyIncomeTotal(salary: number, passiveIncome: number): number {
  const pos = (v: number) => (Number.isFinite(v) && v > 0 ? v : 0);
  return pos(salary) + pos(passiveIncome);
}

export const fmtNtd = (v: number) => `NT$ ${Math.round(v).toLocaleString("zh-TW")}`;

export interface SalaryRule {
  key: string;
  title: string;
  formula: string;
  value: number;
  /** 點開規則時抽屜顯示的說明與逐步計算。 */
  detail: ModalContent;
}

/**
 * 以每月總收入（月薪 + 被動收入）推算的五條理財經驗法則。非有限或負數的輸入一律視為 0。
 */
export function salaryRules(salary: number, passiveIncome: number): SalaryRule[] {
  const s = monthlyIncomeTotal(salary, passiveIncome);
  const salaryStep = { label: "每月總收入（月薪 + 被動收入）", value: fmtNtd(s) };
  const annualStep = { label: "× 12 個月（年收入）", value: fmtNtd(s * 12) };

  const rule = (
    key: string,
    title: string,
    formula: string,
    value: number,
    description: string,
    steps: ModalContent["steps"]
  ): SalaryRule => ({
    key,
    title,
    formula,
    value,
    detail: { title, description, steps, result: { label: title, value: fmtNtd(value) } },
  });

  return [
    rule(
      "save",
      "每月投資或儲蓄",
      "總收入 × 0.3",
      s * 0.3,
      "每月先把三成收入撥去投資或儲蓄，剩下的才拿來花。這是累積資產的基本比例，收入穩定後可以再逐步提高。",
      [salaryStep, { label: "× 30%" }]
    ),
    rule(
      "spend",
      "每月開支上限",
      "總收入 × 0.6",
      s * 0.6,
      "日常生活開支控制在總收入六成以內，保留空間給儲蓄與突發支出，避免月光。",
      [salaryStep, { label: "× 60%" }]
    ),
    rule(
      "emergency",
      "緊急預備金",
      "總收入 × 3",
      s * 3,
      "至少備妥三個月總收入的現金，應付失業、醫療等突發狀況。建議放在隨時能動用的活存，不要拿去投資。",
      [salaryStep, { label: "× 3 個月" }]
    ),
    rule(
      "principal",
      "穩定 6% 報酬工具所需本金",
      "總收入 × 12 ÷ 6%",
      (s * 12) / 0.06,
      "如果想靠年化 6% 的穩定報酬（例如高股息或債券）產生和目前年收入一樣的現金流，需要投入的本金。",
      [salaryStep, annualStep, { label: "÷ 6% 年化報酬" }]
    ),
    rule(
      "noWork",
      "無法工作時的緊急現金流",
      "總收入 × 12 × 5",
      s * 12 * 5,
      "萬一因傷病長期無法工作，準備五年份的年收入作為現金流，讓生活與家人不受影響。可搭配失能險分擔。",
      [salaryStep, annualStep, { label: "× 5 年" }]
    ),
  ];
}

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
