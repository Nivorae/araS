import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(async (fn) => fn(txMock)),
    insurance: { findFirst: vi.fn(), update: vi.fn() },
    entry: { deleteMany: vi.fn() },
  },
}));

vi.mock("@/services/entitlements.service", () => ({
  entitlementsService: { isPremium: vi.fn() },
}));

vi.mock("@/lib/serialize", () => ({
  d: (v: unknown) => Number(v),
  dn: (v: unknown) => (v == null ? null : Number(v)),
}));

const txMock = {
  entry: { create: vi.fn(), update: vi.fn() },
  entryHistory: { create: vi.fn() },
  insurance: { create: vi.fn() },
};

import { prisma } from "@/lib/prisma";
import { entitlementsService } from "../../services/entitlements.service";
import { insuranceService, PremiumRequiredError } from "../../services/insurance.service";

const USER_ID = "user_test123";
const BASE = { insurer: "國泰人壽", insuredName: "本人", insuranceType: "MEDICAL" as const };

describe("InsuranceService.create", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    txMock.entry.create.mockResolvedValue({ id: "entry-1", value: 0 });
    txMock.entryHistory.create.mockResolvedValue({});
    txMock.insurance.create.mockResolvedValue({
      id: "ins-1",
      entryId: "entry-1",
      ...BASE,
      policyName: null,
      policyNumber: null,
      startDate: null,
      paymentTermYears: null,
      coveragePeriod: null,
      annualPremium: null,
      coverage: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  it("throws PremiumRequiredError for a non-premium user", async () => {
    vi.mocked(entitlementsService.isPremium).mockResolvedValue(false);
    await expect(insuranceService.create(BASE, USER_ID)).rejects.toBeInstanceOf(
      PremiumRequiredError
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("creates an Entry with topCategory 保險, includeInChart false, value 0", async () => {
    vi.mocked(entitlementsService.isPremium).mockResolvedValue(true);
    await insuranceService.create(BASE, USER_ID);
    expect(txMock.entry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: USER_ID,
          topCategory: "保險",
          includeInChart: false,
          value: 0,
        }),
      })
    );
  });

  it("persists the insurance row with its type and coverage", async () => {
    vi.mocked(entitlementsService.isPremium).mockResolvedValue(true);
    await insuranceService.create(
      { ...BASE, coverage: [{ key: "hospital_daily", label: "住院日額", value: 2000 }] },
      USER_ID
    );
    expect(txMock.insurance.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ entryId: "entry-1", insuranceType: "MEDICAL" }),
      })
    );
  });
});

describe("InsuranceService.findById", () => {
  beforeEach(() => vi.clearAllMocks());
  it("scopes the lookup by userId via the entry relation", async () => {
    vi.mocked(prisma.insurance.findFirst).mockResolvedValue(null);
    expect(await insuranceService.findById("ins-1", USER_ID)).toBeNull();
    expect(prisma.insurance.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "ins-1", entry: { userId: USER_ID } } })
    );
  });
});

describe("InsuranceService.deleteByEntryId", () => {
  beforeEach(() => vi.clearAllMocks());
  it("deletes the entry scoped by userId (cascade removes the insurance)", async () => {
    vi.mocked(prisma.entry.deleteMany).mockResolvedValue({ count: 1 });
    await insuranceService.deleteByEntryId("entry-1", USER_ID);
    expect(prisma.entry.deleteMany).toHaveBeenCalledWith({
      where: { id: "entry-1", userId: USER_ID },
    });
  });
});
