import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(async (arg) => (Array.isArray(arg) ? Promise.all(arg) : arg(txMock))),
    dividend: { findMany: vi.fn(), findFirst: vi.fn() },
    entry: { findMany: vi.fn() },
  },
}));

vi.mock("@/services/entitlements.service", () => ({
  entitlementsService: { isPremium: vi.fn() },
}));

vi.mock("@/lib/serialize", () => ({
  d: (v: unknown) => Number(v),
  dn: (v: unknown) => (v == null ? null : Number(v)),
}));

const txMock = {
  entry: { findFirst: vi.fn(), update: vi.fn() },
  entryHistory: { create: vi.fn(), findFirst: vi.fn(), delete: vi.fn(), updateMany: vi.fn() },
  dividend: { create: vi.fn(), update: vi.fn(), delete: vi.fn(), findFirst: vi.fn() },
  transaction: { create: vi.fn(), deleteMany: vi.fn() },
};

import { entitlementsService } from "../../services/entitlements.service";
import {
  dividendsService,
  PremiumRequiredError,
  NotFoundError,
  ConflictError,
} from "../../services/dividends.service";

const USER_ID = "user_test123";
const STOCK = {
  id: "stock-1",
  userId: USER_ID,
  name: "台積電",
  subCategory: "台股",
  stockCode: "2330",
  topCategory: "投資",
  value: 100000,
};
const BANK = {
  id: "bank-1",
  userId: USER_ID,
  name: "國泰世華",
  subCategory: "金融卡",
  topCategory: "流動資金",
  value: 50000,
};

function dividendRow(over: Record<string, unknown> = {}) {
  return {
    id: "div-1",
    entryId: STOCK.id,
    userId: USER_ID,
    payDate: new Date("2026-08-13"),
    amount: 1200,
    perShare: null,
    shares: null,
    note: null,
    bankEntryId: null,
    bankHistoryId: null,
    transactionId: null,
    reinvestedAt: null,
    reinvestAmount: null,
    reinvestPrice: null,
    reinvestUnits: null,
    reinvestHistoryId: null,
    reinvestBankHistoryId: null,
    createdAt: new Date("2026-08-13"),
    ...over,
  };
}

describe("DividendsService.create", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(entitlementsService.isPremium).mockResolvedValue(true);
    txMock.entry.findFirst.mockImplementation(async ({ where }: { where: { id: string } }) =>
      where.id === STOCK.id ? STOCK : where.id === BANK.id ? BANK : null
    );
    txMock.entryHistory.create.mockResolvedValue({ id: "hist-1" });
    txMock.dividend.create.mockResolvedValue(dividendRow());
    txMock.dividend.update.mockResolvedValue(dividendRow());
    txMock.transaction.create.mockResolvedValue({ id: "tx-1" });
  });

  it("rejects a non-premium user before touching the database", async () => {
    vi.mocked(entitlementsService.isPremium).mockResolvedValue(false);
    await expect(
      dividendsService.create(
        { entryId: STOCK.id, payDate: "2026-08-13", amount: 1200, recordIncome: true },
        USER_ID
      )
    ).rejects.toBeInstanceOf(PremiumRequiredError);
    expect(txMock.dividend.create).not.toHaveBeenCalled();
  });

  it("writes no entry history when no bank account is given", async () => {
    await dividendsService.create(
      { entryId: STOCK.id, payDate: "2026-08-13", amount: 1200, recordIncome: false },
      USER_ID
    );
    expect(txMock.entryHistory.create).not.toHaveBeenCalled();
    expect(txMock.entry.update).not.toHaveBeenCalled();
  });

  it("credits the bank entry when a bank account is given", async () => {
    await dividendsService.create(
      {
        entryId: STOCK.id,
        payDate: "2026-08-13",
        amount: 1200,
        bankEntryId: BANK.id,
        recordIncome: false,
      },
      USER_ID
    );
    expect(txMock.entryHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ entryId: BANK.id, delta: 1200, balance: 51200 }),
    });
    expect(txMock.entry.update).toHaveBeenCalledWith({
      where: { id: BANK.id },
      data: { value: 51200 },
    });
  });

  it("records an income transaction when recordIncome is true", async () => {
    await dividendsService.create(
      { entryId: STOCK.id, payDate: "2026-08-13", amount: 1200, recordIncome: true },
      USER_ID
    );
    expect(txMock.transaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: USER_ID,
        type: "income",
        category: "股利",
        source: "台積電",
        amount: 1200,
      }),
    });
  });

  it("rejects a stock entry owned by someone else", async () => {
    const OTHER_USER_ID = "user_other456";
    txMock.entry.findFirst.mockImplementation(
      async ({ where }: { where: { id: string; userId: string } }) =>
        where.id === STOCK.id && where.userId === USER_ID ? STOCK : null
    );
    await expect(
      dividendsService.create(
        { entryId: STOCK.id, payDate: "2026-08-13", amount: 1200, recordIncome: true },
        OTHER_USER_ID
      )
    ).rejects.toThrow();
    expect(txMock.entry.findFirst).toHaveBeenCalledWith({
      where: { id: STOCK.id, userId: OTHER_USER_ID },
    });
  });

  it("rejects a bank entry that is not 流動資金", async () => {
    txMock.entry.findFirst.mockImplementation(async ({ where }: { where: { id: string } }) =>
      where.id === STOCK.id ? STOCK : { ...BANK, topCategory: "投資" }
    );
    await expect(
      dividendsService.create(
        {
          entryId: STOCK.id,
          payDate: "2026-08-13",
          amount: 1200,
          bankEntryId: BANK.id,
          recordIncome: false,
        },
        USER_ID
      )
    ).rejects.toThrow();
  });
});

