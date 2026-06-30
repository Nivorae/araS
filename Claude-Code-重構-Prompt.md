# 給 Claude Code 的重構 Prompt

> 用法：在專案根目錄開 Claude Code，把下面整段（從「任務」開始）貼進去。
> 建議分階段執行，不要一次叫它全做完 — 先讓它產出計畫，你確認後再逐階段放行。

---

## 任務

我要在這個 monorepo 裡新增一個 **Expo React Native App（`apps/mobile`）**，作為現有 Web 產品的 iOS 行動版，目標是上架 App Store。請以「沿用現有後端與邏輯、只重寫 UI 層」為原則進行。

### 現有專案結構

- Monorepo：pnpm + Turbo
- `packages/web`（`@repo/web`）：Next.js 15（App Router）+ React 19，使用 `@clerk/nextjs`、Prisma、Tailwind v4、Zustand、Zod、recharts、motion。API 是 `app/api/*` 的 route handlers，搭配 service 層（例如 `entriesService`），已有 ownership 檢查與 security log。
- `packages/shared`（`@repo/shared`）：共用 TypeScript 型別與 Zod schema。
- 資料庫：Supabase（Postgres），透過 Prisma 存取。
- 產品：資產記帳 App。

### 核心約束（請嚴格遵守）

1. **不要動 `@repo/web` 的 API 授權邏輯。** route handlers、`entriesService`、ownership 檢查維持原樣。唯一允許的調整是：讓這些端點除了 cookie 之外，也接受 `Authorization: Bearer <Clerk session token>` 形式的驗證，以便行動端呼叫。
2. **不要拆出獨立後端。** Next.js 繼續同時當 Web 版與 API。行動端打的就是現有 `/api/*`。
3. **保留 Clerk。** 行動端用 `@clerk/clerk-expo`，不要換成其他登入方案。
4. **最大化重用。** 商業邏輯、型別、Zod schema、ownership 規則一律從 `@repo/shared` / 既有程式碼搬，不要重寫。只有 UI 層需要改寫。
5. **資料庫層不要改。** Prisma / Supabase 維持現狀。

### UI 對應（Web → Mobile）

| Web          | Mobile                                                                  |
| ------------ | ----------------------------------------------------------------------- |
| `div` / JSX  | `View` / `Text`                                                         |
| Tailwind v4  | NativeWind                                                              |
| recharts     | victory-native（或 react-native-gifted-charts，請你評估後選一個並說明） |
| motion       | react-native-reanimated                                                 |
| Next 路由    | Expo Router                                                             |
| lucide-react | lucide-react-native                                                     |

### 請依以下階段進行，每階段做完先停下來讓我確認

**Phase 1 — 骨架與登入**

- 在 `apps/mobile` 建立 Expo 專案（Expo Router + TypeScript），正確接進 pnpm workspace 與 Turbo pipeline。
- 整合 `@clerk/clerk-expo`，實作登入 / 登出 / session 持久化。
- 建立一個 API client，呼叫現有 `/api/*` 時自動帶上 Clerk session token 於 `Authorization` header。
- 設定 `@repo/shared` 的型別 / Zod 在行動端可正常 import。
- 驗收標準：能登入，並成功呼叫一個現有端點（例如 `GET /api/entries/[id]/history`）把資料顯示出來。

**Phase 2 — 畫面移植**

- 依上面的對應表，逐頁把 Web 畫面改寫成 RN。
- 每搬一頁，列出「重用了哪些既有邏輯 / 沒重寫」與「UI 換了什麼」。
- 圖表（記帳的損益 / 配息視覺化）要正常運作。

**Phase 3 — 打包設定**

- 設定 EAS Build（`eas.json`），讓我能在雲端（無 Mac）產出 iOS `.ipa`。
- 列出送 App Store 前我需要自己準備的東西（bundle ID、圖示、截圖、隱私政策等）。

### 開始前

先不要寫任何程式碼。請先：

1. 看過現有 `packages/web`（特別是 `app/api/*`、`entriesService`、`@repo/shared`）理解現況。
2. 產出一份 **Phase 1 的具體執行計畫**（要新增 / 修改哪些檔案、用哪些套件版本、workspace 怎麼設定）。
3. 標出任何你發現的風險或需要我決定的選擇。

我確認計畫後，你再開始 Phase 1。

---

## （選用）安全收尾 Prompt — 可在重構前先單獨叫一輪

> 這段獨立於 RN 重構，先做完更安心。

請檢查並強化 `@repo/web` 現有 API 的授權，**不要改動對外行為，只強化安全**：

1. 確認 `entriesService.verifyHistoryOwnership` 是透過關聯查 `entry: { userId }`，而不是只查 `history.id`。若不是，修正它。
2. 在所有寫入 / 刪除的 Prisma 查詢，把 `userId` 直接折進 `where`（例如 `where: { id, entry: { userId } }`），讓授權與變更成為同一個原子操作，不依賴「先呼叫 verify」的順序。
3. 所有讀取財務紀錄的端點（含 `GET /history`）都要做同樣的 ownership 把關。
4. 相關 Zod schema 加上 `.strict()`，多餘欄位直接報錯。
5. 確認 `handleError` 把 ZodError 對應成 400，且 production 不回傳 Prisma / stack 細節。
6. 為 `/api/stocks/*` 這類公開行情端點加上簡單的 rate limit。

先列出你發現的問題清單與修改計畫，我確認後再動手。
