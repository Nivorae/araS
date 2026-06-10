# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Slash Commands

| Command     | Description                                                                 |
| ----------- | --------------------------------------------------------------------------- |
| `/fix-ci`   | Diagnose and fix the latest failing GitHub Actions CI run automatically     |
| `/ship`     | Full delivery pipeline: lint → stage → commit → push with safety guardrails |
| `/simplify` | Review recently changed code for quality and efficiency, then fix issues    |

## First-time Setup

```bash
# 1. Copy env and fill in Supabase credentials
cp .env.example .env

# 2. Generate Prisma client (required before first run, and after schema changes)
pnpm db:generate

# 3. Start dev server
pnpm dev
```

> **Important:** `.env` must have exactly one `DATABASE_URL` pointing to Supabase.
> Never duplicate `DATABASE_URL` — the last value wins but it causes confusion.

## Commands

```bash
# Development
pnpm dev                  # Start all via Turborepo (web :3000)

# Quality checks
pnpm lint
pnpm type-check
pnpm test
pnpm test:coverage        # With 80% threshold enforcement
pnpm test:e2e             # Playwright

# Run a single test file
pnpm --filter @repo/web exec vitest run tests/services/entries.service.test.ts

# Database
pnpm docker:up            # Start PostgreSQL on port 5434
pnpm db:generate          # Generate Prisma client after schema changes
pnpm db:migrate           # Run migrations (dev)
pnpm db:studio            # Prisma Studio UI
```

## Architecture

Turborepo pnpm monorepo:

```
apps/
  web/      # Next.js 15 App Router + React 19 + Tailwind CSS 4 + Clerk + Prisma 6 (@repo/web)
packages/
  ui/       # shadcn/ui shared components (@repo/ui)
  shared/   # Zod schemas + shared types (@repo/shared)
  eslint-config/  # Shared ESLint rules (@repo/eslint-config)
```

- **`@repo/web`** — Next.js 15 App Router. API endpoints are Next.js Route Handlers under `apps/web/app/api/**`. Clerk via `@clerk/nextjs`. Prisma schema lives in `apps/web/prisma/schema.prisma`.
- **`@repo/shared`** — Zod schemas shared across the monorepo. No build step — resolved directly to source.
- **`@repo/ui`** — shadcn/ui components. No build step — exports `.tsx` source directly.
- **`@repo/eslint-config`** — Shared ESLint rules. `index.js` (base), `react.js`, `next.js`.

### API request lifecycle

```
Request → middleware.ts (clerkMiddleware; auth.protect() on market-data proxies) → Route Handler (auth() check → Zod parse → service) → ok/err/handleError
```

### Layered architecture

Route Handlers (`apps/web/app/api/**/route.ts`) handle HTTP parsing, call `auth()` from Clerk, validate input with Zod schemas from `@repo/shared`, and call services. Services (`apps/web/services/`) contain business logic and call Prisma — every query is scoped by `userId` (ownership checks via `findFirst({ where: { id, userId } })` / `deleteMany({ where: { id, userId } })`). Route Handlers use `ok` / `err` / `handleError` from `apps/web/lib/api-response.ts` to produce the standard `{ success, data|error, timestamp }` envelope defined in `@repo/shared`. Security-relevant events (auth failures, ownership violations) are logged via `logSecurityEvent` from `apps/web/lib/security-log.ts`.

### API response envelope

All responses use `ApiResponse<T>` from `@repo/shared`:

- Success: `{ success: true, data: T, meta?: PaginationMeta, timestamp: string }`
- Error: `{ success: false, error: { code, message, details? }, timestamp: string }`

### Auth

Clerk is used for authentication. `apps/web/middleware.ts` uses `clerkMiddleware` with `auth.protect()` on the market-data proxy routes (`/api/stocks/*`, `/api/exchange-rate`, `/api/cathaylife-rates`, `/api/quotes/*`). Every data Route Handler additionally self-protects: it calls `auth()` from `@clerk/nextjs/server` and returns 401 when there is no `userId`. Client Components use `useAuth()` from `@clerk/nextjs`.

### Data model

Personal-finance models in `apps/web/prisma/schema.prisma`, all scoped by Clerk `userId`:

- `Entry` (assets/liabilities, with `EntryHistory`), `Loan`, `Transaction`, `PortfolioItem`, `Insurance`, `Recurrence` (MONTHLY/WEEKLY/BIWEEKLY/YEARLY auto-generated transactions)

### Env vars

Root `.env` is the single source of truth. `apps/web` loads it via `next dev --env-file ../../.env`. See `.env.example`. Key vars: `DATABASE_URL`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`.

## Reference Resources

| Resource                        | URL                                             | Description                                          |
| ------------------------------- | ----------------------------------------------- | ---------------------------------------------------- |
| MCP Servers (community curated) | https://github.com/modelcontextprotocol/servers | Community-maintained list of recommended MCP servers |
| Agents                          | https://github.com/wshobson/agents              | Agent implementations and patterns reference         |

## Installed Plugins

| Plugin                 | Scope | Purpose                                                                                                                                                                            |
| ---------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **superpowers** v5.0.2 | user  | Skills system: brainstorming, TDD, debugging, plan writing/execution, code review, git worktrees, parallel agents, and more. Always check for applicable skills before responding. |
| **playwright**         | user  | Browser automation via MCP — navigate, click, fill forms, take screenshots, inspect network, etc. Use for E2E testing and UI verification.                                         |
| **code-simplifier**    | user  | Reviews recently changed code for reuse, quality, and efficiency, then fixes issues found. Invoke with `/simplify`.                                                                |
| **skill-creator**      | user  | Create, modify, and evaluate skills. Benchmark skill performance and optimize trigger descriptions.                                                                                |
| **greptile**           | local | AI-powered codebase search and Q&A grounded in this repository. Use for deep semantic code searches and understanding unfamiliar code paths.                                       |

## Conventions

- **Commits**: Conventional Commits enforced by commitlint + husky. Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`. Subject must be lowercase.
- **Tests**: `apps/web` service tests mock Prisma via `vi.mock("@/lib/prisma")`; component tests use jsdom + React Testing Library.
- **Tailwind**: `apps/web` uses Tailwind CSS 4 — config is in `app/globals.css` via `@theme` block, not `tailwind.config.ts`.
