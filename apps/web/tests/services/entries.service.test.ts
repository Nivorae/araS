import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const txMock = {
  entry: { findFirst: vi.fn(), update: vi.fn() },
  entryHistory: { create: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(async (arg) => arg(txMock)),
    entry: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    entryHistory: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("@/lib/serialize", () => ({
  d: (v: unknown) => Number(v),
  dn: (v: unknown) => (v == null ? null : Number(v)),
}));

vi.mock("@/services/entitlements.service", () => ({
  entitlementsService: { isPremium: vi.fn() },
}));

import { prisma } from "@/lib/prisma";
import { entriesService } from "../../services/entries.service";
import { entitlementsService } from "../../services/entitlements.service";
import {
  EntryLimitError,
  EntryNotFoundError,
  InvalidTransferError,
  InsufficientBalanceError,
} from "../../services/entries.service";
import { FREE_ENTRY_LIMIT } from "@repo/shared";

const USER_ID = "user_test123";

const VALID_ENTRY = {
  name: "台積電",
  topCategory: "流動資金",
  subCategory: "現金",
  value: 1000,
};

describe("EntriesService.list", () => {
  beforeEach(() => vi.clearAllMocks());
  it("filters by userId", async () => {
    vi.mocked(prisma.entry.findMany).mockResolvedValue([]);
    await entriesService.list(USER_ID);
    expect(prisma.entry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: USER_ID } })
    );
  });

  it("includes an insurance summary on the listed entries", async () => {
    vi.mocked(prisma.entry.findMany).mockResolvedValue([
      {
        id: "e1",
        userId: USER_ID,
        name: "醫療險",
        topCategory: "保險",
        subCategory: "MEDICAL",
        stockCode: null,
        bankCode: null,
        note: null,
        value: 0,
        includeInChart: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        loan: null,
        history: [],
        insurance: {
          id: "ins1",
          insuranceType: "MEDICAL",
          insurer: "國泰人壽",
          insuredName: "本人",
        },
      },
    ] as never);
    const entries = await entriesService.list(USER_ID);
    const entry = entries[0]!;
    expect(entry.insurance).toEqual({
      id: "ins1",
      insuranceType: "MEDICAL",
      insurer: "國泰人壽",
      insuredName: "本人",
    });
    expect(prisma.entry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          insurance: {
            select: { id: true, insuranceType: true, insurer: true, insuredName: true },
          },
        }),
      })
    );
  });
});

describe("EntriesService.findById", () => {
  beforeEach(() => vi.clearAllMocks());
  it("uses findFirst with userId", async () => {
    vi.mocked(prisma.entry.findFirst).mockResolvedValue(null);
    await entriesService.findById("entry-1", USER_ID);
    expect(prisma.entry.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "entry-1", userId: USER_ID } })
    );
  });
});

describe("EntriesService.findByIdWithHistory", () => {
  beforeEach(() => vi.clearAllMocks());

  it("scopes the lookup by userId", async () => {
    vi.mocked(prisma.entry.findFirst).mockResolvedValue(null);
    expect(await entriesService.findByIdWithHistory("entry-1", USER_ID)).toBeNull();
    expect(prisma.entry.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "entry-1", userId: USER_ID } })
    );
  });

  it("returns entry and newest-first history in a single query", async () => {
    vi.mocked(prisma.entry.findFirst).mockResolvedValue({
      id: "entry-1",
      userId: USER_ID,
      value: 500,
      history: [
        { id: "h1", entryId: "entry-1", delta: 500, balance: 500, units: null, note: null },
      ],
    } as never);

    const result = await entriesService.findByIdWithHistory("entry-1", USER_ID);

    expect(result?.entry.value).toBe(500);
    expect(result?.history).toHaveLength(1);
    // `history` must not leak onto the entry object the route reads `value`/`createdAt` from.
    expect(result?.entry).not.toHaveProperty("history");
    expect(prisma.entry.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        include: { history: { orderBy: { createdAt: "desc" } } },
      })
    );
    // The whole point of this method: one round trip, not findById + listHistory.
    expect(prisma.entryHistory.findMany).not.toHaveBeenCalled();
  });
});

