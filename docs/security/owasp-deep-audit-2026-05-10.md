# OWASP Deep Audit — araS

**Date:** 2026-05-10
**Scope:** Full-coverage OWASP audit beyond the `/cso` daily scan
**Frameworks evaluated:** OWASP API Security Top 10 (2023), OWASP Web Top 10 (2021), OWASP ASVS Level 1, PWA security
**Companion reports:**

- `docs/security/cso-audit-2026-05-10.md` (infrastructure + supply chain)
- `docs/security/xss-scan-report.md` (client-side XSS)

---

## What this report adds beyond `/cso`

The daily `/cso` audit operates at an 8/10 confidence gate and prioritizes infrastructure-layer findings (secrets, supply chain, CI/CD). This report adds:

1. **OWASP API Security Top 10 (2023)** — point-by-point evidence, more relevant for araS than the Web Top 10 since 22 of 22 server endpoints are `/api/*` routes.
2. **OWASP ASVS Level 1** mapping — verification controls for authentication, session management, and access control.
3. **PWA / Service Worker** — `next-pwa` is in use; service-worker caching has unique privacy implications on shared devices.
4. **Logging & monitoring** — coverage gap analysis (A09).
5. **Cache-poisoning / shared-cache** risk on user-data API routes.
6. **Privacy & data protection** — what classes of data we hold and how we handle erasure.

---

## Verdict at a glance

| Layer                                     | Result                                                                                                   |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| API authorization (BOLA/BFLA)             | **Strong** — every `[id]` route confirms ownership via `findById(id, userId)` before mutating            |
| Input validation                          | **Strong** — 10/11 mutating routes use Zod schemas (`DELETE /transactions/[id]` correctly takes no body) |
| Error masking                             | **Strong** — production errors are masked; only Zod validation details are returned (intentional UX)     |
| Authentication                            | **Delegated to Clerk** — appropriate; depends on Clerk Dashboard config (manual review needed)           |
| Session management                        | **Delegated to Clerk** — same                                                                            |
| Logging & monitoring (A09)                | **GAP** — only 1 `console.error` across all 22 API routes; no security event logging                     |
| PWA service-worker scope                  | **CONCERN** — `cacheOnFrontEndNav: true` may cache authenticated navigations                             |
| User-data response caching                | **CONCERN** — no explicit `Cache-Control: private` headers on user data                                  |
| CSP / HSTS / X-Frame / Permissions-Policy | **Strong** — configured at `apps/web/next.config.ts:13-48`                                               |
| CSP `script-src` strength                 | **WEAK** — includes `'unsafe-inline'` (unavoidable in stock Next.js without nonce middleware)            |

---

## OWASP API Security Top 10 (2023)

### API1:2023 — Broken Object Level Authorization (BOLA)

**Status: PASS.** Every `[id]` and `[historyId]` route reads the path param, calls `await auth()`, then verifies ownership via a userId-scoped service call **before** any mutation.

Verified pattern (representative):

```ts
// apps/web/app/api/loans/[id]/sync/route.ts:14-18
const { userId } = await auth();
if (!userId) return err("UNAUTHORIZED", "Authentication required", 401);
const { id } = await params;
const existing = await loansService.findById(id, userId); // <-- ownership gate
if (!existing) return err("NOT_FOUND", "Loan not found", 404);
```

Confirmed across:

- `apps/web/app/api/loans/[id]/route.ts`
- `apps/web/app/api/loans/[id]/rate/route.ts`
- `apps/web/app/api/loans/[id]/sync/route.ts`
- `apps/web/app/api/entries/[id]/route.ts`
- `apps/web/app/api/entries/[id]/history/route.ts`
- `apps/web/app/api/entries/[id]/history/[historyId]/route.ts` (uses `verifyHistoryOwnership(historyId, userId)`)
- `apps/web/app/api/portfolio/[id]/route.ts`
- `apps/web/app/api/transactions/[id]/route.ts`

Only public `[id]`-style route is `quotes/[symbol]` — `symbol` is a stock ticker, not user data. Acceptable.

> **Caveat:** This audit verified the route layer. The service layer (`loansService.findById`, etc.) MUST also enforce userId scoping in its Prisma `where` clause. Recent commit `c60e9cf` is titled "fix(service): add userId scoping to loans write methods, fix test mocks" — this strongly implies a prior gap that has been closed. **Recommend a one-time Prisma query-log review on staging to confirm every `findById` translates to `WHERE id = ? AND userId = ?`.**

