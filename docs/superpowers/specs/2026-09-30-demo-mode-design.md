# 示範模式（Demo Mode）設計文件

**狀態：設計已討論完成，待審閱（2026-09-30）。尚未實作。**

## 問題

手機版有六個付費入口（第 21 筆資產、保單、股息、股息再投入、資產配置、理財規劃）。
其中多數功能「沒有資料就看不出價值」—— 免費使用者在付費牆前只看得到一串文字說明，
沒辦法實際摸到功能。

## 目標

讓**已登入的免費使用者**按一顆按鈕，就進入一個資料已經打好、所有 Premium 功能
都解鎖的狀態，用跟正式版完全相同的畫面實際操作，再決定要不要付費。

成功的樣子：

- 使用者從任何付費牆都能一鍵進入示範，並直接落在他剛剛被擋下的那個功能。
- 示範中可以新增、修改、刪除，筆數不限。
- 示範中的任何操作都**不會**碰到使用者的真實資料，也不會寫進資料庫。
- 示範模式沒辦法被當成免費的 Premium 長期使用。

## 不做的事

- **未登入訪客的示範**（歡迎頁「先逛逛」）。行情 API 需要登入，範圍會變大；之後可疊加。
- **首頁空狀態的示範入口**。新使用者此時該先建立自己的第一筆資產；上線後看數據再議。
- **示範資料的本機暫存**。App 被系統結束後示範即消失，第一版接受這個行為。
- **單次示範的總時長上限、新增筆數上限**。先只靠背景逾時（見下）防濫用。
- **Apple 免費試用期**（App Store Connect 的 introductory offer）。是獨立項目，與本設計互不影響。
- **Web 版**。Web 已有自己的訪客示範（`useFinanceStore` + `data/demo.json`），不動。
- **後端**。本設計不新增、不修改任何 API 或資料表。

## 使用者體驗

### 入口（兩處，Premium 使用者都不顯示）

1. **付費牆**（`app/(app)/paywall.tsx`）：購買按鈕下方的次要按鈕「先用示範資料體驗」。
   依進入付費牆時的 `source` 決定落點：

   | `source`                                               | 示範落點                 |
   | ------------------------------------------------------ | ------------------------ |
   | `allocation_tab`                                       | 資產損益頁的「配置」分頁 |
   | `dividend_tab` / `dividend_form` / `dividend_reinvest` | 資產損益頁的「股息」分頁 |
   | `insurance_form`                                       | 保單總覽                 |
   | `finance_planning`                                     | 退休頁的「理財規劃」模式 |
   | `entry_limit` / `settings_card` / `unknown`            | 首頁                     |

2. **設定頁**（`app/(app)/settings.tsx`）：「升級 Premium」卡片旁新增一列「體驗完整功能」，落點為首頁。

### 示範中

- 畫面與正式版完全相同，沒有另一套 UI。
- 頂端常駐一條橫幅：「示範資料 · 修改不會儲存」，附「升級」與「離開示範」兩顆按鈕。
- 所有 Premium 功能直接可用，不會再跳付費牆，沒有 20 筆上限。
- 內建資料是一套**寫死的範例**，每個類別各有一筆，讓使用者一進去就看到每個分類、
  每個 Premium 畫面都有內容的完整狀態（見下方「示範資料」）。
- 股價、配息率、匯率、基金淨值照常打真的後端（使用者已登入）。

### 示範資料

內容（名稱、金額、單位數、代號）全部寫死在 `lib/demo/seed.ts`，每次進入示範都是
同一套，不隨機、不依使用者的真實資料產生。

**資產／負債：`lib/categoryConfig.ts` 的每個最末層分類各一筆，共 19 筆。**

| 大類     | 各一筆的分類                                      |
| -------- | ------------------------------------------------- |
| 流動資金 | 現金、Line Pay、Apple Pay、街口支付、金融卡、其他 |
| 負債     | 貸款（附貸款明細）、信用卡、其他負債              |
| 投資     | 投資基金、台股、美股、加密貨幣、貴金屬、其他投資  |
| 固定資產 | 房屋、車輛、其他資產                              |
| 應收款   | 一般應收款                                        |

**保險：`InsuranceForm` 的七個險種各一張保單**（各自帶出對應的 Entry）。

**讓其他畫面有內容的配套資料：**

- 台股、美股各有數筆股息紀錄，其中至少一筆已再投入。
- 收入與支出交易，涵蓋過去數個月；至少一筆定期交易。
- 每筆資產／負債過去 12 個月的歷史，讓淨值成長圖有完整曲線。

**日期是唯一不寫死的部分**：以「今天往回推 N 天／N 個月」表示。若寫死成實際日期，
幾個月後淨值圖的最後一點會停在過去，示範看起來像壞掉。

