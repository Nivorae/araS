import {
  INSURANCE_COVERAGE_OPTIONS,
  type CoverageItem,
  type Entry,
  type EntryHistory,
  type Insurance,
  type InsuranceType,
  type Transaction,
} from "@repo/shared";
import type { DemoDividend, DemoState } from "./types";

// 示範資料。名稱、金額、代號全部寫死；只有日期以「今天」往回推 —— 寫死成實際
// 日期的話，幾個月後淨值圖最後一點會停在過去，示範看起來像壞掉。

const DAY_MS = 86_400_000;

// 往回 n 個月的月中。n = 0 時月中可能還沒到，所以一律不晚於昨天。
function monthsAgo(now: Date, months: number): string {
  const mid = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - months, 15);
  return new Date(Math.min(mid, now.getTime() - DAY_MS)).toISOString();
}

export const SEED_IDS = {
  cash: "demo-seed-cash",
  debit: "demo-seed-debit",
  loan: "demo-seed-loan",
  card: "demo-seed-card",
  tw: "demo-seed-tw",
  us: "demo-seed-us",
  receivable: "demo-seed-receivable",
} as const;

interface EntrySeed {
  id: string;
  name: string;
  topCategory: string;
  subCategory: string;
  value: number;
  /** 12 個月前的值；省略代表這一年沒變。 */
  startValue?: number;
  stockCode?: string;
  bankCode?: string;
  /** 有報價的投資：一次買進，單位數 × 成本價 = value。 */
  units?: number;
  pricePerShare?: number;
  boughtMonthsAgo?: number;
}

// prettier-ignore
const ENTRY_SEEDS: EntrySeed[] = [
  // 流動資金
  { id: SEED_IDS.cash, name: "錢包現金", topCategory: "流動資金", subCategory: "現金", value: 35000, startValue: 20000 },
  { id: "demo-seed-linepay", name: "LINE Pay Money", topCategory: "流動資金", subCategory: "Line Pay", value: 3200, startValue: 1500 },
  { id: "demo-seed-applepay", name: "Apple Cash", topCategory: "流動資金", subCategory: "Apple Pay", value: 1800, startValue: 1000 },
  { id: "demo-seed-jkopay", name: "街口帳戶", topCategory: "流動資金", subCategory: "街口支付", value: 2500, startValue: 800 },
  { id: SEED_IDS.debit, name: "國泰世華 薪轉戶", topCategory: "流動資金", subCategory: "金融卡", value: 480000, startValue: 310000, bankCode: "cathay" },
  { id: "demo-seed-liquid-other", name: "外幣定存", topCategory: "流動資金", subCategory: "其他", value: 150000 },
  // 負債
  { id: SEED_IDS.loan, name: "房屋貸款", topCategory: "負債", subCategory: "貸款", value: 7450000, startValue: 7620000 },
  { id: SEED_IDS.card, name: "信用卡未繳", topCategory: "負債", subCategory: "信用卡", value: 28000, startValue: 35000 },
  { id: "demo-seed-debt-other", name: "親友借款", topCategory: "負債", subCategory: "其他負債", value: 100000, startValue: 160000 },
  // 投資
  { id: "demo-seed-fund", name: "安聯台灣科技基金", topCategory: "投資", subCategory: "投資基金", value: 200000, startValue: 150000 },
  { id: SEED_IDS.tw, name: "台積電", topCategory: "投資", subCategory: "台股", value: 170000, stockCode: "2330", units: 200, pricePerShare: 850, boughtMonthsAgo: 11 },
  { id: SEED_IDS.us, name: "Apple", topCategory: "投資", subCategory: "美股", value: 124000, stockCode: "AAPL", units: 20, pricePerShare: 6200, boughtMonthsAgo: 10 },
  { id: "demo-seed-crypto", name: "Bitcoin", topCategory: "投資", subCategory: "加密貨幣", value: 140000, stockCode: "BTC", units: 0.05, pricePerShare: 2800000, boughtMonthsAgo: 9 },
  { id: "demo-seed-metal", name: "現貨黃金", topCategory: "投資", subCategory: "貴金屬", value: 190000, stockCode: "xau", units: 2, pricePerShare: 95000, boughtMonthsAgo: 8 },
  { id: "demo-seed-invest-other", name: "定期定額帳戶", topCategory: "投資", subCategory: "其他投資", value: 80000, startValue: 50000 },
  // 固定資產
  { id: "demo-seed-house", name: "自住房屋", topCategory: "固定資產", subCategory: "房屋", value: 12000000 },
  { id: "demo-seed-car", name: "Toyota RAV4", topCategory: "固定資產", subCategory: "車輛", value: 650000, startValue: 720000 },
  { id: "demo-seed-asset-other", name: "筆電與相機", topCategory: "固定資產", subCategory: "其他資產", value: 90000, startValue: 110000 },
  // 應收款
  { id: SEED_IDS.receivable, name: "朋友借款", topCategory: "應收款", subCategory: "一般應收款", value: 30000 },
];

