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