describe("EntriesService.create", () => {
  beforeEach(() => vi.clearAllMocks());
  it("stores userId on the entry", async () => {
    const fakeEntry = {
      id: "e1",
      name: "Test",
      topCategory: "資產",
      subCategory: "現金",
      stockCode: null,
      value: { toNumber: () => 100 },
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: USER_ID,
    };
    vi.mocked(prisma.entry.create).mockResolvedValue(fakeEntry as never);
    vi.mocked(prisma.entryHistory.create).mockResolvedValue({} as never);
    await entriesService.create(
      { name: "Test", topCategory: "資產", subCategory: "現金", value: 100 },
      USER_ID
    );
    expect(prisma.entry.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: USER_ID }) })
    );
  });
});

describe("EntriesService.delete", () => {
  beforeEach(() => vi.clearAllMocks());
  it("uses deleteMany with userId", async () => {
    vi.mocked(prisma.entry.deleteMany).mockResolvedValue({ count: 1 });
    await entriesService.delete("entry-1", USER_ID);
    expect(prisma.entry.deleteMany).toHaveBeenCalledWith({
      where: { id: "entry-1", userId: USER_ID },
    });
  });
});

describe("EntriesService.transfer", () => {
  beforeEach(() => vi.clearAllMocks());

  function mockEntries(from: Record<string, unknown>, to: Record<string, unknown>) {
    txMock.entry.findFirst.mockImplementation(async ({ where }: { where: { id: string } }) =>
      where.id === "from-1" ? from : where.id === "to-1" ? to : null
    );
    txMock.entry.update.mockImplementation(
      async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => ({
        ...(where.id === "from-1" ? from : to),
        ...data,
      })
    );
  }

  const CASH_FROM = {
    id: "from-1",
    userId: USER_ID,
    name: "現金",
    topCategory: "流動資金",
    value: 1000,
  };
  const CASH_TO = {
    id: "to-1",
    userId: USER_ID,
    name: "另一帳戶",
    topCategory: "流動資金",
    value: 200,
  };

  it("debits the source and credits the target by the same amount", async () => {
    mockEntries(CASH_FROM, CASH_TO);

    const result = await entriesService.transfer(
      { fromEntryId: "from-1", toEntryId: "to-1", amount: 300 },
      USER_ID
    );

    expect(result.from.value).toBe(700);
    expect(result.to.value).toBe(500);
    expect(txMock.entryHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ entryId: "from-1", delta: -300 }) })
    );
    expect(txMock.entryHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ entryId: "to-1", delta: 300 }) })
    );
  });

  it("debits amount + fee from the source while the target only gets amount", async () => {
    mockEntries(CASH_FROM, CASH_TO);

    const result = await entriesService.transfer(
      { fromEntryId: "from-1", toEntryId: "to-1", amount: 300, fee: 15 },
      USER_ID
    );

    expect(result.from.value).toBe(685);
    expect(result.to.value).toBe(500);
    expect(txMock.entryHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ entryId: "from-1", delta: -315 }) })
    );
  });

  it("throws InsufficientBalanceError when amount + fee would push the source negative", async () => {
    mockEntries(CASH_FROM, CASH_TO);

    await expect(
      entriesService.transfer(
        { fromEntryId: "from-1", toEntryId: "to-1", amount: 990, fee: 20 },
        USER_ID
      )
    ).rejects.toBeInstanceOf(InsufficientBalanceError);
    expect(txMock.entryHistory.create).not.toHaveBeenCalled();
  });

  it("throws EntryNotFoundError when either entry is missing or not owned by the user", async () => {
    mockEntries(CASH_FROM, CASH_TO);

    await expect(
      entriesService.transfer({ fromEntryId: "missing", toEntryId: "to-1", amount: 100 }, USER_ID)
    ).rejects.toBeInstanceOf(EntryNotFoundError);
  });

  it("throws InvalidTransferError when either entry is outside the transferable categories", async () => {
    mockEntries(CASH_FROM, { ...CASH_TO, topCategory: "投資" });

    await expect(
      entriesService.transfer({ fromEntryId: "from-1", toEntryId: "to-1", amount: 100 }, USER_ID)
    ).rejects.toBeInstanceOf(InvalidTransferError);
  });
});

