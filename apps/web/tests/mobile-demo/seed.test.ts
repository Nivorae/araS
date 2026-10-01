import { describe, it, expect } from "vitest";
import { INSURANCE_TYPES } from "@repo/shared";
import { buildSeed, SEED_IDS } from "../../../mobile/lib/demo/seed";

const NOW = new Date("2026-09-30T04:00:00.000Z");

// 抄自 apps/mobile/lib/categoryConfig.ts 的最末層分類（那個檔案依賴圖示套件，
// 這裡載不進來）。categoryConfig 新增分類時，這份清單與種子資料要一起補。
const LEAF_CATEGORIES: [string, string][] = [
  ["流動資金", "現金"],
  ["流動資金", "Line Pay"],
  ["流動資金", "Apple Pay"],
  ["流動資金", "街口支付"],
  ["流動資金", "金融卡"],
  ["流動資金", "其他"],
  ["負債", "貸款"],
  ["負債", "信用卡"],
  ["負債", "其他負債"],
  ["投資", "投資基金"],
  ["投資", "台股"],
  ["投資", "美股"],
  ["投資", "加密貨幣"],
  ["投資", "貴金屬"],
  ["投資", "其他投資"],
  ["固定資產", "房屋"],
  ["固定資產", "車輛"],
  ["固定資產", "其他資產"],
  ["應收款", "一般應收款"],
];

describe("buildSeed", () => {
  const seed = buildSeed(NOW);

  it("has exactly one entry for every leaf category", () => {
    for (const [top, sub] of LEAF_CATEGORIES) {
      const matches = seed.entries.filter((e) => e.topCategory === top && e.subCategory === sub);
      expect(matches, `${top} / ${sub}`).toHaveLength(1);
    }
  });

  it("has exactly one policy for every insurance type, each with its own entry", () => {
    for (const type of INSURANCE_TYPES) {
      const policies = seed.insurances.filter((i) => i.insuranceType === type);
      expect(policies, type).toHaveLength(1);
      const entry = seed.entries.find((e) => e.id === policies[0]!.entryId);
      expect(entry?.topCategory).toBe("保險");
      expect(entry?.value).toBe(0);
      expect(entry?.includeInChart).toBe(false);
      expect(entry?.insurance?.id).toBe(policies[0]!.id);
    }
  });

  it("has no entries beyond the leaf categories and the policies", () => {
    expect(seed.entries).toHaveLength(LEAF_CATEGORIES.length + INSURANCE_TYPES.length);
  });

  it("keeps every entry's value equal to its latest history balance", () => {
    for (const entry of seed.entries) {
      const rows = seed.history
        .filter((h) => h.entryId === entry.id)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      expect(rows.length, entry.name).toBeGreaterThan(0);
      expect(rows[rows.length - 1]!.balance, entry.name).toBe(entry.value);
      // running balance 要自洽
      let running = 0;
      for (const row of rows) {
        running += row.delta;
        expect(row.balance, entry.name).toBe(running);
      }
    }
  });

  it("dates nothing in the future and reaches back twelve months", () => {
    const stamps = [
      ...seed.history.map((h) => h.createdAt),
      ...seed.transactions.map((t) => t.date),
      ...seed.dividends.map((d) => d.payDate),
    ];
    for (const stamp of stamps) expect(new Date(stamp).getTime()).toBeLessThan(NOW.getTime());
    const earliest = seed.history.map((h) => h.createdAt).sort()[0]!;
    expect(earliest.slice(0, 7)).toBe("2025-09");
  });

  it("gives the priced investments a code and units so live prices can apply", () => {
    for (const sub of ["台股", "美股", "加密貨幣", "貴金屬"]) {
      const entry = seed.entries.find((e) => e.subCategory === sub)!;
      expect(entry.stockCode, sub).toBeTruthy();
      const units = seed.history
        .filter((h) => h.entryId === entry.id)
        .reduce((sum, h) => sum + (h.units ?? 0), 0);
      expect(units, sub).toBeGreaterThan(0);
    }
  });

  it("attaches loan details to the loan entry", () => {
    const loan = seed.entries.find((e) => e.id === SEED_IDS.loan)!.loan;
    expect(loan?.entryId).toBe(SEED_IDS.loan);
    expect(loan?.termMonths).toBe(360);
  });

  it("includes dividends for both stock entries, one of them reinvested", () => {
    expect(seed.dividends.some((d) => d.entryId === SEED_IDS.tw)).toBe(true);
    expect(seed.dividends.some((d) => d.entryId === SEED_IDS.us)).toBe(true);
    const reinvested = seed.dividends.filter((d) => d.reinvestedAt !== null);
    expect(reinvested).toHaveLength(1);
    expect(seed.history.some((h) => h.id === reinvested[0]!.reinvestHistoryId)).toBe(true);
  });

  it("includes income and expense transactions and one recurrence due in the future", () => {
    expect(seed.transactions.some((t) => t.type === "income")).toBe(true);
    expect(seed.transactions.some((t) => t.type === "expense")).toBe(true);
    expect(seed.recurrences).toHaveLength(1);
    expect(new Date(seed.recurrences[0]!.nextRunAt).getTime()).toBeGreaterThan(NOW.getTime());
  });

  it("returns independent data on every call", () => {
    const other = buildSeed(NOW);
    other.entries[0]!.value = -1;
    expect(buildSeed(NOW).entries[0]!.value).not.toBe(-1);
  });
});