interface InsuranceSeed {
  type: InsuranceType;
  insurer: string;
  policyName: string;
  annualPremium: number;
  paymentTermYears: number;
  coveragePeriod: string;
  coverage: [key: string, value: number][];
}

// prettier-ignore
const INSURANCE_SEEDS: InsuranceSeed[] = [
  { type: "LIFE", insurer: "國泰人壽", policyName: "終身壽險", annualPremium: 36000, paymentTermYears: 20, coveragePeriod: "終身", coverage: [["death_disability", 3000000]] },
  { type: "MEDICAL", insurer: "富邦人壽", policyName: "實支實付醫療險", annualPremium: 12000, paymentTermYears: 20, coveragePeriod: "終身", coverage: [["hospital_daily", 2000], ["reimbursement_cap", 300000]] },
  { type: "CANCER", insurer: "南山人壽", policyName: "防癌終身險", annualPremium: 9800, paymentTermYears: 20, coveragePeriod: "終身", coverage: [["first_diagnosis", 1000000]] },
  { type: "ACCIDENT", insurer: "富邦產險", policyName: "個人傷害險", annualPremium: 3200, paymentTermYears: 1, coveragePeriod: "1 年", coverage: [["accident_death_disability", 5000000]] },
  { type: "SAVINGS_INVESTMENT", insurer: "台灣人壽", policyName: "利變型儲蓄險", annualPremium: 60000, paymentTermYears: 6, coveragePeriod: "終身", coverage: [["cash_value", 420000]] },
  { type: "LONGTERM_CARE", insurer: "全球人壽", policyName: "長期照顧險", annualPremium: 24000, paymentTermYears: 20, coveragePeriod: "終身", coverage: [["monthly_benefit", 30000]] },
  { type: "OTHER", insurer: "國泰世紀產險", policyName: "旅遊平安險", annualPremium: 1500, paymentTermYears: 1, coveragePeriod: "1 年", coverage: [["overseas_medical", 1000000]] },
];

function coverageItems(seed: InsuranceSeed): CoverageItem[] {
  return seed.coverage.map(([key, value]) => {
    // OTHER 沒有預設清單，保障名稱是自由文字。
    const label =
      seed.type === "OTHER"
        ? "海外醫療"
        : (INSURANCE_COVERAGE_OPTIONS[seed.type].find((o) => o.key === key)?.label ?? key);
    return { key, label, value };
  });
}

// [entryId, 幾個月前發放, 金額, 每股股利, 股數]
const DIVIDEND_SEEDS: [string, number, number, number, number][] = [
  [SEED_IDS.tw, 8, 900, 4.5, 200],
  [SEED_IDS.tw, 5, 900, 4.5, 200],
  [SEED_IDS.tw, 2, 1000, 5, 200],
  [SEED_IDS.us, 6, 480, 24, 20],
  [SEED_IDS.us, 3, 480, 24, 20],
];

