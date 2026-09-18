# 目前進度

> 這份文件取代記憶體裡的 `project_open_tasks_*` 系列。跟著 git 走、隨時可看，
> 不需要透過 Claude 對話才能存取。過時的段落請直接刪掉或改掉，不用保留歷史 ——
> 歷史交給 git log 和 CHANGELOG.md。

最後整理：2026-09-18

## 下一步

**1.5 已通過 Apple 審核並上線，release PR #135 已合併回 `main`**（2026-09-18）。
build 17（commit `9781a80`，version 1.5，SDK 57）。A 線已結案。

- **真機驗證剩餘項目** —— Face ID 已確認正常（2026-09-18）。剩 Android
  指紋解鎖、通知點回首頁、Android `SUBSCRIPTIONS_SUPPORTED` 沒影響 iOS 付費流程。
- **B. Android 封閉測試** —— 使用者決定暫緩，先不處理（2026-09-18）。純
  Play Console 後台操作，不碰程式碼，細節仍留在下方備查。

⚠️ SDK 57 改了原生指紋，**1.5 之後的更新必須走 native build + 送審，不能 OTA**，
直到下一次 OTA 前置作業（見下方「第一次 OTA 前必做」）完成。1.4 的使用者收不到
從現在的 `main`／`develop` 發的任何更新；要緊急修 1.4 只能從 SDK 57 升級前的
commit 發 OTA。

## A. 1.5 iOS binary —— 已上線（2026-09-18）

build **17**（commit `9781a80`，version 1.5，SDK 57）建置成功並已 `eas submit`
上傳到 App Store Connect。1.4 之後連續六次失敗（build 11–16）的原因是兩個不同的問題：

1. **Install 階段掛在 sharp** —— EAS 預設建置映像在 1.4 之後換成
   `macos-tahoe-26.5-xcode-26.6`，sharp 的 install script 找不到預編譯檔、改從
   原始碼編譯然後死在 `Please add node-addon-api to your dependencies`。
2. **釘回舊映像會改成死在 Xcode** —— `expo-modules-jsi@57.1.0` 用了 `weak let`
   （Swift 6.2 語法），舊映像的 Xcode 26.0 編不過。**SDK 57 需要 Xcode 26.1+，
   所以釘舊映像這條路是死的**，只能用新映像並解決 sharp。

**解法**（commit `9781a80`）：`ignoredOptionalDependencies: [sharp]`。

⚠️ 兩個踩過的坑，之後遇到類似狀況別再走一遍：

- **`ignoredBuiltDependencies` / `neverBuiltDependencies` 在 EAS 上無效。**
  EAS 的 `pnpm install` 跑在「允許所有 build script」模式下（pnpm 10 預設應該
  擋下全部並印出 `Ignored build scripts`，但 log 裡一個都沒擋），黑名單會被蓋過去。
  `ignoredOptionalDependencies` 是**解析階段**的設定、直接寫進 lockfile，
  `--frozen-lockfile` 的安裝根本看不到那個套件，所以才有效。
- **光從 `apps/web/package.json` 移除 sharp 不夠** —— 它同時是 `next@15.5.18`
  的 optionalDependency，兩邊都要處理才會從 lockfile 消失。

sharp 全 repo 只有 `apps/web/scripts/gen-icons.mjs`（一次性產圖示）用得到，
重跑方式寫在那支檔案的開頭註解。Vercel 上 Next.js 的圖片最佳化用平台自己提供的
sharp，不受影響。

剩下的步驟：

- [x] Apple 審核通過，1.5 已上線（2026-09-18）
- [x] `develop → main` 的 release PR（#135）已合併（2026-09-18）

⚠️ `overrides` 與 `ignoredOptionalDependencies` 同時存在於 `package.json` 和
`pnpm-workspace.yaml`，**兩邊要一起改**：pnpm 10+ 只讀 workspace、pnpm 9 只讀
package.json，而本機的 `packageManager` 是 9.14.2、EAS 用的是 10.16.1。

### 待補：expo patch 版本落後

`expo@57.0.22`（建議 `~57.0.23`）與 `expo-notifications@57.0.18`（建議
`~57.0.19`）各差一個 patch，EAS 的 `expo doctor` 會因此報錯，但**不擋 build**。
build 17 是在這個狀態下建成的。下次 native build 前再一起補。

### 1.5 真機驗證（要 TestFlight 或 development build）

