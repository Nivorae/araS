import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { calculateLoanStatus, generateAmortizationSchedule } from "@repo/shared";
import { LoanDetailSheet } from "../LoanDetailSheet";
import type { Loan } from "@repo/shared";

vi.mock("@repo/shared", async () => {
  const actual = await vi.importActual<typeof import("@repo/shared")>("@repo/shared");
  return {
    ...actual,
    generateAmortizationSchedule: vi.fn().mockReturnValue([]),
    calculateLoanStatus: vi.fn().mockReturnValue({
      remainingPrincipal: 900000,
      nextRemainingPrincipal: 887550,
      nextPaymentAmount: 12450,
      nextPaymentDate: new Date("2026-05-01"),
      paidMonths: 3,
    }),
  };
});

vi.mock("../AmortizationTable", () => ({
  AmortizationTable: () => null,
}));

const MOCK_LOAN: Loan = {
  id: "loan-1",
  entryId: "entry-1",
  loanName: "花蓮房貸",
  totalAmount: 1200000,
  annualInterestRate: 2,
  termMonths: 360,
  startDate: "2026-01-01T00:00:00.000Z",
  gracePeriodMonths: 0,
  repaymentType: "principal_interest",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("LoanDetailSheet — currentBalance display", () => {
  const onClose = vi.fn();
  const onRateUpdated = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(calculateLoanStatus).mockReturnValue({
      remainingPrincipal: 900000,
      nextRemainingPrincipal: 887550,
      nextPaymentAmount: 12450,
      nextPaymentDate: new Date("2026-05-01"),
      paidMonths: 3,
    });
  });

  it("displays currentBalance as 剩餘本金 instead of calculated remainingPrincipal", () => {
    render(
      <LoanDetailSheet
        open={true}
        loan={MOCK_LOAN}
        currentBalance={850000}
        color="#C7C7D4"
        onClose={onClose}
        onRateUpdated={onRateUpdated}
      />
    );
    expect(screen.getByRole("spinbutton", { name: "剩餘本金" })).toHaveValue(850000);
    expect(screen.getByRole("spinbutton", { name: "剩餘本金" })).not.toHaveValue(900000);
  });

  it("falls back to calculated remainingPrincipal when currentBalance is not provided", () => {
    render(
      <LoanDetailSheet
        open={true}
        loan={MOCK_LOAN}
        color="#C7C7D4"
        onClose={onClose}
        onRateUpdated={onRateUpdated}
      />
    );
    expect(screen.getByRole("spinbutton", { name: "剩餘本金" })).toHaveValue(900000);
  });
});

