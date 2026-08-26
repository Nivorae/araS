# 目前進度

> 這份文件取代記憶體裡的 `project_open_tasks_*` 系列。跟著 git 走、隨時可看，
> 不需要透過 Claude 對話才能存取。過時的段落請直接刪掉或改掉，不用保留歷史 ——
> 歷史交給 git log 和 CHANGELOG.md。

最後整理：2026-08-26

## 進行中

### 1. `arasasset.com` 被 Google Safe Browsing 標記 — 最高優先

**症狀**：全新安裝、Google 登入完成後，會閃出整頁紅色 Safari
「Deceptive Website Warning」（網址列顯示 accounts.google.com），約兩秒後自動
消失並正常進入主頁。登入本身沒壞，但使用者看到的是「這個理財 App 要騙我的
密碼和信用卡」。

**根因（2026-08-26 查證）**：Google Transparency Report 的 Safe Browsing 狀態
查詢中，`arasasset.com` 與 `clerk.arasasset.com` 都回傳狀態碼 **2**（第 3 類
旗標 true），判定時間戳凍結在 **2026-08-21T07:23Z**；對照組 20 幾個網域
（含 `ara-s-web.vercel.app` 與 9 個別家 Clerk FAPI 子網域如 `clerk.cal.com`、
`clerk.linear.app`）全部回 1（乾淨）或 4（大型平台白名單），官方惡意測試站回 3。
只有我們的網域回 2。兩個 host 時間戳完全相同 → 旗標下在根網域、子網域繼承。

誤判成因：網域 2026-07-28 才註冊（RDAP 查證，無前手歷史），四週大的新網域 +
登入表單 + 理財字眼 + 一個攔截 Google OAuth callback 的子網域 = 釣魚站的
教科書外型。

為什麼是「閃兩秒」而不是擋死：登入重導鏈是 accounts.google.com →
`clerk.arasasset.com/v1/oauth_callback` → `saraasset://sso-callback`。Safari 的
Safe Browsing 查詢是非同步的，回報時 deep link 已經打回 App、`setActive` 已成功，
警告是在正要被關掉的瀏覽器裡渲染出來的。

App 的 API 走 `ara-s-web.vercel.app`（乾淨），所以只有登入這段瀏覽器流程中槍。
Apple 登入是原生流程、不開瀏覽器，不受影響 —— 與 8 月 OAuth lockout 同樣的分界線。

- [x] Search Console 加了 `arasasset.com` Domain 資源。判定類別是
      **「不實網頁」（社交工程）**，且**「網址示例：不適用」** —— Google 沒有列出
      任何具體頁面，代表旗標下在整個網域層級、不是某一頁有問題內容。也就是說
      沒有具體頁面可修，這是純粹的網域信譽誤判
- [x] 修掉一個很可能是誘因的設定：`arasasset.com` 原本逐位元組複製舊站內容，
      卻在 HTML 裡宣告 `canonical/og:url → ara-s-web.vercel.app`，等於「新網域
      冒充既有網站」。已把 Vercel Production 的 `NEXT_PUBLIC_APP_URL` 改為
      `https://arasasset.com` 並 redeploy，驗證 canonical/OG/robots/sitemap 全部
      指回自己且無雙斜線（細節見記憶 `project_web_seo_domain`）
- [x] 2026-08-26 已按下 Search Console 的「要求審查」，附上下方的說明文案。
      審查期間旗標仍在、警告照樣會閃，通常 1-3 天有結果
- [x] 2026-08-26 已替新的 `arasasset.com` 資源提交
      `https://arasasset.com/sitemap.xml`（純 SEO，與旗標解除無關）
- [ ] 未確認、目前不阻塞：App 警告畫面按「Show Details」顯示的確切 URL。若申訴
      被駁回才需要 —— 顯示 `clerk.arasasset.com/...` = 對上上述證據；顯示
      `accounts.google.com/...` 的某個頁面 = 另一條線（見記憶
      `project_account_deletion_oauth_lockout`），處理方式不同
- [x] 2026-08-26 已送 Safe Browsing 誤判回報表單
      （`https://safebrowsing.google.com/safebrowsing/report_error/`），
      `https://arasasset.com/` 與 `https://clerk.arasasset.com/` 各一次。
      這條管道沒有回覆、沒有進度可查 —— 成功與否只能靠覆查狀態碼看出來
