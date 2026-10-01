import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { DemoEngine } from "../../../mobile/lib/demo/engine";
import { DemoError } from "../../../mobile/lib/demo/types";
import { SEED_IDS } from "../../../mobile/lib/demo/seed";

const NOW = new Date("2026-09-30T04:00:00.000Z");

function expectDemoError(fn: () => unknown, status: number) {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(DemoError);
    expect((e as DemoError).status).toBe(status);
    return;
  }
  throw new Error("expected a DemoError");
}

describe("DemoEngine entries", () => {
  let engine: DemoEngine;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    engine = new DemoEngine(NOW);
  });
  afterEach(() => vi.useRealTimers());

  it("lists seed entries newest first with units summed from history", () => {
    const entries = engine.listEntries();
    expect(entries).toHaveLength(26);
    const stamps = entries.map((e) => e.createdAt);
    expect([...stamps].sort().reverse()).toEqual(stamps);
    expect(entries.find((e) => e.id === SEED_IDS.tw)!.units).toBe(201);
    expect(entries.find((e) => e.id === SEED_IDS.cash)!.units).toBeNull();
  });

  it("creates an entry with an opening history row and no entry limit", () => {
    for (let i = 0; i < 30; i++) {
      engine.createEntry({
        name: `現金 ${i}`,
        topCategory: "流動資金",
        subCategory: "現金",
        value: 100,
      });
    }
    expect(engine.listEntries()).toHaveLength(56);

    const created = engine.createEntry({
      name: "聯發科",
      topCategory: "投資",
      subCategory: "台股",
      stockCode: "2454",
      value: 120000,
      units: 100,
      pricePerShare: 1200,
      createdAt: "2026-09-01",
    });
    expect(created.units).toBe(100);
    expect(created.createdAt).toBe("2026-09-01T00:00:00.000Z");
    expect(engine.entryHistory(created.id)).toMatchObject([
      { delta: 120000, balance: 120000, units: 100, pricePerShare: 1200 },
    ]);
  });

  it("writes a history row only when an update changes the value", () => {
    const before = engine.entryHistory(SEED_IDS.cash).length;
    engine.updateEntry(SEED_IDS.cash, { name: "皮夾" });
    expect(engine.entryHistory(SEED_IDS.cash)).toHaveLength(before);

    const updated = engine.updateEntry(SEED_IDS.cash, { value: 40000, note: "領錢" });
    expect(updated.value).toBe(40000);
    expect(updated.name).toBe("皮夾");
    const rows = engine.entryHistory(SEED_IDS.cash);
    expect(rows).toHaveLength(before + 1);
    expect(rows[0]).toMatchObject({ delta: 5000, balance: 40000, note: "領錢" });
  });

  it("keeps includeInChart changes off the history", () => {
    const before = engine.entryHistory(SEED_IDS.card).length;
    expect(engine.updateEntry(SEED_IDS.card, { includeInChart: false }).includeInChart).toBe(false);
    expect(engine.entryHistory(SEED_IDS.card)).toHaveLength(before);
  });

  it("404s on a missing entry", () => {
    expectDemoError(() => engine.updateEntry("nope", { name: "x" }), 404);
    expectDemoError(() => engine.deleteEntry("nope"), 404);
    expectDemoError(() => engine.entryHistory("nope"), 404);
  });

  it("shifts every later balance when a middle history row is edited", () => {
    const rows = [...engine.entryHistory(SEED_IDS.cash)].reverse(); // oldest first
    const target = rows[3]!;
    const laterBefore = rows.slice(4).map((r) => r.balance);

    engine.updateHistory(SEED_IDS.cash, target.id, { delta: target.delta + 1000 });

    const after = [...engine.entryHistory(SEED_IDS.cash)].reverse();
    expect(after[3]!.balance).toBe(target.balance + 1000);
    expect(after.slice(4).map((r) => r.balance)).toEqual(laterBefore.map((b) => b + 1000));
    expect(after.slice(0, 3).map((r) => r.balance)).toEqual(rows.slice(0, 3).map((r) => r.balance));
    expect(engine.listEntries().find((e) => e.id === SEED_IDS.cash)!.value).toBe(36000);
  });

  it("edits a history row's note and date without touching balances", () => {
    const newest = engine.entryHistory(SEED_IDS.cash)[0]!;
    const edited = engine.updateHistory(SEED_IDS.cash, newest.id, {
      note: "備註",
      createdAt: "2026-09-20",
    });
    expect(edited).toMatchObject({
      note: "備註",
      createdAt: "2026-09-20T00:00:00.000Z",
      balance: newest.balance,
    });
    expect(engine.listEntries().find((e) => e.id === SEED_IDS.cash)!.value).toBe(35000);
  });

  it("removes a middle history row and re-derives the entry value", () => {
    const rows = [...engine.entryHistory(SEED_IDS.cash)].reverse();
    const target = rows[3]!;
    engine.deleteHistory(SEED_IDS.cash, target.id);

    const after = [...engine.entryHistory(SEED_IDS.cash)].reverse();
    expect(after).toHaveLength(rows.length - 1);
    expect(after.some((r) => r.id === target.id)).toBe(false);
    expect(engine.listEntries().find((e) => e.id === SEED_IDS.cash)!.value).toBe(
      35000 - target.delta
    );
  });

  it("zeroes the entry when its only history row is deleted", () => {
    const entry = engine.createEntry({
      name: "暫存",
      topCategory: "流動資金",
      subCategory: "現金",
      value: 500,
    });
    engine.deleteHistory(entry.id, engine.entryHistory(entry.id)[0]!.id);
    expect(engine.listEntries().find((e) => e.id === entry.id)!.value).toBe(0);
  });

  it("404s when a history row does not belong to the entry", () => {
    const foreign = engine.entryHistory(SEED_IDS.debit)[0]!;
    expectDemoError(() => engine.updateHistory(SEED_IDS.cash, foreign.id, { note: "x" }), 404);
    expectDemoError(() => engine.deleteHistory(SEED_IDS.cash, foreign.id), 404);
  });

  it("deletes an entry together with its history", () => {
    engine.deleteEntry(SEED_IDS.cash);
    expect(engine.listEntries().some((e) => e.id === SEED_IDS.cash)).toBe(false);
    expectDemoError(() => engine.entryHistory(SEED_IDS.cash), 404);
  });

  describe("transfer", () => {
    it("moves the amount, charges the fee to the source, and logs both sides", () => {
      const result = engine.transfer({
        fromEntryId: SEED_IDS.debit,
        toEntryId: SEED_IDS.cash,
        amount: 10000,
        fee: 15,
      });
      expect(result.from.value).toBe(480000 - 10015);
      expect(result.to.value).toBe(45000);
      expect(engine.entryHistory(SEED_IDS.debit)[0]).toMatchObject({
        delta: -10015,
        note: "轉帳至「錢包現金」（含手續費 $15）",
      });
      expect(engine.entryHistory(SEED_IDS.cash)[0]).toMatchObject({
        delta: 10000,
        note: "轉帳自「國泰世華 薪轉戶」",
      });
    });

    it("rejects an overdraft and leaves both balances alone", () => {
      expectDemoError(
        () =>
          engine.transfer({ fromEntryId: SEED_IDS.cash, toEntryId: SEED_IDS.debit, amount: 35001 }),
        400
      );
      const entries = engine.listEntries();
      expect(entries.find((e) => e.id === SEED_IDS.cash)!.value).toBe(35000);
      expect(entries.find((e) => e.id === SEED_IDS.debit)!.value).toBe(480000);
    });

    it("rejects the same entry on both sides, and categories outside the transfer set", () => {
      expectDemoError(
        () => engine.transfer({ fromEntryId: SEED_IDS.cash, toEntryId: SEED_IDS.cash, amount: 1 }),
        400
      );
      expectDemoError(
        () => engine.transfer({ fromEntryId: SEED_IDS.cash, toEntryId: SEED_IDS.tw, amount: 1 }),
        400
      );
      expectDemoError(
        () => engine.transfer({ fromEntryId: "nope", toEntryId: SEED_IDS.cash, amount: 1 }),
        404
      );
    });
  });

  describe("allocation", () => {
    it("breaks assets down by top category and reports debt to assets", () => {
      const allocation = engine.allocation();
      const totalAssets = 672500 + 904900 + 12740000 + 30000;
      expect(allocation.breakdown.map((b) => b.topCategory)).toEqual([
        "固定資產",
        "投資",
        "流動資金",
        "應收款",
      ]);
      expect(allocation.breakdown[0]).toMatchObject({ value: 12740000 });
      expect(allocation.breakdown.reduce((s, b) => s + b.percentage, 0)).toBeCloseTo(100);
      expect(allocation.debtToAssetRatio).toBeCloseTo((7578000 / totalAssets) * 100);
      expect(allocation.concentrationWarnings.map((w) => w.name)).toEqual(["自住房屋"]);
    });

    it("ignores entries excluded from the chart", () => {
      engine.updateEntry("demo-seed-house", { includeInChart: false });
      expect(engine.allocation().breakdown.find((b) => b.topCategory === "固定資產")!.value).toBe(
        740000
      );
    });

    it("returns a null ratio and no breakdown when there are no assets", () => {
      for (const entry of engine.listEntries()) engine.deleteEntry(entry.id);
      expect(engine.allocation()).toEqual({
        breakdown: [],
        concentrationWarnings: [],
        debtToAssetRatio: null,
      });
    });
  });

  describe("netWorthHistory", () => {
    it("returns six monthly points for 6m and twelve for 1y, ending at today's totals", () => {
      const six = engine.netWorthHistory("6m");
      expect(six.points.map((p) => p.period)).toEqual(["Apr", "May", "Jun", "Jul", "Aug", "Sep"]);
      expect(engine.netWorthHistory("1y").points).toHaveLength(12);

      const last = six.points[5]!;
      expect(last.totalLiabilities).toBe(7578000);
      expect(last.totalAssets).toBe(672500 + 904900 + 12740000 + 30000);
      expect(last.netWorth).toBe(last.totalAssets - last.totalLiabilities);
    });

    it("spans from the earliest history month for all", () => {
      const all = engine.netWorthHistory("all").points;
      expect(all).toHaveLength(13);
      expect(all[0]!.period).toBe("Sep");
    });

    it("leaves out an entry that did not exist yet, and one excluded from the chart", () => {
      const before = engine.netWorthHistory("6m").points[5]!.totalAssets;
      const previousMonth = engine.netWorthHistory("6m").points[4]!.totalAssets;
      engine.createEntry({
        name: "新戶頭",
        topCategory: "流動資金",
        subCategory: "現金",
        value: 1000,
      });
      // 時鐘是凍結的：新紀錄的時間剛好等於「現在」，而 bucket 只收早於現在的紀錄。
      vi.advanceTimersByTime(1000);
      const points = engine.netWorthHistory("6m").points;
      expect(points[5]!.totalAssets).toBe(before + 1000);
      expect(points[4]!.totalAssets).toBe(previousMonth);

      engine.updateEntry("demo-seed-house", { includeInChart: false });
      expect(engine.netWorthHistory("6m").points[5]!.totalAssets).toBe(before + 1000 - 12000000);
    });

    it("returns no points when nothing is charted", () => {
      for (const entry of engine.listEntries()) engine.deleteEntry(entry.id);
      expect(engine.netWorthHistory("6m")).toEqual({ range: "6m", points: [] });
    });
  });

  describe("loans", () => {
    it("creates a liability entry carrying the loan and an opening history row", () => {
      const entry = engine.createLoan({
        loanName: "車貸",
        category: "貸款",
        totalAmount: 600000,
        annualInterestRate: 3,
        termMonths: 60,
        startDate: "2026-09-01T00:00:00.000Z",
        gracePeriodMonths: 0,
        repaymentType: "principal_equal",
      });
      expect(entry).toMatchObject({
        name: "車貸",
        topCategory: "負債",
        subCategory: "貸款",
        value: 600000,
      });
      expect(entry.loan).toMatchObject({ entryId: entry.id, totalAmount: 600000, termMonths: 60 });
      expect(engine.entryHistory(entry.id)).toMatchObject([{ delta: 600000, balance: 600000 }]);
    });

    it("renames the entry and logs a balance adjustment when the total changes", () => {
      const loanId = engine.listEntries().find((e) => e.id === SEED_IDS.loan)!.loan!.id;
      const result = engine.updateLoan(loanId, {
        loanName: "房貸",
        totalAmount: 7400000,
        annualInterestRate: 2.3,
      });
      expect(result.annualInterestRate).toBe(2.3);
      expect(result.entry).toMatchObject({ name: "房貸", value: 7400000 });
      expect(engine.entryHistory(SEED_IDS.loan)[0]).toMatchObject({
        delta: -50000,
        balance: 7400000,
        note: "手動調整餘額",
      });
    });

    it("404s on an unknown loan", () => {
      expectDemoError(() => engine.updateLoan("nope", { loanName: "x" }), 404);
    });
  });

  it("keeps two engines fully independent", () => {
    const other = new DemoEngine(NOW);
    engine.deleteEntry(SEED_IDS.cash);
    engine.updateEntry(SEED_IDS.debit, { value: 1 });
    expect(other.listEntries()).toHaveLength(26);
    expect(other.listEntries().find((e) => e.id === SEED_IDS.debit)!.value).toBe(480000);
  });
});
