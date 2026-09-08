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
# 1. Copy env and fill in credentials for your DEV Supabase project (see below)
cp .env.example .env

# 2. Generate Prisma client (required before first run, and after schema changes)
pnpm db:generate

# 3. Create the schema and load test data
pnpm db:migrate:deploy
pnpm db:seed

# 4. Start dev server
pnpm dev
```

> **Important:** `.env` must point at the **dev** Supabase project, never
> production. There are two projects: production is used only by the Vercel
> deployment and its credentials belong solely in Vercel's env vars. Everything
> that reads `.env` — `pnpm dev`, every `db:*` script, and any phone pointed at
> the dev server — reads and writes whatever is configured there, deletes
> included. A production URL in `.env` means test runs mutate real users' data.
>
> Define `DATABASE_URL` and `DIRECT_URL` exactly once each; duplicates silently
> take the last value.

## Commands

```bash
# Development
pnpm dev                  # Start all via Turborepo (web :3000)

# Quality checks
pnpm lint
pnpm type-check
pnpm test
pnpm test:coverage        # With 80% threshold enforcement

# Run a single test file
pnpm --filter @repo/web exec vitest run tests/services/entries.service.test.ts

# Database (all of these act on whatever .env points at — keep it on dev)
pnpm db:check             # Abort if the target looks like production (>3 users)
pnpm db:generate          # Generate Prisma client after schema changes
pnpm db:migrate           # Create a migration (dev only — CAN reset the database)
pnpm db:migrate:deploy    # Apply existing migrations without resetting
pnpm db:seed              # Load test data (21 entries: one over the free cap)
pnpm db:reset             # check -> drop -> migrate -> seed. Destructive
pnpm db:studio            # Prisma Studio UI
```

`db:seed` and `db:reset` write to one shared test account,
`user_3FcaiZZRQbEpYWCPqpBUngRxf8Q` — sign in as that account on the device to see
the seeded data. Override with `SEED_USER_ID=user_... pnpm db:seed` for a different
account. The seed wipes only the target user's rows, and both scripts refuse to run
when the database holds more than three distinct users, so pointing at production
aborts instead of destroying data.

The seed deliberately creates one entry more than `FREE_ENTRY_LIMIT`, so the
premium paywall gate is active as soon as it finishes.

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

`PREMIUM_OWNER_USER_IDS` (comma-separated Clerk user ids) makes those accounts
premium without an Apple purchase — checked in `EntitlementsService.isPremium`
before the `Subscription` lookup. Server-side only, so it never ships in the App
bundle; changing it in Vercel takes effect on the next app launch with no
rebuild and no OTA. Deliberately not a hand-written `Subscription` row: that
table means "Apple says this person paid", and a manual row also collides with
the unique `appleAccountToken` if that account later subscribes for real.

## Current progress

Before starting any task, check `docs/TODO.md` for what's currently in
progress or open — it's the single source of truth for task state (not
memory). Keep it updated as work completes or new tasks surface.

## Known won't-fix / deliberate decisions

Don't re-propose these — each was raised and rejected on purpose:

- **Vercel preview deployments 500 on every route** (`MIDDLEWARE_INVOCATION_FAILED`).
  Clerk env vars are Production-only in Vercel; only `DATABASE_URL`/`DIRECT_URL`
  are set to All Environments. Fixing it would mean a working preview reads/writes
  the real financial database on every PR, since those two vars already are
  All-Environments — the brokenness is an accidental safeguard. Revisit only if
  someone else joins the project or a change genuinely needs visual review before merge.
- **CI does not run on PRs into `develop`** — `.github/workflows/ci.yml` triggers
  only on `pull_request: branches: [main]` and `push: branches: [main, dev]`
  (`dev` matches no real branch here). A develop-targeted PR's `gh pr checks`
  shows only the Vercel deploy check, which reads like "CI passed" but isn't.
  Run `pnpm lint` / `pnpm type-check` / `pnpm test` locally before merging into
  `develop`.
- **No multi-currency support.** The genuinely non-TWD assets (美股/加密貨幣/貴金屬)
  already convert at display time via `useInvestmentMarketValues`. Full per-entry
  currency would require a historical-FX table to keep the net-worth chart's past
  snapshots from silently changing value, plus migrations on `Entry`/`EntryHistory`
  (currently implicit-TWD `Decimal`) and rewrites of every aggregate. Not worth it
  without a real user request. If it resurfaces, the cheap version is a 外幣存款
  subcategory that converts to TWD at save time — no schema change, no historical-FX
  problem.
- **No web premium/paywall UI.** Subscriptions are iOS-IAP only; web has no upgrade
  path. Entitlement is keyed by Clerk `userId`, so a subscription bought on iOS
  already makes the web account premium — the only stuck case is a web-only user
  with no iPhone, judged out of scope for this product.

## Web SEO / GEO

The marketing site (`arasasset.com`) is optimised for both Google and AI answer
engines. Full analysis + score history in `geo-reports/GEO-AUDIT-REPORT.md`
(50/100 as of 2026-09-02; the ceiling is off-site brand authority, not code).
Use the global `geo` / `geo-audit` skills for analysis — don't build a local copy.

**Every SEO surface, and they must stay in sync** — a fact like the brand
description, platforms, pricing, or the App Store URL appears in all of these:

- `apps/web/app/page.tsx` — homepage JSON-LD `@graph` (Organization + `founder`
  Person + WebSite + SoftwareApplication + FAQPage), `metadata`, `SAME_AS`
- `apps/web/app/landing-faq.ts` — the 8 landing FAQs (single source: drives the
  visible `<Faq>` in `landing-content.tsx` **and** the FAQPage schema)
- `apps/web/app/{about,privacy,support,terms}/page.tsx` — per-page `metadata` +
  `<JsonLd>` (BreadcrumbList everywhere; FAQPage on `/support`; Person on `/about`)
- `apps/web/app/sitemap.ts`, `apps/web/app/robots.txt/route.ts`
- `apps/web/public/llms.txt`, `apps/web/public/llms-full.txt`

**Helpers**: `<JsonLd>` (`apps/web/components/json-ld.tsx`),
`breadcrumbJsonLd` / `faqPageJsonLd` (`apps/web/lib/structured-data.ts`),
`siteUrl` (`apps/web/lib/site-url.ts`, from `NEXT_PUBLIC_APP_URL`).

**Gotchas**:

- **CSP blocks new external scripts silently.** Any new `<script src>` / beacon
  (GA was one) needs its host added to `script-src` **and** `connect-src` in
  `apps/web/next.config.ts`. No console error when it's missing — the tag just
  never loads.
- **`robots.txt` is a route handler**, not `MetadataRoute.Robots`, so it can
  carry `Content-Signal: search=yes, ai-input=yes, ai-train=yes`. Keep the
  `Disallow` list in sync with the private app routes.
- **Brand disambiguation**: "araS" collides with Aras Corp (PLM, has a Wikipedia
  page) and 艾瑞斯資訊. `Organization.alternateName` carries `araS 資產` /
  `arasasset`; every new profile must use the exact name "araS" + link
  `arasasset.com`.
- Developer for schema/attribution: **KO CHUAN LI** (前端工程師). App Store:
  `https://apps.apple.com/tw/app/id6785747999` (slug-less, TW storefront).
