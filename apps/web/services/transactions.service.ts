import { prisma } from "@/lib/prisma";
import { d } from "@/lib/serialize";
import type { CreateTransaction } from "@repo/shared";

function serializeTransaction(tx: {
  id: string;
  type: string;
  amount: import("@prisma/client").Prisma.Decimal;
  category: string;
  source: string;
  note: string | null;
  date: Date;
  createdAt: Date;
}) {
  return { ...tx, amount: d(tx.amount) };
}

export class TransactionsService {
  async list(month?: string) {
    let where = {};
    if (month) {
      const [year, m] = month.split("-").map(Number);
      if (year && m) {
        const start = new Date(year, m - 1, 1);
        const end = new Date(year, m, 1);
        where = { date: { gte: start, lt: end } };
      }
    }
    const rows = await prisma.transaction.findMany({ where, orderBy: { date: "desc" } });
    return rows.map(serializeTransaction);
  }

  async create(data: CreateTransaction) {
    const { date, note, ...rest } = data;
    const row = await prisma.transaction.create({
      data: { ...rest, date: new Date(date), note: note ?? null },
    });
    return serializeTransaction(row);
  }

  async delete(id: string) {
    return prisma.transaction.delete({ where: { id } });
  }
}

export const transactionsService = new TransactionsService();
