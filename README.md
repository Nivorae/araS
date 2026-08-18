# araS — 個人資產管理工具

一個 Turborepo + pnpm monorepo：**Next.js 15 後端/網頁** + **Expo React Native iOS App**，
共用同一套 API、Zod schema 與 Clerk 認證。協助記錄與檢視資產、負債、收支、投資組合、保險與退休規劃。

## Tech Stack

| Layer      | Technology                                                                            |
| ---------- | ------------------------------------------------------------------------------------- |
| Web / API  | Next.js 15 App Router + React 19 + Tailwind CSS 4（API = Route Handlers，非 Express） |
| Mobile     | Expo（React Native）SDK 54 + Expo Router                                              |
| Auth       | Clerk（Web `@clerk/nextjs`、Mobile `@clerk/clerk-expo`，Google / LINE OAuth）         |
| ORM        | Prisma 6                                                                              |
| Database   | PostgreSQL（Supabase）                                                                |
| Validation | Zod（共用於 `@repo/shared`）                                                          |
| Testing    | Vitest + React Testing Library                                                        |
| Language   | TypeScript 5（strict）                                                                |
| Monorepo   | Turborepo + pnpm workspaces                                                           |
| Deploy     | Web/API → Vercel（Root Directory `apps/web`）；Mobile → EAS + App Store               |

## 第三方服務

| 服務                                            | 用途                                                               |
| ----------------------------------------------- | ------------------------------------------------------------------ |
| **Supabase**                                    | PostgreSQL 資料庫（production / dev 各一個獨立專案，登入帳號不同） |
| **Vercel**                                      | Web/API 部署（含 Turborepo Remote Cache，選用）                    |
| **Clerk**                                       | 認證（Google / LINE OAuth）                                        |
| **Google Cloud Console**                        | 申請 Google OAuth 用戶端，供 Clerk Google 登入使用                 |
| **LINE Developers Console**                     | 建立 LINE Login channel，供 Clerk LINE 登入使用                    |
| **Cloudflare**                                  | 自訂網域 DNS（arasasset.com）                                      |
| **Expo Go**                                     | 手機測試 App（掃 QR 開發預覽用，非發布服務）                       |
| **EAS (Expo Application Services)**             | Mobile build / submit / OTA 更新                                   |
| **Apple Developer Program / App Store Connect** | iOS 上架、App Store Server Notifications webhook                   |
| **RevenueCat**                                  | App 內購／訂閱（IAP）                                              |
| **Sentry.io**                                   | 錯誤監控（crash reporting）                                        |
| **GitHub / GitHub Actions**                     | 原始碼託管 + CI（`.github/workflows/ci.yml`，`/fix-ci` 對象）      |

> 各服務的登入帳號記在 `docs/ACCOUNTS.local.md`。**這個 repo 是公開的**，所以那個檔案
> 被 `.gitignore` 排除、只存在本機 —— 帳號、密碼、金鑰一律不進版控。

### Supabase dev 專案會自動暫停

dev 專案在免費方案上，**閒置約 7 天就會被自動暫停**，之後所有連線都會失敗：

```
FATAL: (ENOTFOUND) tenant/user postgres.<project-ref> not found
```

這則訊息看起來像帳密或主機名稱錯誤，其實兩者都不是 —— 專案本身不在了。
到 Supabase dashboard 按 **Restore project**，復原後**重新複製一次連線字串**貼回
`.env`（pooler 主機可能從 `aws-0-` 換成 `aws-1-`），再跑 `pnpm db:migrate:deploy`
與 `pnpm db:seed`。

在手機上這會表現成「儲存資產一直轉圈圈」，因為 `apps/mobile/lib/api.ts` 的
`request()` 沒有 timeout，連不上後端時會轉到 iOS 自己逾時（約 75 秒）為止。
由外而內的排查順序：

1. `Get-NetTCPConnection -LocalPort 3000` —— dev server 到底有沒有開？
2. `curl http://<LAN_IP>:3000/api/health` —— 回 500 代表程式活著、DB 掛了。
3. 用 `.env` 裡**另一組**專案憑證做唯讀探測，隔離網路／Prisma／憑證等變因：
   `echo "SELECT 1;" | npx prisma db execute --url "$U" --stdin`

