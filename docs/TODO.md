# 目前進度

> 這份文件取代記憶體裡的 `project_open_tasks_*` 系列。跟著 git 走、隨時可看，
> 不需要透過 Claude 對話才能存取。過時的段落請直接刪掉或改掉，不用保留歷史 ——
> 歷史交給 git log 和 CHANGELOG.md。

最後整理：2026-08-14

## 進行中

### 1. 股票股息紀錄（Premium）— 開發完成，待上線

`feature/stock-dividends`，14 個實作 task + Task 15 全套驗證皆完成，
`pnpm lint && pnpm type-check && pnpm test` 全綠。內容：Premium 專屬的股票股
息紀錄，可手動輸入每檔股票的股利、可選入帳到流動資金帳戶、一鍵再投資回同一
檔股票。

**上線順序（不可調換）：**

1. 對正式環境的 Supabase 專案直接跑 migration —— **不要**依賴 `.env`（依
   CLAUDE.md 規定永遠指向 dev 專案）也**不要**指望 Vercel 部署會做這件事：
   `apps/web/package.json` 的 build command 是 `prisma generate && next build`，
   沒有 `prisma migrate deploy` 這一步，單獨部署 web 不會在正式環境建出
   `Dividend` 資料表。改用內嵌環境變數、只對這一次指令生效的方式，明確指向
   正式環境的 `DATABASE_URL`/`DIRECT_URL`：

   ```bash
   DATABASE_URL="<正式環境 pooler URL>" DIRECT_URL="<正式環境 direct URL>" \
     pnpm --filter @repo/web exec prisma migrate deploy
   ```

2. 照常把 web 部署到 Vercel
3. 確認生產 API 可用 —— 具體檢查：已登入使用者呼叫
   `GET /api/dividends/summary` 要回 `200`，不是 `500`
4. 都確認過後，才對 mobile 發 `eas update`

順序反過來的話，OTA 會先送到裝置上，裝置卻查詢一張還不存在的資料表。

**尚未完成：裝置實測。** 目前沒有任何 subagent 有實體裝置可測，以下項目都還
沒有在真機上驗證過：

- [ ] 用 Premium 帳號新增一筆股利、選擇入帳到某個流動資金帳戶，該帳戶餘額
      確實增加對應金額
- [ ] 再投資 sheet 的三行摘要正確，確認送出後同時扣銀行、加回同一檔股票的
      零股股數
- [ ] 長按刪除該筆股利紀錄後，兩邊餘額（銀行與股票）都完整回復到沖銷前的
      原始金額
- [ ] 非 Premium 帳號嘗試新增股利時，出現 paywall 而不是真的存進資料庫

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

## 如何使用這份文件

- 完成的項目打勾就好，不用整段留著當「已完成紀錄」—— 那是 CHANGELOG.md 和 git
  log 的工作。
- 一個項目徹底做完（含 merge）就整段刪掉，不要移到「已完成」區塊累積。
- 新任務浮現就加進「進行中」，不用等我或你主動想到才補。