### API2:2023 — Broken Authentication

**Status: DELEGATED TO CLERK + ENV-VAR GUARDED.**

Code-level controls:

- `apps/web/middleware.ts` runs `clerkMiddleware()` globally with broad matcher.
- Every API route re-checks `await auth()` defensively (correct — `clerkMiddleware()` attaches context but does not enforce).
- 401 returned consistently via `err("UNAUTHORIZED", ...)`.

What this audit cannot verify (manual Clerk Dashboard review required):

- Session lifetime and rotation policy
- Required factors (password complexity, MFA enforcement)
- Account lockout thresholds
- Email verification requirement
- Suspicious-IP detection settings
- Token revocation on password change

**Action:** Owner should screenshot Clerk Dashboard → Sessions, Authentication, and Security tabs and append to this report's appendix.

### API3:2023 — Broken Object Property Level Authorization (BOPLA)

**Status: PARTIAL — Recommend response-shaping.**

`apps/web/services/*.ts` returns full Prisma objects via `entriesService.list(userId)`. Need to verify these don't include columns that shouldn't be exposed (e.g., internal flags, audit timestamps that reveal admin behavior, soft-deleted content).

**Action:** Add explicit response DTOs (Zod `.pick()` on the schemas in `@repo/shared`) so the API contract is intentional. Without this, adding a sensitive column to a Prisma model auto-leaks it to the client.

### API4:2023 — Unrestricted Resource Consumption

**Status: GAP — covered as `/cso` Finding #4.**

`.env.example` declares `RATE_LIMIT_MAX=100` and `RATE_LIMIT_WINDOW_MS=60000` but the values are never read by any code. Stolen Clerk session can spam any mutating route.

Additional concerns specific to this app:

- `POST /api/transactions` has no per-user daily cap. Could be used to fill the database.
- `PATCH /api/loans/[id]/sync` triggers expensive amortization recalculation; a tight loop is CPU-amplifying on Vercel.
- The public proxy routes (`/api/stocks/*`, `/api/exchange-rate`) have no IP-based limit and no auth — covered as `/cso` Finding #3.

### API5:2023 — Broken Function Level Authorization

**Status: PASS — no admin endpoints exist.**

`schema.prisma` has a `User.role` field (`admin/editor/viewer`) per `CLAUDE.md`, but no API route reads `role`. There is no admin surface to bypass. If admin endpoints are added later, verify each one calls a `requireRole` helper.

### API6:2023 — Unrestricted Access to Sensitive Business Flows

**Status: GAP — no automation defenses.**

Examples in this app:

- An attacker (or buggy client) could rapidly create 10,000 entries to inflate net-worth charts.
- A user could spam `POST /api/loans` to create fake loan records, then sync them in a loop to load-test our infra.

**Recommendation:** Add a per-action quota distinct from raw rate limit. E.g., max 50 entries per user per day. Same for loan creation.

### API7:2023 — Server Side Request Forgery (SSRF)

**Status: PARTIAL — covered as `/cso` Finding #3.**

The proxy routes accept user-supplied symbols and fetch fixed Yahoo/Coingecko hosts. Only the path varies via `encodeURIComponent`. Not classic SSRF (host is fixed), but still abusable as an open proxy.

Additional check: the `symbol` parameter is **not** validated against a whitelist of expected ticker formats. An attacker can send `symbol=../../foo` — `encodeURIComponent` neutralizes path traversal in URL terms, so this is safe per spec.

### API8:2023 — Security Misconfiguration

**Status: STRONG.**

Verified at `apps/web/next.config.ts:13-48`:

