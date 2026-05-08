import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    transaction: {
      findMany: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/serialize", () => ({ d: (v: unknown) => Number(v) }));

import { prisma } from "@/lib/prisma";
import { transactionsService } from "../../services/transactions.service";

const USER_ID = "user_test123";

describe("TransactionsService.list", () => {
  beforeEach(() => vi.clearAllMocks());
  it("filters by userId", async () => {
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([]);
    await transactionsService.list(USER_ID);
    expect(prisma.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: USER_ID }) })
    );
  });
  it("filters by userId and month", async () => {
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([]);
    await transactionsService.list(USER_ID, "2026-05");
    expect(prisma.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: USER_ID,
          date: expect.objectContaining({ gte: expect.any(Date) }),
        }),
      })
    );
  });
});

describe("TransactionsService.create", () => {
  beforeEach(() => vi.clearAllMocks());
  it("stores userId on the transaction", async () => {
    const fake = {
      id: "t1",
      type: "income",
      amount: { toNumber: () => 100 },
      category: "薪資",
      source: "公司",
      note: null,
      date: new Date(),
      createdAt: new Date(),
      userId: USER_ID,
    };
    vi.mocked(prisma.transaction.create).mockResolvedValue(fake as never);
    await transactionsService.create(
      {
        type: "income",
        amount: 100,
        category: "薪資",
        source: "daily",
        date: new Date().toISOString(),
      },
      USER_ID
    );
    expect(prisma.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: USER_ID }) })
    );
  });
});

describe("TransactionsService.delete", () => {
  beforeEach(() => vi.clearAllMocks());
  it("uses deleteMany with userId", async () => {
    vi.mocked(prisma.transaction.deleteMany).mockResolvedValue({ count: 1 });
    await transactionsService.delete("t1", USER_ID);
    expect(prisma.transaction.deleteMany).toHaveBeenCalledWith({
      where: { id: "t1", userId: USER_ID },
    });
  });
});
