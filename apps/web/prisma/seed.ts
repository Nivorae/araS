import { PrismaClient } from "@prisma/client";
import { FREE_ENTRY_LIMIT } from "@repo/shared";
import { assertDevDatabase } from "./dev-db-guard";

const prisma = new PrismaClient();

// The designated test account for the dev database. Not a secret — Clerk user ids
// are public identifiers — and safe to default to because every write below is
// scoped to this one id. Override with SEED_USER_ID to seed a different account.
const TEST_USER_ID = "user_3FcaiZZRQbEpYWCPqpBUngRxf8Q";

const now = new Date();
/** A date `monthsBack` months before today, on the given day of month. */
function monthsAgo(monthsBack: number, day = 15): Date {
  return new Date(now.getFullYear(), now.getMonth() - monthsBack, day, 12, 0, 0);
}

type EntrySpec = {
  name: string;
  topCategory: string;
  subCategory: string;
  /** Oldest → newest. Running balances are derived, so they always line up. */
  deltas: number[];
  /** Share counts paired with `deltas`, for entries the UI treats as holdings. */
  units?: number[];
  stockCode?: string;
  bankCode?: string;
  note?: string;
  includeInChart?: boolean;
};

// Spread across every top-level category so each screen has something to render,
// and across several months so the entry-detail month grouping has real sections.
// Deliberately one more than FREE_ENTRY_LIMIT so the paywall gate is active the
// moment the seed finishes — asserted at the end of main().
const ENTRY_SPECS: EntrySpec[] = [
  { name: "皮夾現金", topCategory: "流動資金", subCategory: "現金", deltas: [8000, -1500, 3000] },
  { name: "Line Pay", topCategory: "流動資金", subCategory: "Line Pay", deltas: [2000, 1200] },
  { name: "街口支付", topCategory: "流動資金", subCategory: "街口支付", deltas: [1500, -400] },
  {
    name: "薪轉戶",
    topCategory: "流動資金",
    subCategory: "金融卡",
    bankCode: "822",
    deltas: [60000, 55000, -32000, 58000],
  },
  {
    name: "生活費帳戶",
    topCategory: "流動資金",
    subCategory: "金融卡",
    bankCode: "812",
    deltas: [25000, -8000],
  },
  { name: "零錢罐", topCategory: "流動資金", subCategory: "其他", deltas: [3200] },
  {
    name: "台積電",
    topCategory: "投資",
    subCategory: "台股",
    stockCode: "2330",
    deltas: [530000, 285000],
    units: [500, 250],
  },
  {
    name: "元大高股息",
    topCategory: "投資",
    subCategory: "台股",
    stockCode: "0056",
    deltas: [122000, 61500, 63000],
    units: [3000, 1500, 1500],
  },
  {
    name: "Apple",
    topCategory: "投資",
    subCategory: "美股",
    stockCode: "AAPL",
    deltas: [148000, 76000],
    units: [20, 10],
  },
  {
    name: "Bitcoin",
    topCategory: "投資",
    subCategory: "加密貨幣",
    stockCode: "BTC-USD",
    deltas: [95000, -30000],
    units: [0.05, -0.015],
  },
  { name: "黃金存摺", topCategory: "投資", subCategory: "貴金屬", deltas: [88000, 22000] },
  {
    name: "退休目標基金",
    topCategory: "投資",
    subCategory: "投資基金",
    deltas: [40000, 10000, 10000],
  },
  { name: "員工持股信託", topCategory: "投資", subCategory: "其他投資", deltas: [65000] },
  {
    name: "自住公寓",
    topCategory: "固定資產",
    subCategory: "房屋",
    deltas: [12000000],
    note: "估值,非成交價",
  },
  { name: "機車", topCategory: "固定資產", subCategory: "車輛", deltas: [68000, -8000] },
  { name: "攝影器材", topCategory: "固定資產", subCategory: "其他資產", deltas: [95000, -12000] },
  {
    name: "房屋貸款",
    topCategory: "負債",
    subCategory: "貸款",
    deltas: [8400000, -180000, -180000],
  },
  {
    name: "信用卡未繳",
    topCategory: "負債",
    subCategory: "信用卡",
    deltas: [42000, -42000, 31000],
  },
  { name: "助學貸款", topCategory: "負債", subCategory: "其他負債", deltas: [180000, -20000] },
  { name: "代墊同事聚餐", topCategory: "應收款", subCategory: "一般應收款", deltas: [4200] },
  // Insurance entries are display-only: value 0, excluded from the chart, so the
  // linked policy never distorts net worth.
  {
    name: "國泰人壽 終身壽險",
    topCategory: "保險",
    subCategory: "新增",
    deltas: [],
    includeInChart: false,
  },
];

async function seedEntries(userId: string): Promise<void> {
  for (const [index, spec] of ENTRY_SPECS.entries()) {
    // One record per month working forward, so the newest sits at the top of the
    // detail screen the way the app orders it.
    const span = Math.max(spec.deltas.length, 1);
    let balance = 0;
    const rows = spec.deltas.map((delta, i) => {
      balance += delta;
      return {
        delta,
        balance,
        units: spec.units?.[i] ?? null,
        createdAt: monthsAgo(span - 1 - i, ((index * 3) % 26) + 2),
        note: i === 0 ? "初始建立" : null,
      };
    });

    await prisma.entry.create({
      data: {
        userId,
        name: spec.name,
        topCategory: spec.topCategory,
        subCategory: spec.subCategory,
        stockCode: spec.stockCode ?? null,
        bankCode: spec.bankCode ?? null,
        note: spec.note ?? null,
        // The service keeps an entry's value equal to its newest running balance;
        // mirror that so seeded rows aren't in a state the app can't produce.
        value: balance,
        includeInChart: spec.includeInChart ?? true,
        createdAt: monthsAgo(span, 1),
        history: { create: rows },
      },
    });
  }
}