describe("EntriesService.verifyHistoryOwnership", () => {
  beforeEach(() => vi.clearAllMocks());
  it("returns true when history record belongs to user", async () => {
    vi.mocked(prisma.entryHistory.findFirst).mockResolvedValue({ id: "h1" } as never);
    const result = await entriesService.verifyHistoryOwnership("h1", USER_ID);
    expect(result).toBe(true);
    expect(prisma.entryHistory.findFirst).toHaveBeenCalledWith({
      where: { id: "h1", entry: { userId: USER_ID } },
    });
  });
  it("returns false when record not found", async () => {
    vi.mocked(prisma.entryHistory.findFirst).mockResolvedValue(null);
    const result = await entriesService.verifyHistoryOwnership("h1", USER_ID);
    expect(result).toBe(false);
  });
});

describe("EntriesService.create — bankCode", () => {
  beforeEach(() => vi.clearAllMocks());

  it("passes bankCode to prisma when provided", async () => {
    const fakeEntry = {
      id: "e1",
      name: "Test",
      topCategory: "銀行",
      subCategory: "金融卡",
      stockCode: null,
      bankCode: "ctbc",
      value: { toNumber: () => 5000 },
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: USER_ID,
    };
    vi.mocked(prisma.entry.create).mockResolvedValue(fakeEntry as never);
    vi.mocked(prisma.entryHistory.create).mockResolvedValue({} as never);

    await entriesService.create(
      {
        name: "Test",
        topCategory: "銀行",
        subCategory: "金融卡",
        value: 5000,
        bankCode: "ctbc",
      },
      USER_ID
    );

    expect(prisma.entry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ bankCode: "ctbc" }),
      })
    );
  });

  it("sets bankCode to null when not provided", async () => {
    const fakeEntry = {
      id: "e2",
      name: "Test",
      topCategory: "銀行",
      subCategory: "金融卡",
      stockCode: null,
      bankCode: null,
      value: { toNumber: () => 5000 },
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: USER_ID,
    };
    vi.mocked(prisma.entry.create).mockResolvedValue(fakeEntry as never);
    vi.mocked(prisma.entryHistory.create).mockResolvedValue({} as never);

    await entriesService.create(
      { name: "Test", topCategory: "銀行", subCategory: "金融卡", value: 5000 },
      USER_ID
    );

    expect(prisma.entry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ bankCode: null }),
      })
    );
  });
});

describe("EntriesService.create limit guard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("throws EntryLimitError when a non-premium user is at the limit", async () => {
    vi.mocked(entitlementsService.isPremium).mockResolvedValue(false);
    vi.mocked(prisma.entry.count).mockResolvedValue(FREE_ENTRY_LIMIT);
    await expect(entriesService.create(VALID_ENTRY, USER_ID)).rejects.toBeInstanceOf(
      EntryLimitError
    );
    expect(prisma.entry.create).not.toHaveBeenCalled();
  });

  it("allows a non-premium user below the limit", async () => {
    vi.mocked(entitlementsService.isPremium).mockResolvedValue(false);
    vi.mocked(prisma.entry.count).mockResolvedValue(FREE_ENTRY_LIMIT - 1);
    vi.mocked(prisma.entry.create).mockResolvedValue({ id: "e1", value: 1000 } as never);
    vi.mocked(prisma.entryHistory.create).mockResolvedValue({} as never);
    await entriesService.create(VALID_ENTRY, USER_ID);
    expect(prisma.entry.create).toHaveBeenCalled();
  });

  it("allows a premium user regardless of count (never even counts)", async () => {
    vi.mocked(entitlementsService.isPremium).mockResolvedValue(true);
    vi.mocked(prisma.entry.create).mockResolvedValue({ id: "e1", value: 1000 } as never);
    vi.mocked(prisma.entryHistory.create).mockResolvedValue({} as never);
    await entriesService.create(VALID_ENTRY, USER_ID);
    expect(prisma.entry.count).not.toHaveBeenCalled();
    expect(prisma.entry.create).toHaveBeenCalled();
  });
});

