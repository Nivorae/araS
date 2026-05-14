import { prisma } from "@/lib/prisma";
import { d, dn } from "@/lib/serialize";
import type { CreateEntry, UpdateEntry, UpdateEntryHistory } from "@repo/shared";

function serializeHistory(h: {
  id: string;
  entryId: string;
  delta: import("@prisma/client").Prisma.Decimal;
  balance: import("@prisma/client").Prisma.Decimal;
  units: import("@prisma/client").Prisma.Decimal | null;
  note: string | null;
  createdAt: Date;
}) {
  return { ...h, delta: d(h.delta), balance: d(h.balance), units: dn(h.units) };
}

function serializeLoan(loan: {
  id: string;
  entryId: string;
  loanName: string;
  totalAmount: import("@prisma/client").Prisma.Decimal;
  annualInterestRate: import("@prisma/client").Prisma.Decimal;
  termMonths: number;
  startDate: Date;
  gracePeriodMonths: number;
  repaymentType: string;
  overrideTermMonths: number | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...loan,
    totalAmount: d(loan.totalAmount),
    annualInterestRate: d(loan.annualInterestRate),
  };
}

export class EntriesService {
  async list(userId: string) {
    const entries = await prisma.entry.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { loan: true, history: { select: { units: true } } },
    });
    return entries.map(({ history, loan, ...e }) => ({
      ...e,
      value: d(e.value),
      loan: loan ? serializeLoan(loan) : null,
      units: history.some((h) => h.units != null)
        ? history.reduce((s, h) => s + (h.units ? d(h.units) : 0), 0)
        : null,
    }));
  }

  async findById(id: string, userId: string) {
    const entry = await prisma.entry.findFirst({
      where: { id, userId },
      include: { loan: true },
    });
    if (!entry) return null;
    const { loan, ...rest } = entry;
    return { ...rest, value: d(rest.value), loan: loan ? serializeLoan(loan) : null };
  }

  async create(data: CreateEntry, userId: string) {
    const { units, stockCode, bankCode, createdAt, ...rest } = data;
    const timestamp = createdAt ? new Date(createdAt) : undefined;

    const entry = await prisma.entry.create({
      data: {
        ...rest,
        userId,
        stockCode: stockCode ?? null,
        bankCode: bankCode ?? null,
        ...(timestamp !== undefined ? { createdAt: timestamp } : {}),
      },
    });

    await prisma.entryHistory.create({
      data: {
        entryId: entry.id,
        delta: entry.value,
        balance: entry.value,
        units: units ?? null,
        ...(timestamp !== undefined ? { createdAt: timestamp } : {}),
      },
    });

    return { ...entry, value: d(entry.value) };
  }

  async update(id: string, data: UpdateEntry, userId: string) {
    const existing = await prisma.entry.findFirst({ where: { id, userId } });
    if (!existing) return null;
    const { units, ...updateData } = data;
    const cleaned = Object.fromEntries(
      Object.entries(updateData).filter(([, v]) => v !== undefined)
    ) as Parameters<typeof prisma.entry.update>[0]["data"];
    const entry = await prisma.entry.update({ where: { id }, data: cleaned });
    if (data.value !== undefined && existing) {
      const delta = d(entry.value) - d(existing.value);
      await prisma.entryHistory.create({
        data: { entryId: id, delta, balance: d(entry.value), units: units ?? null },
      });
    }
    return { ...entry, value: d(entry.value) };
  }

  async delete(id: string, userId: string) {
    return prisma.entry.deleteMany({ where: { id, userId } });
  }

  async listHistory(id: string) {
    const rows = await prisma.entryHistory.findMany({
      where: { entryId: id },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(serializeHistory);
  }

  async updateHistory(historyId: string, data: UpdateEntryHistory) {
    const existing = await prisma.entryHistory.findUniqueOrThrow({ where: { id: historyId } });

    const existingDelta = d(existing.delta);
    const existingBalance = d(existing.balance);
    const newDelta = data.delta ?? existingDelta;
    const deltaDiff = newDelta - existingDelta;

    await prisma.entryHistory.update({
      where: { id: historyId },
      data: {
        note: data.note !== undefined ? data.note : existing.note,
        createdAt: data.createdAt !== undefined ? new Date(data.createdAt) : existing.createdAt,
        units: data.units !== undefined ? data.units : dn(existing.units),
        delta: newDelta,
        balance: existingBalance + deltaDiff,
      },
    });

    if (deltaDiff !== 0) {
      await prisma.entryHistory.updateMany({
        where: { entryId: existing.entryId, createdAt: { gt: existing.createdAt } },
        data: { balance: { increment: deltaDiff } },
      });

      const last = await prisma.entryHistory.findFirst({
        where: { entryId: existing.entryId },
        orderBy: { createdAt: "desc" },
      });
      if (last) {
        await prisma.entry.update({
          where: { id: existing.entryId },
          data: { value: d(last.balance) },
        });
      }
    }

    const updated = await prisma.entryHistory.findUniqueOrThrow({ where: { id: historyId } });
    return serializeHistory(updated);
  }

  async deleteHistory(historyId: string) {
    const existing = await prisma.entryHistory.findUniqueOrThrow({ where: { id: historyId } });
    const existingDelta = d(existing.delta);

    await prisma.entryHistory.delete({ where: { id: historyId } });

    await prisma.entryHistory.updateMany({
      where: { entryId: existing.entryId, createdAt: { gt: existing.createdAt } },
      data: { balance: { increment: -existingDelta } },
    });

    const last = await prisma.entryHistory.findFirst({
      where: { entryId: existing.entryId },
      orderBy: { createdAt: "desc" },
    });
    await prisma.entry.update({
      where: { id: existing.entryId },
      data: { value: last ? d(last.balance) : 0 },
    });
  }

  async createHistory(
    entryId: string,
    data: { delta: number; balance: number; units?: number | null; note?: string; createdAt?: Date }
  ) {
    const payload: Parameters<typeof prisma.entryHistory.create>[0]["data"] = {
      entryId,
      delta: data.delta,
      balance: data.balance,
      units: data.units ?? null,
      note: data.note ?? null,
    };
    if (data.createdAt) payload.createdAt = data.createdAt;
    const row = await prisma.entryHistory.create({ data: payload });
    return serializeHistory(row);
  }

  async verifyHistoryOwnership(historyId: string, userId: string): Promise<boolean> {
    const row = await prisma.entryHistory.findFirst({
      where: { id: historyId, entry: { userId } },
    });
    return row !== null;
  }
}

export const entriesService = new EntriesService();