- `NEXT_PUBLIC_GA_ID` is set **only** in Vercel Production (dev/preview send no
  hits). GA renders via `apps/web/components/google-analytics.tsx`.

**After every production deploy that changed a public page**:

1. Google Search Console → URL Inspection → "Request Indexing" for each changed
   or new URL.
2. `pnpm --filter @repo/web indexnow` (pings Bing/Yandex/Copilot; key file is
   `apps/web/public/42273540bc2d049348f599ea70dcf81a.txt` — must stay reachable).

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
- **Analytics events**: event names come from `apps/mobile/lib/analytics/events.ts` — no string literals for event names anywhere in code. Event/param definitions and the metric formulas are in `docs/analytics.md`.

## Git workflow

`feature/*` → `develop` → `main`. Branch off `main`, never off `develop`.

```
main ──► feature/* ──(/create-pr)──► develop ──(release PR)──► main
```

1. **`/git:branch`** — cut a branch from `main` (from the staged diff or the conversation).
2. **Develop** — don't commit file-by-file; commit once the whole feature is done.
3. **`/git:commit`** — Conventional Commits, `<72` chars, **no scope**, no body; suggests splits when needed.
4. **`/create-pr`** — run on the feature branch (**never** on `develop`/`main`). Pushes, opens a PR with **base `develop`**, merges once green.
5. **`/git:changelog`** — run on `develop` with a clean tree; writes `CHANGELOG.md` (`--ota` or `--release`).
6. **Release PR** — `gh pr create --base main --head develop`. **CI (`.github/workflows/ci.yml`) only runs on PRs whose base is `main`** — a `develop`-based PR shows only the Vercel check, which looks like green CI but isn't. This release PR is the only place Lint / Type Check / Build / Security Scan actually run, so never `git merge` straight to `main` to skip it. (This is the same limitation noted under "Known won't-fix".)
7. **Ship** — see "Mobile release"; `/mobile-release` decides OTA vs App Store.

