import type { Prisma } from "@prisma/client";
import type { CreateInsurance, UpdateInsurance } from "@repo/shared";
import { prisma } from "@/lib/prisma";
import { d, dn } from "@/lib/serialize";
import { entitlementsService } from "@/services/entitlements.service";

// Thrown when a non-premium user attempts an insurance write. The route maps
// this to a 403 PREMIUM_REQUIRED envelope so the client can open the paywall.
export class PremiumRequiredError extends Error {
  constructor() {
    super("Premium subscription required");
    this.name = "PremiumRequiredError";
  }
}

function serializeInsurance(ins: {
  id: string;
  entryId: string;
  insurer: string;
  insuredName: string;
  insuranceType: string;
  policyName: string | null;
  policyNumber: string | null;
  startDate: Date | null;
  paymentTermYears: number | null;
  coveragePeriod: string | null;
  annualPremium: Prisma.Decimal | null;
  coverage: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...ins,
    startDate: ins.startDate ? ins.startDate.toISOString() : null,
    annualPremium: dn(ins.annualPremium),
    coverage: (ins.coverage as unknown) ?? [],
  };
}

export class InsuranceService {
  async create(data: CreateInsurance, userId: string) {
    if (!(await entitlementsService.isPremium(userId))) throw new PremiumRequiredError();

    return prisma.$transaction(async (tx) => {
      const entry = await tx.entry.create({
        data: {
          userId,
          name: data.policyName?.trim() || data.insurer,
          topCategory: "保險",
          subCategory: data.insuranceType,
          value: 0,
          includeInChart: false,
        },
      });

      await tx.entryHistory.create({
        data: { entryId: entry.id, delta: 0, balance: 0 },
      });

      const insurance = await tx.insurance.create({
        data: {
          entryId: entry.id,
          insurer: data.insurer,
          insuredName: data.insuredName,
          insuranceType: data.insuranceType,
          policyName: data.policyName ?? null,
          policyNumber: data.policyNumber ?? null,
          startDate: data.startDate ? new Date(data.startDate) : null,
          paymentTermYears: data.paymentTermYears ?? null,
          coveragePeriod: data.coveragePeriod ?? null,
          annualPremium: data.annualPremium ?? null,
          coverage: (data.coverage ?? []) as Prisma.InputJsonValue,
        },
      });

      // The created Entry is returned alongside the Insurance record (shaped
      // like entries.service.ts's list() output) so callers can push it
      // straight into the local store — an insurance entry is always value:0
      // and includeInChart:false, so there's nothing to (re)compute; a full
      // refetch just to see it appear is unnecessary network round-trips.
      return {
        ...serializeInsurance(insurance),
        entry: {
          id: entry.id,
          name: entry.name,
          topCategory: entry.topCategory,
          subCategory: entry.subCategory,
          stockCode: null,
          bankCode: null,
          note: null,
          value: d(entry.value),
          includeInChart: entry.includeInChart,
          createdAt: entry.createdAt.toISOString(),
          updatedAt: entry.updatedAt.toISOString(),
          loan: null,
          units: null,
          insurance: {
            id: insurance.id,
            insuranceType: insurance.insuranceType,
            insurer: insurance.insurer,
            insuredName: insurance.insuredName,
          },
        },
      };
    });
  }

  async list(userId: string) {
    const insurances = await prisma.insurance.findMany({
      where: { entry: { userId } },
      orderBy: { createdAt: "desc" },
    });
    return insurances.map(serializeInsurance);
  }

  async findById(id: string, userId: string) {
    const insurance = await prisma.insurance.findFirst({
      where: { id, entry: { userId } },
    });
    return insurance ? serializeInsurance(insurance) : null;
  }

  async update(id: string, data: UpdateInsurance, userId: string) {
    const existing = await prisma.insurance.findFirst({ where: { id, entry: { userId } } });
    if (!existing) return null;

    // Entry.name is derived from insurer/policyName at creation time (see
    // create() above) and otherwise never touched — keep it in sync so the
    // entry-list row doesn't go stale after an edit.
    const nextInsurer = data.insurer ?? existing.insurer;
    const nextPolicyName = data.policyName !== undefined ? data.policyName : existing.policyName;
    const nameChanged = data.insurer !== undefined || data.policyName !== undefined;

    const [updated] = await prisma.$transaction([
      prisma.insurance.update({
        where: { id },
        data: {
          ...(data.insurer !== undefined && { insurer: data.insurer }),
          ...(data.insuredName !== undefined && { insuredName: data.insuredName }),
          ...(data.insuranceType !== undefined && { insuranceType: data.insuranceType }),
          ...(data.policyName !== undefined && { policyName: data.policyName }),
          ...(data.policyNumber !== undefined && { policyNumber: data.policyNumber }),
          ...(data.startDate !== undefined && {
            startDate: data.startDate ? new Date(data.startDate) : null,
          }),
          ...(data.paymentTermYears !== undefined && { paymentTermYears: data.paymentTermYears }),
          ...(data.coveragePeriod !== undefined && { coveragePeriod: data.coveragePeriod }),
          ...(data.annualPremium !== undefined && { annualPremium: data.annualPremium }),
          ...(data.coverage !== undefined && {
            coverage: (data.coverage ?? []) as Prisma.InputJsonValue,
          }),
        },
      }),
      ...(nameChanged
        ? [
            prisma.entry.update({
              where: { id: existing.entryId },
              data: { name: nextPolicyName?.trim() || nextInsurer },
            }),
          ]
        : []),
    ]);
    return serializeInsurance(updated);
  }

  async deleteByEntryId(entryId: string, userId: string) {
    // Cascade on Entry→Insurance removes the insurance row.
    return prisma.entry.deleteMany({ where: { id: entryId, userId } });
  }
}

export const insuranceService = new InsuranceService();
