// The 34 Taiwan insurers offered in the insurer <select>, plus a free-typed
// "其他". UI constant only — the DB stores the resolved string, never an enum,
// so adding/renaming an insurer never needs a migration. (Insurance spec)
export const INSURER_LIST: string[] = [
  "三商美邦人壽",
  "中華郵政（壽險處）",
  "中國信託產險",
  "元大人壽",
  "友邦人壽",
  "台灣人壽",
  "合作金庫人壽",
  "安聯人壽",
  "安達國際人壽",
  "安達產險",
  "宏泰人壽",
  "明台產險",
  "旺旺友聯產險",
  "法國巴黎人壽",
  "法國巴黎產險",
  "泰安產險",
  "保誠人壽",
  "南山人壽",
  "南山產險",
  "第一金人壽",
  "第一產險",
  "國泰人壽",
  "國泰世紀產險",
  "凱基人壽",
  "富邦人壽",
  "富邦產險",
  "華南產險",
  "新光人壽",
  "新光產險",
  "新安東京海上產險",
  "遠雄人壽",
  "臺銀人壽",
  "和泰產險",
  "全球人壽",
];

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