async function seedLoan(userId: string): Promise<void> {
  const entry = await prisma.entry.findFirst({ where: { userId, subCategory: "貸款" } });
  if (!entry) return;
  await prisma.loan.create({
    data: {
      entryId: entry.id,
      loanName: "房屋貸款",
      totalAmount: 8400000,
      annualInterestRate: 2.06,
      termMonths: 360,
      startDate: monthsAgo(14, 1),
      gracePeriodMonths: 0,
      repaymentType: "principal_interest",
    },
  });
}

async function seedInsurance(userId: string): Promise<void> {
  const entry = await prisma.entry.findFirst({ where: { userId, topCategory: "保險" } });
  if (!entry) return;
  await prisma.insurance.create({
    data: {
      entryId: entry.id,
      insurer: "國泰人壽",
      insuredName: "測試帳號",
      insuranceType: "LIFE",
      policyName: "終身壽險",
      policyNumber: "TEST-0001",
      startDate: monthsAgo(30, 1),
      paymentTermYears: 20,
      coveragePeriod: "終身",
      annualPremium: 36000,
      coverage: [
        { key: "death", label: "身故保險金", value: "1,000,000" },
        { key: "disability", label: "完全失能", value: "1,000,000" },
      ],
    },
  });
}

async function seedTransactions(userId: string): Promise<void> {
  await prisma.transaction.createMany({
    data: [
      {
        userId,
        type: "income",
        amount: 58000,
        category: "薪資",
        source: "daily",
        date: monthsAgo(0, 5),
      },
      {
        userId,
        type: "expense",
        amount: 18000,
        category: "房租",
        source: "daily",
        date: monthsAgo(0, 6),
      },
      {
        userId,
        type: "expense",
        amount: 6400,
        category: "飲食",
        source: "daily",
        date: monthsAgo(0, 12),
      },
      {
        userId,
        type: "expense",
        amount: 1200,
        category: "交通",
        source: "daily",
        date: monthsAgo(1, 9),
      },
      {
        userId,
        type: "income",
        amount: 58000,
        category: "薪資",
        source: "daily",
        date: monthsAgo(1, 5),
      },
      {
        userId,
        type: "expense",
        amount: 2800,
        category: "娛樂",
        source: "daily",
        date: monthsAgo(2, 20),
      },
    ],
  });
}

async function seedPortfolio(userId: string): Promise<void> {
  await prisma.portfolioItem.createMany({
    data: [
      { userId, symbol: "2330", name: "台積電", avgCost: 1086, shares: 750 },
      { userId, symbol: "AAPL", name: "Apple", avgCost: 7450, shares: 30 },
    ],
  });
}

async function seedRecurrence(userId: string): Promise<void> {
  const entry = await prisma.entry.findFirst({ where: { userId, subCategory: "金融卡" } });
  if (!entry) return;
  await prisma.recurrence.create({
    data: {
      userId,
      entryId: entry.id,
      type: "expense",
      amount: 18000,
      category: "房租",
      source: "daily",
      note: "每月房租",
      frequency: "MONTHLY",
      dayOfMonth: 5,
      startDate: monthsAgo(6, 5),
      // Next month, so `/api/recurrences/process` has nothing to generate on the
      // first launch — seeded totals stay exactly as printed below.
      nextRunAt: new Date(now.getFullYear(), now.getMonth() + 1, 5, 12, 0, 0),
      active: true,
    },
  });
}

/** Removes only this user's rows. Entry children cascade. */
async function wipeUser(userId: string): Promise<void> {
  await prisma.recurrence.deleteMany({ where: { userId } });
  await prisma.transaction.deleteMany({ where: { userId } });
  await prisma.portfolioItem.deleteMany({ where: { userId } });
  await prisma.entry.deleteMany({ where: { userId } });
}

async function main(): Promise<void> {
  const userId = process.env.SEED_USER_ID ?? process.argv[2] ?? TEST_USER_ID;
  if (!userId.startsWith("user_")) {
    throw new Error(`"${userId}" is not a Clerk user id — those start with "user_".`);
  }

  await assertDevDatabase(prisma);
  await wipeUser(userId);

  await seedEntries(userId);
  await seedLoan(userId);
  await seedInsurance(userId);
  await seedTransactions(userId);
  await seedPortfolio(userId);
  await seedRecurrence(userId);

  const entries = await prisma.entry.count({ where: { userId } });
  const history = await prisma.entryHistory.count({ where: { entry: { userId } } });
  console.log(
    `Seeded ${entries} entries and ${history} history records for ${userId}, ` +
      "plus 1 loan, 1 policy, 6 transactions, 2 portfolio items, 1 recurrence."
  );
  if (entries > FREE_ENTRY_LIMIT) {
    console.log(`Over the free limit of ${FREE_ENTRY_LIMIT} — the paywall gate is active.`);
  } else {
    console.warn(
      `Only ${entries} entries, at or under the free limit of ${FREE_ENTRY_LIMIT}: the paywall ` +
        "gate will NOT trigger. Add more to ENTRY_SPECS."
    );
  }
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
