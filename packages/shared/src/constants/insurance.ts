export interface InsurerItem {
  code: string;
  name: string;
}

// The 34 Taiwan insurers offered in the insurer <select>, plus a free-typed
// "其他". UI constant only — the DB stores the resolved name string, never an
// enum or the code below, so adding/renaming an insurer never needs a
// migration. (Insurance spec) `code` only exists to key each insurer's logo
// asset (served from apps/web/public/insurance/{code}.svg|png, same scheme as
// the bank logos under public/banks) — see InsurerLogo in apps/mobile.
export const INSURERS: InsurerItem[] = [
  { code: "mercuries-life", name: "三商美邦人壽" },
  { code: "chunghwa-post", name: "中華郵政（壽險處）" },
  { code: "ctbc-property", name: "中國信託產險" },
  { code: "yuanta-life", name: "元大人壽" },
  { code: "aia", name: "友邦人壽" },
  { code: "taiwan-life", name: "台灣人壽" },
  { code: "tcb-life", name: "合作金庫人壽" },
  { code: "allianz", name: "安聯人壽" },
  { code: "chubb-life", name: "安達國際人壽" },
  { code: "chubb-property", name: "安達產險" },
  { code: "hontai-life", name: "宏泰人壽" },
  { code: "mingtai", name: "明台產險" },
  { code: "want-want-union", name: "旺旺友聯產險" },
  { code: "cardif-life", name: "法國巴黎人壽" },
  { code: "cardif-property", name: "法國巴黎產險" },
  { code: "tai-an", name: "泰安產險" },
  { code: "prudential", name: "保誠人壽" },
  { code: "nan-shan-life", name: "南山人壽" },
  { code: "nan-shan-property", name: "南山產險" },
  { code: "first-life", name: "第一金人壽" },
  { code: "first-insurance", name: "第一產險" },
  { code: "cathay-life", name: "國泰人壽" },
  { code: "cathay-century", name: "國泰世紀產險" },
  { code: "kgi-life", name: "凱基人壽" },
  { code: "fubon-life", name: "富邦人壽" },
  { code: "fubon-property", name: "富邦產險" },
  { code: "hua-nan-property", name: "華南產險" },
  { code: "shin-kong-life", name: "新光人壽" },
  { code: "shin-kong-property", name: "新光產險" },
  { code: "sompo", name: "新安東京海上產險" },
  { code: "farglory-life", name: "遠雄人壽" },
  { code: "bot-life", name: "臺銀人壽" },
  { code: "hotai-property", name: "和泰產險" },
  { code: "global-life", name: "全球人壽" },
];

export const INSURER_LIST: string[] = INSURERS.map((i) => i.name);

const INSURER_CODE_BY_NAME: Record<string, string> = Object.fromEntries(
  INSURERS.map((i) => [i.name, i.code])
);

/** Looks up an insurer's logo-asset code by its display name. Free-typed
 * (「其他」) names have no code, so callers must handle `undefined`. */
export function getInsurerCode(name: string): string | undefined {
  return INSURER_CODE_BY_NAME[name];
}

export const INSURANCE_TYPES = [
  "LIFE",
  "MEDICAL",
  "CANCER",
  "ACCIDENT",
  "SAVINGS_INVESTMENT",
  "LONGTERM_CARE",
  "OTHER",
] as const;
export type InsuranceType = (typeof INSURANCE_TYPES)[number];

// Human labels for the type <select>.
export const INSURANCE_TYPE_LABELS: Record<InsuranceType, string> = {
  LIFE: "壽險",
  MEDICAL: "醫療險",
  CANCER: "癌症險",
  ACCIDENT: "意外險",
  SAVINGS_INVESTMENT: "儲蓄/投資型",
  LONGTERM_CARE: "長照/失能",
  OTHER: "其他",
};

export const MAX_COVERAGE_ITEMS = 3;

export interface CoverageOption {
  key: string;
  label: string;
}

// Per-type coverage picklists (user selects up to MAX_COVERAGE_ITEMS). OTHER is
// intentionally absent — it has no predefined list and takes free-form labels.
export const INSURANCE_COVERAGE_OPTIONS: Record<
  Exclude<InsuranceType, "OTHER">,
  CoverageOption[]
> = {
  LIFE: [
    { key: "death_disability", label: "身故/全殘保額" },
    { key: "total_disability", label: "完全失能保險金" },
    { key: "maturity", label: "祝壽保險金" },
    { key: "premium_waiver", label: "豁免保費" },
  ],
  MEDICAL: [
    { key: "hospital_daily", label: "住院日額" },
    { key: "reimbursement_cap", label: "實支實付上限" },
    { key: "surgery_cap", label: "手術費用限額" },
    { key: "outpatient_surgery", label: "門診手術金" },
    { key: "icu_daily", label: "加護病房日額" },
    { key: "recovery", label: "出院療養金" },
  ],
  CANCER: [
    { key: "first_diagnosis", label: "初次罹癌保險金" },
    { key: "cancer_hospital_daily", label: "癌症住院日額" },
    { key: "chemo_radio", label: "化療/放療給付" },
    { key: "cancer_surgery", label: "癌症手術保險金" },
    { key: "cancer_death", label: "癌症身故保險金" },
  ],
  ACCIDENT: [
    { key: "accident_death_disability", label: "意外身故/失能保額" },
    { key: "accident_reimbursement_cap", label: "意外實支實付上限" },
    { key: "accident_hospital_daily", label: "意外住院日額" },
    { key: "fracture", label: "骨折未住院給付" },
    { key: "major_burn", label: "重大燒燙傷保險金" },
  ],
  SAVINGS_INVESTMENT: [
    { key: "sum_insured", label: "保額" },
    { key: "declared_rate", label: "宣告利率" },
    { key: "cash_value", label: "目前保價金" },
    { key: "surrender_value", label: "解約金" },
    { key: "accumulated_bonus", label: "累積增值回饋金" },
  ],
  LONGTERM_CARE: [
    { key: "monthly_benefit", label: "每月給付金" },
    { key: "lump_sum", label: "一次性給付金" },
    { key: "disability_support", label: "失能扶助金" },
    { key: "premium_waiver", label: "豁免保費" },
    { key: "death_premium_refund", label: "身故退還保費" },
  ],
};
