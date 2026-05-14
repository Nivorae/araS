import { z } from "zod";

// EntryHistory
export const EntryHistorySchema = z.object({
  id: z.string(),
  entryId: z.string(),
  delta: z.number(),
  balance: z.number(),
  units: z.number().nullable().optional(),
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

// Entry (unified asset + liability)
export const EntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  topCategory: z.string(),
  subCategory: z.string(),
  stockCode: z.string().nullable().optional(),
  bankCode: z.string().nullable().optional(),
  units: z.number().nullable().optional(),
  value: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
  loan: LoanSchema.nullable().optional(),
});
export type Entry = z.infer<typeof EntrySchema>;

export const CreateEntrySchema = z.object({
  name: z.string().min(1, "名稱為必填"),
  topCategory: z.string().min(1, "大類為必填"),
  subCategory: z.string().min(1, "子類別為必填"),
  stockCode: z.string().optional(),
  bankCode: z.string().optional(),
  units: z.number().optional(),
  value: z.number().positive("金額必須大於 0"),
  createdAt: z.string().optional(),
});
export type CreateEntry = z.infer<typeof CreateEntrySchema>;

export const UpdateEntrySchema = CreateEntrySchema.partial();
export type UpdateEntry = z.infer<typeof UpdateEntrySchema>;

export const UpdateEntryHistorySchema = z.object({
  note: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  delta: z.number().optional(),
  units: z.number().nullable().optional(),
});
export type UpdateEntryHistory = z.infer<typeof UpdateEntryHistorySchema>;

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

// ValueSnapshot — auto-recorded on every asset/liability mutation
export const ValueSnapshotSchema = z.object({
  id: z.string(),
  date: z.string(), // ISO string, e.g. "2026-04-08T10:00:00.000Z"
  totalAssets: z.number(),
  totalLiabilities: z.number(),
});
export type ValueSnapshot = z.infer<typeof ValueSnapshotSchema>;
