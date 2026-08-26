import { getAnalyticsClient, ANALYTICS_DEBUG } from "./client";
import type { AnalyticsEvent, AnalyticsEventProperties } from "./events";

/**
 * 送出一個事件。**全 App 唯一允許碰 PostHog SDK 的地方就是這裡**（外加
 * `client.ts` 的初始化）—— 元件與 hook 一律呼叫 `track()`。
 *
 * 這樣換掉分析供應商時只需要改這個檔案；也讓「不要送出個資」這件事只需要
 * 審查一個檔案就能保證。
 *
 * 型別上綁死 `AnalyticsEventProperties`：事件名稱與它允許的參數是一組，
 * 帶錯參數或多帶欄位都是編譯錯誤。
 */
export function track<E extends AnalyticsEvent>(
  event: E,
  properties: AnalyticsEventProperties[E]
): void {
  // 追蹤失敗絕對不能影響主流程 —— 這個 try/catch 是刻意包住「整個」函式，
  // 包含 debug log 本身。呼叫端因此永遠不需要為了埋點而自己包 try/catch。
  try {
    if (ANALYTICS_DEBUG) {
      console.log(`[analytics] ${event}`, properties);
    }
    getAnalyticsClient()?.capture(event, properties);
  } catch (e) {
    // 只在 dev 出聲；production 靜默，使用者不該因為分析壞掉而看到任何東西。
    if (ANALYTICS_DEBUG) console.warn(`[analytics] 送出 ${event} 失敗`, e);
  }
}