- [x] Face ID 解鎖：正常
- [ ] Android 指紋解鎖
- [ ] 點通知回首頁。Expo Go 裡通知掛在 Expo Go 名下，完全滑掉時點擊只會開
      Expo Go 首頁，不是程式的問題
- [ ] Android 那組 `SUBSCRIPTIONS_SUPPORTED` 改動沒有影響 iOS 的付費流程
      （理論上 iOS 恆為 true、行為不變，但沒實機驗過）

### 第一次 OTA 前必做（SDK 57 之後的新規則）

- [ ] `eas update` 現在必須帶 `--environment production`，且**不讀
      `.env.production`**，只用 EAS 後台的環境變數。要把 `.env.production` 的
      `EXPO_PUBLIC_*` 全部 `eas env:create --environment production`，再
      dry-run grep bundle 確認沒有 LAN 位址
- [ ] iOS 最低版本升到 **16.4**（原 15.1），更舊的 iPhone 將無法安裝新版

## B. Android 首次上架 Google Play（純免費版）

決策：**首發不含訂閱付費**。後端零 Google Play 購買處理（`apps/web/services`
搜不到 androidpublisher / RTDN），訂閱驗證 100% 綁 Apple 的 App Store Server
Notifications，Android 要賣訂閱是獨立的一整塊工程。

程式端已完成：Android 沒有 RevenueCat key 時不再顯示 `PREVIEW_PLANS` 的假價格
（新增 `SUBSCRIPTIONS_SUPPORTED`，`lib/purchases.ts`，把「Expo Go 沒有原生模組」
和「這個平台根本沒商店」分開）；free 使用者不再看到升級卡片，**已是 Premium 的
仍然看得到**（權限綁 Clerk userId，在 iPhone 買過的人在 Android 也是 Premium）；
「管理訂閱」在 Android 改為說明用 Alert，不外連 Apple 訂閱頁（anti-steering）。

Play Console 端（**只能由你在後台做**）：

- [x] 建立應用程式、上傳第一支 `.aab`（versionCode 4、fingerprint runtime）、
      送出**封閉測試**（測試群組 `version1`，2026-09-01）
- [x] 商店資訊（素材、隱私權政策網址、資料安全性表單、內容分級、目標對象、
      廣告聲明）—— 2026-09-01 確認檢查清單已無待辦項
- [ ] **確認 ≥12 位測試者實際 opted-in** —— 門檻算的是真的點連結加入的人數，
      不是填進去的 email 數。權威位置：Play Console → 測試 → **正式版存取權**，
      那頁直接顯示「X / 12 位測試人員」與「Y / 14 天」的進度，不要用猜的
- [ ] 等封閉測試版本**通過 Google 審查並實際上線** —— 14 天是從測試者裝得到
      的那天起算，不是從按提交那天
- [ ] 連續維持 14 天
- [ ] 跑滿後在「正式版存取權」頁提出申請（一份獨立表單，問測試期間學到什麼）
- [ ] 通過後才能建立正式版並送正式審查

⚠️ **12 人算的是實際 opted-in 的帳號，不是你填進去的 email 數。** 2026-09-01
的實際狀態是「已加 email、0 名選擇參加」。對方必須用清單上那個 Google 帳號打開
「加入測試網址」並點成為測試人員，計數器才會動。算帳號不算裝置；中途退出人數
會掉。**內部測試（最多 100 人）不算數。**

規則適用範圍：只有 **2023-11-13 之後建立的個人開發者帳號**要跑這關；公司／組織
帳號（需 D-U-N-S）與更早的個人帳號都免除。若 Android 使用者湊不到 12 個，
改用組織帳號是唯一能跳過這 14 天的路。

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

### 基金淨值 — 程式碼已上 production，入口關著

實機驗證通過（搜尋 → 綁定 → 取淨值 → 市值都正確），2026-08-28 決定先不對使用者
開放。開關是 `apps/mobile/lib/stockConstants.ts` 的 **`FUND_NAV_ENABLED`**
（現為 `false`）：關著時詳情頁沒有「獲取淨值／更新淨值」與「重新選擇基金」、
不抓淨值、已綁定的基金也不併入清單市值。

後端 `/api/funds/*`、服務層與 15 個測試都留著，`Entry.stockCode` 上綁好的代碼
也留著 —— 要放出來把旗標改成 `true` 即可，不需要重寫。資料源與四個實測踩到的
坑記在 `docs/superpowers/specs/2026-08-28-fund-nav-design.md`。

