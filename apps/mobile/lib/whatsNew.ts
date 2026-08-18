/**
 * 「本次更新」文案的來源與顯示判斷。
 *
 * 文案跟著 **新** bundle 走：`app.json` 的 `expo.extra.whatsNew` 會被打進 OTA
 * bundle，所以重啟後跑起來的那份 JS 自己就帶著要講的話 —— 舊 bundle 不需要
 * （也沒辦法）去預讀新的 manifest。
 *
 * 這裡刻意不 import React 或任何 hook：顯示與否是一個可以單獨閱讀、單獨推理的
 * 判斷（`apps/mobile` 沒有 test script，所以「能被讀懂」就是唯一的驗證方式）。
 */

/** AsyncStorage key：存「上一次顯示過的 whatsNew id」。 */
export const WHATS_NEW_STORAGE_KEY = "whatsNew.lastShownId";

/**
 * 發版時固定使用的三個區塊標題，依這個順序寫進 `app.json`。
 *
 * 這裡只是「約定」而不是「限制」—— `parseWhatsNew` 照 `app.json` 給的標題與順序
 * 原樣顯示，沒有東西可寫的區塊直接整段省略（例如純修 bug 的版本就不會有
 * 「新功能」）。
 */
export const WHATS_NEW_SECTION_TITLES = ["新功能", "優化", "立即重啟"] as const;

export interface WhatsNewSection {
  title: string;
  items: string[];
}

export interface WhatsNew {
  id: string;
  sections: WhatsNewSection[];
}

/**
 * 從 `Constants.expoConfig?.extra?.whatsNew` 這種來源不明的值解析出文案。
 *
 * 任何形狀不對的情況一律回 null —— 失效方向必須是「少講」，不是講錯。空白的
 * 項目、以及沒有任何項目的區塊，都會被丟掉而不是留下一個空標題。
 */
export function parseWhatsNew(extra: unknown): WhatsNew | null {
  if (!extra || typeof extra !== "object") return null;
  const { id, sections } = extra as { id?: unknown; sections?: unknown };
  if (typeof id !== "string" || id.trim() === "") return null;
  if (!Array.isArray(sections)) return null;

  const clean: WhatsNewSection[] = [];
  for (const section of sections) {
    if (!section || typeof section !== "object") continue;
    const { title, items } = section as { title?: unknown; items?: unknown };
    if (typeof title !== "string" || title.trim() === "") continue;
    if (!Array.isArray(items)) continue;
    const cleanItems = items.filter((i): i is string => typeof i === "string" && i.trim() !== "");
    if (cleanItems.length === 0) continue;
    clean.push({ title, items: cleanItems });
  }
  if (clean.length === 0) return null;

  return { id, sections: clean };
}

export interface ShouldShowWhatsNewInput {
  /** 這份 bundle 自己帶的文案（`parseWhatsNew` 的結果）。 */
  whatsNew: WhatsNew | null;
  /** AsyncStorage 裡上次顯示過的 id；沒有紀錄時為 null。 */
  lastShownId: string | null;
  /** `Updates.isEnabled`：Expo Go／dev 為 false，整段邏輯短路。 */
  isEnabled: boolean;
  /** `currentlyRunning.isEmbeddedLaunch`：跑的是 App Store 內建 bundle、還沒套用過任何 OTA。 */
  isEmbeddedLaunch: boolean;
}

/**
 * 這次啟動該不該顯示「本次更新」？
 *
 * 失效安全（這是整個設計的重點）：判斷依據是「這份 bundle 帶的 id」與「上次顯示
 * 過的 id」不同，而不是「有沒有東西可以講」。
 *
 * - id 不同 → 顯示一次，然後寫回 AsyncStorage
 * - id 相同 → 不顯示
 * - 發版時忘了改 id → 什麼都不顯示（靜默），而不是把上一版的舊文案再講一次
 *
 * 另外兩個短路：Expo Go／dev（`isEnabled` false）沒有 OTA 可言；剛從 App Store
 * 安裝、跑的是內建 bundle 時也不顯示 —— 那是首次安裝，不是「更新」，該版的說明
 * 由 App Store 的版本資訊負責。
 */
export function shouldShowWhatsNew({
  whatsNew,
  lastShownId,
  isEnabled,
  isEmbeddedLaunch,
}: ShouldShowWhatsNewInput): boolean {
  if (!isEnabled) return false;
  if (isEmbeddedLaunch) return false;
  if (!whatsNew) return false;
  return whatsNew.id !== lastShownId;
}