describe("DividendsService.delete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    txMock.entryHistory.findFirst.mockImplementation(
      async ({
        where,
        orderBy,
      }: {
        where: { id?: string; entryId?: string };
        orderBy?: unknown;
      }) => {
        // 沖銷時先讀被刪的那一筆，再讀剩下的最後一筆來回推 Entry.value。
        if (where.id)
          return { id: where.id, entryId: BANK.id, delta: 1200, createdAt: new Date("2026-08-13") };
        if (orderBy)
          return {
            id: "hist-prev",
            entryId: BANK.id,
            delta: 0,
            balance: 50000,
            createdAt: new Date("2026-08-01"),
          };
        return null;
      }
    );
  });

  it("reverses the bank credit and deletes the income transaction", async () => {
    txMock.dividend.findFirst.mockResolvedValue(
      dividendRow({ bankEntryId: BANK.id, bankHistoryId: "hist-1", transactionId: "tx-1" })
    );

    await dividendsService.delete("div-1", USER_ID);

    expect(txMock.entryHistory.delete).toHaveBeenCalledWith({ where: { id: "hist-1" } });
    expect(txMock.entryHistory.updateMany).toHaveBeenCalledWith({
      where: { entryId: BANK.id, createdAt: { gt: new Date("2026-08-13") } },
      data: { balance: { increment: -1200 } },
    });
    expect(txMock.entry.update).toHaveBeenCalledWith({
      where: { id: BANK.id },
      data: { value: 50000 },
    });
    expect(txMock.transaction.deleteMany).toHaveBeenCalledWith({
      where: { id: "tx-1", userId: USER_ID },
    });
    expect(txMock.dividend.delete).toHaveBeenCalledWith({ where: { id: "div-1" } });
  });

  it("reverses both legs of a reinvested dividend", async () => {
    // Leg-aware mock: each historyId maps to the entry + delta it actually
    // wrote, in real write order (bank credit, then bank debit, then stock
    // credit), so this test can tell the three legs apart instead of treating
    // them as interchangeable bank rows.
    const bankCreditLeg = {
      entryId: BANK.id,
      delta: 1200,
      createdAt: new Date("2026-08-13T00:00:00Z"),
    };
    const bankDebitLeg = {
      entryId: BANK.id,
      delta: -1200,
      createdAt: new Date("2026-08-14T00:00:00Z"),
    };
    const stockCreditLeg = {
      entryId: STOCK.id,
      delta: 1200,
      createdAt: new Date("2026-08-14T00:00:01Z"),
    };
    const LEGS: Record<string, { entryId: string; delta: number; createdAt: Date }> = {
      "hist-1": bankCreditLeg,
      "hist-bank-debit": bankDebitLeg,
      "hist-stock": stockCreditLeg,
    };
    txMock.entryHistory.findFirst.mockImplementation(
      async ({
        where,
        orderBy,
      }: {
        where: { id?: string; entryId?: string };
        orderBy?: unknown;
      }) => {
        if (where.id) return { id: where.id, ...LEGS[where.id] };
        if (orderBy)
          return {
            id: "hist-prev",
            entryId: where.entryId,
            delta: 0,
            balance: where.entryId === BANK.id ? 50000 : 100000,
            createdAt: new Date("2026-08-01"),
          };
        return null;
      }
    );

    txMock.dividend.findFirst.mockResolvedValue(
      dividendRow({
        bankEntryId: BANK.id,
        bankHistoryId: "hist-1",
        reinvestedAt: new Date("2026-08-14"),
        reinvestHistoryId: "hist-stock",
        reinvestBankHistoryId: "hist-bank-debit",
      })
    );

    await dividendsService.delete("div-1", USER_ID);

    // Ordering is real, not order-insensitive: unwind reverses the two
    // reinvest legs before the original credit leg (reverse write order).
    const deletedIds = txMock.entryHistory.delete.mock.calls.map((c) => c[0].where.id);
    expect(deletedIds).toEqual(["hist-stock", "hist-bank-debit", "hist-1"]);

    // Stock credit leg (delta +1200) reversed.
    expect(txMock.entryHistory.updateMany).toHaveBeenCalledWith({
      where: { entryId: STOCK.id, createdAt: { gt: stockCreditLeg.createdAt } },
      data: { balance: { increment: -1200 } },
    });
    // Bank debit leg (delta -1200) reversed — increment is positive.
    expect(txMock.entryHistory.updateMany).toHaveBeenCalledWith({
      where: { entryId: BANK.id, createdAt: { gt: bankDebitLeg.createdAt } },
      data: { balance: { increment: 1200 } },
    });
    // Bank credit leg (delta +1200) reversed.
    expect(txMock.entryHistory.updateMany).toHaveBeenCalledWith({
      where: { entryId: BANK.id, createdAt: { gt: bankCreditLeg.createdAt } },
      data: { balance: { increment: -1200 } },
    });

    // Entry.value recomputed for both affected entries, not only the bank.
    expect(txMock.entry.update).toHaveBeenCalledWith({
      where: { id: BANK.id },
      data: { value: 50000 },
    });
    expect(txMock.entry.update).toHaveBeenCalledWith({
      where: { id: STOCK.id },
      data: { value: 100000 },
    });
  });

  it("throws NotFoundError for another user's dividend", async () => {
    txMock.dividend.findFirst.mockResolvedValue(null);
    await expect(dividendsService.delete("div-1", USER_ID)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("sets the entry value to 0 when no history remains", async () => {
    txMock.dividend.findFirst.mockResolvedValue(
      dividendRow({ bankEntryId: BANK.id, bankHistoryId: "hist-1" })
    );
    txMock.entryHistory.findFirst.mockImplementation(
      async ({ where, orderBy }: { where: { id?: string }; orderBy?: unknown }) => {
        if (where.id)
          return { id: "hist-1", entryId: BANK.id, delta: 1200, createdAt: new Date("2026-08-13") };
        if (orderBy) return null;
        return null;
      }
    );

    await dividendsService.delete("div-1", USER_ID);

    expect(txMock.entry.update).toHaveBeenCalledWith({
      where: { id: BANK.id },
      data: { value: 0 },
    });
  });
});

describe("DividendsService.reinvest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(entitlementsService.isPremium).mockResolvedValue(true);
    txMock.entry.findFirst.mockImplementation(async ({ where }: { where: { id: string } }) =>
      where.id === STOCK.id ? STOCK : where.id === BANK.id ? BANK : null
    );
    txMock.entryHistory.create.mockResolvedValue({ id: "hist-new" });
    txMock.dividend.update.mockResolvedValue(
      dividendRow({
        reinvestedAt: new Date("2026-08-14"),
        reinvestAmount: 1200,
        reinvestPrice: 600,
        reinvestUnits: 2,
      })
    );
  });

  it("debits the bank and credits the stock with derived units", async () => {
    txMock.dividend.findFirst.mockResolvedValue(
      dividendRow({ bankEntryId: BANK.id, bankHistoryId: "hist-1" })
    );

    await dividendsService.reinvest("div-1", { amount: 1200, price: 600 }, USER_ID);

    expect(txMock.entryHistory.create).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({ entryId: BANK.id, delta: -1200, balance: 48800 }),
    });
    expect(txMock.entryHistory.create).toHaveBeenNthCalledWith(2, {
      data: expect.objectContaining({ entryId: STOCK.id, delta: 1200, units: 2, balance: 101200 }),
    });
  });

  it("skips the bank leg when the dividend has no bank account", async () => {
    txMock.dividend.findFirst.mockResolvedValue(dividendRow());

    await dividendsService.reinvest("div-1", { amount: 1200, price: 600 }, USER_ID);

    const entryIds = txMock.entryHistory.create.mock.calls.map((c) => c[0].data.entryId);
    expect(entryIds).toEqual([STOCK.id]);
  });

  it("rejects reinvesting the same dividend twice", async () => {
    txMock.dividend.findFirst.mockResolvedValue(
      dividendRow({ reinvestedAt: new Date("2026-08-14") })
    );

    await expect(
      dividendsService.reinvest("div-1", { amount: 1200, price: 600 }, USER_ID)
    ).rejects.toBeInstanceOf(ConflictError);
    expect(txMock.entryHistory.create).not.toHaveBeenCalled();
  });

  it("rejects an amount larger than the dividend", async () => {
    txMock.dividend.findFirst.mockResolvedValue(dividendRow());

    await expect(
      dividendsService.reinvest("div-1", { amount: 5000, price: 600 }, USER_ID)
    ).rejects.toBeInstanceOf(ConflictError);
    expect(txMock.entryHistory.create).not.toHaveBeenCalled();
  });

  it("rejects a non-premium user", async () => {
    vi.mocked(entitlementsService.isPremium).mockResolvedValue(false);
    await expect(
      dividendsService.reinvest("div-1", { amount: 1200, price: 600 }, USER_ID)
    ).rejects.toBeInstanceOf(PremiumRequiredError);
  });
});

