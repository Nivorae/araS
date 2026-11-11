import { describe, it, expect } from "vitest";
import {
  DEFAULTS,
  monthlyIncomeTotal,
  niceMax,
  salaryRules,
  sanitizeAmountInput,
  sanitizeParams,
  withThousands,
} from "../../lib/retirement";

describe("retirement lib (web port of apps/mobile/lib/retirement.ts)", () => {
  it("monthlyIncomeTotal treats non-finite and negative inputs as 0", () => {
    expect(monthlyIncomeTotal(50000, 10000)).toBe(60000);
    expect(monthlyIncomeTotal(NaN, 10000)).toBe(10000);
    expect(monthlyIncomeTotal(-5, Infinity)).toBe(0);
  });

  it("salaryRules returns the five mobile rules with the same values", () => {
    const rules = salaryRules(50000, 10000);
    expect(rules.map((r) => r.key)).toEqual(["save", "spend", "emergency", "principal", "noWork"]);
    const v = Object.fromEntries(rules.map((r) => [r.key, r.value]));
    expect(v).toEqual({
      save: 18000,
      spend: 36000,
      emergency: 180000,
      principal: 12000000,
      noWork: 3600000,
    });
    expect(rules[0]!.detail.result).toEqual({ label: "每月投資或儲蓄", value: "NT$ 18,000" });
  });

  it("sanitizeParams keeps valid numbers and fills the rest from defaults", () => {
    expect(sanitizeParams({ currentAge: 40, swr: "x", accRate: NaN })).toEqual({
      ...DEFAULTS,
      currentAge: 40,
    });
    expect(sanitizeParams(null)).toEqual(DEFAULTS);
  });

  it("niceMax rounds up to 1/2/2.5/5/10 × 10ⁿ", () => {
    expect(niceMax(0)).toBe(1);
    expect(niceMax(1_200_000)).toBe(2_000_000);
    expect(niceMax(2_300_000)).toBe(2_500_000);
    expect(niceMax(7_000_000)).toBe(10_000_000);
    expect(niceMax(5_000_000)).toBe(5_000_000);
  });

  it("amount input helpers strip junk and format thousands", () => {
    expect(sanitizeAmountInput("NT$ 1,234.5.6")).toBe("1234.56");
    expect(withThousands("1234567")).toBe("1,234,567");
    expect(withThousands("1234.")).toBe("1,234.");
    expect(withThousands("")).toBe("");
  });
});
