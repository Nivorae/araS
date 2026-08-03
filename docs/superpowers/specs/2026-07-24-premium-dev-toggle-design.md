# Premium Dev Toggle 設計文件

## 問題

Premium 權限判斷是 server-authoritative、fail-closed 的：`EntitlementsService.isPremium(userId)` 讀取的 `Subscription` 資料列，只會由 Apple 的 server-to-server webhook（`apps/web/app/api/webhooks/app-store-notifications/route.ts`）寫入。`apps/mobile/lib/purchases.ts` 在 Expo Go 裡會直接 no-op（判斷 `Constants.executionEnvironment === "storeClient"`），所以在 Expo Go 裡無法完成真正的 IAP 購買。這使得無法端對端測試 premium 相關的功能（paywall、20 筆免費上限、保險功能限制）。

## 目標

讓開發者可以在 Expo Go App 內把自己的帳號在「premium」和「free」之間切換，並且走的是真正的後端權限判斷路徑（而不是前端假資料），同時要保證這個機制在正式環境裡完全不可觸及。

## 設計

### 後端：`apps/web/app/api/dev/subscription/route.ts`

- `POST { action: "activate" | "deactivate" }`
- 第一行就檢查：`if (process.env.NODE_ENV === "production") return 404`。這讓這支路由在部署到 Vercel production 後形同不存在——這是唯一真正有意義的防護，因為它是後端強制的，client 端怎麼改都繞不過去。
- 非正式環境時：照常用 Clerk `auth()` 驗證身份；只會操作呼叫者自己的 `Subscription` 資料列，key 是 `deriveAppleAccountToken(userId)`（跟真正的 webhook 用同一套推導邏輯）。
- `activate`：upsert 一筆資料，`productId: "dev_test_premium"`、`status: "active"`、`expiresAt: now + 1 年`、`environment: "Sandbox"`、`originalTransactionId: "dev-" + userId`。
- `deactivate`：刪除該資料列。
- 回應沿用標準的 `ok`/`err` envelope。

### 手機端：`apps/mobile/app/(app)/settings.tsx`

- 在既有的「升級 Premium」卡片附近，新增一個用 `if (__DEV__)` 包起來的區塊。
- 兩顆按鈕：「模擬升級」與「模擬取消」，各自呼叫上面的 API（透過既有的 API client），成功後 invalidate `useIsPremium` 的 query，讓畫面立刻反映新狀態。
- `__DEV__` 只控制按鈕要不要顯示（方便正式 build 不會出現這些按鈕），並不是安全防線——真正的防線是後端的 `NODE_ENV` 檢查。

### 資料流

按下按鈕 → `POST /api/dev/subscription` → Clerk `auth()` → 寫入/刪除 `Subscription` 資料列 → 手機端 invalidate `useIsPremium` → 走跟正式購買相同的查詢路徑（`GET /api/entitlements` → `EntitlementsService.isPremium`）回傳切換後的狀態 → 所有真實的限制邏輯（`entries.service.ts` 的 20 筆上限、保險功能限制）都會跟著反應。

### 錯誤處理

- 正式環境：路由回 404，手機端顯示一般性的失敗提示（理論上不會真的碰到，因為按鈕本身就被 `__DEV__` 擋掉了）。
- 未登入：沿用既有的 401 模式（透過 `auth()`），跟其他路由一致。
- 沿用既有的 `ok`/`err`/`handleError` 慣例，不引入新的錯誤處理方式。

### 測試方式

手動測試，因為這只是個開發用工具：

1. 按「模擬升級」→ 確認 paywall 相關限制解除，且可以新增第 21 筆 entry。
2. 按「模擬取消」→ 確認上限限制恢復（第 21 筆會被擋），且該出現 paywall 的地方會正常出現。
3. 確認本機設定 `NODE_ENV=production` 時該路由會回 404（驗證防護機制有效）。

## 不在範圍內

- 任何真實 Apple IAP / RevenueCat 流程的變更。
- 通用的 feature-flag 系統——這只是針對單一權限狀態的專用開發工具。
- 自動化測試——這支路由只存在於非正式環境，不屬於產品的測試範圍。