export function buildSeed(now: Date): DemoState {
  let historySeq = 0;
  const history: EntryHistory[] = [];
  const pushHistory = (row: Omit<EntryHistory, "id">): EntryHistory => {
    const full = { id: `demo-seed-h-${++historySeq}`, ...row };
    history.push(full);
    return full;
  };

  const entries: Entry[] = ENTRY_SEEDS.map((seed) => {
    let createdAt: string;
    if (seed.units != null) {
      createdAt = monthsAgo(now, seed.boughtMonthsAgo ?? 6);
      pushHistory({
        entryId: seed.id,
        delta: seed.value,
        balance: seed.value,
        units: seed.units,
        pricePerShare: seed.pricePerShare ?? null,
        note: null,
        createdAt,
      });
    } else {
      // 12 個月前建立，之後每月往目前的值走一步；沒變動的月份不留紀錄。
      const start = seed.startValue ?? seed.value;
      createdAt = monthsAgo(now, 12);
      let balance = start;
      pushHistory({
        entryId: seed.id,
        delta: start,
        balance,
        units: null,
        pricePerShare: null,
        note: null,
        createdAt,
      });
      for (let step = 1; step <= 12; step++) {
        const next =
          step === 12 ? seed.value : Math.round(start + ((seed.value - start) * step) / 12);
        if (next === balance) continue;
        pushHistory({
          entryId: seed.id,
          delta: next - balance,
          balance: next,
          units: null,
          pricePerShare: null,
          note: null,
          createdAt: monthsAgo(now, 12 - step),
        });
        balance = next;
      }
    }
    return {
      id: seed.id,
      name: seed.name,
      topCategory: seed.topCategory,
      subCategory: seed.subCategory,
      stockCode: seed.stockCode ?? null,
      bankCode: seed.bankCode ?? null,
      note: null,
      value: seed.value,
      includeInChart: true,
      createdAt,
      updatedAt: createdAt,
      loan: null,
      insurance: null,
    };
  });

  const entryById = (id: string): Entry => entries.find((e) => e.id === id)!;

  // 貸款明細
  const loanStart = monthsAgo(now, 36);
  entryById(SEED_IDS.loan).loan = {
    id: "demo-seed-loan-detail",
    entryId: SEED_IDS.loan,
    loanName: "房屋貸款",
    totalAmount: 8000000,
    annualInterestRate: 2.1,
    termMonths: 360,
    startDate: loanStart,
    gracePeriodMonths: 0,
    repaymentType: "principal_interest",
    overrideTermMonths: null,
    createdAt: loanStart,
    updatedAt: loanStart,
  };

  // 保單：每個險種一張，各自帶一筆 value 0、不納入圖表的 Entry。
  const insurances: Insurance[] = INSURANCE_SEEDS.map((seed) => {
    const entryId = `demo-seed-ins-entry-${seed.type}`;
    const id = `demo-seed-ins-${seed.type}`;
    const createdAt = monthsAgo(now, 6);
    pushHistory({
      entryId,
      delta: 0,
      balance: 0,
      units: null,
      pricePerShare: null,
      note: null,
      createdAt,
    });
    entries.push({
      id: entryId,
      name: seed.policyName,
      topCategory: "保險",
      subCategory: seed.type,
      stockCode: null,
      bankCode: null,
      note: null,
      value: 0,
      includeInChart: false,
      createdAt,
      updatedAt: createdAt,
      loan: null,
      insurance: { id, insuranceType: seed.type, insurer: seed.insurer, insuredName: "示範用戶" },
    });
    return {
      id,
      entryId,
      insurer: seed.insurer,
      insuredName: "示範用戶",
      insuranceType: seed.type,
      policyName: seed.policyName,
      policyNumber: null,
      startDate: monthsAgo(now, 24),
      paymentTermYears: seed.paymentTermYears,
      coveragePeriod: seed.coveragePeriod,
      annualPremium: seed.annualPremium,
      coverage: coverageItems(seed),
      createdAt,
      updatedAt: createdAt,
    };
  });

  // 交易：近六個月的薪資與兩類支出。
  let txSeq = 0;
  const transactions: Transaction[] = [];
  const pushTx = (tx: Omit<Transaction, "id" | "createdAt">): Transaction => {
    const full = { id: `demo-seed-tx-${++txSeq}`, createdAt: tx.date, ...tx };
    transactions.push(full);
    return full;
  };
  for (let month = 5; month >= 0; month--) {
    const date = monthsAgo(now, month);
    pushTx({ type: "income", amount: 68000, category: "薪資", source: "daily", note: null, date });
    pushTx({ type: "expense", amount: 12000, category: "餐飲", source: "daily", note: null, date });
    pushTx({ type: "expense", amount: 2400, category: "交通", source: "daily", note: null, date });
  }

  // 股息：台積電三筆、Apple 兩筆，各帶一筆收入交易。第一筆台積電已再投資。
  const dividends: DemoDividend[] = DIVIDEND_SEEDS.map(
    ([entryId, month, amount, perShare, shares], index) => {
      const payDate = monthsAgo(now, month);
      const income = pushTx({
        type: "income",
        amount,
        category: "股利",
        // 後端把股票名稱寫進 source 欄位，這裡照抄它的行為。
        source: entryById(entryId).name as Transaction["source"],
        note: null,
        date: payDate,
      });
      return {
        id: `demo-seed-div-${index + 1}`,
        entryId,
        payDate,
        amount,
        perShare,
        shares,
        note: null,
        bankEntryId: null,
        reinvestedAt: null,
        reinvestAmount: null,
        reinvestPrice: null,
        reinvestUnits: null,
        createdAt: payDate,
        bankHistoryId: null,
        transactionId: income.id,
        reinvestHistoryId: null,
        reinvestBankHistoryId: null,
      };
    }
  );
  const reinvested = dividends[0]!;
  const tw = entryById(SEED_IDS.tw);
  const reinvestRow = pushHistory({
    entryId: tw.id,
    delta: 900,
    balance: tw.value + 900,
    units: 1,
    pricePerShare: null,
    note: "股利再投資",
    createdAt: reinvested.payDate,
  });
  tw.value += 900;
  tw.updatedAt = reinvested.payDate;
  reinvested.reinvestedAt = reinvested.payDate;
  reinvested.reinvestAmount = 900;
  reinvested.reinvestPrice = 900;
  reinvested.reinvestUnits = 1;
  reinvested.reinvestHistoryId = reinvestRow.id;

  // 定期交易：每月 5 號的手機月租，下一次一定落在未來，process 不會補產生交易。
  const nextRun = new Date(now.getFullYear(), now.getMonth(), 5);
  if (nextRun.getTime() <= now.getTime()) nextRun.setMonth(nextRun.getMonth() + 1);
  const recurrenceStart = monthsAgo(now, 6);
  const portfolioAt = monthsAgo(now, 11);

  return {
    entries,
    history,
    insurances,
    dividends,
    transactions,
    portfolio: [
      {
        id: "demo-seed-pf-1",
        symbol: "2330.TW",
        name: "台積電",
        avgCost: 850,
        shares: 200,
        createdAt: portfolioAt,
        updatedAt: portfolioAt,
      },
    ],
    recurrences: [
      {
        id: "demo-seed-rec-1",
        entryId: SEED_IDS.debit,
        type: "expense",
        amount: 799,
        category: "電信",
        source: "daily",
        note: "手機月租",
        frequency: "MONTHLY",
        dayOfMonth: 5,
        dayOfWeek: null,
        monthOfYear: null,
        startDate: recurrenceStart,
        nextRunAt: nextRun.toISOString(),
        lastRunAt: null,
        active: true,
        createdAt: recurrenceStart,
        updatedAt: recurrenceStart,
      },
    ],
  };
}