- `Content-Security-Policy` with allowlists for Clerk + Cloudflare Turnstile
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`

Gaps:

- `script-src 'unsafe-inline'` — required by Next.js without nonce middleware. Reduces XSS protection meaningfully. Recommend implementing per-request nonce.
- No `Cross-Origin-Opener-Policy` (`same-origin`) or `Cross-Origin-Embedder-Policy` (`require-corp`) headers. These prevent cross-origin window manipulation. Optional but recommended.
- No `Subresource Integrity (SRI)` hashes on external scripts (Clerk, Turnstile load via their own CDN). Optional; trust delegated.

### API9:2023 — Improper Inventory Management

**Status: PASS.**

22 routes in `apps/web/app/api/`, each with a single `route.ts`. No version-prefix surface (no `/v1/`, `/v2/`). No deprecated handlers found. CLAUDE.md doc drift (describes a non-existent `apps/api/`) is the only inventory issue — bookkeeping, not security.

### API10:2023 — Unsafe Consumption of APIs

**Status: GOOD with caveats.**

Upstream APIs: Yahoo Finance, Coingecko, ECB (open.er-api.com), Cathay Life, TWSE, SEC, Anthropic via Clerk telemetry.

Verified handling:

- All upstream calls wrapped in `try/catch` returning safe defaults on failure.
- Type guards on response shape (e.g., `typeof detail?.dividendRate?.raw === "number"` in `stocks/dividend/route.ts:25`).
- Response data is **not** rendered as HTML — flows into typed React state.

Gaps:

- No timeout on `fetch()` calls to upstreams. A slow Yahoo response holds a Vercel function open until the platform's max duration (300s per Vercel knowledge update). Worst case: slow-loris equivalent on our function quota.
- No retry-with-backoff or circuit breaker. If Yahoo errors, every user request also errors.

**Recommendation:** Wrap fetches with `AbortController` and a 5-second timeout.

---

## OWASP Web Top 10 (2021) — gap fill

The `/cso` audit covered A01-A10 at a high level. Items needing more depth:

### A01: Broken Access Control — already covered (API1 above)

### A02: Cryptographic Failures

**Status: DELEGATED + STRONG.**

- Passwords/sessions handled by Clerk (industry-standard bcrypt/argon2 + HTTP-only cookies, per Clerk docs).
- TLS terminated at Vercel (TLS 1.3, HSTS preload). HSTS configured for one year + subdomains.
- No app-level encryption needed (no payment data, no PHI).
- `DATABASE_URL` and `DIRECT_URL` are env-only, never logged (verified — no `console.log` references them).

### A03: Injection

**Status: STRONG.**

- All DB access via Prisma ORM with parameterized queries.
- One `$queryRaw\`SELECT 1\``in`apps/web/app/api/health/route.ts:6` — no interpolation, intentional health check.
- No `child_process`, `exec`, or shell-out anywhere in `apps/`.
- All API inputs validated by Zod (verified — 10/11 mutating routes; the one without is `DELETE` with no body).

### A04: Insecure Design — covered above (API4, API6)

### A05: Security Misconfiguration — covered above (API8)

### A06: Vulnerable Components — covered as `/cso` Findings #1, #2

### A07: Identification and Authentication Failures — covered as API2

### A08: Software and Data Integrity Failures — covered as `/cso` Finding #5 (unpinned actions)

### A09: Security Logging and Monitoring Failures

