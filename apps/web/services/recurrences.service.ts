import { prisma } from "@/lib/prisma";
import { d } from "@/lib/serialize";
import type { CreateRecurrence, UpdateRecurrence } from "@repo/shared";

type RecurrenceFreq = "MONTHLY" | "WEEKLY" | "BIWEEKLY" | "YEARLY";

function serializeRecurrence(r: {
  id: string;
  entryId: string;
  userId: string;
  type: string;
  amount: import("@prisma/client").Prisma.Decimal;
  category: string;
  source: string;
  note: string | null;
  frequency: RecurrenceFreq;
  dayOfMonth: number | null;
  dayOfWeek: number | null;
  monthOfYear: number | null;
  startDate: Date;
  nextRunAt: Date;
  lastRunAt: Date | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: r.id,
    entryId: r.entryId,
    type: r.type,
    amount: d(r.amount),
    category: r.category,
    source: r.source,
    note: r.note,
    frequency: r.frequency,
    dayOfMonth: r.dayOfMonth,
    dayOfWeek: r.dayOfWeek,
    monthOfYear: r.monthOfYear,
    startDate: r.startDate.toISOString(),
    nextRunAt: r.nextRunAt.toISOString(),
    lastRunAt: r.lastRunAt?.toISOString() ?? null,
    active: r.active,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

function computeInitialNextRunAt(
  frequency: RecurrenceFreq,
  startDate: Date,
  dayOfMonth?: number | null,
  dayOfWeek?: number | null,
  monthOfYear?: number | null
): Date {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);

  switch (frequency) {
    case "MONTHLY": {
      const dom = dayOfMonth ?? 1;
      const candidate = new Date(start.getFullYear(), start.getMonth(), dom);
      if (candidate < start) candidate.setMonth(candidate.getMonth() + 1);
      const lastDay = new Date(candidate.getFullYear(), candidate.getMonth() + 1, 0).getDate();
      candidate.setDate(Math.min(dom, lastDay));
      return candidate;
    }
    case "WEEKLY": {
      const dow = dayOfWeek ?? 0;
      const candidate = new Date(start);
      const diff = (dow - candidate.getDay() + 7) % 7;
      candidate.setDate(candidate.getDate() + diff);
      return candidate;
    }
    case "BIWEEKLY": {
      const dow = dayOfWeek ?? 0;
      const candidate = new Date(start);
      const diff = (dow - candidate.getDay() + 7) % 7;
      candidate.setDate(candidate.getDate() + diff);
      return candidate;
    }
    case "YEARLY": {
      const m = (monthOfYear ?? 1) - 1;
      const dom2 = dayOfMonth ?? 1;
      const candidate = new Date(start.getFullYear(), m, dom2);
      if (candidate < start) candidate.setFullYear(candidate.getFullYear() + 1);
      return candidate;
    }
  }
}

export function computeNextRunAt(
  frequency: RecurrenceFreq,
  from: Date,
  dayOfMonth?: number | null,
  monthOfYear?: number | null
): Date {
  const next = new Date(from);
  switch (frequency) {
    case "MONTHLY": {
      next.setMonth(next.getMonth() + 1);
      if (dayOfMonth) {
        const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
        next.setDate(Math.min(dayOfMonth, lastDay));
      }
      break;
    }
    case "WEEKLY":
      next.setDate(next.getDate() + 7);
      break;
    case "BIWEEKLY":
      next.setDate(next.getDate() + 14);
      break;
    case "YEARLY": {
      next.setFullYear(next.getFullYear() + 1);
      if (monthOfYear && dayOfMonth) {
        next.setMonth(monthOfYear - 1);
        const lastDay = new Date(next.getFullYear(), monthOfYear, 0).getDate();
        next.setDate(Math.min(dayOfMonth, lastDay));
      }
      break;
    }
  }
  return next;
}

export class RecurrencesService {
  async list(userId: string, entryId?: string) {
    const rows = await prisma.recurrence.findMany({
      where: { userId, ...(entryId ? { entryId } : {}) },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(serializeRecurrence);
  }

  async create(data: CreateRecurrence, userId: string) {
    const entry = await prisma.entry.findFirst({
      where: { id: data.entryId, userId },
    });
    if (!entry) return null;

    const startDate = new Date(data.startDate);
    const nextRunAt = computeInitialNextRunAt(
      data.frequency as RecurrenceFreq,
      startDate,
      data.dayOfMonth,
      data.dayOfWeek,
      data.monthOfYear
    );
    const row = await prisma.recurrence.create({
      data: {
        userId,
        entryId: data.entryId,
        type: data.type,
        amount: data.amount,
        category: data.category,
        source: data.source ?? "daily",
        note: data.note ?? null,
        frequency: data.frequency as RecurrenceFreq,
        dayOfMonth: data.dayOfMonth ?? null,
        dayOfWeek: data.dayOfWeek ?? null,
        monthOfYear: data.monthOfYear ?? null,
        startDate,
        nextRunAt,
      },
    });
    return serializeRecurrence(row);
  }

  async update(id: string, data: UpdateRecurrence, userId: string) {
    const existing = await prisma.recurrence.findFirst({ where: { id, userId } });
    if (!existing) return null;

    const needsRecompute =
      data.frequency !== undefined ||
      data.dayOfMonth !== undefined ||
      data.dayOfWeek !== undefined ||
      data.monthOfYear !== undefined ||
      data.startDate !== undefined;

    const freq = (data.frequency ?? existing.frequency) as RecurrenceFreq;
    const dom = data.dayOfMonth !== undefined ? data.dayOfMonth : existing.dayOfMonth;
    const dow = data.dayOfWeek !== undefined ? data.dayOfWeek : existing.dayOfWeek;
    const moy = data.monthOfYear !== undefined ? data.monthOfYear : existing.monthOfYear;
    const startDate = data.startDate ? new Date(data.startDate) : existing.startDate;

    const nextRunAt = needsRecompute
      ? computeInitialNextRunAt(freq, startDate, dom, dow, moy)
      : existing.nextRunAt;

    const row = await prisma.recurrence.update({
      where: { id },
      data: {
        ...(data.type !== undefined ? { type: data.type } : {}),
        ...(data.amount !== undefined ? { amount: data.amount } : {}),
        ...(data.category !== undefined ? { category: data.category } : {}),
        ...(data.source !== undefined ? { source: data.source } : {}),
        ...(data.note !== undefined ? { note: data.note } : {}),
        ...(data.frequency !== undefined ? { frequency: data.frequency as RecurrenceFreq } : {}),
        ...(data.dayOfMonth !== undefined ? { dayOfMonth: data.dayOfMonth } : {}),
        ...(data.dayOfWeek !== undefined ? { dayOfWeek: data.dayOfWeek } : {}),
        ...(data.monthOfYear !== undefined ? { monthOfYear: data.monthOfYear } : {}),
        ...(data.startDate !== undefined ? { startDate } : {}),
        nextRunAt,
      },
    });
    return serializeRecurrence(row);
  }

  async delete(id: string, userId: string) {
    return prisma.recurrence.deleteMany({ where: { id, userId } });
  }

  async process(userId: string): Promise<number> {
    const now = new Date();
    const pending = await prisma.recurrence.findMany({
      where: { userId, active: true, nextRunAt: { lte: now } },
    });

    let created = 0;
    for (const rec of pending) {
      let nextRun = new Date(rec.nextRunAt);
      const freq = rec.frequency as RecurrenceFreq;
      let safetyLimit = 0;

      while (nextRun <= now && safetyLimit < 366) {
        safetyLimit++;
        await prisma.transaction.create({
          data: {
            userId,
            type: rec.type,
            amount: rec.amount,
            category: rec.category,
            source: rec.source,
            note: rec.note,
            date: nextRun,
          },
        });
        created++;
        nextRun = computeNextRunAt(freq, nextRun, rec.dayOfMonth, rec.monthOfYear);
      }

      await prisma.recurrence.update({
        where: { id: rec.id },
        data: { nextRunAt: nextRun, lastRunAt: now },
      });
    }

    return created;
  }

  async findById(id: string, userId: string) {
    const row = await prisma.recurrence.findFirst({ where: { id, userId } });
    return row ? serializeRecurrence(row) : null;
  }
}

export const recurrencesService = new RecurrencesService();
