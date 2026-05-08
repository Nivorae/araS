import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    portfolioItem: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/serialize", () => ({ d: (v: unknown) => Number(v) }));

import { prisma } from "@/lib/prisma";
import { portfolioService } from "../../services/portfolio.service";

const USER_ID = "user_test123";

describe("PortfolioService.list", () => {
  beforeEach(() => vi.clearAllMocks());
  it("filters by userId", async () => {
    vi.mocked(prisma.portfolioItem.findMany).mockResolvedValue([]);
    await portfolioService.list(USER_ID);
    expect(prisma.portfolioItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: USER_ID } })
    );
  });
});

describe("PortfolioService.findById", () => {
  beforeEach(() => vi.clearAllMocks());
  it("uses findFirst with userId", async () => {
    vi.mocked(prisma.portfolioItem.findFirst).mockResolvedValue(null);
    await portfolioService.findById("p1", USER_ID);
    expect(prisma.portfolioItem.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "p1", userId: USER_ID } })
    );
  });
});

describe("PortfolioService.create", () => {
  beforeEach(() => vi.clearAllMocks());
  it("stores userId on the item", async () => {
    const fake = {
      id: "p1",
      symbol: "AAPL",
      name: "Apple",
      avgCost: { toNumber: () => 150 },
      shares: { toNumber: () => 10 },
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: USER_ID,
    };
    vi.mocked(prisma.portfolioItem.create).mockResolvedValue(fake as never);
    await portfolioService.create(
      { symbol: "AAPL", name: "Apple", avgCost: 150, shares: 10 },
      USER_ID
    );
    expect(prisma.portfolioItem.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: USER_ID }) })
    );
  });
});

describe("PortfolioService.delete", () => {
  beforeEach(() => vi.clearAllMocks());
  it("uses deleteMany with userId", async () => {
    vi.mocked(prisma.portfolioItem.deleteMany).mockResolvedValue({ count: 1 });
    await portfolioService.delete("p1", USER_ID);
    expect(prisma.portfolioItem.deleteMany).toHaveBeenCalledWith({
      where: { id: "p1", userId: USER_ID },
    });
  });
});
