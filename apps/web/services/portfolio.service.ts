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
}) {
  return { ...item, avgCost: d(item.avgCost), shares: d(item.shares) };
}

export class PortfolioService {
  async list() {
    const rows = await prisma.portfolioItem.findMany({ orderBy: { createdAt: "desc" } });
    return rows.map(serializeItem);
  }

  async findById(id: string) {
    const item = await prisma.portfolioItem.findUnique({ where: { id } });
    return item ? serializeItem(item) : null;
  }

  async create(data: CreatePortfolioItem) {
    const item = await prisma.portfolioItem.create({ data });
    return serializeItem(item);
  }

  async update(id: string, data: UpdatePortfolioItem) {
    const cleaned = Object.fromEntries(
      Object.entries(data).filter(([, v]) => v !== undefined)
    ) as Parameters<typeof prisma.portfolioItem.update>[0]["data"];
    const item = await prisma.portfolioItem.update({ where: { id }, data: cleaned });
    return serializeItem(item);
  }

  async delete(id: string) {
    return prisma.portfolioItem.delete({ where: { id } });
  }
}

export const portfolioService = new PortfolioService();