- [ ] 每天用同一支 API 覆查狀態碼，回到 1 才算解除
- 不做：**不改登入按鈕順序去推薦 Apple 登入**（2026-08-26 使用者否決，他自己
  就以 Google 登入為主）
- 最後手段、先不要做：把 Clerk FAPI 換到別的網域 —— 會換掉 publishable key、
  必須 native rebuild + 重新送審，等申訴結果再說
- 不做：從 `ara-s-web.vercel.app` 做 308 導向到新網域 —— 已不需要（舊站現在自己
  宣告 `canonical → arasasset.com`），而且 App 的 `EXPO_PUBLIC_API_URL` 還指著
  舊站，全站導向會打壞所有已出貨 binary 的 `/api/*`
- [ ] 順帶、與本案無關：`www.arasasset.com` 沒有 DNS 記錄（NXDOMAIN），輸入 www 會連不上
- [ ] 順帶：`apps/web/app/robots.ts` 與 `sitemap.ts` 用字串串接組網址，
      `NEXT_PUBLIC_APP_URL` 帶尾斜線就會產出 `//sitemap.xml`。加一行
      `.replace(/\/$/, "")` 可讓這個坑踩不到（尚未決定要不要做）

要求審查的說明文案：

> This is the official website of araS, an iOS personal finance app published on
> the App Store (id6785747999). The domain was registered on 2026-07-28 and is
> operated solely by the app's developer. The site contains no third-party
> content, no iframes, no forms, and no third-party scripts. The
> clerk.arasasset.com subdomain is the managed authentication endpoint provided
> by Clerk (clerk.com), our authentication provider, and is used only for our own
> app's OAuth flow. We believe this is a false positive.

### 2. 每月記帳提醒通知 — 已設計，尚未實作

Spec 在 `docs/superpowers/specs/2026-08-13-monthly-reminder-notification-design.md`
（PR #96 合入）。本機通知，`expo-notifications` calendar trigger 每月 1 號 9:00
重複，不動後端與資料庫。設定頁加 Switch 卡片、預設關閉。

- [ ] 尚未開始寫 plan、尚未實作
- 註：**需要 native rebuild**（`expo-notifications` 是原生模組，OTA 送不了），
  所以排程上適合跟下一次上架版本綁在一起做。

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

### 4. 行為分析漏斗（PostHog）— 已實作，等金鑰與發版

程式碼已完成，說明文件在 `docs/analytics.md`。目的是把「下載後 7 天內
0.6% 轉付費」拆成可觀測的五段，回答流失發生在哪一步。

新增 `posthog-react-native`（無必要的原生模組，optional peer 全部沒裝，
儲存退回已在用的 AsyncStorage），埋 7 個事件：`app_open`、
`onboarding_complete`、`first_record_created`、`record_created`、
`paywall_viewed`、`subscribe_clicked`、`subscribe_success`。
原本 App 沒有任何引導流程、`onboarding_complete` 沒有東西可埋，所以在登入頁
右上角加了一顆 ? 按鈕，開啟三步說明的 bottom sheet
（`components/OnboardingSheet.tsx`）。**刻意不是首次啟動強制顯示** —— 登入頁
本身就是第一個畫面，說明只在使用者主動想看時才出現。

- [x] analytics 模組、七個埋點、說明 sheet、`docs/analytics.md`
- [x] `pnpm type-check` / `pnpm lint` 通過；`expo export` 打包驗證過
- [x] PostHog project 已建立（US Cloud，project id 577802），key 已填進四個
      地方：`apps/mobile/.env:9`、`.env.production:25`、`eas.json` 的 preview:15
      與 production:36。用 flags 端點驗證過金鑰有效（錯的 key 會回 401）
- [x] 用 Expo Go 驗證過事件確實送達 PostHog（2026-08-26，Activity 頁看得到進來的事件）
- [x] 已於 2026-08-26 走 OTA 出貨（runtime version 1.3，update group
      `59f41b0a`）。出貨前驗證過：`posthog-react-native` 只有 `dist/`、無
      podspec、需要原生模組的 optional peer 全部未安裝；bundle 內 React 內部
      唯一標記只出現 1 次（單一份 React）、無 LAN IP
- [ ] `subscribe_success` 只能在 TestFlight／正式版驗證（Expo Go 沒有
      RevenueCat 原生模組）

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
