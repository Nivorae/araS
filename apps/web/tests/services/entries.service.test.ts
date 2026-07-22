import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
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
import { EntryLimitError } from "../../services/entries.service";
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
