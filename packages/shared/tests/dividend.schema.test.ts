import { describe, it, expect } from "vitest";
import {
  CreateDividendSchema,
  UpdateDividendSchema,
  ReinvestDividendSchema,
} from "../src/schemas/finance";

describe("CreateDividendSchema", () => {
  it("accepts a minimal dividend", () => {
    const parsed = CreateDividendSchema.parse({
      entryId: "entry-1",
      payDate: "2026-08-13",
      amount: 1200,
    });
    expect(parsed.amount).toBe(1200);
    expect(parsed.recordIncome).toBe(true);
  });

  it("rejects a non-positive amount", () => {
    expect(() =>
      CreateDividendSchema.parse({ entryId: "e", payDate: "2026-08-13", amount: 0 })
    ).toThrow();
  });

  it("rejects a missing entryId", () => {
    expect(() => CreateDividendSchema.parse({ payDate: "2026-08-13", amount: 10 })).toThrow();
  });

  it("allows clearing the bank account with null", () => {
    expect(UpdateDividendSchema.parse({ bankEntryId: null }).bankEntryId).toBeNull();
  });

  it("requires a positive price on reinvest", () => {
    expect(() => ReinvestDividendSchema.parse({ amount: 100, price: 0 })).toThrow();
    expect(ReinvestDividendSchema.parse({ amount: 100, price: 25.5 }).price).toBe(25.5);
  });
});