describe("LoanDetailSheet — payment sync", () => {
  const onClose = vi.fn();
  const onRateUpdated = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(calculateLoanStatus).mockReturnValue({
      remainingPrincipal: 900000,
      nextRemainingPrincipal: 887550,
      nextPaymentAmount: 12450,
      nextPaymentDate: new Date("2026-05-01"),
      paidMonths: 3,
    });
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
  });

  it("renders 我已繳款 button when loan has a next payment date", () => {
    render(
      <LoanDetailSheet
        open={true}
        loan={MOCK_LOAN}
        color="#C7C7D4"
        onClose={onClose}
        onRateUpdated={onRateUpdated}
      />
    );
    expect(screen.getByRole("button", { name: "我已繳款" })).toBeInTheDocument();
  });

  it("does not render 我已繳款 button when loan is fully repaid", () => {
    vi.mocked(calculateLoanStatus).mockReturnValue({
      remainingPrincipal: 0,
      nextRemainingPrincipal: 0,
      nextPaymentAmount: 0,
      nextPaymentDate: null,
      paidMonths: 360,
    });
    render(
      <LoanDetailSheet
        open={true}
        loan={MOCK_LOAN}
        color="#C7C7D4"
        onClose={onClose}
        onRateUpdated={onRateUpdated}
      />
    );
    expect(screen.queryByRole("button", { name: "我已繳款" })).not.toBeInTheDocument();
  });

  it("opens confirmation sheet when 我已繳款 is clicked", () => {
    render(
      <LoanDetailSheet
        open={true}
        loan={MOCK_LOAN}
        color="#C7C7D4"
        onClose={onClose}
        onRateUpdated={onRateUpdated}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "我已繳款" }));
    expect(screen.getByText("確認本期還款")).toBeInTheDocument();
  });

  it("closes confirmation sheet when backdrop is clicked", () => {
    render(
      <LoanDetailSheet
        open={true}
        loan={MOCK_LOAN}
        color="#C7C7D4"
        onClose={onClose}
        onRateUpdated={onRateUpdated}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "我已繳款" }));
    fireEvent.click(screen.getByTestId("sync-backdrop"));
    expect(screen.queryByText("確認本期還款")).not.toBeInTheDocument();
  });

  it("switches to manual input when 金額不同？手動輸入 is clicked", () => {
    render(
      <LoanDetailSheet
        open={true}
        loan={MOCK_LOAN}
        color="#C7C7D4"
        onClose={onClose}
        onRateUpdated={onRateUpdated}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "我已繳款" }));
    fireEvent.click(screen.getByRole("button", { name: "金額不同？手動輸入" }));
    expect(screen.getByLabelText("實際剩餘本金")).toBeInTheDocument();
  });

  it("disables 確認已繳 when manual balance exceeds totalAmount", () => {
    render(
      <LoanDetailSheet
        open={true}
        loan={MOCK_LOAN}
        color="#C7C7D4"
        onClose={onClose}
        onRateUpdated={onRateUpdated}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "我已繳款" }));
    fireEvent.click(screen.getByRole("button", { name: "金額不同？手動輸入" }));
    fireEvent.change(screen.getByLabelText("實際剩餘本金"), { target: { value: "9999999" } });
    expect(screen.getByRole("button", { name: "確認已繳" })).toBeDisabled();
  });

  it("calls fetch and onRateUpdated on successful auto sync", async () => {
    render(
      <LoanDetailSheet
        open={true}
        loan={MOCK_LOAN}
        color="#C7C7D4"
        onClose={onClose}
        onRateUpdated={onRateUpdated}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "我已繳款" }));
    fireEvent.click(screen.getByRole("button", { name: "確認已繳" }));
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/loans/loan-1/sync",
        expect.objectContaining({ method: "PATCH" })
      );
      expect(onRateUpdated).toHaveBeenCalled();
    });
  });

  it("shows error message when sync fails", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false });
    render(
      <LoanDetailSheet
        open={true}
        loan={MOCK_LOAN}
        color="#C7C7D4"
        onClose={onClose}
        onRateUpdated={onRateUpdated}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "我已繳款" }));
    fireEvent.click(screen.getByRole("button", { name: "確認已繳" }));
    await waitFor(() => {
      expect(screen.getByText("同步失敗，請稍後再試")).toBeInTheDocument();
    });
  });

  it("calls onSynced instead of onRateUpdated when onSynced is provided", async () => {
    const onSynced = vi.fn();
    render(
      <LoanDetailSheet
        open={true}
        loan={MOCK_LOAN}
        color="#C7C7D4"
        onClose={onClose}
        onRateUpdated={onRateUpdated}
        onSynced={onSynced}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "我已繳款" }));
    fireEvent.click(screen.getByRole("button", { name: "確認已繳" }));
    await waitFor(() => {
      expect(onSynced).toHaveBeenCalled();
      expect(onRateUpdated).not.toHaveBeenCalled();
    });
  });
});

// Shared mock rows for effective-status tests
const MOCK_ROWS = [
  {
    month: 1,
    paymentDate: new Date("2026-05-20"),
    beginBalance: 6000000,
    principalPaid: 12623,
    interestPaid: 8900,
    totalPayment: 21523,
    endBalance: 5987377,
    isPast: false,
  },
  {
    month: 2,
    paymentDate: new Date("2026-06-20"),
    beginBalance: 5987377,
    principalPaid: 12642,
    interestPaid: 8881,
    totalPayment: 21523,
    endBalance: 5974735,
    isPast: false,
  },
  {
    month: 3,
    paymentDate: new Date("2026-07-20"),
    beginBalance: 5974735,
    principalPaid: 12661,
    interestPaid: 8862,
    totalPayment: 21523,
    endBalance: 5962074,
    isPast: false,
  },
];

describe("LoanDetailSheet — effectiveStatus from currentBalance", () => {
  const onClose = vi.fn();
  const onRateUpdated = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(generateAmortizationSchedule).mockReturnValue(MOCK_ROWS);
    vi.mocked(calculateLoanStatus).mockReturnValue({
      remainingPrincipal: 6000000,
      nextRemainingPrincipal: 5987377,
      nextPaymentAmount: 21523,
      nextPaymentDate: new Date("2026-05-20"),
      paidMonths: 0,
    });
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
  });

  it("when currentBalance reflects first payment made, shows 已繳 1 期", () => {
    render(
      <LoanDetailSheet
        open={true}
        loan={MOCK_LOAN}
        currentBalance={5987377}
        color="#C7C7D4"
        onClose={onClose}
        onRateUpdated={onRateUpdated}
      />
    );
    expect(screen.getByText(/已繳 1 期/)).toBeInTheDocument();
  });

  it("when currentBalance reflects first payment made, shows second month as 下期日期", () => {
    render(
      <LoanDetailSheet
        open={true}
        loan={MOCK_LOAN}
        currentBalance={5987377}
        color="#C7C7D4"
        onClose={onClose}
        onRateUpdated={onRateUpdated}
      />
    );
    // Month 2 date is 2026-06-20, not month 1 (2026-05-20)
    expect(screen.getByText("2026/06/20")).toBeInTheDocument();
    expect(screen.queryByText("2026/05/20")).not.toBeInTheDocument();
  });

  it("when no currentBalance provided, uses date-based paidMonths from status", () => {
    render(
      <LoanDetailSheet
        open={true}
        loan={MOCK_LOAN}
        color="#C7C7D4"
        onClose={onClose}
        onRateUpdated={onRateUpdated}
      />
    );
    // date-based paidMonths = 0 from mock
    expect(screen.getByText(/已繳 0 期/)).toBeInTheDocument();
  });
});

