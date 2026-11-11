import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { NetWorthChart, formatY } from "../NetWorthChart";

describe("NetWorthChart (web port of mobile NetWorthChart)", () => {
  it("shows the empty state without data", () => {
    render(<NetWorthChart data={[]} />);
    expect(screen.getByText("尚無足夠的歷史資料")).toBeInTheDocument();
  });

  it("formats axis values sign-aware in k / M", () => {
    expect(formatY(-2_400_000)).toBe("-2M");
    expect(formatY(12_300)).toBe("12k");
    expect(formatY(500)).toBe("500");
  });

  it("toggles the 淨資產 / 總資產 / 總負債 tooltip on a point", () => {
    // jsdom has no layout; give the wrapper a size so points render.
    Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, value: 300 });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
      configurable: true,
      value: 200,
    });
    render(
      <NetWorthChart
        data={[
          {
            date: "2026-01-31",
            period: "2026-01",
            netWorth: 1000,
            totalAssets: 1500,
            totalLiabilities: 500,
          },
          {
            date: "2026-02-28",
            period: "2026-02",
            netWorth: -200,
            totalAssets: 300,
            totalLiabilities: 500,
          },
        ]}
      />
    );
    fireEvent.click(screen.getByTestId("networth-point-1"));
    const tip = screen.getByRole("tooltip");
    expect(tip).toHaveTextContent("2026-02");
    expect(tip).toHaveTextContent("淨資產 -NT$200");
    expect(tip).toHaveTextContent("總負債 NT$500");
    fireEvent.click(screen.getByTestId("networth-point-1"));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
});
