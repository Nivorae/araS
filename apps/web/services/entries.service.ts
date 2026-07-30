import { prisma } from "@/lib/prisma";
import { d, dn } from "@/lib/serialize";
import type { CreateEntry, UpdateEntry, UpdateEntryHistory } from "@repo/shared";
import { entitlementsService } from "@/services/entitlements.service";
import { FREE_ENTRY_LIMIT, LIABILITY_TOP_CATEGORIES } from "@repo/shared";

const LIABILITY_SET = new Set(LIABILITY_TOP_CATEGORIES);

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

// Thrown by create() when a non-premium user is already at FREE_ENTRY_LIMIT.
// The route layer maps this to a 403 ENTRY_LIMIT_REACHED envelope.
export class EntryLimitError extends Error {
  constructor() {
    super("Free plan entry limit reached");
    this.name = "EntryLimitError";
  }
}

export class EntriesService {
  async list(userId: string) {
    const entries = await prisma.entry.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        loan: true,
        history: { select: { units: true } },
        insurance: { select: { id: true, insuranceType: true, insurer: true, insuredName: true } },
      },
    });
    return entries.map(({ history, loan, insurance, ...e }) => ({
      ...e,
      value: d(e.value),
      loan: loan ? serializeLoan(loan) : null,
      insurance: insurance ?? null,
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

  // Ownership check and history read in a single round trip — the entry screen
  // is latency-bound, so the saved query is the whole point. The `userId` in the
  // where-clause carries the same scoping guarantee as findById.
  //
  // The returned entry deliberately omits `loan` (unlike findById), because the
  // only caller reads `value`/`createdAt` and joining loan would waste the round
  // trip this exists to save. It is therefore NOT substitutable for findById.
  async findByIdWithHistory(id: string, userId: string) {
    const entry = await prisma.entry.findFirst({
      where: { id, userId },
      include: { history: { orderBy: { createdAt: "desc" } } },
    });
    if (!entry) return null;
    const { history, ...rest } = entry;
    return {
      entry: { ...rest, value: d(rest.value) },
      history: history.map(serializeHistory),
    };
  }

  async create(data: CreateEntry, userId: string) {
    // Server-side enforcement is the authoritative defence (client hints are
    // advisory). Premium users skip the count entirely.
    const premium = await entitlementsService.isPremium(userId);
    if (!premium) {
      const count = await prisma.entry.count({ where: { userId } });
      if (count >= FREE_ENTRY_LIMIT) throw new EntryLimitError();
    }

    const { units, stockCode, bankCode, createdAt, note, includeInChart, ...rest } = data;
    const timestamp = createdAt ? new Date(createdAt) : undefined;

    const entry = await prisma.entry.create({
      data: {
        ...rest,
        userId,
        stockCode: stockCode ?? null,
        bankCode: bankCode ?? null,
        note: note ?? null,
        ...(includeInChart !== undefined ? { includeInChart } : {}),
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
    // `createdAt` is not an entry-column edit here — it dates the appended
    // history line (e.g. back-dating an added record), so pull it out of the
    // entry update payload.
    const { units, createdAt, ...updateData } = data;
    const cleaned = Object.fromEntries(
      Object.entries(updateData).filter(([, v]) => v !== undefined)
    ) as Parameters<typeof prisma.entry.update>[0]["data"];
    const entry = await prisma.entry.update({ where: { id }, data: cleaned });
    if (data.value !== undefined && existing) {
      const delta = d(entry.value) - d(existing.value);
      await prisma.entryHistory.create({
        data: {
          entryId: id,
          delta,
          balance: d(entry.value),
          units: units ?? null,
          note: data.note ?? null,
          ...(createdAt ? { createdAt: new Date(createdAt) } : {}),
        },
      });
    }
    return { ...entry, value: d(entry.value) };
  }

  async delete(id: string, userId: string) {
    return prisma.entry.deleteMany({ where: { id, userId } });
  }

  // `userId` scopes the lookup through the parent Entry — EntryHistory carries no
  // userId column of its own. Enforcing that here rather than trusting the caller
  // keeps the method safe on its own: a future route that forgets the
  // verifyHistoryOwnership pre-check still cannot reach another user's record.
  // Same shape as insurance.service.ts / loans.service.ts — null means "not
  // yours or not there", which the route turns into a 404.
  async updateHistory(historyId: string, data: UpdateEntryHistory, userId: string) {
    const existing = await prisma.entryHistory.findFirst({
      where: { id: historyId, entry: { userId } },
    });
    if (!existing) return null;

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

  // Scoped through the parent Entry for the same reason as updateHistory above.
  // A missing row is a no-op, not an error: the only way to get here past the
  // route's ownership check is a concurrent delete, and "already gone" is the
  // outcome the caller wanted.
  async deleteHistory(historyId: string, userId: string) {
    const existing = await prisma.entryHistory.findFirst({
      where: { id: historyId, entry: { userId } },
    });
    if (!existing) return;
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

  async getAssetAllocation(userId: string) {
    const entries = await prisma.entry.findMany({
      where: { userId, includeInChart: true },
      select: { id: true, name: true, topCategory: true, value: true },
    });

    // Single pass: decode each entry's Decimal once, split into asset/liability
    // totals, and accumulate the per-category breakdown map as we go.
    let totalAssets = 0;
    let totalLiabilities = 0;
    const byTopCategory = new Map<string, number>();
    const assetValues: { id: string; name: string; value: number }[] = [];
    for (const e of entries) {
      const value = d(e.value);
      if (LIABILITY_SET.has(e.topCategory)) {
        totalLiabilities += value;
        continue;
      }
      totalAssets += value;
      byTopCategory.set(e.topCategory, (byTopCategory.get(e.topCategory) ?? 0) + value);
      assetValues.push({ id: e.id, name: e.name, value });
    }
    const debtToAssetRatio = totalAssets > 0 ? (totalLiabilities / totalAssets) * 100 : null;

    const breakdown = [...byTopCategory.entries()]
      .map(([topCategory, value]) => ({
        topCategory,
        value,
        percentage: (value / totalAssets) * 100,
      }))
      .sort((a, b) => b.value - a.value);

    const concentrationWarnings = assetValues
      .map((e) => ({ entryId: e.id, name: e.name, percentage: (e.value / totalAssets) * 100 }))
      .filter((w) => w.percentage >= 40);

    return { breakdown, concentrationWarnings, debtToAssetRatio };
  }

  async verifyHistoryOwnership(historyId: string, userId: string): Promise<boolean> {
    const row = await prisma.entryHistory.findFirst({
      where: { id: historyId, entry: { userId } },
    });
    return row !== null;
  }
}

export const entriesService = new EntriesService();