## Project Structure

```
apps/
├── web/      Next.js 15 App Router：頁面 + API Route Handlers（apps/web/app/api/**）+ Prisma  (@repo/web)
└── mobile/   Expo React Native iOS App，重用 web 的 /api/* 與 @repo/shared          (@repo/mobile)
packages/
├── ui/             shadcn/ui 共用元件（直接輸出 .tsx 原始碼）            (@repo/ui)
├── shared/         共用 Zod schema 與型別（無 build step）              (@repo/shared)
└── eslint-config/  共用 ESLint 規則                                     (@repo/eslint-config)
```

Mobile 不直接連資料庫 —— 它透過 Bearer token 呼叫 web 的 `/api/*`（Clerk `auth()` 直接驗證 Bearer header，後端零改動）。

## Quick Start

```bash
# 1. 安裝
pnpm install

# 2. 設定環境變數（root .env 是單一來源）
cp .env.example .env
# → 填入 DATABASE_URL、CLERK_SECRET_KEY、NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

# 3. 產生 Prisma client（首次執行與每次改 schema 後都要）
pnpm db:generate

# 4. 啟動開發伺服器（web :3000）
pnpm dev
```

> **重要：** `.env` 只能有一個 `DATABASE_URL`（指向 Supabase）。重複會造成混亂（最後一個生效）。

Mobile 開發：

```bash
pnpm dev                              # 啟動後端（real device 透過 LAN IP 連線）
pnpm --filter @repo/mobile start -c   # 啟動 Expo，iOS 相機掃 QR 開啟 Expo Go
```

`apps/mobile/.env` 的 `EXPO_PUBLIC_API_URL` 要填**電腦的 LAN IP**（例如 `http://192.168.50.220:3000`）——
手機上的 `localhost` 指向手機自己。背景執行 Expo 時終端機不會印 QR，改在 Expo Go 手動輸入
`exp://<LAN_IP>:8081`。

## 🚀 完整流程速查（從改動到上線）

> 忘記怎麼做的時候看這一節就好。`/` 開頭的是打給 Claude Code 的指令，其餘是終端機指令。

### 情境 A：改 JS / UI / 邏輯 → OTA 熱更新（最常見，不用送審）

```
1.  /git:branch              從 main 開 feature 分支
2.  （開發）                  完成後再 commit，不要逐檔 commit
3.  /git:commit              產生 conventional commit
4.  /create-pr               推分支 + 開 PR（base 自動是 develop）
5.  （在 GitHub merge PR 進 develop）
6.  git checkout develop && git pull
7.  /git:changelog --ota     記錄這次改動到 CHANGELOG，**同時**把同一批文案寫進
                             app.json 的 extra.whatsNew（id 和 lines 都要改）
8.  「推 OTA」                Claude 會先確認版號不變、跑乾跑驗證，再 eas update
9.  git checkout main && git merge develop && git push origin main
```

用戶重開 App 後幾分鐘內生效，設定頁的「更新於」會變成新時間。

第 7 步的 `whatsNew` 不能跳過：App 套用更新後顯示的「本次更新」說明只從那裡讀文案，
`CHANGELOG.md` 不會被打包進 App。忘了改的後果是**那次更新對使用者靜默**（見下面
「更新提示」）。

### 情境 B：動到原生 → 重新打包送審

觸發條件：新增／移除原生套件、升級 Expo SDK、改 `app.json` 原生設定、換 icon 或 App 名稱。

```
1-6. 同情境 A
7.   /git:changelog --release   開新的 ## X.Y 區段（這段文字等下要用）
8.   「上架」                    Claude 會跟你確認版號（例：1.1 → 1.2）後
                                改 app.json → eas build → eas submit
9.   （到 App Store Connect）    新增版本 → 貼上第 7 步的 CHANGELOG 文字
                                → 選 build → 送審（1–3 天）
10.  git checkout main && git merge develop && git push origin main
```

### 不確定是 A 還是 B？

直接說「**發版**」或「**推更新**」，`/mobile-release` 會看 diff 自動判斷並告訴你走哪條路。
判斷錯誤的代價很高——把需要原生模組的 JS 用 OTA 推出去會讓 App 直接閃退——所以不確定時就問。

