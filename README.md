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
| Testing    | Vitest + React Testing Library + Playwright                                           |
| Language   | TypeScript 5（strict）                                                                |
| Monorepo   | Turborepo + pnpm workspaces                                                           |
| Deploy     | Web/API → Vercel（Root Directory `apps/web`）；Mobile → EAS + App Store               |

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

## Scripts

| Command              | Description                          |
| -------------------- | ------------------------------------ |
| `pnpm dev`           | Turborepo 啟動全部（web :3000）      |
| `pnpm lint`          | Lint 全部套件                        |
| `pnpm type-check`    | TypeScript 型別檢查                  |
| `pnpm test`          | 執行測試                             |
| `pnpm test:coverage` | 測試 + 80% coverage 門檻             |
| `pnpm test:e2e`      | Playwright E2E                       |
| `pnpm docker:up`     | 本地 PostgreSQL（port 5434）         |
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
