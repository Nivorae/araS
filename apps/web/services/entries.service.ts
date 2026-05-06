import { prisma } from "@/lib/prisma";
import type { CreateEntry, UpdateEntry, UpdateEntryHistory } from "@repo/shared";

export class EntriesService {
  async list() {
    const entries = await prisma.entry.findMany({
      orderBy: { createdAt: "desc" },
      include: { loan: true, history: { select: { units: true } } },
    });
    return entries.map(({ history, ...e }) => ({
      ...e,
      units: history.some((h) => h.units != null)
        ? history.reduce((s, h) => s + (h.units ?? 0), 0)
        : null,
    }));
  }

  async findById(id: string) {
    return prisma.entry.findUnique({
      where: { id },
      include: { loan: true },
    });
  }

  async create(data: CreateEntry) {
    const { units, stockCode, createdAt, ...rest } = data;
    const timestamp = createdAt ? new Date(createdAt) : undefined;

    const entry = await prisma.entry.create({
      data: {
        ...rest,
        stockCode: stockCode ?? null,
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

    return entry;
  }

  async update(id: string, data: UpdateEntry) {
    const existing = await prisma.entry.findUnique({ where: { id } });
    const { units, ...updateData } = data;
    const cleaned = Object.fromEntries(
      Object.entries(updateData).filter(([, v]) => v !== undefined)
    ) as Parameters<typeof prisma.entry.update>[0]["data"];
    const entry = await prisma.entry.update({ where: { id }, data: cleaned });
    if (data.value !== undefined && existing) {
      const delta = entry.value - existing.value;
      await prisma.entryHistory.create({
        data: { entryId: id, delta, balance: entry.value, units: units ?? null },
      });
    }
    return entry;
  }

  async delete(id: string) {
    return prisma.entry.delete({ where: { id } });
  }

  async listHistory(id: string) {
    return prisma.entryHistory.findMany({
      where: { entryId: id },
      orderBy: { createdAt: "desc" },
    });
  }

  async updateHistory(historyId: string, data: UpdateEntryHistory) {
    const existing = await prisma.entryHistory.findUniqueOrThrow({ where: { id: historyId } });

    const newDelta = data.delta ?? existing.delta;
    const deltaDiff = newDelta - existing.delta;

    await prisma.entryHistory.update({
      where: { id: historyId },
      data: {
        note: data.note !== undefined ? data.note : existing.note,
        createdAt: data.createdAt !== undefined ? new Date(data.createdAt) : existing.createdAt,
        units: data.units !== undefined ? data.units : existing.units,
        delta: newDelta,
        balance: existing.balance + deltaDiff,
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
          data: { value: last.balance },
        });
      }
    }

    return prisma.entryHistory.findUniqueOrThrow({ where: { id: historyId } });
  }

  async deleteHistory(historyId: string) {
    const existing = await prisma.entryHistory.findUniqueOrThrow({ where: { id: historyId } });

    await prisma.entryHistory.delete({ where: { id: historyId } });

    // Shift subsequent records' balance down by the deleted delta
    await prisma.entryHistory.updateMany({
      where: { entryId: existing.entryId, createdAt: { gt: existing.createdAt } },
      data: { balance: { increment: -existing.delta } },
    });

    const last = await prisma.entryHistory.findFirst({
      where: { entryId: existing.entryId },
      orderBy: { createdAt: "desc" },
    });
    await prisma.entry.update({
      where: { id: existing.entryId },
      data: { value: last?.balance ?? 0 },
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
    return prisma.entryHistory.create({ data: payload });
  }
}

export const entriesService = new EntriesService();