### 日常開發

```bash
pnpm dev                              # 後端 API（手機透過 LAN IP 連）
pnpm --filter @repo/mobile start -c   # Expo，Expo Go 輸入 exp://<LAN_IP>:8081
```

## Mobile 發版

版號**只在原生打包時 bump**，OTA 不動它 —— 詳見 [`/mobile-release`](.claude/skills/mobile-release/SKILL.md) skill。

| 改動內容                                             | 走法                     | 版號        | 需要送審 |
| ---------------------------------------------------- | ------------------------ | ----------- | -------- |
| 文字、樣式、版面、邏輯、API 呼叫（純 JS）            | **OTA** `eas update`     | **不變**    | 否       |
| 新增原生套件、Expo SDK 升級、app.json 原生設定、icon | **原生打包** `eas build` | **要 bump** | 是       |

```bash
# OTA（幾分鐘後用戶重開 App 生效）
cd apps/mobile && eas update --branch production --clear-cache --message "…"
```

⚠️ **OTA 絕不能 bump `app.json` 的 `version`。** `runtimeVersion.policy` 是 `appVersion`，
代表 runtimeVersion 就等於 version，而 OTA 只送給 runtimeVersion 完全相符的 binary ——
bump 了版號，更新就永遠送不到已安裝的裝置上，**而且不會報錯**。

設定頁底部會顯示版號：`版本 1.2` + `更新於 <OTA 發佈時間>` + 更新狀態（下載進度／
已下載待重啟／已是最新版本）。版號來自 `app.json`，時間來自 `expo-updates` 的
`Updates.createdAt`，每次 `eas update` 自動更新，不需手動維護。

### 更新提示（發 OTA 前必做一步）

`fallbackToCacheTimeout` 是預設的 0，所以套用一次 OTA 需要開**兩次** App：第一次仍跑
舊 bundle 並在背景下載，第二次才生效。App 因此有兩個提示：

| 時機           | 顯示                                               | 文案來源                    |
| -------------- | -------------------------------------------------- | --------------------------- |
| 下載完成當下   | 底部 banner「有新版本已準備好　[稍後] [立即重啟]」 | 固定文字（與版本無關）      |
| 重啟後首次執行 | 「本次更新」sheet，只顯示一次                      | `app.json` `extra.whatsNew` |

**每次發 OTA 前都要改 `app.json` 的 `expo.extra.whatsNew`**，`id` 和 `lines` 都要改
（文案沿用 `CHANGELOG.md` 剛寫好的那幾行，不要另外編）：

```json
"extra": {
  "whatsNew": {
    "id": "2026-08-18-update-notice",
    "lines": ["更新下載完成後會在畫面下方提示…"]
  }
}
```

sheet 是否顯示，取決於「bundle 帶的 `id`」與「AsyncStorage 存的上次顯示過的 id」是否
不同。**忘了改 id → 什麼都不顯示（靜默）**，而不是重播上一版的舊文案 —— 錯的方向刻意
設計成「少講」而非「講錯」。判斷邏輯在 `apps/mobile/lib/whatsNew.ts` 的
`shouldShowWhatsNew()`（純函式，不依賴 React）。

`extra` 不是原生欄位，改它走 OTA 即可，**不需要重新打包**，也不可以順手 bump `version`。
另外這兩個提示在 Expo Go 驗證不了（`Updates.isEnabled` 為 false，整段邏輯短路），
只能在 TestFlight 或正式版上看。

環境變數有兩套且**必須同步**：`eas.json` 的 `build.production.env` 給 `eas build` 用，
`apps/mobile/.env.production` 給 `eas update` 用（`eas update` 不讀 `eas.json`）。
發佈前可先本地乾跑確認打包內容：

```bash
cd apps/mobile && NODE_ENV=production npx expo export --platform ios
grep -c "192.168" dist/_expo/static/js/ios/*.hbc   # 要是 0
```

## Git 工作流程

`feature/*` → `develop` → `main`。Feature 分支一律從 `main` checkout。

```
main ──► feature/*  ──/create-pr──►  develop  ──merge──►  main
```

