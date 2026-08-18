import type { Entry } from "@repo/shared";

/**
 * 只留下「納入圖表」開著的項目。
 *
 * `includeInChart === undefined` 視為納入 —— 這個欄位是後來才加的，舊資料與
 * 沒帶這個欄位的來源都必須維持原本的行為（Prisma 的 default 也是 true）。所以
 * 判斷寫成 `!== false`，不能寫成 `=== true`。
 *
 * 伺服器端的兩個圖表端點（getNetWorthHistory / getAssetAllocation）自己就有
 * `where: { includeInChart: true }`，這裡是給前端自行加總的那幾個數字用的，
 * 語意與 web 的 `makeSnapshot()` 一致。
 */
export function chartedEntries(entries: Entry[]): Entry[] {
  return entries.filter((e) => e.includeInChart !== false);
}
