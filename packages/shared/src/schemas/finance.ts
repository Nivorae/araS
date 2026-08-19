import { z } from "zod";
import {
  INSURANCE_TYPES,
  INSURANCE_COVERAGE_OPTIONS,
  MAX_COVERAGE_ITEMS,
  type InsuranceType,
} from "../constants/insurance";

// EntryHistory
export const EntryHistorySchema = z.object({
  id: z.string(),
  entryId: z.string(),
  delta: z.number(),
  balance: z.number(),
  units: z.number().nullable().optional(),
  // Per-share price paid at the time of this record — stored as entered
  // (or manually overridden), not derived from delta/units at read time.
  // Null for non-investment entries and for pre-migration rows with no units.
  pricePerShare: z.number().nullable().optional(),
  note: z.string().nullable(),
  createdAt: z.string(),
});
export type EntryHistory = z.infer<typeof EntryHistorySchema>;

// Loan
export const RepaymentTypeSchema = z.enum(["principal_interest", "principal_equal"]);
export type RepaymentType = z.infer<typeof RepaymentTypeSchema>;

export const LoanSchema = z.object({
  id: z.string(),
  entryId: z.string(),
  loanName: z.string(),
  totalAmount: z.number(),
  annualInterestRate: z.number(),
  termMonths: z.number(),
  startDate: z.string(),
  gracePeriodMonths: z.number(),
  repaymentType: RepaymentTypeSchema,
  overrideTermMonths: z.number().int().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Loan = z.infer<typeof LoanSchema>;

export const CreateLoanSchema = z.object({
  loanName: z.string().min(1, "貸款名稱為必填"),
  category: z.string().min(1, "類別為必填"),
  totalAmount: z.number().positive("金額必須大於 0"),
  annualInterestRate: z.number().min(0).max(100),
  termMonths: z.number().int().positive("期數必須大於 0"),
  startDate: z.string(),
  gracePeriodMonths: z.number().int().min(0).default(0),
  repaymentType: RepaymentTypeSchema,
});
export type CreateLoan = z.infer<typeof CreateLoanSchema>;

export const UpdateLoanRateSchema = z.object({
  annualInterestRate: z.number().min(0).max(100),
});
export type UpdateLoanRate = z.infer<typeof UpdateLoanRateSchema>;

export const UpdateLoanSchema = z.object({
  loanName: z.string().min(1).optional(),
  totalAmount: z.number().positive().optional(),
  annualInterestRate: z.number().min(0).max(100).optional(),
  termMonths: z.number().int().positive().optional(),
  startDate: z.string().optional(),
  gracePeriodMonths: z.number().int().min(0).optional(),
  repaymentType: RepaymentTypeSchema.optional(),
});
export type UpdateLoan = z.infer<typeof UpdateLoanSchema>;

// Insurance summary — subset returned inline on Entry (EntriesService.list()'s
// `select`), NOT the full Insurance record used on the detail page.
export const InsuranceTypeSchema = z.enum(
  INSURANCE_TYPES as unknown as [InsuranceType, ...InsuranceType[]]
);

export const InsuranceSummarySchema = z.object({
  id: z.string(),
  insuranceType: InsuranceTypeSchema,
  insurer: z.string(),
  insuredName: z.string(),
});
export type InsuranceSummary = z.infer<typeof InsuranceSummarySchema>;

// Entry (unified asset + liability)
export const EntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  topCategory: z.string(),
  subCategory: z.string(),
  stockCode: z.string().nullable().optional(),
  bankCode: z.string().nullable().optional(),
  units: z.number().nullable().optional(),
  note: z.string().nullable().optional(),
  value: z.number(),
  includeInChart: z.boolean().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  loan: LoanSchema.nullable().optional(),
  insurance: InsuranceSummarySchema.nullable().optional(),
});
export type Entry = z.infer<typeof EntrySchema>;