describe("EntriesService.getAssetAllocation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("computes each top category's percentage of total assets", async () => {
    vi.mocked(prisma.entry.findMany).mockResolvedValue([
      { topCategory: "投資", value: 600, includeInChart: true },
      { topCategory: "流動資金", value: 400, includeInChart: true },
    ] as never);

    const result = await entriesService.getAssetAllocation(USER_ID);

    expect(result.breakdown).toEqual([
      { topCategory: "投資", value: 600, percentage: 60 },
      { topCategory: "流動資金", value: 400, percentage: 40 },
    ]);
  });

  it("flags entries at or above 40% of total assets as concentration warnings", async () => {
    vi.mocked(prisma.entry.findMany).mockResolvedValue([
      { id: "e1", name: "台積電", topCategory: "投資", value: 500, includeInChart: true },
      { id: "e2", name: "現金", topCategory: "流動資金", value: 500, includeInChart: true },
    ] as never);

    const result = await entriesService.getAssetAllocation(USER_ID);

    expect(result.concentrationWarnings).toEqual([
      { entryId: "e1", name: "台積電", percentage: 50 },
      { entryId: "e2", name: "現金", percentage: 50 },
    ]);
  });

  it("does not flag entries below the 40% threshold", async () => {
    vi.mocked(prisma.entry.findMany).mockResolvedValue([
      { id: "e1", name: "台積電", topCategory: "投資", value: 300, includeInChart: true },
      { id: "e2", name: "現金", topCategory: "流動資金", value: 700, includeInChart: true },
    ] as never);

    const result = await entriesService.getAssetAllocation(USER_ID);

    expect(result.concentrationWarnings).toEqual([{ entryId: "e2", name: "現金", percentage: 70 }]);
  });

  it("excludes entries with includeInChart=false from the breakdown and totals", async () => {
    vi.mocked(prisma.entry.findMany).mockResolvedValue([
      { id: "e1", name: "現金", topCategory: "流動資金", value: 1000, includeInChart: true },
    ] as never);

    await entriesService.getAssetAllocation(USER_ID);

    expect(prisma.entry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: USER_ID, includeInChart: true } })
    );
  });

  it("excludes liability categories from the breakdown and computes debtToAssetRatio", async () => {
    vi.mocked(prisma.entry.findMany).mockResolvedValue([
      { id: "e1", name: "現金", topCategory: "流動資金", value: 800, includeInChart: true },
      { id: "e2", name: "信用卡", topCategory: "負債", value: 200, includeInChart: true },
    ] as never);

    const result = await entriesService.getAssetAllocation(USER_ID);

    expect(result.breakdown).toEqual([{ topCategory: "流動資金", value: 800, percentage: 100 }]);
    expect(result.debtToAssetRatio).toBe(25);
  });

  it("returns a null debtToAssetRatio and empty breakdown when there are no assets", async () => {
    vi.mocked(prisma.entry.findMany).mockResolvedValue([]);

    const result = await entriesService.getAssetAllocation(USER_ID);

    expect(result.breakdown).toEqual([]);
    expect(result.concentrationWarnings).toEqual([]);
    expect(result.debtToAssetRatio).toBeNull();
  });
});

