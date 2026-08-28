# 目前進度

> 這份文件取代記憶體裡的 `project_open_tasks_*` 系列。跟著 git 走、隨時可看，
> 不需要透過 Claude 對話才能存取。過時的段落請直接刪掉或改掉，不用保留歷史 ——
> 歷史交給 git log 和 CHANGELOG.md。

最後整理：2026-08-28

## 進行中

### 1. `arasasset.com` Safe Browsing 旗標 — 已解除（2026-08-27）

Google 於 2026-08-27 來信通知安全性審核完成，判定網域不含惡意內容、警告訊息
即將撤下。覆查 Transparency Report 狀態 API，`arasasset.com` 與
`clerk.arasasset.com` 都已從 **2**（flagged）回到 **1**（乾淨）、所有分類旗標
false、時間戳不再凍結在 2026-08-21。全新安裝 Google 登入時閃紅色
「Deceptive Website Warning」的問題隨之結束。

旗標是誤判（新註冊網域 + 登入表單 + 理財字眼 + 攔 OAuth callback 的子網域）。
處理過程與證據留在記憶 `project_safe_browsing_domain_flag`。順手做掉的
`NEXT_PUBLIC_APP_URL` → `https://arasasset.com` 修正（canonical/OG 不再冒充舊站）
本身是對的，維持現狀。

- [x] 2026-08-27 實機驗證：重新用 Google 登入，紅色警告畫面已不再出現。本案結案
- [x] 2026-08-28 尾斜線的坑修掉了：三處各自重複的 `NEXT_PUBLIC_APP_URL` 讀取
      收斂成 `apps/web/lib/site-url.ts`，在那裡一次 `.replace(/\/+$/, "")`。
      `robots.ts`／`sitemap.ts`／`layout.tsx` 都改讀它
- [ ] 順帶、與本案無關：`www.arasasset.com` 沒有 DNS 記錄（NXDOMAIN，2026-08-28
      覆查仍然如此），輸入 www 會連不上。**這件事只能在 Cloudflare + Vercel 後台
      做，程式碼動不了**：Vercel 專案 Domains 加 `www.arasasset.com` 並設成
      redirect 到 apex，再照它給的值在 Cloudflare 加一筆 CNAME（proxy 關閉）

### 2. 每月記帳提醒通知 — 已實作，等實機驗證與發版

Spec 在 `docs/superpowers/specs/2026-08-13-monthly-reminder-notification-design.md`
（PR #96 合入）。本機通知，`expo-notifications` calendar trigger 每月 1 號 9:00
重複，不動後端與資料庫。設定頁加 Switch 卡片、預設關閉。

- [x] `apps/mobile/lib/notifications.ts`：排程／取消／查詢排程／權限，唯一碰
      原生 API 的地方。iOS 用可重複的 CALENDAR trigger（排一次系統自己接管）；
      Android 沒有等價觸發，改排「下一次」並在回到前景時續約
- [x] `apps/mobile/hooks/useMonthlyReminder.ts`：開關狀態存 AsyncStorage、預設
      關閉，載入時與每次回到前景都拿 OS 權限對齊 —— 使用者在系統設定裡收回權限
      時開關會自動退回關閉，不會顯示「開」但永遠不響
- [x] 設定頁新增 Switch 卡片變體（`SettingSwitchCard`），權限被永久拒絕時改跳
      App 內 Alert 引導去系統設定，開關留在關閉
- [x] 2026-08-28 追加：提醒時間可調（點卡片上的時間開 `TimePickerModal`，
      分鐘 5 分一級、純 JS 無新原生依賴）。日期仍固定每月 1 號。設計文件原本
      寫「不做時間選擇器」，已標記推翻
- [x] `app.json` 的 `plugins` 加入 `expo-notifications`；root layout 設定前景
      顯示 handler 與「點通知回首頁」的 response listener