describe("DividendsService.update", () => {
  // Stateful bank fixture representing the post-original-credit state (BANK
  // was 50000 before the original 1200 credit; update() is called with the
  // account already sitting at 51200). Mutable so entry.findFirst/entry.update
  // behave like the real DB: entry.update writes the value back, so a call
  // that reads AFTER unwind sees what reverseHistory just wrote (50000), while
  // a call that reads BEFORE unwind would still see the stale 51200. This is
  // what makes the ordering of requireCashEntry vs unwind observable.
  let bankValue = 51200;

  beforeEach(() => {
    vi.clearAllMocks();
    bankValue = 51200;
    vi.mocked(entitlementsService.isPremium).mockResolvedValue(true);
    txMock.entry.findFirst.mockImplementation(async ({ where }: { where: { id: string } }) =>
      where.id === STOCK.id ? STOCK : where.id === BANK.id ? { ...BANK, value: bankValue } : null
    );
    txMock.entry.update.mockImplementation(
      async ({ data }: { where: { id: string }; data: { value: number } }) => {
        bankValue = data.value;
        return { id: BANK.id, value: bankValue };
      }
    );
    txMock.entryHistory.create.mockResolvedValue({ id: "hist-new" });
    txMock.entryHistory.findFirst.mockImplementation(
      async ({ where, orderBy }: { where: { id?: string }; orderBy?: unknown }) => {
        if (where.id)
          return { id: where.id, entryId: BANK.id, delta: 1200, createdAt: new Date("2026-08-13") };
        if (orderBy)
          return {
            id: "hist-prev",
            entryId: BANK.id,
            delta: 0,
            balance: 50000,
            createdAt: new Date("2026-08-01"),
          };
        return null;
      }
    );
    txMock.dividend.update.mockResolvedValue(dividendRow({ amount: 2000 }));
  });

  it("unwinds the old posting and replays the new amount", async () => {
    txMock.dividend.findFirst.mockResolvedValue(
      dividendRow({ bankEntryId: BANK.id, bankHistoryId: "hist-1", transactionId: "tx-1" })
    );

    await dividendsService.update("div-1", { amount: 2000 }, USER_ID);

    expect(txMock.entryHistory.delete).toHaveBeenCalledWith({ where: { id: "hist-1" } });
    expect(txMock.transaction.deleteMany).toHaveBeenCalledWith({
      where: { id: "tx-1", userId: USER_ID },
    });
    // The bank was at 51200 when update() was called, but unwind() reverses
    // the old 1200 credit first (entry.update writes it back to 50000), so
    // the replay must post against 50000, not the stale pre-unwind 51200.
    // If requireCashEntry ever ran before unwind, this would be 53200.
    expect(txMock.entryHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ entryId: BANK.id, delta: 2000, balance: 52000 }),
    });
  });

  it("refuses to change the amount of a reinvested dividend", async () => {
    txMock.dividend.findFirst.mockResolvedValue(
      dividendRow({ reinvestedAt: new Date("2026-08-14") })
    );

    await expect(
      dividendsService.update("div-1", { amount: 2000 }, USER_ID)
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("clears the bank posting when bankEntryId is set to null", async () => {
    txMock.dividend.findFirst.mockResolvedValue(
      dividendRow({ bankEntryId: BANK.id, bankHistoryId: "hist-1" })
    );

    await dividendsService.update("div-1", { bankEntryId: null }, USER_ID);

    expect(txMock.entryHistory.delete).toHaveBeenCalledWith({ where: { id: "hist-1" } });
    expect(txMock.entryHistory.create).not.toHaveBeenCalled();
    expect(txMock.dividend.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ bankEntryId: null, bankHistoryId: null }),
      })
    );
  });

  it("throws NotFoundError for another user's dividend", async () => {
    txMock.dividend.findFirst.mockResolvedValue(null);
    await expect(dividendsService.update("div-1", { amount: 1 }, USER_ID)).rejects.toBeInstanceOf(
      NotFoundError
    );
  });
});