export const CreateEntrySchema = z.object({
  name: z.string().min(1, "名稱為必填"),
  topCategory: z.string().min(1, "大類為必填"),
  subCategory: z.string().min(1, "子類別為必填"),
  stockCode: z.string().optional(),
  bankCode: z.string().optional(),
  units: z.number().optional(),
  // Per-share price for this purchase — stored on the resulting EntryHistory
  // row alongside `units`/`value`, not derived from them.
  pricePerShare: z.number().positive().optional(),
  note: z.string().max(200).optional(),
  value: z.number().positive("金額必須大於 0"),
  includeInChart: z.boolean().optional(),
  createdAt: z.string().optional(),
});
export type CreateEntry = z.infer<typeof CreateEntrySchema>;

export const UpdateEntrySchema = CreateEntrySchema.partial();
export type UpdateEntry = z.infer<typeof UpdateEntrySchema>;

// Transfer — moves a balance between two entries (流動資金/負債/應收款 only),
// writing one EntryHistory row on each side. `fee`, when set, is deducted
// from the source on top of `amount` — the target always receives `amount`.
export const TransferEntrySchema = z
  .object({
    fromEntryId: z.string().min(1),
    toEntryId: z.string().min(1),
    amount: z.number().positive("金額必須大於 0"),
    fee: z.number().nonnegative("手續費不能為負數").optional(),
    note: z.string().max(200).optional(),
    createdAt: z.string().optional(),
  })
  .refine((data) => data.fromEntryId !== data.toEntryId, {
    message: "來源與目標項目不能相同",
    path: ["toEntryId"],
  });
export type TransferEntry = z.infer<typeof TransferEntrySchema>;

// Not a Zod schema — nothing parses a response through it (the route returns
// the service's result as-is), so it's a plain type used only for the
// client's `api.post<TransferResult>` annotation.
export type TransferResult = { from: Entry; to: Entry };

export const UpdateEntryHistorySchema = z.object({
  note: z.string().max(200).nullable().optional(),
  createdAt: z.string().optional(),
  delta: z.number().optional(),
  units: z.number().nullable().optional(),
  pricePerShare: z.number().nullable().optional(),
});
export type UpdateEntryHistory = z.infer<typeof UpdateEntryHistorySchema>;

// Asset allocation analysis — GET /api/entries/allocation response (Premium).
export const AssetAllocationSchema = z.object({
  breakdown: z.array(
    z.object({ topCategory: z.string(), value: z.number(), percentage: z.number() })
  ),
  concentrationWarnings: z.array(
    z.object({ entryId: z.string(), name: z.string(), percentage: z.number() })
  ),
  debtToAssetRatio: z.number().nullable(),
});
export type AssetAllocation = z.infer<typeof AssetAllocationSchema>;

// Transaction
export const TransactionTypeSchema = z.enum(["income", "expense"]);
export type TransactionType = z.infer<typeof TransactionTypeSchema>;

export const TransactionSourceSchema = z.enum(["daily", "emergency", "excluded"]);
export type TransactionSource = z.infer<typeof TransactionSourceSchema>;

export const TransactionSchema = z.object({
  id: z.string(),
  type: TransactionTypeSchema,
  amount: z.number(),
  category: z.string(),
  source: TransactionSourceSchema,
  note: z.string().nullable(),
  date: z.string(),
  createdAt: z.string(),
});
export type Transaction = z.infer<typeof TransactionSchema>;

export const CreateTransactionSchema = z.object({
  type: TransactionTypeSchema,
  amount: z.number().positive("金額必須大於 0"),
  category: z.string().min(1, "類別為必填"),
  source: TransactionSourceSchema,
  note: z.string().optional(),
  date: z.string(),
});
export type CreateTransaction = z.infer<typeof CreateTransactionSchema>;

// Portfolio
export const PortfolioItemSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  name: z.string(),
  avgCost: z.number(),
  shares: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type PortfolioItem = z.infer<typeof PortfolioItemSchema>;

export const CreatePortfolioItemSchema = z.object({
  symbol: z.string().min(1, "代號為必填"),
  name: z.string().min(1, "名稱為必填"),
  avgCost: z.number().positive("成本必須大於 0"),
  shares: z.number().positive("股數必須大於 0"),
});
export type CreatePortfolioItem = z.infer<typeof CreatePortfolioItemSchema>;

export const UpdatePortfolioItemSchema = CreatePortfolioItemSchema.partial();
export type UpdatePortfolioItem = z.infer<typeof UpdatePortfolioItemSchema>;