分類清單日後若有增減，種子資料要跟著補。險種由測試直接比對 `@repo/shared` 的
`INSURANCE_TYPES`，新增險種而漏補會讓測試失敗；資產分類定義在 `categoryConfig.ts`
（依賴圖示套件，測試環境載不進來），測試裡只能比對一份抄寫的 19 項清單，所以新增
分類時要人工記得補。

### 離開

| 觸發                       | 行為                                                      |
| -------------------------- | --------------------------------------------------------- |
| 按「離開示範」             | 確認對話框（提醒修改不會儲存）→ 清空示範資料 → 回首頁     |
| 按「升級」                 | 直接離開示範（不再確認）→ 開啟付費牆                      |
| App 在背景超過 **10 分鐘** | 回到前景時自動離開示範，回首頁，並以 Alert 告知示範已結束 |
| App 被滑掉或被系統結束     | 示範狀態只存在記憶體，重開後自然回到真實帳號              |
| 登出                       | 離開示範                                                  |

10 分鐘逾時是防濫用的唯一機制：記帳的真實用法跨越數天，沒有人能每 10 分鐘回來
維持一次。

### 示範中被封鎖的操作

作用在真實帳號上，示範中一律隱藏入口，且示範 API 層再擋一次：

- 刪除帳號（`DELETE /api/account`）
- 購買、恢復購買（示範中不會進到付費牆；按「升級」會先離開示範）
- 開發用的模擬訂閱開關（`POST /api/dev/subscription`）

另外兩項是實作時補上的：

- **退休頁的試算參數與薪資試算器**存在手機本機（AsyncStorage），不經過 API。示範中
  照常可以調，但不寫回本機，離開示範後恢復成使用者自己的數字。
- **沒有商店的平台（目前的 Android）不顯示兩個示範入口。** 那裡的免費使用者買不到
  訂閱，示範完也無處可升級。

## 架構

切換點只有一個：**`useApi()`**。手機版所有資料請求都經過它（約 30 支 API，
絕大多數集中在 `hooks/useFinanceActions.ts`），所以畫面與 `useFinanceActions`
都不需要知道示範模式的存在。

```
畫面 → useFinanceActions → useApi() ─┬─ 正常：createApi(getToken) → 後端
                                     └─ 示範：createDemoApi(realApi) ─┬─ 行情類路徑 → realApi（真後端）
                                                                       └─ 其餘路徑 → 記憶體裡的示範引擎
```

### 新增的單元

| 檔案                                | 職責                                                                                                                   | 依賴                      |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| `lib/demo/seed.ts`                  | 寫死的示範資料（每個類別一筆）。只有日期以「今天」為基準往回推算                                                       | `@repo/shared` 型別       |
| `lib/demo/engine.ts`                | 記憶體裡的假後端：持有資料、處理 CRUD 與連動邏輯。**純 TypeScript，不 import 任何 RN／Clerk／`lib/api`**，以便單獨測試 | `seed.ts`、`@repo/shared` |
| `lib/demo/demoApi.ts`               | 實作 `Api` 介面。把 `method + path` 對應到引擎的函式；行情類路徑轉給真 API；未知路徑丟 `ApiError("DEMO_UNSUPPORTED")`  | `engine.ts`、`lib/api`    |
| `lib/demo/router.ts`                | 把 `method + path` 對應到引擎的函式。純 TypeScript                                                                     | `engine.ts`               |
| `lib/demo/landing.ts`               | 付費牆 `source` → 示範落點路由。純 TypeScript                                                                          | `analytics/events`        |
| `lib/demo/session.ts`               | `enterDemo()` / `exitDemo()`：清快取、切換 store、送分析事件、逾時提示                                                 | 上列各項                  |
| `store/demoStore.ts`                | zustand：`engine`、`generation`、`enteredAt`、`pendingNav`                                                             | `engine.ts`               |
| `components/DemoBanner.tsx`         | 頂端橫幅與兩顆按鈕                                                                                                     | `demoStore`               |
| `hooks/useDemoBackgroundTimeout.ts` | 監聽 `AppState`，背景超過 10 分鐘即 `exit("timeout")`                                                                  | `demoStore`               |

### 修改的單元

- **`lib/api.ts` `useApi()`**：讀 `demoStore.active`，為 true 時回傳 demo API。兩種
  狀態各自維持穩定的參考（現有註解說明了為何 `api` 不能每次 render 換新）；只有
  進出示範那一刻參考會換，這正好讓依賴 `api` 的 effect 重新抓取。
- **`hooks/useIsPremium.ts` `PremiumProvider`**：示範中對外提供 `isPremium: true`、
  `loading: false`。真實的權限值照常保留在內部，離開示範後立即恢復，不需重抓。
  示範中 `refresh()` 不發請求。
