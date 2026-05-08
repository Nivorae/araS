import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    entry: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
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

import { prisma } from "@/lib/prisma";
import { entriesService } from "../../services/entries.service";

const USER_ID = "user_test123";

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