// Mock rows for re-amortization tests (4 rows, all totalPayment=21523)
const MOCK_ROWS_4 = [
  {
    month: 1,
    paymentDate: new Date("2026-02-01"),
    beginBalance: 1200000,
    principalPaid: 5000,
    interestPaid: 200,
    totalPayment: 5200,
    endBalance: 1195000,
    isPast: false,
  },
  {
    month: 2,
    paymentDate: new Date("2026-03-01"),
    beginBalance: 1195000,
    principalPaid: 5000,
    interestPaid: 200,
    totalPayment: 5200,
    endBalance: 1190000,
    isPast: false,
  },
  {
    month: 3,
    paymentDate: new Date("2026-04-01"),
    beginBalance: 1190000,
    principalPaid: 5000,
    interestPaid: 200,
    totalPayment: 5200,
    endBalance: 1185000,
    isPast: false,
  },
  {
    month: 4,
    paymentDate: new Date("2026-05-01"),
    beginBalance: 1185000,
    principalPaid: 5000,
    interestPaid: 200,
    totalPayment: 5200,
    endBalance: 1180000,
    isPast: false,
  },
];

// Re-amortized rows returned when extra payment detected (totalPayment=4800 — clearly different)
const MOCK_REAMORT_ROWS = [
  {
    month: 1,
    paymentDate: new Date("2026-03-01"),
    beginBalance: 1193000,
    principalPaid: 4800,
    interestPaid: 0,
    totalPayment: 4800,
    endBalance: 1188200,
    isPast: false,
  },
  {
    month: 2,
    paymentDate: new Date("2026-04-01"),
    beginBalance: 1188200,
    principalPaid: 4800,
    interestPaid: 0,
    totalPayment: 4800,
    endBalance: 1183400,
    isPast: false,
  },
];

describe("LoanDetailSheet — re-amortization on extra principal payment", () => {
  const onClose = vi.fn();
  const onRateUpdated = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(calculateLoanStatus).mockReturnValue({
      remainingPrincipal: 1200000,
      nextRemainingPrincipal: 1195000,
      nextPaymentAmount: 5200,
      nextPaymentDate: new Date("2026-02-01"),
      paidMonths: 0,
    });
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
  });

  it("does not re-amortize when currentBalance matches scheduled balance (normal payment)", () => {
    vi.mocked(generateAmortizationSchedule).mockReturnValue(MOCK_ROWS_4);
    render(
      <LoanDetailSheet
        open={true}
        loan={MOCK_LOAN}
        currentBalance={1195000}
        color="#C7C7D4"
        onClose={onClose}
        onRateUpdated={onRateUpdated}
      />
    );
    // row 1 of original schedule is next — totalPayment = 5200
    const labelEl = screen.getByText("下期應繳");
    expect(labelEl.parentElement).toHaveTextContent(/5,200/);
    expect(vi.mocked(generateAmortizationSchedule)).toHaveBeenCalledTimes(1);
  });

  it("re-amortizes future rows when currentBalance is below scheduled balance (extra payment)", () => {
    vi.mocked(generateAmortizationSchedule)
      .mockReturnValueOnce(MOCK_ROWS_4)
      .mockReturnValueOnce(MOCK_REAMORT_ROWS);
    render(
      <LoanDetailSheet
        open={true}
        loan={MOCK_LOAN}
        currentBalance={1193000}
        color="#C7C7D4"
        onClose={onClose}
        onRateUpdated={onRateUpdated}
      />
    );
    // re-amortized rows have totalPayment=4800, not original 5200
    const labelEl = screen.getByText("下期應繳");
    expect(labelEl.parentElement).toHaveTextContent(/4,800/);
    expect(labelEl.parentElement).not.toHaveTextContent(/5,200/);
  });

  it("shows correct paidMonths after extra payment", () => {
    vi.mocked(generateAmortizationSchedule)
      .mockReturnValueOnce(MOCK_ROWS_4)
      .mockReturnValueOnce(MOCK_REAMORT_ROWS);
    render(
      <LoanDetailSheet
        open={true}
        loan={MOCK_LOAN}
        currentBalance={1193000}
        color="#C7C7D4"
        onClose={onClose}
        onRateUpdated={onRateUpdated}
      />
    );
    expect(screen.getByText(/已繳 1 期/)).toBeInTheDocument();
  });
});
