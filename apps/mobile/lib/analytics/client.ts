import PostHog from "posthog-react-native";
import Constants from "expo-constants";

/**
 * PostHog client 的建立與保管。
 *
 * 設計原則跟 `lib/purchases.ts` 一樣：**分析壞掉不可以讓 App 壞掉**。沒有金鑰、
 * 建立失敗、網路不通，都只是「沒有數據」，不是「使用者看到白畫面」。
 */

// 金鑰與 host 都走環境變數，不 hardcode。EXPO_PUBLIC_* 會被 inline 進 JS
// bundle，本來就是公開值（PostHog 的 project API key 只能寫入、不能讀取資料，
// 跟 Clerk publishable key、RevenueCat SDK key 同一類）。
const apiKey = process.env.EXPO_PUBLIC_POSTHOG_API_KEY;
const host = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

/**
 * dev 與 production 的事件分流。
 *
 * 沿用 `app/_layout.tsx` 裡 Sentry 的做法：同一個 project、用一個 super
 * property 分流，而不是開兩個 project。理由是後台只要 filter
 * `environment = production` 就乾淨了，卻不必為了測試而維護第二組金鑰；
 * 要換成兩個 project 也只要換 `.env` 的 key，程式碼不用動。
 */
export const ANALYTICS_ENVIRONMENT = __DEV__ ? "development" : "production";

/** dev 模式下把每個事件印在 console，方便不開後台就能驗證。 */
export const ANALYTICS_DEBUG = __DEV__;

let client: PostHog | null = null;
let initialised = false;

/**
 * 建立 PostHog client。在 App 進入點呼叫一次；重複呼叫是 no-op。
 *
 * 刻意關掉所有「自動蒐集」：
 *  - `captureAppLifecycleEvents`：我們自己送語意明確的 `app_open`，
 *    不需要 SDK 再送一份 `Application Opened` 把漏斗弄亂。
 *  - `enableSessionReplay`：會錄到畫面上的金額與帳目名稱，屬於個資，絕不開。
 *  - autocapture（點擊／畫面）：預設就要透過 `<PostHogProvider>` 才會啟用，
 *    我們刻意不使用那個 Provider，所以不會有任何自動事件。
 * 結果是：**只有這個檔案的姊妹檔 `events.ts` 列出的六個事件會被送出。**
 */
export function initAnalytics(): void {
  if (initialised) return;
  initialised = true;

  if (!apiKey) {
    if (ANALYTICS_DEBUG) {
      console.warn(
        "[analytics] 沒有 EXPO_PUBLIC_POSTHOG_API_KEY，追蹤停用（事件只會印在 console）"
      );
    }
    return;
  }

  try {
    client = new PostHog(apiKey, {
      host,
      // 沒有 expo-file-system 時，SDK 會自動退回已安裝的 AsyncStorage，
      // 匿名 distinct_id 因此能跨啟動保存 —— 這就是我們的「裝置層級匿名 ID」。
      persistence: "file",
      captureAppLifecycleEvents: false,
      enableSessionReplay: false,
      disableSurveys: true,
      preloadFeatureFlags: false,
      // 手機端網路不穩，批次小一點、間隔短一點，事件比較不會卡在記憶體裡隨
      // App 被殺掉一起消失。
      flushAt: 10,
      flushInterval: 10_000,
    });

    // Super properties：附加在「之後每一個事件」上，不必在每個呼叫點重複寫。
    void client
      .register({
        environment: ANALYTICS_ENVIRONMENT,
        app_version: Constants.expoConfig?.version ?? "unknown",
      })
      .catch(() => {});
  } catch (e) {
    client = null;
    if (ANALYTICS_DEBUG) console.warn("[analytics] PostHog 初始化失敗，追蹤停用", e);
  }
}

/** 取得 client；尚未初始化或初始化失敗時回 null，呼叫端不需要處理例外。 */
export function getAnalyticsClient(): PostHog | null {
  return client;
}
