# 資產記帳 App — 上架重構 Roadmap

> 這份文件把規劃過程中的所有決策收斂成一條可執行路線。
> **定位：這是一個 mobile-first 產品，最終只有手機 App。** 現有網頁版只是開發期的自測工具，不會當產品經營。
> 核心方向：**重構成 React Native（Expo），Next.js 轉為純後端 API（headless），保留 Clerk，Supabase 升 Pro。**

---

## 0. 現況盤點

**技術棧**

- Monorepo：pnpm + Turbo
- `@repo/web`：Next.js 15（App Router）+ React 19、`@clerk/nextjs`、Prisma、Tailwind v4、Zustand、Zod、recharts、motion
  - 註：原本的 `next-pwa` 是為了「PWA 上架」那條老路，改用原生 RN 後**不再需要，可移除**
- 資料庫：Supabase（Postgres），目前免費版
- API：`/api/*` route handlers + service 層（`entriesService`）、ownership 檢查、security log — 架構乾淨
- 產品：資產記帳 App

**已確認的事**

- API 授權寫得扎實（IDOR、不信任 client 身分、欄位白名單都有處理）
- 安全把關集中在 `entriesService.verifyHistoryOwnership` — 這個函式是擋 IDOR 的唯一防線，需確認實作正確

---

## 1. 五個核心決策（為什麼這樣選）

| 問題                             | 決策                                      | 理由                                                                                                               |
| -------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 用 WebView 殼還是 React Native？ | **React Native（Expo）**                  | 真原生 App，避開 App Store 4.2「純網站殼」退件；Clerk 走原生流程不再掉登入；Expo EAS 雲端打包，沒有 Mac 也能出 ipa |
| 要前後端分離嗎？                 | **不用**                                  | 現有 `/api/*` route handler 就是後端；RN App 直接打同一套 API，不需要獨立 Express                                  |
| 要移除 Clerk 嗎？                | **不用，保留**                            | 改用 `@clerk/clerk-expo`（原生 SDK），先前 WebView 掉登入的雷直接消失；換掉只會丟掉現有授權模型                    |
| 沒有 Mac 怎麼打包？              | **Expo EAS Build**                        | 在雲端的 macOS 環境編譯簽章，輸出 `.ipa`，完全不用碰 Xcode                                                         |
| 訂閱 / 七天試用怎麼做？          | **上架後再加，用 RevenueCat + Apple IAP** | 七天試用 = Apple introductory offer，內建處理；過審風險最低；抽成 15%（年營收 <100 萬美元）                        |

---

## 2. 目標架構

```
monorepo/
├── apps/
│   └── mobile/          # 新增：Expo React Native App（行動端）
├── packages/
│   ├── web/  (@repo/web)    # Next.js：純後端 API（route handlers 不動）；網頁 UI 退為自測 / 規格參考
│   ├── shared/ (@repo/shared)  # 型別 + Zod，Web 與 Mobile 共用
│   └── ui/  (@repo/ui)
└── ...
```

- **Web（Next.js）= 純後端 API（headless）**：仍要部署（它是 App 的唯一後端，Prisma 不能在手機上跑），但網頁 UI 不再是產品，凍結在現狀、可只開放給自己看
- **Mobile（Expo）= 唯一的產品客戶端**：打同一套 `/api`，授權邏輯不變，差別只在驗證從 cookie → `Authorization` header（帶 Clerk session token）
- **資料庫**：跟客戶端無關，App 打 `/api`、DB 在後面

> **重要：先別刪掉網頁 UI。** 功能都做完的 web 畫面是現在最完整的「規格書」——重構時讓 Claude Code 去讀 web 的畫面與邏輯、照著在 RN 重現，比口頭描述精準得多。等 mobile 功能對齊（parity）後，web UI 再降級成內部工具或退役都行。

---

## 3. 執行階段

### Phase 0 — 前置與收尾（可與 Phase 1 平行）

**帳號 / 基礎設施**

- [ ] 註冊 Apple Developer Program（**99 USD / 年**）
- [ ] Supabase 升級 **Pro（約 25 USD / 月）** — 上線前必做
  - 免費版兩個硬傷：① 7 天無流量自動暫停 ② 沒有自動備份（財務資料不可接受）
- [ ] 設定 **connection pooling**（serverless + Prisma 必做，否則連線數會爆）
  - `DATABASE_URL` → pooled 連線（transaction 模式，6543 埠，`?pgbouncer=true`）
  - `DIRECT_URL` → direct 連線（5432 埠，給 migration 用）
  - 兩條字串在 Supabase 後台 Database 設定頁直接複製

**安全收尾（建議在重構前先補）**

