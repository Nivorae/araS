import { describe, it, expect } from "vitest";
import { demoLandingFor } from "../../../mobile/lib/demo/landing";
import { PAYWALL_SOURCES } from "../../../mobile/lib/analytics/events";

describe("demoLandingFor", () => {
  it("sends allocation to the allocation tab", () => {
    expect(demoLandingFor(PAYWALL_SOURCES.ALLOCATION_TAB)).toEqual({
      replace: "/transactions?view=allocation",
    });
  });

  it.each([
    PAYWALL_SOURCES.DIVIDEND_TAB,
    PAYWALL_SOURCES.DIVIDEND_FORM,
    PAYWALL_SOURCES.DIVIDEND_REINVEST,
  ])("sends %s to the dividends tab", (source) => {
    expect(demoLandingFor(source)).toEqual({ replace: "/transactions?view=dividends" });
  });

  it("pushes the insurance overview on top of home", () => {
    expect(demoLandingFor(PAYWALL_SOURCES.INSURANCE_FORM)).toEqual({
      replace: "/",
      push: "/insurance/overview",
    });
  });

  it("sends finance planning to the retirement tab in finance mode", () => {
    expect(demoLandingFor(PAYWALL_SOURCES.FINANCE_PLANNING)).toEqual({
      replace: "/retirement?mode=finance",
    });
  });

  it.each([
    PAYWALL_SOURCES.ENTRY_LIMIT,
    PAYWALL_SOURCES.SETTINGS_CARD,
    PAYWALL_SOURCES.DEMO_BANNER,
    PAYWALL_SOURCES.UNKNOWN,
  ])("sends %s home", (source) => {
    expect(demoLandingFor(source)).toEqual({ replace: "/" });
  });
});
