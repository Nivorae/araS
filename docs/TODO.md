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
- [x] `app.json` 的 `plugins` 加入 `expo-notifications`；root layout 設定前景
      顯示 handler 與「點通知回首頁」的 response listener
- [x] `pnpm lint` / `type-check` / `test`（225 tests）全數通過
- [ ] Expo Go 實機驗證：把 trigger 暫時改成幾分鐘後，確認排程／取消／點擊導向，
      驗完改回 `day: 1, hour: 9`
- 註：**需要 native rebuild**（`expo-notifications` 是原生模組，且 `app.json` 的
  `plugins` 已變更，OTA 送不了），所以要跟下一次上架版本綁在一起發。

### 3. 基金淨值更新（含境內外）— 設計階段

- [x] 境外基金：已驗證免費可行。集保結算所 TDCC open data
      `https://openapi.tdcc.com.tw/v1/opendata/3-4`，無需 API key、無需註冊，
      單次回應含基金代碼、名稱、淨值、淨值日期、計價幣別、ISIN（整包 dump，
      5,990 檔，360KB，建議 server 端快取 12h 再讓 App 查單一檔）
- [ ] 境內基金資料源尚未確認（TDCC 沒有，歸投信投顧公會 SITCA 管，其官網是
      ASP.NET viewstate，還沒驗證是否有其他免費 JSON 源）
- [ ] 定案：`Entry.stockCode` 存基金代碼（沿用既有多型欄位，不需 migration）；
      淨值/幣別 on-demand 抓取、不落地存資料庫（跟美股現在的模式一致）
- [ ] 使用情境已定案：entry 清單/詳情頁上的「獲取淨值」按鈕，第一次按時用
      使用者輸入的名稱去搜尋比對、綁定官方代碼寫回 `stockCode`，之後每次按
      直接用代碼查
- [ ] 尚未開始寫 spec / plan

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