// Quote
export const QuoteSchema = z.object({
  symbol: z.string(),
  price: z.number(),
  currency: z.string(),
});
export type Quote = z.infer<typeof QuoteSchema>;

// Recurrence
export const RecurrenceFreqSchema = z.enum(["MONTHLY", "WEEKLY", "BIWEEKLY", "YEARLY"]);
export type RecurrenceFreq = z.infer<typeof RecurrenceFreqSchema>;

export const RecurrenceSchema = z.object({
  id: z.string(),
  entryId: z.string(),
  type: TransactionTypeSchema,
  amount: z.number(),
  category: z.string(),
  source: TransactionSourceSchema,
  note: z.string().nullable(),
  frequency: RecurrenceFreqSchema,
  dayOfMonth: z.number().nullable().optional(),
  dayOfWeek: z.number().nullable().optional(),
  monthOfYear: z.number().nullable().optional(),
  startDate: z.string(),
  nextRunAt: z.string(),
  lastRunAt: z.string().nullable().optional(),
  active: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Recurrence = z.infer<typeof RecurrenceSchema>;

export const CreateRecurrenceSchema = z.object({
  entryId: z.string().min(1),
  type: TransactionTypeSchema,
  amount: z.number().positive("金額必須大於 0"),
  category: z.string().min(1, "類別為必填"),
  source: TransactionSourceSchema.default("daily"),
  note: z.string().max(200).optional(),
  frequency: RecurrenceFreqSchema,
  dayOfMonth: z.number().int().min(1).max(31).optional(),
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  monthOfYear: z.number().int().min(1).max(12).optional(),
  startDate: z.string(),
});
export type CreateRecurrence = z.infer<typeof CreateRecurrenceSchema>;

export const UpdateRecurrenceSchema = CreateRecurrenceSchema.omit({ entryId: true }).partial();
export type UpdateRecurrence = z.infer<typeof UpdateRecurrenceSchema>;

// ValueSnapshot — auto-recorded on every asset/liability mutation
export const ValueSnapshotSchema = z.object({
  id: z.string(),
  date: z.string(), // ISO string, e.g. "2026-04-08T10:00:00.000Z"
  totalAssets: z.number(),
  totalLiabilities: z.number(),
});
export type ValueSnapshot = z.infer<typeof ValueSnapshotSchema>;

// Net worth history — reconstructed server-side from EntryHistory balances.
// Unlike ValueSnapshot (a client-side in-memory approximation), these points
// carry real history and are the only source the growth chart reads.
export const NetWorthRangeSchema = z.enum(["6m", "1y", "all"]);
export type NetWorthRange = z.infer<typeof NetWorthRangeSchema>;

export const NetWorthPointSchema = z.object({
  period: z.string(), // display label, e.g. "Apr" or "2026"
  date: z.string(), // ISO string for the end of the bucket
  totalAssets: z.number(),
  totalLiabilities: z.number(),
  netWorth: z.number(),
});
export type NetWorthPoint = z.infer<typeof NetWorthPointSchema>;

export const NetWorthHistorySchema = z.object({
  range: NetWorthRangeSchema,
  points: z.array(NetWorthPointSchema),
});
export type NetWorthHistory = z.infer<typeof NetWorthHistorySchema>;

// Insurance
export const CoverageItemSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  value: z.number(),
});
export type CoverageItem = z.infer<typeof CoverageItemSchema>;

const coverageArray = z
  .array(CoverageItemSchema)
  .max(MAX_COVERAGE_ITEMS, `最多 ${MAX_COVERAGE_ITEMS} 項保障`)
  .optional();

// Cross-field rule: for the six structured types, every coverage key must be a
// known option for that type. OTHER is free-form (any key allowed).
function validCoverageKeys(type: InsuranceType, coverage: CoverageItem[] | undefined): boolean {
  if (!coverage || coverage.length === 0 || type === "OTHER") return true;
  const allowed = new Set(INSURANCE_COVERAGE_OPTIONS[type].map((o) => o.key));
  return coverage.every((c) => allowed.has(c.key));
}