三條呼叫路徑全被旗標擋住：`useInvestmentMarketValues.ts:107`（`targets` 用
`isPriceable()` 過濾）、`entry/[id].tsx:326`（`if (!isFundEntry) return`）、
`FundPickerSheet` 搜尋（兩個開啟入口都在 `{isFundEntry && …}` 內，sheet 自身
effect 另有 `if (!visible) return`）。

## 網頁版 SEO / GEO

程式面**已全部完成並上 production**（GA4、JSON-LD `@graph`、BreadcrumbList、
`/about` 頁、可引用的事實句改寫、landing FAQ、`llms.txt` / `llms-full.txt`、
`Content-Signal` robots.txt、IndexNow、`softwareVersion`）。細節見 `CLAUDE.md`
的「Web SEO / GEO」段落——那裡列了所有必須同步的 SEO 介面。

`geo-reports/GEO-AUDIT-REPORT.md`：**50/100（2026-09-02）**。技術地基強
（SSR / robots 全開 / sitemap / 安全標頭），**剩下的天花板是 off-site 品牌權威，
改 code 到不了**。Google 搜不到 `arasasset.com` 不是壞掉、也已進索引，純粹是
排名問題：零外部連結、內容太薄、品牌詞「araS」撞 Aras Corp / 艾瑞斯資訊。

剩下的全是帳號類手工事項：

- [ ] GSC 對 `/`、`/about`、`/support`、`/terms` 重新「要求索引」；跑一次
      `pnpm --filter @repo/web indexnow`（Safe Browsing 誤判已於 09-09 解除）
- [ ] Google Play 商店資訊「網站」欄填 `arasasset.com`（App Store 已填）
- [ ] 開一個 LinkedIn 或 FB 專頁 + 一個 Threads/IG，全部串進 `page.tsx` 的
      `SAME_AS`
- [ ] 投 Product Hunt + 1~2 個台灣 App 目錄
- [ ] 爭取 ≥1 篇第三方台灣理財 App 介紹提到 araS（塔科女子 / 蘋果仁 / vocus）
- [ ] 在 PTT Tech_Job / Dcard 理財 / Threads 發一篇真誠的「我做了這個」
- [ ] 之後每 1~2 週看 GSC 成效報表

## 技術債（不阻塞任何事）

- [ ] **`pnpm audit` 報 92 個弱點**（3 critical / 52 high，2026-09-01 觀察）。
      全是傳遞依賴、不是自己的程式碼：主要是 `ajv@8.18.0 > fast-uri@3.1.0`，
      經由 `@commitlint/config-validator`（開發工具）與
      `@ducanh2912/next-pwa > webpack > schema-utils` 進來。CI 的
      `pnpm audit --audit-level=high` 步驟不阻擋建置（job 仍然 success），
      所以不影響發版。之後單獨排一次依賴升級處理。
- [ ] root `package.json` 還叫 `production-template`、描述寫的是
      「React + Express monorepo」—— 腳手架殘留，root 是 private 沒人消費，
      但看起來很怪。

## 已評估、暫不執行

- **後端拆分到 Zeabur**：架構上可行（web 前端已經是乾淨的 HTTP 呼叫、沒有直接
  import service），但現階段不建議 —— 1.1 使用者的 API 位址寫死在 binary 裡
  拆不掉、App Store webhook 重新驗證成本高、訂閱才剛開始賣不宜同時搬家。若
  動機是「需要常駐運算」，中間路線是只把那部分放 Zeabur、主 API 留在 Vercel。
- **多幣別支援**、**CI 不會在 develop 上跑**、**Vercel Preview 部署 500**、
  **網頁版 premium/paywall UI**：四項都是刻意不修，理由寫在 `CLAUDE.md` 的
  「Known won't-fix / deliberate decisions」。
- **強制更新閘門（非 OTA）＋ App 內更新紀錄畫面**：2026-08-21 設計完成後決定
  不做。兩者都是使用者無感的基礎建設，現階段使用者規模小到「真的出事直接聯絡
  本人」比擋板還快；更新紀錄則幾乎沒人會看。設計文件已刪除，內容留在 git
  commit `0f37365`，若日後後端要做不相容變更再撿回來 —— 注意那時擋板已經來不及
  發給舊 binary，這個時間差是當初唯一的論據。

## 如何使用這份文件

- 完成的項目打勾就好，不用整段留著當「已完成紀錄」—— 那是 CHANGELOG.md 和 git
  log 的工作。
- 一個項目徹底做完（含 merge）就整段刪掉，不要移到「已完成」區塊累積。
- 新任務浮現就加進來，不用等我或你主動想到才補。
