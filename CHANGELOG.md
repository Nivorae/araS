# Changelog

版號以 `apps/mobile/app.json` 的 `version` 為準（App Store 上架版本）。

- `## X.Y` 區段 = 一次 App Store 送審版本。該區段的條目就是送審時
  「此版本新增功能」的文案來源。
- `### OTA` 子區段 = 該版本上架後透過 `eas update` 推送的更新。OTA 不改版號，
  所以累積在當前版本底下。

由 `/git:changelog` 維護。不追蹤 root `package.json` 版號，也不打 git tag ——
每次 build / OTA 的 commit hash 由 EAS 記錄（見 expo.dev 的 update / build 頁面）。

## 1.1（已上架）

### OTA

- 2026/07/20 重新設計設定頁：使用者資訊置頂、三張品牌色卡片（升級 / 登出 / 刪除），底部顯示版號與更新時間
- 2026/07/16 修正網路中斷時的錯誤訊息，改為中文提示、不再閃退並保留已輸入內容
- 2026/07/13 新增日曆式日期選擇、股票數量／金額兩種輸入模式、卡片滑動預覽、依月份分組的歷史紀錄、以市值計算淨資產
- 2026/07/12 修正 API 網址誤指向本機開發位址，導致無法載入資料

## 1.0（已上架）

- 首次上架 App Store
- 資產／負債、貸款、交易、投資組合、保險、退休規劃
- Clerk 登入（Google / LINE OAuth）
- 淨資產走勢圖與分類卡片

---

## 專案基礎建設（非 App 版本）

初始 scaffold 內容，保留備查：Next.js 15 App Router + React 19、Tailwind CSS v4 +
shadcn/ui、Zustand、Zod 環境變數驗證、CSP 與 rate limiting、Vitest、Playwright、
GitHub Actions CI/CD、Husky + lint-staged、Dependabot。
