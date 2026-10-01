import { PAYWALL_SOURCES, type PaywallSource } from "../analytics/events";
import type { DemoNav } from "./types";

// 使用者是在哪個付費入口被擋下的，進示範後就直接落在那個功能上。
export function demoLandingFor(source: PaywallSource): DemoNav {
  switch (source) {
    case PAYWALL_SOURCES.ALLOCATION_TAB:
      return { replace: "/transactions?view=allocation" };
    case PAYWALL_SOURCES.DIVIDEND_TAB:
    case PAYWALL_SOURCES.DIVIDEND_FORM:
    case PAYWALL_SOURCES.DIVIDEND_REINVEST:
      return { replace: "/transactions?view=dividends" };
    case PAYWALL_SOURCES.INSURANCE_FORM:
      return { replace: "/", push: "/insurance/overview" };
    case PAYWALL_SOURCES.FINANCE_PLANNING:
      return { replace: "/retirement?mode=finance" };
    default:
      return { replace: "/" };
  }
}
