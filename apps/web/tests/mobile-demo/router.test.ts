import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { Dividend, Entry, EntryHistory, Insurance, NetWorthHistory } from "@repo/shared";
import { DemoEngine } from "../../../mobile/lib/demo/engine";
import {
  handleDemoRequest,
  isPassthroughPath,
  type DemoMethod,
} from "../../../mobile/lib/demo/router";
import { DemoError } from "../../../mobile/lib/demo/types";
import { SEED_IDS } from "../../../mobile/lib/demo/seed";

const NOW = new Date("2026-09-30T04:00:00.000Z");

describe("isPassthroughPath", () => {
  it.each([
    "/api/stocks/price?symbol=2330.TW",
    "/api/stocks/tw",
    "/api/funds/search?q=abc",
    "/api/quotes/whatever",
    "/api/exchange-rate",
    "/api/cathaylife-rates",
  ])("lets %s through to the real backend", (path) => {
    expect(isPassthroughPath(path)).toBe(true);
  });

  it.each([
    "/api/entries",
    "/api/account",
    "/api/dividends/summary",
    "/api/entitlements",
    "/api/stocksx",
  ])("keeps %s inside the demo", (path) => {
    expect(isPassthroughPath(path)).toBe(false);
  });
});

describe("handleDemoRequest", () => {
  let engine: DemoEngine;
  const call = <T>(method: DemoMethod, path: string, body?: unknown) =>
    handleDemoRequest(engine, method, path, body) as T;

  function expectError(fn: () => unknown, code: string, status: number) {
    try {
      fn();
    } catch (e) {
      expect(e).toBeInstanceOf(DemoError);
      expect(e).toMatchObject({ code, status });
      return;
    }
    throw new Error("expected a DemoError");
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    engine = new DemoEngine(NOW);
  });
  afterEach(() => vi.useRealTimers());

  it("serves the four reads the app makes on launch", () => {
    expect(call<Entry[]>("GET", "/api/entries")).toHaveLength(26);
    expect(call<unknown[]>("GET", "/api/portfolio")).toHaveLength(1);
    expect(call<unknown[]>("GET", "/api/recurrences")).toHaveLength(1);
    expect(call<unknown[]>("GET", "/api/transactions").length).toBeGreaterThan(0);
    expect(call("POST", "/api/recurrences/process", {})).toEqual({ created: 0 });
  });

  it("routes entry writes, history, transfer, allocation and net worth", () => {
    const created = call<Entry>("POST", "/api/entries", {
      name: "零錢",
      topCategory: "流動資金",
      subCategory: "現金",
      value: 300,
    });
    expect(call<Entry>("PUT", `/api/entries/${created.id}`, { value: 500 }).value).toBe(500);

    const rows = call<EntryHistory[]>("GET", `/api/entries/${created.id}/history`);
    expect(rows).toHaveLength(2);
    call("PATCH", `/api/entries/${created.id}/history/${rows[0]!.id}`, { note: "補登" });
    call("DELETE", `/api/entries/${created.id}/history/${rows[0]!.id}`);
    expect(call<EntryHistory[]>("GET", `/api/entries/${created.id}/history`)).toHaveLength(1);

    expect(
      call<{ to: Entry }>("POST", "/api/entries/transfer", {
        fromEntryId: SEED_IDS.debit,
        toEntryId: created.id,
        amount: 100,
      }).to.value
    ).toBe(400);

    expect(call<{ breakdown: unknown[] }>("GET", "/api/entries/allocation").breakdown).toHaveLength(
      4
    );
    expect(
      call<NetWorthHistory>("GET", "/api/entries/net-worth-history?range=1y").points
    ).toHaveLength(12);
    expect(call<NetWorthHistory>("GET", "/api/entries/net-worth-history").range).toBe("6m");

    expect(call("DELETE", `/api/entries/${created.id}`)).toBeNull();
    expect(call<Entry[]>("GET", "/api/entries")).toHaveLength(26);
  });

  it("routes loans", () => {
    const entry = call<Entry>("POST", "/api/loans", {
      loanName: "車貸",
      category: "貸款",
      totalAmount: 600000,
      annualInterestRate: 3,
      termMonths: 60,
      startDate: "2026-09-01T00:00:00.000Z",
      gracePeriodMonths: 0,
      repaymentType: "principal_equal",
    });
    expect(
      call<{ loanName: string }>("PATCH", `/api/loans/${entry.loan!.id}`, { loanName: "新車貸" })
        .loanName
    ).toBe("新車貸");
  });

  it("routes insurances", () => {
    const created = call<Insurance & { entry: Entry }>("POST", "/api/insurances", {
      insurer: "新光人壽",
      insuredName: "王小明",
      insuranceType: "OTHER",
    });
    expect(call<Insurance[]>("GET", "/api/insurances")).toHaveLength(8);
    expect(call<Insurance>("GET", `/api/insurances/${created.id}`).insurer).toBe("新光人壽");
    expect(
      call<Insurance>("PATCH", `/api/insurances/${created.id}`, { insurer: "富邦人壽" }).insurer
    ).toBe("富邦人壽");
    call("DELETE", `/api/insurances/${created.id}`);
    expect(call<Insurance[]>("GET", "/api/insurances")).toHaveLength(7);
  });

  it("routes dividends, keeping summary and reinvest apart from ids", () => {
    expect(call<Dividend[]>("GET", "/api/dividends")).toHaveLength(5);
    expect(
      call<Dividend[]>("GET", `/api/dividends?entryId=${encodeURIComponent(SEED_IDS.us)}`)
    ).toHaveLength(2);
    expect(call<{ totalAllTime: number }>("GET", "/api/dividends/summary").totalAllTime).toBe(3760);

    const created = call<Dividend>("POST", "/api/dividends", {
      entryId: SEED_IDS.us,
      payDate: "2026-09-25",
      amount: 500,
      recordIncome: false,
    });
    expect(call<Dividend>("PATCH", `/api/dividends/${created.id}`, { amount: 600 }).amount).toBe(
      600
    );
    expect(
      call<Dividend>("POST", `/api/dividends/${created.id}/reinvest`, { amount: 600, price: 6000 })
        .reinvestUnits
    ).toBe(0.1);
    call("DELETE", `/api/dividends/${created.id}`);
    expect(call<Dividend[]>("GET", "/api/dividends")).toHaveLength(5);
  });

  it("routes transactions, portfolio and recurrences", () => {
    const tx = call<{ id: string }>("POST", "/api/transactions", {
      type: "expense",
      amount: 1,
      category: "雜支",
      source: "daily",
      date: "2026-09-29",
    });
    call("DELETE", `/api/transactions/${tx.id}`);

    const item = call<{ id: string }>("POST", "/api/portfolio", {
      symbol: "X",
      name: "X",
      avgCost: 1,
      shares: 1,
    });
    expect(call<{ shares: number }>("PUT", `/api/portfolio/${item.id}`, { shares: 2 }).shares).toBe(
      2
    );
    call("DELETE", `/api/portfolio/${item.id}`);

    const rec = call<{ id: string }>("POST", "/api/recurrences", {
      entryId: SEED_IDS.debit,
      type: "expense",
      amount: 1,
      category: "雜支",
      source: "daily",
      frequency: "WEEKLY",
      startDate: "2026-09-10",
    });
    expect(
      call<{ amount: number }>("PUT", `/api/recurrences/${rec.id}`, { amount: 2 }).amount
    ).toBe(2);
    call("DELETE", `/api/recurrences/${rec.id}`);
  });

  it("reports premium so nothing re-gates inside the demo", () => {
    expect(call("GET", "/api/entitlements")).toEqual({ isPremium: true });
  });

  it("blocks the routes that act on the real account", () => {
    expectError(() => call("DELETE", "/api/account"), "DEMO_BLOCKED", 403);
    expectError(
      () => call("POST", "/api/dev/subscription", { action: "activate" }),
      "DEMO_BLOCKED",
      403
    );
  });

  it("refuses anything it does not recognise instead of guessing", () => {
    expectError(() => call("GET", "/api/unknown"), "DEMO_UNSUPPORTED", 0);
    expectError(() => call("DELETE", "/api/entries"), "DEMO_UNSUPPORTED", 0);
    expectError(() => call("POST", "/api/entries/abc/history"), "DEMO_UNSUPPORTED", 0);
    expectError(() => call("GET", "/api/stocks/price?symbol=2330.TW"), "DEMO_UNSUPPORTED", 0);
    expectError(() => call("GET", "not-a-path"), "DEMO_UNSUPPORTED", 0);
  });

  it("surfaces engine errors unchanged", () => {
    expectError(() => call("PUT", "/api/entries/nope", { name: "x" }), "NOT_FOUND", 404);
  });
});
