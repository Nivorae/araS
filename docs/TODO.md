# 目前進度

> 這份文件取代記憶體裡的 `project_open_tasks_*` 系列。跟著 git 走、隨時可看，
> 不需要透過 Claude 對話才能存取。過時的段落請直接刪掉或改掉，不用保留歷史 ——
> 歷史交給 git log 和 CHANGELOG.md。

最後整理：2026-09-01

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

### B. Native rebuild + 送審（iOS 1.4）

這批**不能 OTA**：`expo-notifications` 是原生模組，且 `app.json` 的 `plugins`
有變更。照 `mobile-release` 的判斷表走 Road B。

- [x] `app.json` 的 `version` 1.3 → **1.4**（它同時是 `runtimeVersion`，
      policy 是 `appVersion`）
- [x] 更新 `app.json` 的 `extra.whatsNew`（id `2026-09-01-monthly-reminder`，
      內容是「每月記帳提醒」）
- [x] `CHANGELOG.md` 的 `## 1.4（審核中）` 區段 —— 這段文字就是 ASC
      「此版本新增功能」的文案來源
- [ ] `eas build --profile production --platform ios` → `eas submit` → ASC 送審
      ⚠️ 8/28 之前跑的那支 production build **不含**通知功能，要重跑
      ⚠️ 上次 native build 之後 `app.json` 的 `plugins` 有動過，若 provisioning
      profile 抱怨 capability，照 `mobile-release` 的 `eas credentials` 步驟走
- [ ] `eas submit` 之後務必到 ASC 確認**建置版本**已切到新的 build number
      —— 1.2 的第三輪被打回就是因為這一步沒做
- [ ] 上架後才驗得準的一項：**點通知回首頁**。Expo Go 裡通知掛在 Expo Go 名下，
      完全滑掉時點擊只會開 Expo Go 首頁，不是程式的問題
- 送審前記得確認 EAS 配額（上次確認：2026-08-04 起新週期，iOS 1/15）

### C. Android 首次上架 Google Play（1.4，純免費版）

決策：**首發不含訂閱付費**。後端零 Google Play 購買處理（`apps/web/services`
搜不到 androidpublisher / RTDN），訂閱驗證 100% 綁 Apple 的 App Store Server
Notifications，Android 要賣訂閱是獨立的一整塊工程。

程式端（PR #122，已合併進 develop）：

- [x] 修掉一個會被 Google 打回的 bug：Android 沒有 RevenueCat key →
      `isPurchasesConfigured()` false → paywall 的 `previewMode` 為 true →
      正式版會顯示 `PREVIEW_PLANS` 的假價格 NT$300／NT$30。新增
      `SUBSCRIPTIONS_SUPPORTED`（`lib/purchases.ts`）把「Expo Go 沒有原生模組」
      和「這個平台根本沒商店」分開
- [x] Android 的 free 使用者不再看到「升級 Premium」卡片；**已是 Premium 的
      仍然看得到** —— 權限綁 Clerk userId，在 iPhone 買過的人在 Android 也是
      Premium。「管理訂閱」在 Android 改為說明用 Alert，不外連 Apple 訂閱頁
      （Google Play 的 anti-steering 規則）
- [x] `eas build --profile production --platform android` 已跑（`buildType`
      本來就是 `app-bundle`，`versionCode` 由 EAS 的 `autoIncrement` 管）

Play Console 端（**只能由你在後台做**）：

- [ ] 建立應用程式：名稱 `Sara Asset`、套件名稱 `com.Sara.assetapp`（與 iOS
      bundle id 同字串，Android 端不可再改）
- [ ] 上傳第一支 `.aab`。**第一版一定要用 Play Console 網頁手動上傳** ——
      `eas submit` 的 API 無法替一個還沒有任何版本的應用程式建立首版
- [ ] 商店資訊素材：512×512 應用程式圖示、1024×500 主打圖（feature graphic，
      Google 必填、Apple 沒有這個東西，要新做）、至少 2 張手機截圖、
      簡短說明（80 字內）、完整說明
- [ ] 隱私權政策網址填 `https://arasasset.com/privacy`（頁面已存在）
- [ ] **資料安全性表單**：宣告蒐集的資料與用途。`app.json` 已封鎖
      `com.google.android.gms.permission.AD_ID`，所以可以誠實勾「不用於廣告」
- [ ] 內容分級問卷、目標對象與內容、廣告聲明（本 App 無廣告）
- [ ] **封閉測試 12 人 × 連續 14 天** —— 個人開發者帳號的硬性要求，正式發布前
      跑不完就不能上。這是整個時程的關鍵路徑，越早開始越好
- [ ] 全部跑完才送正式版審查

之後才需要做（不阻塞首發）：

- [ ] `eas.json` 的 `submit.production` 目前**只有 ios**。要用 `eas submit
    --platform android` 自動送件，需要 Google Cloud service account JSON 並在
      Play Console 授權；首版手動上傳之後再補，可省下之後每次的手動步驟
- [ ] Android App Links：`app.json` 的 `android.intentFilters` 只有
      `ara-s-web.vercel.app`，沒有 `arasasset.com`（iOS 兩個都有）。要真正生效
      還需要在網站放 `/.well-known/assetlinks.json`，內容要填 **Play 應用程式
      簽署**的 SHA-256 指紋 —— 那個指紋要等第一次上傳到 Play 之後才拿得到，
      所以只能等首發完成再做
- [ ] Android 訂閱付費：Play Console 訂閱商品 + RevenueCat Android app/key +
      後端接 Google Play RTDN 與 androidpublisher 驗證 + `entitlements` 支援
      雙來源。在那之前 Android 免費使用者受 `FREE_ENTRY_LIMIT = 20` 限制且
      無解鎖途徑，保單／資產配置／股息同理

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