> 完整的指令順序見上面「[🚀 完整流程速查](#-完整流程速查從改動到上線)」。

1. **`/git:branch`** — 從 staged diff 或對話自動建議分支名；也可附帶情境：`/git:branch 加上 hero 動畫`。從 `main` 開分支。
2. **開發** — 整個 feature 完成前不要逐檔 commit。
3. **`/git:commit`** — feature 完成後執行；產生 Conventional Commits 訊息（<72 字、無 scope、無 body），必要時建議拆分。
4. **`/create-pr`** — 在 feature 分支執行（**不可在 develop/main**）。推分支、開 PR（base 一律是 `develop`）、跑 CI/CD、合併進 develop。
5. **切到 develop，`/git:changelog`** — 記錄這次改動（`--ota` 或 `--release`），寫進 `CHANGELOG.md`。**僅可在 develop 執行**，工作區需乾淨。
6. **`git push origin develop`** — 驗證功能正常。
7. **merge develop → main**
   ```bash
   git checkout main && git merge develop && git push origin main
   ```
8. **發版** — 見上面「Mobile 發版」（`/mobile-release` 判定 OTA 或送審）。

### 版號只有一套

**`apps/mobile/app.json` 的 `version` 是唯一的版號來源**（App Store 上架版本），
`CHANGELOG.md` 依它分段。

不使用 git tag，也不維護 root `package.json` 的 `version`（scaffold 殘留，
root 是 private 套件、不會發佈，沒有任何東西消費它）。每次 build / OTA 的
**commit hash 由 EAS 自動記錄**，在 expo.dev 的 update / build 頁面可查 ——
git tag 會是同一件事的第三份人工副本，只會失準。

## Scripts

| Command              | Description                          |
| -------------------- | ------------------------------------ |
| `pnpm dev`           | Turborepo 啟動全部（web :3000）      |
| `pnpm lint`          | Lint 全部套件                        |
| `pnpm type-check`    | TypeScript 型別檢查                  |
| `pnpm test`          | 執行測試                             |
| `pnpm test:coverage` | 測試 + 80% coverage 門檻             |
| `pnpm db:generate`   | 改完 schema 後重新產生 Prisma client |
| `pnpm db:migrate`    | 執行 migration（dev）                |
| `pnpm db:studio`     | Prisma Studio GUI                    |

## Architecture

### API request lifecycle

```
Request → middleware.ts（clerkMiddleware；market-data proxy 用 auth.protect()）
        → Route Handler（auth() 檢查 → Zod parse → service）
        → ok / err / handleError（標準 { success, data|error, timestamp } envelope）
```

Route Handlers（`apps/web/app/api/**/route.ts`）負責 HTTP 解析、呼叫 Clerk `auth()`、用 `@repo/shared`
的 Zod schema 驗證輸入、再呼叫 services。Services（`apps/web/services/`）含商業邏輯並呼叫 Prisma —
**每筆查詢都以 `userId` scope**（`findFirst({ where: { id, userId } })` / `deleteMany({ where: { id, userId } })`）。

### Data model

個人理財模型（`apps/web/prisma/schema.prisma`），全部以 Clerk `userId` scope：
`Entry`（資產/負債，含 `EntryHistory`）、`Loan`、`Transaction`、`PortfolioItem`、`Insurance`、
`Recurrence`（MONTHLY/WEEKLY/BIWEEKLY/YEARLY 自動產生交易）。

## Features

- **個人財務管理**：資產/負債、貸款、交易、投資組合、保險、退休規劃、定期自動交易
- **認證**：Clerk（Google / LINE OAuth），每筆 API 以 `userId` 隔離
- **REST Envelope**：一致的 `{ success, data|error, timestamp }` 回應格式（`@repo/shared`）
- **行情代理**：股價、匯率、國泰人壽利率等 proxy 路由（`/api/stocks/*`、`/api/exchange-rate` 等）
- **iOS App**：Expo + EAS，UI 與 web 視覺一致

## 文件

- **[CLAUDE.md](CLAUDE.md)** — 專案開發指南（架構、慣例、指令）
- **[apps/mobile/RELEASE.md](apps/mobile/RELEASE.md)** — Mobile App 上架後的發版流程、訂閱制規劃、擴容判斷

## License

MIT
