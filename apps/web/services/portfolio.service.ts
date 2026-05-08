import { prisma } from "@/lib/prisma";
import { d } from "@/lib/serialize";
import type { CreatePortfolioItem, UpdatePortfolioItem } from "@repo/shared";

function serializeItem(item: {
  id: string;
  symbol: string;
  name: string;
  avgCost: import("@prisma/client").Prisma.Decimal;
  shares: import("@prisma/client").Prisma.Decimal;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
}) {
  return { ...item, avgCost: d(item.avgCost), shares: d(item.shares) };
}

export class PortfolioService {
  async list(userId: string) {
    const rows = await prisma.portfolioItem.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(serializeItem);
  }

  async findById(id: string, userId: string) {
    const item = await prisma.portfolioItem.findFirst({ where: { id, userId } });
    return item ? serializeItem(item) : null;
  }

  async create(data: CreatePortfolioItem, userId: string) {
    const item = await prisma.portfolioItem.create({ data: { ...data, userId } });
    return serializeItem(item);
  }

  async update(id: string, data: UpdatePortfolioItem, userId: string) {
    const existing = await prisma.portfolioItem.findFirst({ where: { id, userId } });
    if (!existing) return null;
    const cleaned = Object.fromEntries(
      Object.entries(data).filter(([, v]) => v !== undefined)
    ) as Parameters<typeof prisma.portfolioItem.update>[0]["data"];
    const item = await prisma.portfolioItem.update({ where: { id }, data: cleaned });
    return serializeItem(item);
  }

  async delete(id: string, userId: string) {
    return prisma.portfolioItem.deleteMany({ where: { id, userId } });
  }
}

export const portfolioService = new PortfolioService();
