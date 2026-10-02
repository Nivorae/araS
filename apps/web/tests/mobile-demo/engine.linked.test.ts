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

describe("DemoEngine linked resources", () => {
  let engine: DemoEngine;
  const valueOf = (id: string) => engine.listEntries().find((e) => e.id === id)!.value;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    engine = new DemoEngine(NOW);
  });
  afterEach(() => vi.useRealTimers());

  describe("insurance", () => {
    it("creates the policy together with a zero-value uncharted entry", () => {
      const result = engine.createInsurance({
        insurer: "新光人壽",
        insuredName: "王小明",
        insuranceType: "MEDICAL",
        policyName: " 住院醫療 ",
        annualPremium: 8000,
        coverage: [{ key: "hospital_daily", label: "住院日額", value: 1000 }],
      });
      expect(result.entry).toMatchObject({
        name: "住院醫療",
        topCategory: "保險",
        subCategory: "MEDICAL",
        value: 0,
        includeInChart: false,
        insurance: {
          id: result.id,
          insuranceType: "MEDICAL",
          insurer: "新光人壽",
          insuredName: "王小明",
        },
      });
      expect(result.policyNumber).toBeNull();
      expect(engine.listInsurances()).toHaveLength(8);
      expect(engine.listEntries().some((e) => e.id === result.entryId)).toBe(true);
      expect(engine.getInsurance(result.id).annualPremium).toBe(8000);
    });

    it("falls back to the insurer for the entry name", () => {
      const result = engine.createInsurance({
        insurer: "新光人壽",
        insuredName: "王小明",
        insuranceType: "OTHER",
      });
      expect(result.entry.name).toBe("新光人壽");
      expect(result.coverage).toEqual([]);
    });

    it("keeps the entry name and inline summary in sync on update", () => {
      const updated = engine.updateInsurance("demo-seed-ins-LIFE", {
        policyName: "定期壽險",
        insurer: "富邦人壽",
      });
      expect(updated).toMatchObject({ policyName: "定期壽險", insurer: "富邦人壽" });
      const entry = engine.listEntries().find((e) => e.id === updated.entryId)!;
      expect(entry.name).toBe("定期壽險");
      expect(entry.insurance?.insurer).toBe("富邦人壽");
    });

    it("removes the entry when the policy is deleted, and the policy when the entry is", () => {
      engine.deleteInsurance("demo-seed-ins-LIFE");
      expect(engine.listEntries().some((e) => e.id === "demo-seed-ins-entry-LIFE")).toBe(false);

      engine.deleteEntry("demo-seed-ins-entry-CANCER");
      expect(engine.listInsurances().some((i) => i.id === "demo-seed-ins-CANCER")).toBe(false);
      expect(engine.listInsurances()).toHaveLength(5);
    });

    it("404s on an unknown policy", () => {
      expectDemoError(() => engine.getInsurance("nope"), 404);
      expectDemoError(() => engine.updateInsurance("nope", { insurer: "x" }), 404);
      expectDemoError(() => engine.deleteInsurance("nope"), 404);
    });
  });

  describe("dividends", () => {
    it("lists newest pay date first and filters by entry", () => {
      const all = engine.listDividends();
      expect(all).toHaveLength(5);
      const dates = all.map((d) => d.payDate);
      expect([...dates].sort().reverse()).toEqual(dates);
      expect(engine.listDividends(SEED_IDS.us)).toHaveLength(2);
      expect(all[0]).not.toHaveProperty("transactionId");
    });

    it("accepts a dividend on a 海外股票 holding", () => {
      const overseas = engine.createEntry({
        name: "Vanguard FTSE All-World",
        topCategory: "投資",
        subCategory: "海外股票",
        stockCode: "VWRA.L",
        value: 60000,
        units: 10,
      });

      const dividend = engine.createDividend({
        entryId: overseas.id,
        payDate: "2026-09-25",
        amount: 500,
        recordIncome: false,
      });

      expect(dividend).toMatchObject({ entryId: overseas.id, amount: 500 });
    });

    it("credits the bank entry and records income when both are requested", () => {
      const before = engine.listTransactions().length;
      const dividend = engine.createDividend({
        entryId: SEED_IDS.tw,
        payDate: "2026-09-25",
        amount: 1200,
        bankEntryId: SEED_IDS.debit,
        recordIncome: true,
      });
      expect(dividend).toMatchObject({
        amount: 1200,
        bankEntryId: SEED_IDS.debit,
        reinvestedAt: null,
      });
      expect(valueOf(SEED_IDS.debit)).toBe(481200);
      expect(engine.entryHistory(SEED_IDS.debit)[0]).toMatchObject({
        delta: 1200,
        note: "台積電 股利",
      });
      const income = engine.listTransactions();
      expect(income).toHaveLength(before + 1);
      expect(income[0]).toMatchObject({
        type: "income",
        amount: 1200,
        category: "股利",
        source: "台積電",
      });
    });

    it("touches nothing else when no bank entry and no income are requested", () => {
      const before = engine.listTransactions().length;
      engine.createDividend({
        entryId: SEED_IDS.us,
        payDate: "2026-09-25",
        amount: 300,
        recordIncome: false,
      });
      expect(engine.listTransactions()).toHaveLength(before);
      expect(valueOf(SEED_IDS.debit)).toBe(480000);
    });

    it("rejects a non-stock entry and a non-cash bank entry", () => {
      expectDemoError(
        () =>
          engine.createDividend({
            entryId: SEED_IDS.cash,
            payDate: "2026-09-25",
            amount: 1,
            recordIncome: true,
          }),
        409
      );
      expectDemoError(
        () =>
          engine.createDividend({
            entryId: SEED_IDS.tw,
            payDate: "2026-09-25",
            amount: 1,
            bankEntryId: SEED_IDS.card,
            recordIncome: true,
          }),
        409
      );
      expectDemoError(
        () =>
          engine.createDividend({
            entryId: "nope",
            payDate: "2026-09-25",
            amount: 1,
            recordIncome: true,
          }),
        404
      );
    });

    it("reinvests: debits the bank, adds units and cost to the stock", () => {
      const dividend = engine.createDividend({
        entryId: SEED_IDS.tw,
        payDate: "2026-09-25",
        amount: 1200,
        bankEntryId: SEED_IDS.debit,
        recordIncome: false,
      });
      const result = engine.reinvestDividend(dividend.id, { amount: 1000, price: 1000 });
      expect(result).toMatchObject({ reinvestAmount: 1000, reinvestPrice: 1000, reinvestUnits: 1 });
      expect(result.reinvestedAt).not.toBeNull();
      expect(valueOf(SEED_IDS.debit)).toBe(480000 + 1200 - 1000);
      const stock = engine.listEntries().find((e) => e.id === SEED_IDS.tw)!;
      expect(stock.value).toBe(171900);
      expect(stock.units).toBe(202);
    });

    it("rejects reinvesting twice or more than the dividend", () => {
      expectDemoError(
        () => engine.reinvestDividend("demo-seed-div-1", { amount: 100, price: 100 }),
        409
      );
      expectDemoError(
        () => engine.reinvestDividend("demo-seed-div-2", { amount: 901, price: 100 }),
        409
      );
      expectDemoError(() => engine.reinvestDividend("nope", { amount: 1, price: 1 }), 404);
    });

    it("refuses to edit a reinvested dividend and leaves the holding intact", () => {
      expectDemoError(() => engine.updateDividend("demo-seed-div-1", { note: "改備註" }), 409);
      expect(engine.listEntries().find((e) => e.id === SEED_IDS.tw)!.units).toBe(201);
    });

    it("unwinds and replays on update when the bank entry changes", () => {
      const dividend = engine.createDividend({
        entryId: SEED_IDS.tw,
        payDate: "2026-09-25",
        amount: 1200,
        bankEntryId: SEED_IDS.debit,
        recordIncome: true,
      });
      const count = engine.listTransactions().length;

      const updated = engine.updateDividend(dividend.id, {
        amount: 1500,
        bankEntryId: SEED_IDS.cash,
      });
      expect(updated).toMatchObject({ amount: 1500, bankEntryId: SEED_IDS.cash });
      expect(valueOf(SEED_IDS.debit)).toBe(480000);
      expect(valueOf(SEED_IDS.cash)).toBe(36500);
      expect(engine.listTransactions()).toHaveLength(count);
      expect(engine.listTransactions()[0]).toMatchObject({ amount: 1500, category: "股利" });

      engine.updateDividend(dividend.id, { bankEntryId: null });
      expect(valueOf(SEED_IDS.cash)).toBe(35000);
    });

    it("leaves the books untouched when an update names an invalid bank entry", () => {
      const dividend = engine.createDividend({
        entryId: SEED_IDS.tw,
        payDate: "2026-09-25",
        amount: 1200,
        bankEntryId: SEED_IDS.debit,
        recordIncome: true,
      });
      const count = engine.listTransactions().length;
      expectDemoError(
        () => engine.updateDividend(dividend.id, { bankEntryId: SEED_IDS.card }),
        409
      );
      expect(valueOf(SEED_IDS.debit)).toBe(481200);
      expect(engine.listTransactions()).toHaveLength(count);
    });

    it("undoes every booking when a dividend is deleted", () => {
      const before = engine.listTransactions().length;
      engine.deleteDividend("demo-seed-div-1");
      const stock = engine.listEntries().find((e) => e.id === SEED_IDS.tw)!;
      expect(stock.value).toBe(170000);
      expect(stock.units).toBe(200);
      expect(engine.listTransactions()).toHaveLength(before - 1);
      expect(engine.listDividends()).toHaveLength(4);
      expectDemoError(() => engine.deleteDividend("demo-seed-div-1"), 404);
    });

    it("summarises totals per entry with yield on cost", () => {
      const summary = engine.dividendSummary();
      expect(summary.totalAllTime).toBe(3760);
      // 以 2026-09-30 為基準，最早一筆是 8 個月前（2026-01-15），五筆都在今年。
      expect(summary.totalThisYear).toBe(3760);
      expect(summary.byEntry.map((b) => b.entryId)).toEqual([SEED_IDS.tw, SEED_IDS.us]);
      expect(summary.byEntry[0]).toMatchObject({
        name: "台積電",
        stockCode: "2330",
        totalAllTime: 2800,
        costBasis: 170900,
        yieldOnCost: 2800 / 170900,
      });
    });

    it("drops a deleted stock's dividends from the list and the summary", () => {
      engine.deleteEntry(SEED_IDS.tw);
      expect(engine.listDividends().every((d) => d.entryId === SEED_IDS.us)).toBe(true);
      const summary = engine.dividendSummary();
      expect(summary.totalAllTime).toBe(960);
      expect(summary.byEntry).toHaveLength(1);
    });
  });

  describe("transactions", () => {
    it("creates, lists newest first, and deletes", () => {
      const created = engine.createTransaction({
        type: "expense",
        amount: 250,
        category: "餐飲",
        source: "daily",
        date: "2026-09-29",
      });
      expect(created).toMatchObject({ note: null, date: "2026-09-29T00:00:00.000Z" });
      expect(engine.listTransactions()[0]!.id).toBe(created.id);
      engine.deleteTransaction(created.id);
      expect(engine.listTransactions().some((t) => t.id === created.id)).toBe(false);
      expectDemoError(() => engine.deleteTransaction(created.id), 404);
    });
  });

  describe("portfolio", () => {
    it("creates, updates, and deletes an item", () => {
      const item = engine.createPortfolioItem({
        symbol: "0050.TW",
        name: "元大台灣50",
        avgCost: 180,
        shares: 100,
      });
      expect(engine.listPortfolio()[0]!.id).toBe(item.id);
      expect(engine.updatePortfolioItem(item.id, { shares: 150 })).toMatchObject({
        shares: 150,
        avgCost: 180,
      });
      engine.deletePortfolioItem(item.id);
      expect(engine.listPortfolio()).toHaveLength(1);
      expectDemoError(() => engine.updatePortfolioItem(item.id, { shares: 1 }), 404);
    });
  });

  describe("recurrences", () => {
    it("computes the first run on or after the start date", () => {
      const rec = engine.createRecurrence({
        entryId: SEED_IDS.debit,
        type: "expense",
        amount: 15000,
        category: "房租",
        source: "daily",
        frequency: "MONTHLY",
        dayOfMonth: 1,
        startDate: "2026-09-10T00:00:00.000Z",
      });
      expect(new Date(rec.nextRunAt).getMonth()).toBe(9); // October
      expect(new Date(rec.nextRunAt).getDate()).toBe(1);
      expect(rec).toMatchObject({ active: true, note: null, lastRunAt: null });
      expect(engine.listRecurrences()).toHaveLength(2);
    });

    it("recomputes the next run only when the schedule changes", () => {
      const seeded = engine.listRecurrences()[0]!;
      expect(engine.updateRecurrence(seeded.id, { amount: 899 }).nextRunAt).toBe(seeded.nextRunAt);
      const moved = engine.updateRecurrence(seeded.id, { dayOfMonth: 20 });
      expect(new Date(moved.nextRunAt).getDate()).toBe(20);
    });

    it("404s for a missing entry or recurrence, and deletes", () => {
      expectDemoError(
        () =>
          engine.createRecurrence({
            entryId: "nope",
            type: "expense",
            amount: 1,
            category: "x",
            source: "daily",
            frequency: "WEEKLY",
            startDate: "2026-09-10",
          }),
        404
      );
      const seeded = engine.listRecurrences()[0]!;
      engine.deleteRecurrence(seeded.id);
      expect(engine.listRecurrences()).toHaveLength(0);
      expectDemoError(() => engine.deleteRecurrence(seeded.id), 404);
    });
  });
});
