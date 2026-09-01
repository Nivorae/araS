# 目前進度

> 這份文件取代記憶體裡的 `project_open_tasks_*` 系列。跟著 git 走、隨時可看，
> 不需要透過 Claude 對話才能存取。過時的段落請直接刪掉或改掉，不用保留歷史 ——
> 歷史交給 git log 和 CHANGELOG.md。

最後整理：2026-09-01

## 下一步

**1.4 已同時送出兩邊**（兩支 binary 都建自 `6cfea92`）：iOS 送 App Store 審查、
Android 進 Google Play 封閉測試。`develop` → `main` 的 release PR 是 **#124**
（尚未合併 —— 合併等於部署到 production）。

現在的關鍵路徑是 **B 的封閉測試 12 人**：14 天的時鐘要等人數到位才起算，
在那之前每一天都是白費的。A（iOS 審核）不阻塞它。

`www.arasasset.com` 的 DNS 已於 2026-09-01 完成並驗證（308 → apex、路徑保留、
apex 仍 200），整段已移除。

### A. iOS 1.4 —— 已送審（2026-09-01）

build `5ac7c4f9`（commit `6cfea92`）已 `eas submit` 上傳，ASC 版本 **1.4
(build 10)** 已送出審查。等 Apple 1–3 天。

- [x] 版號 1.3 → 1.4、`extra.whatsNew`、`CHANGELOG.md` 的 1.4 區段
- [x] `runtimeVersion.policy` 換成 `fingerprint`（PR #123）
- [x] `eas credentials -p ios` 重簽 provisioning profile ——
      `expo-notifications` 的 iOS plugin 會寫入 `aps-environment`，8/21 那支
      profile 沒有這個 capability。輸出出現 `Synced capabilities: Enabled:
Push Notifications` 才算修好
- [x] `eas build` → `eas submit` → ASC 選建置版本 → 送出審查
- [ ] **上架後才驗得準**：點通知回首頁。Expo Go 裡通知掛在 Expo Go 名下，
      完全滑掉時點擊只會開 Expo Go 首頁，不是程式的問題
- [ ] 上架後在真機確認 Android 那組 `SUBSCRIPTIONS_SUPPORTED` 改動沒有影響
      iOS 的付費流程（理論上 iOS 恆為 true、行為不變，但沒實機驗過）

⚠️ **審核期間 1.3 使用者收不到任何 OTA** —— 他們 binary 的 runtimeVersion 是
`"1.3"`（舊的 appVersion policy），永遠不可能符合指紋。要緊急修 1.3 的話，
唯一方法是把 `version` 暫時改回 `1.3` 發一包，且那包 JS 不能碰
`expo-notifications`（1.3 的 binary 沒有那個原生模組，import 就閃退）。

### B. Android 首次上架 Google Play（1.4，純免費版）

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

- [x] 建立應用程式、上傳第一支 `.aab`（versionCode 4、fingerprint runtime）、
      送出**封閉測試**（測試群組 `version1`，2026-09-01）
- [ ] **確認 ≥12 位測試者實際 opted-in** —— 門檻算的是真的點連結加入的人數，
      不是填進去的 email 數。權威位置：Play Console → 測試 → **正式版存取權**，
      那頁直接顯示「X / 12 位測試人員」與「Y / 14 天」的進度，不要用猜的
- [ ] 等封閉測試版本**通過 Google 審查並實際上線** —— 14 天是從測試者裝得到
      的那天起算，不是從按提交那天
- [ ] 連續維持 14 天
- [ ] 跑滿後在「正式版存取權」頁提出申請（一份獨立表單，問測試期間學到什麼）
- [ ] 通過後才能建立正式版並送正式審查

- [x] 商店資訊（素材、隱私權政策網址、資料安全性表單、內容分級、目標對象、
      廣告聲明）—— 2026-09-01 由 Max 確認 Play Console 的檢查清單已無待辦項

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

### 基金淨值 — 程式碼在 develop 上，入口關著

實機驗證通過（搜尋 → 綁定 → 取淨值 → 市值都正確），2026-08-28 決定先不對使用者
開放。開關是 `apps/mobile/lib/stockConstants.ts` 的 **`FUND_NAV_ENABLED`**
（現為 `false`）：關著時詳情頁沒有「獲取淨值／更新淨值」與「重新選擇基金」、
不抓淨值、已綁定的基金也不併入清單市值。

後端 `/api/funds/*`、服務層與 15 個測試都留著，`Entry.stockCode` 上綁好的代碼
也留著 —— 要放出來把旗標改成 `true` 即可，不需要重寫。資料源與四個實測踩到的
坑記在 `docs/superpowers/specs/2026-08-28-fund-nav-design.md`。

**已驗證（2026-09-01）：1.4 的 binary 不會呼叫 `/api/funds/*`。** 這件事重要，
因為 `/api/funds/search`、`/api/funds/quote` 只存在於 `develop`，PR #124 合併前
production 沒有它們。三條呼叫路徑全被旗標擋住：`useInvestmentMarketValues.ts:107`
（`targets` 用 `isPriceable()` 過濾）、`entry/[id].tsx:326`（`if (!isFundEntry)
return`）、`FundPickerSheet` 搜尋（兩個開啟入口都在 `{isFundEntry && …}` 內，
sheet 自身 effect 另有 `if (!visible) return`）。

## 技術債（不阻塞任何事）

- [ ] **`pnpm audit` 報 92 個弱點**（3 critical / 52 high，2026-09-01 於 PR #124
      的 CI 上觀察到）。全是傳遞依賴、不是自己的程式碼：主要是
      `ajv@8.18.0 > fast-uri@3.1.0`，經由 `@commitlint/config-validator`（開發
      工具）與 `@ducanh2912/next-pwa > webpack > schema-utils` 進來。CI 的
      `pnpm audit --audit-level=high` 步驟不阻擋建置（job 仍然 success），所以
      不影響發版。是既有狀態、非本次改動造成。之後單獨排一次依賴升級處理。

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
