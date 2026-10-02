import { describe, it, expect } from "vitest";
import {
  CreateEntrySchema,
  CreateLoanSchema,
  CreateTransactionSchema,
  CreatePortfolioItemSchema,
  CreateRecurrenceSchema,
  CreateInsuranceSchema,
  UpdateInsuranceSchema,
  MAX_NAME_LENGTH,
  MAX_LABEL_LENGTH,
  MAX_CODE_LENGTH,
  MAX_NOTE_LENGTH,
  MAX_DATE_LENGTH,
} from "../src";

const long = (n: number) => "x".repeat(n + 1);

// Every free-text field a signed-in user can write is bounded, so one account
// can't store arbitrarily large strings in the shared database.
describe("write schema length limits", () => {
  const entry = { name: "現金", topCategory: "流動資金", subCategory: "現金", value: 1 };

  it.each([
    ["name", MAX_NAME_LENGTH],
    ["topCategory", MAX_LABEL_LENGTH],
    ["subCategory", MAX_LABEL_LENGTH],
    ["stockCode", MAX_CODE_LENGTH],
    ["bankCode", MAX_CODE_LENGTH],
    ["createdAt", MAX_DATE_LENGTH],
  ])("rejects an over-long entry %s", (field, max) => {
    expect(CreateEntrySchema.safeParse({ ...entry, [field]: long(max) }).success).toBe(false);
  });

  it("accepts an entry at the limits", () => {
    expect(
      CreateEntrySchema.safeParse({ ...entry, name: "x".repeat(MAX_NAME_LENGTH) }).success
    ).toBe(true);
  });

  const loan = {
    loanName: "房貸",
    category: "房貸",
    totalAmount: 1,
    annualInterestRate: 1,
    termMonths: 12,
    startDate: "2026-01-01",
    gracePeriodMonths: 0,
    repaymentType: "principal_interest",
  };
  it.each([
    ["loanName", MAX_NAME_LENGTH],
    ["category", MAX_LABEL_LENGTH],
    ["startDate", MAX_DATE_LENGTH],
  ])("rejects an over-long loan %s", (field, max) => {
    expect(CreateLoanSchema.safeParse({ ...loan, [field]: long(max) }).success).toBe(false);
  });

  const tx = { type: "expense", amount: 1, category: "餐飲", source: "daily", date: "2026-01-01" };
  it.each([
    ["category", MAX_LABEL_LENGTH],
    ["note", MAX_NOTE_LENGTH],
    ["date", MAX_DATE_LENGTH],
  ])("rejects an over-long transaction %s", (field, max) => {
    expect(CreateTransactionSchema.safeParse({ ...tx, [field]: long(max) }).success).toBe(false);
  });

  it.each([
    ["symbol", MAX_CODE_LENGTH],
    ["name", MAX_NAME_LENGTH],
  ])("rejects an over-long portfolio %s", (field, max) => {
    const item = { symbol: "AAPL", name: "Apple", shares: 1, avgCost: 1 };
    expect(CreatePortfolioItemSchema.safeParse({ ...item, [field]: long(max) }).success).toBe(
      false
    );
  });

  it("rejects an over-long recurrence category", () => {
    const r = CreateRecurrenceSchema.safeParse({
      entryId: "e1",
      type: "expense",
      amount: 1,
      category: long(MAX_LABEL_LENGTH),
      frequency: "MONTHLY",
      startDate: "2026-01-01",
    });
    expect(r.success).toBe(false);
  });

  const ins = { insurer: "國泰", insuredName: "我", insuranceType: "OTHER" };
  it.each([
    ["insurer", MAX_NAME_LENGTH],
    ["insuredName", MAX_NAME_LENGTH],
    ["policyName", MAX_NAME_LENGTH],
    ["policyNumber", MAX_CODE_LENGTH],
    ["coveragePeriod", MAX_LABEL_LENGTH],
  ])("rejects an over-long insurance %s on create and update", (field, max) => {
    expect(CreateInsuranceSchema.safeParse({ ...ins, [field]: long(max) }).success).toBe(false);
    expect(UpdateInsuranceSchema.safeParse({ [field]: long(max) }).success).toBe(false);
  });

  it("rejects an over-long coverage label", () => {
    const r = CreateInsuranceSchema.safeParse({
      ...ins,
      coverage: [{ key: "k", label: long(MAX_LABEL_LENGTH), value: 1 }],
    });
    expect(r.success).toBe(false);
  });
});
