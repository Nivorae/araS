import { Alert } from "react-native";
import {
  ANALYTICS_EVENTS,
  PAYWALL_SOURCES,
  track,
  type DemoExitReason,
  type PaywallSource,
} from "@/lib/analytics";
import { clearCachedFetch } from "@/hooks/useCachedFetch";
import { clearNetWorthHistoryInFlight } from "@/hooks/useFinanceActions";
import { useFinanceStore } from "@/store/financeStore";
import { isDemoActive, useDemoStore } from "@/store/demoStore";
import { demoLandingFor } from "./landing";
import type { DemoNav } from "./types";

// 真實資料與示範資料共用同一個 financeStore 和同一批模組層級快取。切換前全部
// 清空，畫面樹再由 generation 重新掛載，兩邊才不會看到對方的資料。
function clearDataCaches(): void {
  useFinanceStore.getState().reset();
  clearCachedFetch();
  clearNetWorthHistoryInFlight();
}

const EXIT_NAV: Record<DemoExitReason, DemoNav | null> = {
  manual: { replace: "/" },
  upgrade: { replace: "/", push: `/paywall?source=${PAYWALL_SOURCES.DEMO_BANNER}` },
  timeout: { replace: "/" },
  // 登出時 root layout 自己會導去歡迎頁。
  sign_out: null,
};

export function enterDemo(source: PaywallSource): void {
  if (isDemoActive()) return;
  clearDataCaches();
  useDemoStore.getState().start(demoLandingFor(source));
  track(ANALYTICS_EVENTS.DEMO_ENTERED, { trigger_source: source });
}

export function exitDemo(reason: DemoExitReason): void {
  const { enteredAt } = useDemoStore.getState();
  if (!isDemoActive()) return;
  clearDataCaches();
  useDemoStore.getState().stop(EXIT_NAV[reason]);
  track(ANALYTICS_EVENTS.DEMO_EXITED, {
    reason,
    seconds_in_demo: enteredAt ? Math.round((Date.now() - enteredAt) / 1000) : 0,
  });
  if (reason === "timeout") {
    Alert.alert("示範已結束", "離開 App 超過 10 分鐘，示範模式已自動結束。示範中的修改不會保留。");
  }
}
