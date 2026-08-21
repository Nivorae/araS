# 目前進度

> 這份文件取代記憶體裡的 `project_open_tasks_*` 系列。跟著 git 走、隨時可看，
> 不需要透過 Claude 對話才能存取。過時的段落請直接刪掉或改掉，不用保留歷史 ——
> 歷史交給 git log 和 CHANGELOG.md。

最後整理：2026-08-21

## 進行中

### 1. 每月記帳提醒通知 — 已設計，尚未實作

Spec 在 `docs/superpowers/specs/2026-08-13-monthly-reminder-notification-design.md`
（PR #96 合入）。本機通知，`expo-notifications` calendar trigger 每月 1 號 9:00
重複，不動後端與資料庫。設定頁加 Switch 卡片、預設關閉。

- [ ] 尚未開始寫 plan、尚未實作
- 註：**需要 native rebuild**（`expo-notifications` 是原生模組，OTA 送不了），
  所以排程上適合跟下一次上架版本綁在一起做。

### 2. 1.3 native 上架 — build 已送出，等 Apple 審查

`app.json` 已 bump 到 1.3（build 9），`eas submit` 完成，Apple 正在處理中。
含股利編輯（mobile + web，`expo-haptics` 長按觸覺回饋）+ 上個 session 的 UI
調整（設定頁鈴鐺、新增紀錄預覽卡、分類選擇器重設計、資產配置台股/美股比例）。

- [x] `eas build --profile production --platform ios` 完成，build number 9
- [x] `eas submit --platform ios --latest` 完成，已上傳 App Store Connect
- [ ] 在 ASC 手動：新增版本 1.3 → 順便改 App 名稱為「araS資產紀錄」→ 貼上
      `CHANGELOG.md` 1.3 的文案 → 選 build 9 → 送出審查
- [ ] 每月記帳提醒通知（上面第 1 項）若還沒做，這次沒一起上——下次原生打包
      再排。

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
