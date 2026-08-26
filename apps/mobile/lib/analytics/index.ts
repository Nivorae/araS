/**
 * 行為分析的公開介面。App 其他地方一律從 `@/lib/analytics` import，
 * 不要直接指向底下的檔案，更不要直接 import `posthog-react-native`。
 */
export { ANALYTICS_EVENTS, PAYWALL_SOURCES, toPaywallSource } from "./events";
export type { AnalyticsEvent, AnalyticsEventProperties, PaywallSource } from "./events";
export { initAnalytics, ANALYTICS_ENVIRONMENT, ANALYTICS_DEBUG } from "./client";
export { track } from "./track";
export { trackAppOpen, trackRecordCreated } from "./funnel";
export { resetFunnelStateForTesting } from "./funnelState";
export { useAppOpenTracking } from "./useAppOpenTracking";