export const CreateInsuranceSchema = z
  .object({
    insurer: z.string().min(1, "保險公司為必填"),
    insuredName: z.string().min(1, "被保人為必填"),
    insuranceType: InsuranceTypeSchema,
    policyName: z.string().optional(),
    policyNumber: z.string().optional(),
    startDate: z.string().optional(),
    paymentTermYears: z.number().int().positive().optional(),
    coveragePeriod: z.string().optional(),
    annualPremium: z.number().nonnegative().optional(),
    coverage: coverageArray,
  })
  .superRefine((data, ctx) => {
    if (!validCoverageKeys(data.insuranceType, data.coverage)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["coverage"],
        message: "保障細項不屬於此險種",
      });
    }
  });
export type CreateInsurance = z.infer<typeof CreateInsuranceSchema>;

export const UpdateInsuranceSchema = z.object({
  insurer: z.string().min(1).optional(),
  insuredName: z.string().min(1).optional(),
  insuranceType: InsuranceTypeSchema.optional(),
  policyName: z.string().nullable().optional(),
  policyNumber: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  paymentTermYears: z.number().int().positive().nullable().optional(),
  coveragePeriod: z.string().nullable().optional(),
  annualPremium: z.number().nonnegative().nullable().optional(),
  coverage: coverageArray,
});
export type UpdateInsurance = z.infer<typeof UpdateInsuranceSchema>;

export const InsuranceSchema = z.object({
  id: z.string(),
  entryId: z.string(),
  insurer: z.string(),
  insuredName: z.string(),
  insuranceType: InsuranceTypeSchema,
  policyName: z.string().nullable(),
  policyNumber: z.string().nullable(),
  startDate: z.string().nullable(),
  paymentTermYears: z.number().nullable(),
  coveragePeriod: z.string().nullable(),
  annualPremium: z.number().nullable(),
  coverage: z.array(CoverageItemSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Insurance = z.infer<typeof InsuranceSchema>;

// Dividend — 股票股息紀錄（Premium）。amount 一律 TWD，見設計文件「幣別處理」。
export const CreateDividendSchema = z.object({
  entryId: z.string().min(1),
  payDate: z.string().min(1),
  amount: z.number().positive(),
  perShare: z.number().positive().optional(),
  shares: z.number().positive().optional(),
  note: z.string().max(200).optional(),
  // 未指定即不記錄現金流：不會對任何流動資金 Entry 產生 history。
  bankEntryId: z.string().min(1).optional(),
  // 預設同步一筆收入 Transaction，使用者可在表單上關掉。
  recordIncome: z.boolean().default(true),
});
export type CreateDividend = z.infer<typeof CreateDividendSchema>;

export const UpdateDividendSchema = z.object({
  payDate: z.string().min(1).optional(),
  amount: z.number().positive().optional(),
  note: z.string().max(200).nullable().optional(),
  // null 表示「清掉入帳帳戶」，undefined 表示「不動」。
  bankEntryId: z.string().min(1).nullable().optional(),
});
export type UpdateDividend = z.infer<typeof UpdateDividendSchema>;

export const ReinvestDividendSchema = z.object({
  amount: z.number().positive(),
  price: z.number().positive(),
});
export type ReinvestDividend = z.infer<typeof ReinvestDividendSchema>;

export const DividendSchema = z.object({
  id: z.string(),
  entryId: z.string(),
  payDate: z.string(),
  amount: z.number(),
  perShare: z.number().nullable(),
  shares: z.number().nullable(),
  note: z.string().nullable(),
  bankEntryId: z.string().nullable(),
  reinvestedAt: z.string().nullable(),
  reinvestAmount: z.number().nullable(),
  reinvestPrice: z.number().nullable(),
  reinvestUnits: z.number().nullable(),
  createdAt: z.string(),
});
export type Dividend = z.infer<typeof DividendSchema>;

export const DividendSummarySchema = z.object({
  totalAllTime: z.number(),
  totalThisYear: z.number(),
  byEntry: z.array(
    z.object({
      entryId: z.string(),
      name: z.string(),
      stockCode: z.string().nullable(),
      subCategory: z.string(),
      totalAllTime: z.number(),
      totalThisYear: z.number(),
      costBasis: z.number(),
      yieldOnCost: z.number().nullable(),
    })
  ),
});
export type DividendSummary = z.infer<typeof DividendSummarySchema>;