describe("EntriesService.getNetWorthHistory", () => {
  // Buckets are derived from "now", so the clock has to be pinned for the
  // period labels and boundaries to be assertable at all.
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-11T00:00:00.000Z"));
  });
  afterEach(() => vi.useRealTimers());

  function mockEntries(entries: { id: string; topCategory: string }[]) {
    vi.mocked(prisma.entry.findMany).mockResolvedValue(entries as never);
  }
  function mockHistory(rows: { entryId: string; balance: number; createdAt: string }[]) {
    vi.mocked(prisma.entryHistory.findMany).mockResolvedValue(
      rows.map((r) => ({ ...r, createdAt: new Date(r.createdAt) })) as never
    );
  }

  it("only reads entries that are included in the chart", async () => {
    mockEntries([]);

    await entriesService.getNetWorthHistory(USER_ID, "6m");

    expect(prisma.entry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: USER_ID, includeInChart: true } })
    );
  });

  it("carries the last known balance of each period forward", async () => {
    mockEntries([{ id: "e1", topCategory: "流動資金" }]);
    mockHistory([
      { entryId: "e1", balance: 100, createdAt: "2026-06-05T00:00:00.000Z" },
      { entryId: "e1", balance: 150, createdAt: "2026-06-20T00:00:00.000Z" },
      { entryId: "e1", balance: 300, createdAt: "2026-08-01T00:00:00.000Z" },
    ]);

    const { points } = await entriesService.getNetWorthHistory(USER_ID, "6m");

    expect(points).toHaveLength(6);
    expect(points.map((p) => p.netWorth)).toEqual([0, 0, 0, 150, 150, 300]);
    expect(points.map((p) => p.period)).toEqual(["Mar", "Apr", "May", "Jun", "Jul", "Aug"]);
  });

  it("leaves an entry out of periods that predate its first history row", async () => {
    mockEntries([
      { id: "e1", topCategory: "流動資金" },
      { id: "e2", topCategory: "流動資金" },
    ]);
    mockHistory([
      { entryId: "e1", balance: 100, createdAt: "2026-03-01T00:00:00.000Z" },
      { entryId: "e2", balance: 500, createdAt: "2026-07-01T00:00:00.000Z" },
    ]);

    const { points } = await entriesService.getNetWorthHistory(USER_ID, "6m");

    expect(points.map((p) => p.totalAssets)).toEqual([100, 100, 100, 100, 600, 600]);
  });

  it("subtracts liability categories from net worth", async () => {
    mockEntries([
      { id: "e1", topCategory: "流動資金" },
      { id: "e2", topCategory: "負債" },
    ]);
    mockHistory([
      { entryId: "e1", balance: 1000, createdAt: "2026-03-01T00:00:00.000Z" },
      { entryId: "e2", balance: 400, createdAt: "2026-03-01T00:00:00.000Z" },
    ]);

    const { points } = await entriesService.getNetWorthHistory(USER_ID, "6m");
    const latest = points[points.length - 1]!;

    expect(latest.totalAssets).toBe(1000);
    expect(latest.totalLiabilities).toBe(400);
    expect(latest.netWorth).toBe(600);
  });

  it("returns no points when the user has no history at all", async () => {
    mockEntries([{ id: "e1", topCategory: "流動資金" }]);
    mockHistory([]);

    const result = await entriesService.getNetWorthHistory(USER_ID, "6m");

    expect(result).toEqual({ range: "6m", points: [] });
    expect(prisma.entryHistory.findMany).toHaveBeenCalled();
  });

  it("returns no points, and never queries history, when no entry is charted", async () => {
    mockEntries([]);

    const result = await entriesService.getNetWorthHistory(USER_ID, "6m");

    expect(result).toEqual({ range: "6m", points: [] });
    expect(prisma.entryHistory.findMany).not.toHaveBeenCalled();
  });

  it("spans twelve months for the 1y range", async () => {
    mockEntries([{ id: "e1", topCategory: "流動資金" }]);
    mockHistory([{ entryId: "e1", balance: 100, createdAt: "2025-01-01T00:00:00.000Z" }]);

    const { points } = await entriesService.getNetWorthHistory(USER_ID, "1y");

    expect(points).toHaveLength(12);
    expect(points[0]!.period).toBe("Sep");
    expect(points[11]!.period).toBe("Aug");
  });

  it("starts the all range at the first history row, by month", async () => {
    mockEntries([{ id: "e1", topCategory: "流動資金" }]);
    mockHistory([{ entryId: "e1", balance: 100, createdAt: "2026-05-09T00:00:00.000Z" }]);

    const { points } = await entriesService.getNetWorthHistory(USER_ID, "all");

    expect(points.map((p) => p.period)).toEqual(["May", "Jun", "Jul", "Aug"]);
  });

  it("switches the all range to yearly buckets once it spans over two years", async () => {
    mockEntries([{ id: "e1", topCategory: "流動資金" }]);
    mockHistory([
      { entryId: "e1", balance: 100, createdAt: "2023-05-09T00:00:00.000Z" },
      { entryId: "e1", balance: 250, createdAt: "2025-02-01T00:00:00.000Z" },
    ]);

    const { points } = await entriesService.getNetWorthHistory(USER_ID, "all");

    expect(points.map((p) => p.period)).toEqual(["2023", "2024", "2025", "2026"]);
    expect(points.map((p) => p.netWorth)).toEqual([100, 100, 250, 250]);
  });

  it("clamps the last point's date to now rather than the end of the period", async () => {
    mockEntries([{ id: "e1", topCategory: "流動資金" }]);
    mockHistory([{ entryId: "e1", balance: 100, createdAt: "2026-03-01T00:00:00.000Z" }]);

    const { points } = await entriesService.getNetWorthHistory(USER_ID, "6m");

    expect(points[points.length - 1]!.date).toBe("2026-08-11T00:00:00.000Z");
    expect(points[0]!.date).toBe("2026-04-01T00:00:00.000Z");
  });
});
