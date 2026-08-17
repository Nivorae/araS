# 淨資產成長折線圖 — 設計

日期：2026-08-11
分支：`feature/net-worth-growth-chart`

## 問題

「投資損益 › 走勢」目前顯示的長條圖沒有真實歷史。`valueSnapshots` 不是後端資料，
而是 `store/financeStore.ts` 的 `makeSnapshot(entries)` 在記憶體裡即時算出來的；
`hooks/useFinanceActions.ts` 每次開 App 只塞一筆「今天」的快照。因此那張跨 5 個月
的圖永遠是 4 個空月份加上今天一根，看不出任何成長。

真實歷史其實已經存在資料庫：`EntryHistory` 在每筆資產建立時（`entries.service.ts:127`）
以及每次金額變動時（`entries.service.ts:153`）都會寫入一列，含 `balance` 與可回填的
`createdAt`。把每個 entry 的 balance 時間軸加總，就能還原任何一天的淨資產。

## 決策

| 項目     | 決定                                                  |
| -------- | ----------------------------------------------------- |
| 資料來源 | 後端由 `EntryHistory` 還原（不新增快照表、不用 cron） |
| 位置     | 取代「投資損益 › 走勢」的長條圖，不新增分頁           |
| 線條     | 只畫淨資產一條，線下加漸層填色                        |
| 時間範圍 | 三顆膠囊：`6M` / `1Y` / `全部`                        |
| 付費區隔 | 全部免費（現有免費功能的品質修復，不收進付費牆）      |
| 死碼     | 一併刪除被取代的假快照鏈路                            |

## 後端

### `GET /api/entries/net-worth-history?range=6m|1y|all`

新增 `entriesService.getNetWorthHistory(userId, range)`：

1. 撈該用戶所有 `includeInChart: true` 的 entry，取 `{ id, topCategory }`。
   與 `getAssetAllocation` 同一條納入規則。
2. 撈這些 entry 的 `EntryHistory`，取 `{ entryId, balance, createdAt }`，
   依 `createdAt` 遞增排序。
3. 建期間桶：
   - `6m` → 最近 6 個月桶
   - `1y` → 最近 12 個月桶
   - `all` → 從最早一筆 history 到今天；跨度超過 24 個月改用年桶，避免點過密
4. 每個桶取「桶結束時間點」的狀態：每個 entry 取 `createdAt <= 桶結束` 的最後一筆
   `balance`。沒有任何一筆的 entry 代表當時尚未存在，不計入該桶。以單一指標掃過
   排序後的列，不做 N×M 巢狀查找。
5. 依 `LIABILITY_SET` 分資產／負債，算出 `netWorth = totalAssets - totalLiabilities`。
6. 回傳 `{ range, points: [{ period, date, totalAssets, totalLiabilities, netWorth }] }`。

路由沿用既有樣板：`auth()` 無 `userId` 則 `logSecurityEvent` + 401、Zod 驗 `range`
（預設 `6m`）、成功走 `ok()`、例外走 `handleError()`。不做 Premium gate。

### Shared

`packages/shared/src/schemas/finance.ts` 新增 `NetWorthPointSchema`、
`NetWorthHistorySchema`、`NetWorthRange`，前後端共用。

## Mobile（純 JS）

- 新元件 `components/NetWorthChart.tsx`：`react-native-svg` 的 `<Path>` 單線，
  `<Defs><LinearGradient>` 做線下漸層。沿用 `InvestmentChart` 既有的 `niceCeil`
  Y 軸刻度與點按 tooltip 作法。所有座標在進 SVG 前以 `Number.isFinite` 過濾 —
  非有限數會讓 iOS 硬 crash。
- `store/financeStore.ts` 新增 `netWorthHistory: Partial<Record<NetWorthRange, NetWorthPoint[]>>`
  快取與 setter。
- `hooks/useFinanceActions.ts` 新增 `fetchNetWorthHistory(range)`：抓過的範圍不重抓。
- `app/(app)/(tabs)/transactions.tsx`：「走勢」改渲染 `NetWorthChart`，圖上方加
  `6M / 1Y / 全部` 三顆膠囊（沿用現有 `toggleRow` 樣式）。天平區與「配置」分頁不動。

## 死碼清除

被取代後即無使用者，一併刪除，避免日後又有人拿假快照畫圖：

- `components/InvestmentChart.tsx`
- `lib/chartAggregation.ts` 的 `aggregateSnapshots`、`InvestmentPoint`
- `store/financeStore.ts` 的 `valueSnapshots` slice 與 `makeSnapshot`，
  以及 `addEntryLocal` / `updateEntryLocal` / `deleteEntryLocal` 三處呼叫
- `hooks/useFinanceActions.ts` 中 `setData` 的 `valueSnapshots` 欄位

`aggregateTransactions` 保留 — 後續的記帳功能會用到。
`ValueSnapshotSchema` 保留在 shared（web 端仍可能參照，且刪除不屬本次範圍）。

## 測試

`apps/web/tests/services/entries.service.test.ts` 補 `getNetWorthHistory`：

- 多個期間桶，各桶取到正確的期末 balance
- entry 在中途才建立 → 之前的桶不計入該 entry
- 負債分類扣減淨資產
- `includeInChart: false` 的 entry 被排除
- 完全沒有 history → 回空點陣列而非拋錯

## 已知限制

`EntryHistory` 對 `Entry` 是 `onDelete: Cascade`。刪除一筆資產會連同其歷史一起消失，
圖上過去的淨資產會被回溯改寫。要修正需改為軟刪除，不在本次範圍。

## 發布

Road A（OTA）。`apps/mobile/app.json` 的 `version` 維持 `1.2` 不動 —— 因為
`runtimeVersion.policy` 是 `appVersion`，改版號會讓更新無法送達任何已安裝的裝置。

順序有相依性：後端必須**先** merge 進 `main` 部署到 Vercel，OTA 才有 API 可打。
