import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(async (arg) => arg(txMock)),
    loan: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    entry: {
      update: vi.fn(),
    },
  },
}));

const txMock = {
  entry: { create: vi.fn(), update: vi.fn() },
  entryHistory: { create: vi.fn() },
  loan: { create: vi.fn(), update: vi.fn() },
};

vi.mock("@repo/shared", async () => {
  const actual = await vi.importActual<typeof import("@repo/shared")>("@repo/shared");
  return {
    ...actual,
    calculateLoanStatus: vi.fn().mockReturnValue({
      remainingPrincipal: 6000000,
      nextRemainingPrincipal: 5987377,
      nextPaymentAmount: 21523,
      nextPaymentDate: new Date("2026-05-20"),
      paidMonths: 0,
    }),
  };
});

import { prisma } from "@/lib/prisma";
import { loansService } from "../../services/loans.service";

const MOCK_LOAN = {
  id: "loan-1",
  entryId: "entry-1",
  loanName: "花蓮房貸",
  totalAmount: { toNumber: () => 6000000 },
  annualInterestRate: { toNumber: () => 2.0 },
  termMonths: 360,
  startDate: new Date("2026-04-20T00:00:00.000Z"),
  gracePeriodMonths: 0,
  repaymentType: "principal_interest" as const,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("LoansService.create", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    txMock.entry.create.mockResolvedValue({
      id: "entry-1",
      name: "花蓮房貸",
      topCategory: "負債",
      subCategory: "貸款",
      stockCode: null,
      value: { toNumber: () => 6000000 },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    txMock.entryHistory.create.mockResolvedValue({});
    txMock.loan.create.mockResolvedValue(MOCK_LOAN);
  });

  const CREATE_INPUT = {
    loanName: "花蓮房貸",
    category: "貸款",
    totalAmount: 6000000,
    annualInterestRate: 2.0,
    termMonths: 360,
    startDate: "2026-04-20",
    gracePeriodMonths: 0,
    repaymentType: "principal_interest" as const,
  };

  it("persists includeInChart: false on the created entry when the caller opts out", async () => {
    await loansService.create({ ...CREATE_INPUT, includeInChart: false }, "user-1");

    expect(txMock.entry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ includeInChart: false }),
      })
    );
  });

  it("does not force includeInChart when the caller omits it", async () => {
    await loansService.create(CREATE_INPUT, "user-1");

    expect(txMock.entry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({ includeInChart: expect.anything() }),
      })
    );
  });
});

describe("LoansService.update", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.loan.findFirst).mockResolvedValue(MOCK_LOAN as never);
    txMock.loan.update.mockResolvedValue({
      ...MOCK_LOAN,
      entry: {
        id: "entry-1",
        name: "花蓮房貸",
        topCategory: "負債",
        subCategory: "貸款",
        stockCode: null,
        value: { toNumber: () => 6000000 },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  });

  it("persists includeInChart on the entry when provided", async () => {
    await loansService.update("loan-1", { includeInChart: false }, "user-1");

    expect(txMock.entry.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "entry-1" },
        data: expect.objectContaining({ includeInChart: false }),
      })
    );
  });

  it("does not touch entry.update when includeInChart is omitted and nothing else changed", async () => {
    await loansService.update("loan-1", { annualInterestRate: 2.5 }, "user-1");

    expect(txMock.entry.update).not.toHaveBeenCalled();
  });
});

describe("LoansService.updateRate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.loan.findFirst).mockResolvedValue(MOCK_LOAN as never);
    vi.mocked(prisma.loan.update).mockResolvedValue(MOCK_LOAN as never);
  });

  it("does not overwrite entry.value when updating the interest rate", async () => {
    await loansService.updateRate("loan-1", { annualInterestRate: 2.5 }, "user-1");

    expect(vi.mocked(prisma.entry.update)).not.toHaveBeenCalled();
  });

  it("updates the loan annualInterestRate", async () => {
    await loansService.updateRate("loan-1", { annualInterestRate: 2.5 }, "user-1");

    expect(vi.mocked(prisma.loan.update)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "loan-1" },
        data: { annualInterestRate: 2.5 },
      })
    );
  });
});