- [ ] 確認 `verifyHistoryOwnership` 是用關聯查 `entry: { userId }`，不是只查 `history.id`
- [ ] 寫入層也帶 `where: { ..., entry: { userId } }`，讓授權與變更變成同一個原子操作（避免日後有人改 code 忘了先 verify）
- [ ] `UpdateEntryHistorySchema` 加 `.strict()`，多送欄位直接報錯
- [ ] `GET /history` 也要 ownership 把關（不要只擋寫入）
- [ ] `handleError` 把 ZodError 對應成 400，production 不吐 Prisma / stack 細節

### Phase 1 — RN App 骨架

- [ ] 在 `apps/mobile` 建立 Expo 專案（Expo Router）
- [ ] 接 `@clerk/clerk-expo`，做到登入 / 登出 / session 持久化會動
- [ ] 串接現有 `/api/*`，token 放 `Authorization` header
- [ ] 共用 `@repo/shared` 的型別與 Zod schema
- [ ] 先跑通「登入 → 讀一個列表」的端到端流程

### Phase 2 — UI 移植

| Web（現況）  | Mobile（改用）                                  |
| ------------ | ----------------------------------------------- |
| `div` / JSX  | `View` / `Text`                                 |
| Tailwind v4  | NativeWind                                      |
| recharts     | victory-native（或 react-native-gifted-charts） |
| motion       | react-native-reanimated                         |
| Next 路由    | Expo Router                                     |
| lucide-react | lucide-react-native                             |

- [ ] **以現有 web 畫面為規格**，逐頁移植；**商業邏輯 / `entriesService` 呼叫 / Zod / ownership 全部照搬**，只換 UI 層

### Phase 3 — 打包與送審（先以免費 App 過審）

- [ ] Expo EAS Build 產出 `.ipa`（無需 Mac）
- [ ] App Store Connect 建立 listing：App 圖示、截圖、隱私權政策網址、隱私「營養標籤」、年齡分級
- [ ] TestFlight 實測，重點測 Clerk 登入在真機上穩不穩
- [ ] 送審 — 注意 4.2：確保用起來像 App（原生導覽、可加推播 / 原生分享）

### Phase 4 — 訂閱（上架後再做）

- [ ] 整合 **RevenueCat + Apple IAP**
- [ ] 七天免費試用 = Apple **introductory offer**（不用自己寫試用倒數 / 扣款）
- [ ] 把「是否付費」設計成**單一 entitlement 狀態**（App 各處只問「is pro?」），並同步回 DB
- [ ] 付費牆揭露合規：清楚寫「試用幾天、之後多少錢、自動續訂」（RevenueCat 範本通常已符合）

---

## 4. 對外 API 端點盤點（給行動端打）

從前端 fetch 推得的敏感端點，全部都要 ownership 把關：

| 端點                                    | 方法           | 注意                                                          |
| --------------------------------------- | -------------- | ------------------------------------------------------------- |
| `/api/entries/[id]/history`             | GET            | 讀財務紀錄，`where` 要帶 `entry: { id, userId }`              |
| `/api/entries/[id]/history/[historyId]` | PATCH / DELETE | 已有 `verifyHistoryOwnership`，確認實作正確即可               |
| `/api/stocks/price`                     | GET            | 抓 Yahoo 公開行情，敏感度低，建議加 rate limit 防被當免費代理 |
| `/api/stocks/dividend`                  | GET            | 同上                                                          |

---

## 5. 成本快覽

| 項目                    | 費用                      | 時間點       |
| ----------------------- | ------------------------- | ------------ |
| Apple Developer Program | 99 USD / 年               | 送審前       |
| Supabase Pro            | ~25 USD / 月              | 公開上線前   |
| Expo EAS Build          | 有免費額度，超量計費      | 打包時       |
| Apple IAP 抽成          | 15%（年營收 <100 萬美元） | 開始收訂閱後 |

---

## 6. 建議順序總結

1. **Phase 0**（帳號 + Supabase Pro + 安全收尾）→ 可與 Phase 1 同時進行
2. **Phase 1 → 2**（RN 骨架 → UI 移植）
3. **Phase 3**（先以免費 App 過審 + TestFlight）
4. **Phase 4**（過審後再加訂閱）

> 原則：**重構與金流分開做。** 先把 RN 版做到能登入、能用、過審；訂閱當獨立一輪，因為內購本來就要 App 進到 App Store Connect 後才測得了。

> **未來選項（現在別做）**：等手機成為唯一客戶端、上線穩定後，可評估把 API 搬進 Expo Router 的 server routes、收掉 Next.js，變成單一 Expo 專案，少維護一個框架。但現有 Next API 跑得好又有安全把關，沒理由現在打掉重練——留到後面再看。