- [x] `pnpm lint` / `type-check` / `test`（225 tests）全數通過
- [ ] Expo Go 實機驗證：把 trigger 暫時改成幾分鐘後，確認排程／取消／點擊導向，
      驗完改回 `day: 1, hour: 9`
- 註：**需要 native rebuild**（`expo-notifications` 是原生模組，且 `app.json` 的
  `plugins` 已變更，OTA 送不了），所以要跟下一次上架版本綁在一起發。

### 3. 基金淨值更新（含境內外）— 已實作，等實機驗證

設計與實測踩到的坑記在
`docs/superpowers/specs/2026-08-28-fund-nav-design.md`。

- [x] 境內資料源找到了：投信投顧公會 (SITCA) 每日淨值 CSV，掛在政府資料開放
      平臺 dataset 11109 —— 不必爬那個 ASP.NET viewstate 網站。約 600KB／
      4,244 檔。TDCC 只有境外與期信基金，沒有境內
- [x] 境外：TDCC open data 3-4，約 8.5MB／5,975 檔
- [x] `apps/web/services/funds.service.ts`：兩來源解析＋合併，模組層記憶體快取
      12h（8.5MB 超過 Next Data Cache 單筆 2MB 上限），併發共用同一次下載，
      單一來源掛掉仍然回得出另一邊
- [x] `GET /api/funds/search`、`GET /api/funds/quote`，兩支都自我保護並列入
      middleware 的 `auth.protect()` 名單
- [x] `Entry.stockCode` 存官方代碼（境內用基金統編、境外用 TDCC 代碼，兩邊
      代碼空間實測無交集），不需要 migration
- [x] App：詳情頁「獲取淨值／更新淨值」按鈕 + `FundPickerSheet` 綁定流程 +
      「重新選擇基金」；綁過的基金併入 `useInvestmentMarketValues`，清單與
      總覽的市值跟著更新
- [x] 15 個服務測試（含四個真實踩到的資料坑：基金代號跨投信重複、TDCC 的
      -9999 哨兵值、空字串變 0、兩份檔案 BOM 位置不同）
- [ ] 實機驗證：拿一檔真實持有的基金走一次「搜尋 → 綁定 → 更新淨值」，確認
      市值與損益數字合理
- 註：這部分是純 JS + 後端，可以 OTA；但會跟第 2 項的原生改動同一批發。

## 已評估、暫不執行

- **後端拆分到 Zeabur**：架構上可行（web 前端已經是乾淨的 HTTP 呼叫、沒有直接
  import service），但現階段不建議 —— 1.1 使用者的 API 位址寫死在 binary 裡
  拆不掉、App Store webhook 重新驗證成本高、訂閱才剛開始賣不宜同時搬家。若
  動機是「需要常駐運算」，中間路線是只把那部分放 Zeabur、主 API 留在 Vercel。
- **多幣別支援**：WON'T FIX，詳見記憶 `project_multi_currency_wontfix`。
- **CI 不會在 develop 上跑**：已知，刻意不修（見記憶
  `project_ci_never_runs_on_develop`）。
- **Vercel Preview 部署 500**：已知，刻意不修（見記憶
  `project_preview_deploys_wontfix`）。
- **強制更新閘門（非 OTA）＋ App 內更新紀錄畫面**：2026-08-21 設計完成後決定
  不做。兩者都是使用者無感的基礎建設，現階段使用者規模小到「真的出事直接聯絡
  本人」比擋板還快；更新紀錄則幾乎沒人會看。設計文件已刪除，內容留在 git
  commit `0f37365`，若日後後端要做不相容變更再撿回來 —— 注意那時擋板已經來不及
  發給舊 binary，這個時間差是當初唯一的論據。

## 如何使用這份文件

- 完成的項目打勾就好，不用整段留著當「已完成紀錄」—— 那是 CHANGELOG.md 和 git
  log 的工作。
- 一個項目徹底做完（含 merge）就整段刪掉，不要移到「已完成」區塊累積。
- 新任務浮現就加進「進行中」，不用等我或你主動想到才補。