**Status: GAP.** New finding below (#6).

### A10: Server-Side Request Forgery — covered as API7 / `/cso` #3

---

## OWASP ASVS Level 1 — checklist

Selected high-relevance Level 1 controls for a financial PWA:

| Control | Requirement                                                               | Status       | Evidence                                                               |
| ------- | ------------------------------------------------------------------------- | ------------ | ---------------------------------------------------------------------- | ------------ | ------- | ---------------------------- |
| V2.1.1  | Verify auth required for protected functions                              | PASS         | Every `/api/(loans                                                     | transactions | entries | portfolio)/\*`checks`userId` |
| V2.1.2  | Verify forgotten-password flow does not reveal account existence          | DELEGATED    | Clerk handles                                                          |
| V2.2.1  | Verify anti-automation on auth (rate limit)                               | DELEGATED    | Clerk handles for /sign-in; **not for our APIs** (gap, see API4)       |
| V2.5.1  | Verify session token expires                                              | DELEGATED    | Clerk default                                                          |
| V2.5.5  | Verify session bound to user agent / IP                                   | DELEGATED    | Clerk default                                                          |
| V3.4.1  | Verify session cookies use Secure + HttpOnly + SameSite                   | DELEGATED    | Clerk default                                                          |
| V4.1.1  | Verify access control fails closed                                        | PASS         | All routes return 401 if `!userId`                                     |
| V4.2.1  | Verify URL identifiers cannot be enumerated to access another user's data | PASS         | Ownership gate via `findById(id, userId)`                              |
| V5.1.3  | Verify all input validated server-side                                    | PASS         | Zod schemas                                                            |
| V5.1.4  | Verify input is validated against allowlist (not blocklist)               | PASS         | Zod schemas use shape definitions                                      |
| V5.3.4  | Verify SQLi prevention via parameterized queries                          | PASS         | Prisma ORM throughout                                                  |
| V7.1.1  | Verify password / token storage is hashed                                 | DELEGATED    | Clerk                                                                  |
| V8.3.1  | Verify sensitive data not exposed in URLs                                 | PASS         | All sensitive ops are POST/PATCH/DELETE                                |
| V8.3.6  | Verify HTTP responses have Cache-Control: no-store for sensitive data     | **FAIL**     | New finding #7 below                                                   |
| V9.1.1  | Verify TLS 1.2+ on all connections                                        | PASS         | Vercel terminates TLS 1.3                                              |
| V9.2.1  | Verify HSTS in place                                                      | PASS         | `Strict-Transport-Security` header set                                 |
| V11.1.1 | Verify business logic flows are sequential and not bypassable             | NEEDS REVIEW | E.g., does loan sync require an existing balance update? Manual review |
| V12.3.1 | Verify file upload paths validate the file                                | N/A          | No file uploads                                                        |
| V13.1.1 | Verify all application components are uniquely identified for logging     | **FAIL**     | No structured logging (see #6)                                         |
| V13.2.1 | Verify all auth events are logged                                         | **FAIL**     | No auth event logging (see #6)                                         |
| V14.1.1 | Verify build pipeline performs SAST                                       | PARTIAL      | `pnpm audit` runs in CI; no SAST tool                                  |
| V14.2.1 | Verify components are not vulnerable                                      | PARTIAL      | See `/cso` #1, #2                                                      |

---

## PWA / Service Worker security — new section

`@ducanh2912/next-pwa@10.2.9` is configured at `apps/web/next.config.ts:1-7`:

```ts
const withPWA = withPWAInit({
  dest: "public",
  cacheOnFrontEndNav: true,
  disable: process.env.NODE_ENV === "development",
});
```

### Concerns

1. **`cacheOnFrontEndNav: true`** — caches navigation responses on the client side. This means pages a user visits (including authenticated pages) get stored in the service worker's cache. On a shared device, the next user can replay them from cache before the SW unregisters.

2. **No `runtimeCaching` rules** — relies entirely on Workbox defaults. Default precaching covers static assets (good). Runtime behavior for `/api/*` depends on Workbox version; `next-pwa` v10 defaults usually exclude `/api/*` but should be verified.

3. **No service worker `scope` constraint** — the SW is registered at root `/`, so it intercepts every fetch from the origin including `/api/*`.

4. **Manifest has no `scope`, `id`, or `prefer_related_applications`** — minor; `start_url: "/"` is the default scope.

### Recommendation

Make the PWA cache policy explicit:

```ts
const withPWA = withPWAInit({
  dest: "public",
  cacheOnFrontEndNav: false, // turn off — too risky for authenticated pages
  disable: process.env.NODE_ENV === "development",
  workboxOptions: {
    runtimeCaching: [
      {
        // Never cache user-data API responses
        urlPattern: /^https?:\/\/[^/]+\/api\/(loans|transactions|entries|portfolio).*/,
        handler: "NetworkOnly",
      },
      {
        // Public price data — short TTL OK
        urlPattern: /^https?:\/\/[^/]+\/api\/(stocks|exchange-rate|cathaylife-rates).*/,
        handler: "StaleWhileRevalidate",
        options: { cacheName: "public-data", expiration: { maxAgeSeconds: 300 } },
      },
    ],
  },
});
```

---

## Privacy & Data Protection

araS handles **financial PII** (asset values, liability balances, transaction history per user). This carries regulatory weight in Taiwan (PDPA), the EU (GDPR if any user is EU-resident), and California (CCPA).

| Requirement                         | Status                                                                                            |
| ----------------------------------- | ------------------------------------------------------------------------------------------------- |
| Data minimization                   | PARTIAL — some Prisma fields exposed via API may exceed need (see API3)                           |
| Encryption at rest                  | PASS — Supabase Postgres encrypts at rest by default                                              |
| Encryption in transit               | PASS — TLS 1.3 + HSTS preload                                                                     |
| Right to access (data export)       | NOT IMPLEMENTED                                                                                   |
| Right to erasure (account deletion) | NOT IMPLEMENTED — `User.deletedAt` field exists in schema but no API exposes user-driven deletion |
| Audit log of data access            | NOT IMPLEMENTED — see #6                                                                          |
| Data retention policy               | NOT DOCUMENTED                                                                                    |
| Breach notification process         | NOT DOCUMENTED                                                                                    |

**Recommendation:** Even before formal compliance work, add `DELETE /api/me` endpoint that triggers cascade deletion of all user-owned rows. This is a 2-hour task and material protection against most data-protection complaints.

---

## New findings (beyond `/cso`)

### #6 — HIGH (8/10) — No security event logging

- **Files:** entire `apps/web/app/api/` (only one `console.error` in 22 routes, in `cathaylife-rates`)
- **Why it matters:** OWASP A09 (Logging Failures) sits in the Top 10 specifically because the absence of logs means breaches go undetected for months. Without auth-failure logs, you cannot tell:
  - That a credential-stuffing attack is in progress
  - That a user is trying to access another user's `loanId`
  - That a stolen session is being used from an unfamiliar IP
  - That rate limits are being hit (because there are none, see #4)
- **Exploit scenario:** Attacker steals one user's Clerk session via XSS-adjacent vulnerability, slowly enumerates all users' loan IDs by trying GET /api/loans/[id] with random IDs. Each 404 produces no log. Discovery only happens when a user sees data they shouldn't.
- **Fix:**
  ```ts
  // apps/web/lib/security-log.ts
  export function logSecurityEvent(event: {
    type:
      | "auth_fail"
      | "auth_success"
      | "ownership_violation"
      | "rate_limit_hit"
      | "validation_fail";
    userId?: string;
    ip?: string;
    userAgent?: string;
    resource?: string;
    details?: Record<string, unknown>;
  }) {
    console.log(JSON.stringify({ ...event, ts: new Date().toISOString() }));
  }
  ```
  Then in every route's auth check:
  ```ts
  if (!userId) {
    logSecurityEvent({ type: "auth_fail", ip: req.ip, resource: req.nextUrl.pathname });
    return err("UNAUTHORIZED", "Authentication required", 401);
  }
  if (!existing) {
    logSecurityEvent({ type: "ownership_violation", userId, resource: `loans/${id}` });
    return err("NOT_FOUND", "Loan not found", 404);
  }
  ```
  Vercel automatically captures `console.log` JSON and feeds it to Logs / Log Drains. Pipe to Datadog / Better Stack for retention + alerting.

### #7 — MEDIUM (8/10) — Missing `Cache-Control: private, no-store` on user-data routes

- **Files:** `apps/web/app/api/{loans,transactions,entries,portfolio}/**/route.ts`
- **Why it matters:** Without explicit `Cache-Control: private, no-store`, intermediate proxies (corporate networks, ISPs, future CDN configurations) may cache these responses keyed by URL alone. Vercel's edge does not cache per-session by default for API routes, but the lack of an explicit directive is a defense-in-depth gap. ASVS V8.3.6 explicitly requires this.
- **Exploit scenario:** User A queries `/api/loans` from a corporate network with an aggressive caching proxy. User B on the same network requests the same URL and receives User A's cached response.
- **Fix:** Set in `apps/web/next.config.ts` headers, or per-route in `route.ts`:
  ```ts
  // next.config.ts addition
  {
    source: "/api/(loans|transactions|entries|portfolio)/:path*",
    headers: [
      { key: "Cache-Control", value: "private, no-store, max-age=0" },
      { key: "Vary", value: "Cookie, Authorization" },
    ],
  }
  ```

### #8 — MEDIUM (8/10) — PWA service worker may cache authenticated content

- **File:** `apps/web/next.config.ts:1-7`
- **Why it matters:** `cacheOnFrontEndNav: true` caches navigation responses to the service worker. Authenticated pages (`/assets`, `/transactions`, `/retirement`) are user-specific. On shared devices (family iPad, public kiosk), the next signed-in user's first paint may show the previous user's data before the API refreshes.
- **Exploit scenario:** User A signs into the family iPad, browses to `/transactions`, signs out. User B (same device) signs in. Before the network round-trip completes, the PWA serves User A's cached `/transactions` HTML. User B sees User A's bank balance for ~500ms.
- **Fix:** Switch `cacheOnFrontEndNav: false` and add explicit `runtimeCaching` rules (see PWA section above for full snippet). On sign-out, also call `await navigator.serviceWorker.getRegistration()?.then(r => r?.unregister())` to flush the SW.

### #9 — LOW (8/10) — No `fetch()` timeout on upstream proxy calls

- **Files:** `apps/web/app/api/stocks/*/route.ts`, `exchange-rate/route.ts`, `cathaylife-rates/route.ts`
- **Why it matters:** No `AbortController`. Slow upstream → function holds open until Vercel's 300s timeout → Active CPU bills mount.
- **Fix:** Wrap each fetch:
  ```ts
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 5000);
  try {
    const res = await fetch(url, { signal: ctl.signal, cache: "no-store" });
    // ...
  } finally {
    clearTimeout(timer);
  }
  ```

### #10 — INFO — Service-layer userId scoping needs Prisma-log verification

- **Files:** `apps/web/services/*.ts`
- **Why it matters:** Recent commit `c60e9cf` ("fix(service): add userId scoping to loans write methods") implies a prior bug. The route layer is verified to pass `userId` to service calls; the service layer must actually include it in every Prisma `where` clause.
- **Action:** Run staging traffic with Prisma query logging on (`DATABASE_URL=...&log=query`) for a session, verify every `findById`, `update`, `delete` includes `userId =` in the WHERE clause. Time-box: 30 minutes.

---

## Combined finding inventory (all reports)

| #   | Source      | Sev    | Title                                                     |
| --- | ----------- | ------ | --------------------------------------------------------- |
| 1   | /cso        | HIGH   | Next.js < 15.5.15                                         |
| 2   | /cso        | HIGH   | Build-time RCE chain via next-pwa → serialize-javascript  |
| 3   | /cso        | MEDIUM | Open proxy on stocks/FX routes                            |
| 4   | /cso        | MEDIUM | No rate limiting on user-data routes                      |
| 5   | /cso        | MEDIUM | GitHub Actions tag-pinned, not SHA-pinned                 |
| 6   | This report | HIGH   | No security event logging (A09)                           |
| 7   | This report | MEDIUM | Missing `Cache-Control: private, no-store` on user-data   |
| 8   | This report | MEDIUM | PWA SW may cache authenticated content                    |
| 9   | This report | LOW    | No `fetch()` timeout on upstream proxies                  |
| 10  | This report | INFO   | Service-layer userId scoping needs query-log verification |

---

## Recommended remediation order (combined)

1. **Today (10 min total):**
   - Bump `next` to `^15.5.15` (#1)
   - Add `pnpm.overrides` for `serialize-javascript`, `effect`, `flatted` (#2)

2. **This week (4 h total):**
   - Add `Cache-Control: private, no-store` headers for user-data routes (#7) — 30 min
   - Switch PWA `cacheOnFrontEndNav: false` + add `runtimeCaching` rules (#8) — 1 h
   - Tighten middleware to require auth on `/api/stocks/*` and `/api/exchange-rate` OR add IP rate limit (#3) — 1 h
   - Implement security event logging helper + wire into auth/ownership gates (#6) — 2 h

3. **Next sprint (1 day total):**
   - Add per-userId rate limiting via `@upstash/ratelimit` (#4) — 4 h
   - SHA-pin all CI actions + Renovate config (#5) — 1 h
   - `fetch()` timeouts on upstream proxies (#9) — 30 min
   - Verify service-layer userId scoping on staging (#10) — 30 min
   - Add `DELETE /api/me` for account deletion — 2 h

4. **Backlog (next quarter):**
   - Migrate CSP to nonce-based to drop `script-src 'unsafe-inline'`
   - Add response DTOs (Zod `.pick()`) to fix BOPLA exposure (API3)
   - Document data retention policy
   - Manually review Clerk Dashboard config (session lifetime, MFA, lockouts) and screenshot to appendix

---

## Appendix: tools and frameworks consulted

- **OWASP API Security Top 10 (2023)** — https://owasp.org/API-Security/editions/2023/en/0x11-t10/
- **OWASP Top 10 (2021)** — https://owasp.org/Top10/
- **OWASP ASVS v4.0.3** — https://owasp.org/www-project-application-security-verification-standard/
- **OWASP CWE mapping** — for CWE-79, CWE-285, CWE-352, CWE-918, CWE-778

## Disclaimer

This is an AI-assisted scan, not a substitute for a professional penetration test. For production systems handling financial PII, engage a qualified security firm at least annually. Use this report as a triage tool — every HIGH or MEDIUM finding should be independently verified by a human reviewer before being closed as "fixed."
