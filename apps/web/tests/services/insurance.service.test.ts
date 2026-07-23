import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    // create() uses the callback form; update() uses the array (batch) form.
    $transaction: vi.fn(async (arg) => (Array.isArray(arg) ? Promise.all(arg) : arg(txMock))),
    insurance: { findFirst: vi.fn(), update: vi.fn() },
    entry: { deleteMany: vi.fn(), update: vi.fn() },
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
    txMock.entry.create.mockResolvedValue({
      id: "entry-1",
      name: "國泰人壽",
      topCategory: "保險",
      subCategory: "MEDICAL",
      value: 0,
      includeInChart: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
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

describe("InsuranceService.update", () => {
  beforeEach(() => vi.clearAllMocks());

  const EXISTING = {
    id: "ins-1",
    entryId: "entry-1",
    insurer: "國泰人壽",
    insuredName: "本人",
    insuranceType: "MEDICAL",
    policyName: null,
    policyNumber: null,
    startDate: null,
    paymentTermYears: null,
    coveragePeriod: null,
    annualPremium: null,
    coverage: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it("syncs Entry.name to the new policyName when it changes", async () => {
    vi.mocked(prisma.insurance.findFirst).mockResolvedValue(EXISTING as never);
    vi.mocked(prisma.insurance.update).mockResolvedValue({
      ...EXISTING,
      policyName: "我的保單",
    } as never);
    vi.mocked(prisma.entry.update).mockResolvedValue({} as never);

    await insuranceService.update("ins-1", { policyName: "我的保單" }, USER_ID);

    expect(prisma.entry.update).toHaveBeenCalledWith({
      where: { id: "entry-1" },
      data: { name: "我的保單" },
    });
  });

  it("syncs Entry.name to the insurer when it changes and there is no policyName", async () => {
    vi.mocked(prisma.insurance.findFirst).mockResolvedValue(EXISTING as never);
    vi.mocked(prisma.insurance.update).mockResolvedValue({
      ...EXISTING,
      insurer: "富邦人壽",
    } as never);
    vi.mocked(prisma.entry.update).mockResolvedValue({} as never);

    await insuranceService.update("ins-1", { insurer: "富邦人壽" }, USER_ID);

    expect(prisma.entry.update).toHaveBeenCalledWith({
      where: { id: "entry-1" },
      data: { name: "富邦人壽" },
    });
  });

  it("does not touch Entry.name when neither insurer nor policyName changes", async () => {
    vi.mocked(prisma.insurance.findFirst).mockResolvedValue(EXISTING as never);
    vi.mocked(prisma.insurance.update).mockResolvedValue({
      ...EXISTING,
      annualPremium: 1200,
    } as never);

    await insuranceService.update("ins-1", { annualPremium: 1200 }, USER_ID);

    expect(prisma.entry.update).not.toHaveBeenCalled();
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