- **`store/financeStore.ts`**：新增 `reset()`，把所有 slice 清回初始值。
- **`hooks/useCachedFetch.ts`**：匯出 `clearCachedFetch()` 清空模組層級快取。
- **`hooks/useFinanceActions.ts`**：匯出清空 `netWorthHistoryInFlight` 的函式。
- **`hooks/useFinanceActions.ts`**：`fetchAll` 等會寫入 store 的讀取，在寫入前確認
  `demoStore.generation` 與發出請求時相同，否則丟棄回應。
- **`app/(app)/_layout.tsx`**：掛上 `DemoBanner` 與 `useDemoBackgroundTimeout`；
  `<Stack>` 以 `demoStore.generation` 為 `key`，進出示範時整個畫面樹重新掛載。
  這是為了清掉畫面自己持有的狀態 —— 分頁畫面掛載後不會卸載，
  `(tabs)/_layout.tsx` 的 `DataLoader` 也只在第一次掛載時 `fetchAll()`，不重新
  掛載的話舊資料會留在畫面上。`AppLockGate` 與 `PremiumProvider` 在 `key` 之外，
  不受影響。
- **`app/(app)/(tabs)/transactions.tsx`、`retirement.tsx`**：接受路由參數
  （`?view=allocation|dividends`、`?mode=finance`）以便直接落在指定分頁。
- **`app/(app)/paywall.tsx`、`app/(app)/settings.tsx`**：加入口；設定頁在示範中隱藏
  刪除帳號、訂閱相關列與開發用開關。
- **`lib/analytics/events.ts`、`docs/analytics.md`**：見「分析事件」。

### 進出示範的順序（資料隔離的關鍵）

真實資料與示範資料共用同一個 `financeStore` 和同一批模組層級快取，所以切換時
必須先清乾淨，否則一邊的資料會漏到另一邊的畫面上。

**進入** `enterDemo(source)`：

1. `financeStore.reset()`、`clearCachedFetch()`、清空 `netWorthHistoryInFlight`。
2. 建立新的引擎實例（全新的一套種子資料）放進 `demoStore`，`generation + 1`
   （`useApi()` 隨即換成 demo API，畫面樹重新掛載）。
3. 導向落點；重新掛載的 `DataLoader` 呼叫 `fetchAll()`，拿到的是示範資料。

**離開** `exitDemo(reason)`：

1. 同樣三項清空。
2. 丟棄引擎實例，`generation + 1`。
3. 導向首頁（按「升級」則再推入付費牆；登出不導向）；`fetchAll()` 拿回真實資料。

示範中的寫入**完全不發網路請求** —— 這是「不會動到真實資料」的保證，不靠後端
任何旗標。

## 示範引擎要涵蓋的 API

路徑以手機版實際呼叫為準（2026-09-30 清點）。

**單純的增刪改查**

- `/api/entries`（GET / POST）、`/api/entries/:id`（PUT / DELETE）
- `/api/transactions`（GET / POST）、`/api/transactions/:id`（DELETE）
- `/api/portfolio`（GET / POST）、`/api/portfolio/:id`（PUT / DELETE）
- `/api/recurrences`（GET / POST）、`/api/recurrences/:id`（PUT / DELETE）
- `/api/insurances`（GET）、`/api/insurances/:id`（GET / PATCH / DELETE）
- `/api/dividends`（GET，含 `?entryId=`）

**有連動邏輯，需在引擎內重寫簡化版**

| API                                                | 連動                                                                                          |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `POST/PUT /api/entries*`                           | 每次異動寫一筆 `EntryHistory`                                                                 |
| `GET /api/entries/:id/history`                     | 回傳該筆的歷史                                                                                |
| `GET /api/entries/net-worth-history`               | 由所有 `EntryHistory` 依 `range` 重建淨值曲線（尊重 `includeInChart`）                        |
| `GET /api/entries/allocation`                      | 依分類彙總資產配置                                                                            |
| `PATCH/DELETE /api/entries/:id/history/:historyId` | 改或刪一筆歷史，後續各筆的餘額一起位移，Entry 的值由最後一筆回推                              |
| `POST /api/loans`、`PATCH /api/loans/:id`          | 建立貸款時同時建立負債 Entry 與歷史；改總額時寫一筆歷史                                       |
| `POST /api/entries/transfer`                       | 同時更新來源與目標兩筆，各寫一筆歷史                                                          |
| `POST /api/insurances`                             | 同時建立對應的 `Entry`（`value: 0`、`includeInChart: false`），回傳 `{ ...insurance, entry }` |
| `POST /api/dividends`                              | 入帳時更新對應 Entry 的值並寫歷史                                                             |
| `PATCH/DELETE /api/dividends/:id`                  | 先沖銷該筆股息造成的歷史與收入交易，再重放（刪除則不重放）                                    |
| `POST /api/dividends/:id/reinvest`                 | 更新 Entry 的單位數與值並寫歷史                                                               |
| `GET /api/dividends/summary`                       | 彙總股息統計                                                                                  |
| `POST /api/recurrences/process`                    | 固定回 `{ created: 0 }`（種子資料已包含產生好的交易）                                         |