**Hotfix exception**: a production-down or security issue may go straight to a `main`-based PR. Back-fill `develop` afterward (`gh pr create --base develop --head main`) so history doesn't diverge.

### Versioning

`apps/mobile/app.json` `version` is the **only** version source (the App Store build) and `CHANGELOG.md` is sectioned by it. No git tags. No root `package.json` version (scaffold leftover — root is private, nothing consumes it). EAS records the commit hash for every build/OTA, so a git tag would just be a third copy that drifts.

## Mobile release (`apps/mobile`, Expo + EAS)

Use the **`/mobile-release`** skill — it reads the diff and picks the path. Full post-launch flow (subscriptions, scaling) is in `apps/mobile/RELEASE.md`.

| Change                                                                        | Path                         | Version   | Review |
| ----------------------------------------------------------------------------- | ---------------------------- | --------- | ------ |
| JS only — text, styles, layout, logic, API calls                              | **OTA** `eas update`         | unchanged | no     |
| New native package, Expo SDK bump, `app.json` native config, icon/splash/name | **native build** `eas build` | **bump**  | yes    |

**OTA gotchas**:

- OTA only reaches binaries whose `runtimeVersion` matches exactly — mismatched devices get nothing, with no error. Since 1.4 the policy is **`fingerprint`** (a hash of the native project), so a version-string bump alone no longer blocks OTA; only real native changes do (and those need a rebuild anyway). But **upgrading any dependency that ships native code also changes the fingerprint** — after touching deps, confirm the fingerprint is unchanged before shipping an OTA.
- **Every OTA must update `app.json` `expo.extra.whatsNew`** — bump both `id` and `sections` (reuse the `CHANGELOG.md` lines). The post-update "本次更新" sheet reads only from there; `CHANGELOG.md` is not bundled. A stale `id` = the update is silent to users (deliberately "say nothing" over "say something wrong"). Logic: `apps/mobile/lib/whatsNew.ts` `shouldShowWhatsNew()`.
- Env vars live in **two** places that must stay in sync: `eas.json` `build.production.env` (for `eas build`) and `apps/mobile/.env.production` (for `eas update`, which does not read `eas.json`). `EXPO_PUBLIC_POSTHOG_API_KEY` must match across `apps/mobile/.env`, `.env.production`, and `eas.json`'s `preview` + `production`.
- The update banner + sheet can't be verified in Expo Go (`Updates.isEnabled` is false) — only TestFlight or production.

Pre-publish dry run:

```bash
cd apps/mobile && NODE_ENV=production npx expo export --platform ios
grep -c "192.168" dist/_expo/static/js/ios/*.hbc   # must be 0
```

## Troubleshooting

### Supabase dev project auto-pauses

The dev Supabase project is on the free plan and **auto-suspends after ~7 days idle**; every connection then fails with:

```
FATAL: (ENOTFOUND) tenant/user postgres.<project-ref> not found
```

This reads like a credentials or hostname error — it is neither, the project is simply gone. Restore it in the Supabase dashboard, **re-copy the connection string** into `.env` (the pooler host can flip `aws-0-` → `aws-1-`), then re-run `pnpm db:migrate:deploy` and `pnpm db:seed`.

On a phone this shows as "saving an asset spins forever" — `apps/mobile/lib/api.ts` `request()` has no timeout, so it hangs until iOS times out (~75s). Outside-in checks:

1. `Get-NetTCPConnection -LocalPort 3000` — is the dev server even up?
2. `curl http://<LAN_IP>:3000/api/health` — a 500 means the app is alive, the DB is down.
3. Read-only probe with the **other** project's credentials from `.env` to isolate network / Prisma / creds:
   `echo "SELECT 1;" | npx prisma db execute --url "$U" --stdin`
