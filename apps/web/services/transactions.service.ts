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
  userId: string;
}) {
  return { ...tx, amount: d(tx.amount) };
}

export class TransactionsService {
  async list(userId: string, month?: string) {
    let where: Record<string, unknown> = { userId };
    if (month) {
      const [year, m] = month.split("-").map(Number);
      if (year && m) {
        const start = new Date(year, m - 1, 1);
        const end = new Date(year, m, 1);
        where = { userId, date: { gte: start, lt: end } };
      }
    }
    const rows = await prisma.transaction.findMany({ where, orderBy: { date: "desc" } });
    return rows.map(serializeTransaction);
  }

  async create(data: CreateTransaction, userId: string) {
    const { date, note, ...rest } = data;
    const row = await prisma.transaction.create({
      data: { ...rest, date: new Date(date), note: note ?? null, userId },
    });
    return serializeTransaction(row);
  }

  async delete(id: string, userId: string) {
    return prisma.transaction.deleteMany({ where: { id, userId } });
  }
}

export const transactionsService = new TransactionsService();