**其他**

- `GET /api/entitlements`：不會被呼叫（`PremiumProvider` 在示範中不發請求）；引擎仍回 `{ isPremium: true }` 作保險。
- `DELETE /api/account`、`POST /api/dev/subscription`：丟 `ApiError("DEMO_BLOCKED")`。
- `/api/stocks/*`、`/api/funds/*`、`/api/exchange-rate`、`/api/quotes/*`、`/api/cathaylife-rates`：轉給真 API。

### 已知的取捨：計算邏輯會有兩份

後端這些連動邏輯寫在 `apps/web/services/*`，與 Prisma 綁在一起，第一版**不**為了
共用而重構後端 —— 引擎裡是獨立的簡化實作。代價是後端之後若改了計算方式，示範
模式不會自動跟上，兩邊數字可能不一致。緩解方式：

- 回傳型別一律用 `@repo/shared` 的型別，後端改了回傳格式時 `tsc` 會報錯。
- 引擎測試以後端服務測試的案例為藍本，後端改邏輯時有對照。
- 示範資料是假的，數字有小誤差不影響使用者的真實帳務。

## 分析事件

示範中的操作不能污染既有漏斗。

- **示範中不送** `record_created`、`first_record_created`。後者每台裝置一生只送一次，
  被示範資料觸發會永久毀掉那台裝置的數據，所以示範中連「已送過」的標記也不寫。
- **新增事件**（定義在 `lib/analytics/events.ts`，不寫字串字面量）：
  - `demo_entered`：`{ trigger_source: PaywallSource }`
  - `demo_exited`：`{ reason: "manual" | "upgrade" | "timeout" | "sign_out"; seconds_in_demo: number }`
- **新增 `PAYWALL_SOURCES.DEMO_BANNER`**：從示範橫幅按「升級」進入付費牆時使用，
  這樣才答得出「示範模式帶來多少付費」。
- `docs/analytics.md` 補上事件定義與「示範 → 付費」轉換率的公式。

## 錯誤處理

- 引擎收到不認得的路徑：丟 `ApiError("DEMO_UNSUPPORTED", "示範模式不支援此操作", 0)`。
  畫面既有的錯誤處理會顯示訊息；這同時是開發期發現漏接 API 的手段。
- 找不到的 id：丟 404 的 `ApiError`，與後端行為一致（`deleteEntry` 依賴這點）。
- 行情 API 失敗：沿用現有行為，與示範無關。
- 進入示範時若畫面上還有進行中的真實請求：因為 `netWorthHistoryEpoch` 與 store
  已重置，晚到的回應會被既有的 epoch 檢查丟棄；`fetchAll` 的晚到回應則可能覆寫
  示範資料 —— 實作時需在 `fetchAll` 寫入 store 前確認示範狀態與發出請求時一致。

## 測試

手機版目前沒有測試框架（`apps/mobile/package.json` 只有 `lint` 與 `type-check`），
而在 `apps/mobile` 新增依賴有改變 OTA fingerprint 的風險。因此：

- `engine.ts` 與 `seed.ts` 保持純 TypeScript，測試放在 `apps/web/tests/mobile-demo/`，
  用 web 既有的 vitest 以相對路徑 import。涵蓋：每支 API 的 CRUD、上表每一條連動、
  種子資料涵蓋每個最末層分類與每個險種、兩個引擎實例互不影響。
- 若實作時發現 web 的 vitest 無法乾淨地 import 手機端檔案，退而求其次：引擎不寫
  自動化測試，改列一份逐條的手動驗證清單，並在計畫中明確記錄這個降級。
- 其餘（橫幅、入口、進出流程、背景逾時、資料隔離）在實機手動驗證：
  1. 真實帳號有資料 → 進示範 → 看到的全是示範資料。
  2. 示範中新增／修改／刪除各類資料 → 離開 → 真實資料一筆都沒變（並在 Prisma Studio 確認資料庫沒有新列）。
  3. 六個付費入口各自進示範，落點正確。
  4. 背景 10 分鐘後回來，示範已結束。
  5. 示範中設定頁沒有刪除帳號與訂閱相關項目。
- `pnpm lint`、`pnpm type-check`、`pnpm test` 全過。

## 發布

純 JS 改動，不新增原生套件。實際走 OTA 還是 native build 由 `/mobile-release`
依當時狀況判斷（`docs/TODO.md` 記載 1.5 之後的 OTA 有 fingerprint 前置條件）。
