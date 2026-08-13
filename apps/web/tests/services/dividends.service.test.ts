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

    const deletedIds = txMock.entryHistory.delete.mock.calls.map((c) => c[0].where.id);
    expect(deletedIds).toEqual(expect.arrayContaining(["hist-1", "hist-stock", "hist-bank-debit"]));
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
