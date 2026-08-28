# 目前進度

> 這份文件取代記憶體裡的 `project_open_tasks_*` 系列。跟著 git 走、隨時可看，
> 不需要透過 Claude 對話才能存取。過時的段落請直接刪掉或改掉，不用保留歷史 ——
> 歷史交給 git log 和 CHANGELOG.md。

最後整理：2026-08-28

## 下一步（下週從這裡接手）

PR #121 已於 2026-08-28 合併進 `develop`（merge commit `2a57eac`），內容是：
每月記帳提醒（含可調時間）、基金淨值（入口先關著）、網址尾斜線修正。
`pnpm lint` / `type-check` / `test`（web 240 + shared 12）在合併前全綠。

剩下兩件事，順序無關：

### A. `www.arasasset.com` 的 DNS — 只能在後台做

現況：**NXDOMAIN**，輸入 www 會連不上（apex `arasasset.com` 正常，A 記錄指向
`216.198.79.65` / `64.29.17.65`）。

- [ ] Vercel → 專案 → Domains → **Add Existing** → `www.arasasset.com`
      ⚠️ **不要**去改 apex 那一列的設定，它必須維持
      「Connect to an environment → Production」。在 apex 上按到 Redirect 會讓
      正式站整個重導出去
- [ ] 照 Vercel 給的值在 Cloudflare 加 CNAME（通常是 `www → cname.vercel-dns.com`），
      **Proxy status 必須是 DNS only（灰雲）** —— 開橘雲 Vercel 簽不到憑證
- [ ] 等 www 那列變 Valid Configuration，再在**那一列**按 Edit →
      Redirect to Another Domain → `arasasset.com` → 把 307 改成 **308 Permanent**
      （永久重導才會把 SEO 權重併到 apex，307 會讓兩個網址各自獨立）
- [ ] 弄完覆查：DNS 有記錄、`https://www.arasasset.com` 回 308 且 Location 指向
      apex、憑證有簽出來

### B. Native rebuild + 送審

這批**不能 OTA**：`expo-notifications` 是原生模組，且 `app.json` 的 `plugins`
有變更。照 `mobile-release` 的判斷表走 Road B。

- [ ] `app.json` 的 `version` 從 `1.3` 往上跳（它同時是 `runtimeVersion`，
      policy 是 `appVersion`）
- [ ] 更新 `app.json` 的 `extra.whatsNew`（目前還停在 2026-08-26 的空白狀態
      動畫那版），至少要寫「每月記帳提醒」
- [ ] `eas build` → `eas submit` → App Store Connect 送審
      ⚠️ 合併前就在跑的那支 production build **不含**這次的通知功能，要重跑
- [ ] 上架後才驗得準的一項：**點通知回首頁**。Expo Go 裡通知掛在 Expo Go 名下，
      完全滑掉時點擊只會開 Expo Go 首頁，不是程式的問題
- 送審前記得確認 EAS 配額（上次確認：2026-08-04 起新週期，iOS 1/15，可用到 9/1）

## 已完成但還沒放出來的功能

### 基金淨值 — 程式碼在 develop 上，入口關著

實機驗證通過（搜尋 → 綁定 → 取淨值 → 市值都正確），2026-08-28 決定先不對使用者
開放。開關是 `apps/mobile/lib/stockConstants.ts` 的 **`FUND_NAV_ENABLED`**
（現為 `false`）：關著時詳情頁沒有「獲取淨值／更新淨值」與「重新選擇基金」、
不抓淨值、已綁定的基金也不併入清單市值。

後端 `/api/funds/*`、服務層與 15 個測試都留著，`Entry.stockCode` 上綁好的代碼
也留著 —— 要放出來把旗標改成 `true` 即可，不需要重寫。資料源與四個實測踩到的
坑記在 `docs/superpowers/specs/2026-08-28-fund-nav-design.md`。

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
