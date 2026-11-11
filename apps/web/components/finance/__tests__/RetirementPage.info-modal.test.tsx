import "@testing-library/jest-dom";
import type { ReactNode } from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { RetirementPage } from "../RetirementPage";

vi.mock("recharts", () => ({
  AreaChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Area: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  CartesianGrid: () => null,
  ReferenceLine: () => null,
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

const mockFetchAll = vi.fn();
vi.mock("../../../store/useFinanceStore", () => ({
  useFinanceStore: () => ({
    entries: [],
    fetchAll: mockFetchAll,
  }),
}));

let mockUserId: string | null = "user_a";
vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({ userId: mockUserId }),
}));

let mockPremium = { isPremium: false, loading: false };
vi.mock("../../../hooks/useIsPremium", () => ({
  useIsPremium: () => mockPremium,
}));

const mockPrompt = vi.fn();
vi.mock("../../../lib/mobileAppPrompt", () => ({
  promptMobileApp: (...args: unknown[]) => mockPrompt(...args),
}));

beforeEach(() => {
  mockUserId = "user_a";
  mockPremium = { isPremium: false, loading: false };
  mockPrompt.mockReset();
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
});

describe("RetirementPage — Info Modal", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("opens 目標總額 modal when that card is clicked", () => {
    render(<RetirementPage />);
    fireEvent.click(screen.getByTestId("metric-目標總額"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getAllByText("目標總額").length).toBeGreaterThan(1);
  });

  it("opens 退休缺口 modal when that card is clicked", () => {
    render(<RetirementPage />);
    fireEvent.click(screen.getByTestId("metric-退休缺口"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getAllByText("退休缺口").length).toBeGreaterThan(1);
  });

  it("opens 財務自由預測 modal when that card is clicked", () => {
    render(<RetirementPage />);
    fireEvent.click(screen.getByTestId("metric-財務自由預測"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getAllByText("財務自由預測").length).toBeGreaterThan(1);
  });

  it("opens 被動收入覆蓋 modal when that card is clicked", () => {
    render(<RetirementPage />);
    fireEvent.click(screen.getByTestId("metric-被動收入覆蓋"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getAllByText("被動收入覆蓋").length).toBeGreaterThan(1);
  });

  it("opens 目標達成率 modal when the progress section is clicked", () => {
    render(<RetirementPage />);
    fireEvent.click(screen.getByTestId("goal-progress-section"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getAllByText("目標達成率").length).toBeGreaterThan(1);
  });

  it("closes modal when 了解了 button is clicked", async () => {
    vi.useFakeTimers();
    render(<RetirementPage />);
    fireEvent.click(screen.getByTestId("metric-目標總額"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "了解了" }));
    await act(async () => vi.runAllTimers());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes modal when backdrop is clicked", async () => {
    vi.useFakeTimers();
    render(<RetirementPage />);
    fireEvent.click(screen.getByTestId("metric-目標總額"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("modal-backdrop"));
    await act(async () => vi.runAllTimers());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("RetirementPage — finance planning mode", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("prompts free users to download the app and stays on 退休計劃", () => {
    render(<RetirementPage />);
    fireEvent.click(screen.getByRole("tab", { name: "理財規劃" }));
    expect(mockPrompt).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("tab", { name: "退休計劃" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("metric-目標總額")).toBeInTheDocument();
  });

  it("does nothing while premium status is still loading", () => {
    mockPremium = { isPremium: false, loading: true };
    render(<RetirementPage />);
    fireEvent.click(screen.getByRole("tab", { name: "理財規劃" }));
    expect(mockPrompt).not.toHaveBeenCalled();
  });

  it("switches premium users to the salary calculator and computes the rules", async () => {
    vi.useFakeTimers();
    mockPremium = { isPremium: true, loading: false };
    render(<RetirementPage />);
    fireEvent.click(screen.getByRole("tab", { name: "理財規劃" }));
    await act(async () => vi.runAllTimers());
    expect(screen.getByText("薪資理財試算")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("月薪"), { target: { value: "50,000" } });
    fireEvent.change(screen.getByLabelText("被動收入"), { target: { value: "10000" } });
    // 60,000 × 0.3
    expect(screen.getByTestId("rule-save")).toHaveTextContent("NT$ 18,000");
    expect(screen.getByLabelText("月薪")).toHaveValue("50,000");
    expect(localStorage.getItem("retirement_salary_v1:user_a")).toBe("50000");
  });

  it("opens the rule's 計算說明 sheet", async () => {
    vi.useFakeTimers();
    mockPremium = { isPremium: true, loading: false };
    render(<RetirementPage />);
    fireEvent.click(screen.getByRole("tab", { name: "理財規劃" }));
    await act(async () => vi.runAllTimers());
    fireEvent.click(screen.getByTestId("rule-emergency"));
    expect(screen.getByRole("dialog", { name: "緊急預備金" })).toBeInTheDocument();
  });
});

describe("RetirementPage — per-account params", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("adopts a legacy bare-key value for the first account, keeping valid fields", () => {
    localStorage.setItem(
      "retirement_params_v1",
      JSON.stringify({ currentAge: 40, retirementAge: "bad" })
    );
    render(<RetirementPage />);
    expect(screen.getByLabelText("現在年齡")).toHaveValue("40");
    expect(screen.getByLabelText("預計退休年齡")).toHaveValue("65");
    expect(localStorage.getItem("retirement_params_v1")).toBeNull();
    expect(localStorage.getItem("retirement_params_v1:user_a")).not.toBeNull();
  });

  it("does not persist anything for signed-out guests", () => {
    mockUserId = null;
    render(<RetirementPage />);
    fireEvent.change(screen.getByLabelText("現在年齡"), { target: { value: "35" } });
    expect(localStorage.length).toBe(0);
  });
});
