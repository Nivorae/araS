# Security Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remediate all HIGH and MEDIUM findings from the three security audit reports (`xss-scan-report.md`, `owasp-deep-audit-2026-05-10.md`, `cso-audit-2026-05-10.md`), plus selected LOW/INFO findings.

**Architecture:** Next.js 15 App Router monorepo. All server logic lives in `apps/web/app/api/`. Authentication via Clerk. No `apps/api/` Express service exists despite CLAUDE.md docs.

**Tech Stack:** Next.js 15, Clerk (`@clerk/nextjs` v7), Prisma 6, Zod, `@ducanh2912/next-pwa`, Vitest, TypeScript

---

## File Map

| File                                                         | Change                                                                                        |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `apps/web/package.json`                                      | Bump `next` to `^15.5.15`                                                                     |
| `package.json`                                               | Add `pnpm.overrides` for `serialize-javascript`, `effect`, `flatted`                          |
| `apps/web/next.config.ts`                                    | Fix PWA config + add Cache-Control headers for user-data routes + add COOP header             |
| `apps/web/middleware.ts`                                     | Require auth on proxy routes (`/api/stocks/*`, `/api/exchange-rate`, `/api/cathaylife-rates`) |
| `apps/web/lib/security-log.ts`                               | **NEW** — structured security event logger                                                    |
| `apps/web/tests/lib/security-log.test.ts`                    | **NEW** — unit tests for the logger                                                           |
| `apps/web/app/api/loans/route.ts`                            | Wire security logging                                                                         |
| `apps/web/app/api/loans/[id]/route.ts`                       | Wire security logging                                                                         |
| `apps/web/app/api/loans/[id]/sync/route.ts`                  | Wire security logging                                                                         |
| `apps/web/app/api/loans/[id]/rate/route.ts`                  | Wire security logging                                                                         |
| `apps/web/app/api/entries/route.ts`                          | Wire security logging                                                                         |
| `apps/web/app/api/entries/[id]/route.ts`                     | Wire security logging                                                                         |
| `apps/web/app/api/entries/[id]/history/route.ts`             | Wire security logging                                                                         |
| `apps/web/app/api/entries/[id]/history/[historyId]/route.ts` | Wire security logging                                                                         |
| `apps/web/app/api/transactions/route.ts`                     | Wire security logging                                                                         |
| `apps/web/app/api/transactions/[id]/route.ts`                | Wire security logging                                                                         |
| `apps/web/app/api/portfolio/route.ts`                        | Wire security logging                                                                         |
| `apps/web/app/api/portfolio/[id]/route.ts`                   | Wire security logging                                                                         |
| `apps/web/app/api/stocks/price/route.ts`                     | Add fetch timeout                                                                             |
| `apps/web/app/api/stocks/crypto/route.ts`                    | Add fetch timeout                                                                             |
| `apps/web/app/api/stocks/dividend/route.ts`                  | Add fetch timeout                                                                             |
| `apps/web/app/api/stocks/tw/route.ts`                        | Add fetch timeout                                                                             |
| `apps/web/app/api/stocks/us/route.ts`                        | Add fetch timeout                                                                             |
| `apps/web/app/api/exchange-rate/route.ts`                    | Add fetch timeout                                                                             |
| `apps/web/app/api/cathaylife-rates/route.ts`                 | Add fetch timeout                                                                             |
| `apps/web/app/globals.css`                                   | Add `WAVE_CSS` keyframes                                                                      |
| `apps/web/components/finance/RetirementPage.tsx`             | Remove `dangerouslySetInnerHTML`, add Zod localStorage validation                             |
| `apps/web/hooks/useExchangeRate.ts`                          | Add Zod localStorage validation                                                               |
| `packages/eslint-config/react.js`                            | Add `react/no-danger`, `no-eval`, `no-implied-eval` rules                                     |

---

## Task 1: Dependency Security Patches (HIGH #1, #2)

**Files:**

- Modify: `apps/web/package.json`
- Modify: `package.json` (root)

- [ ] **Step 1: Bump Next.js in `apps/web/package.json`**

Replace:

```json
"next": "^15.1.0",
```

With:

```json
"next": "^15.5.15",
```

- [ ] **Step 2: Add `pnpm.overrides` to root `package.json`**

Add after the `"engines"` block:

```json
  "pnpm": {
    "overrides": {
      "serialize-javascript": ">=7.0.3",
      "effect": ">=3.20.0",
      "flatted": ">=3.4.2"
    }
  }
```

- [ ] **Step 3: Install and verify**

Run:

```bash
pnpm install
pnpm build
```

Expected: clean build, no advisories for `serialize-javascript`/`effect`/`flatted`.

- [ ] **Step 4: Run tests**

```bash
pnpm test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/package.json package.json pnpm-lock.yaml
git commit -m "fix(deps): bump next to 15.5.15, override vulnerable transitive deps"
```

---

## Task 2: Update `next.config.ts` — Cache-Control + COOP + PWA Fix (MEDIUM #7, #8, API8)

**Files:**

- Modify: `apps/web/next.config.ts`

- [ ] **Step 1: Replace `apps/web/next.config.ts` with the updated version**

```ts
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  cacheOnFrontEndNav: false,
  disable: process.env.NODE_ENV === "development",
  workboxOptions: {
    runtimeCaching: [
      {
        urlPattern: /^https?:\/\/[^/]+\/api\/(loans|transactions|entries|portfolio).*/,
        handler: "NetworkOnly",
      },
      {
        urlPattern: /^https?:\/\/[^/]+\/api\/(stocks|exchange-rate|cathaylife-rates).*/,
        handler: "StaleWhileRevalidate",
        options: { cacheName: "public-data", expiration: { maxAgeSeconds: 300 } },
      },
    ],
  },
});

const nextConfig = {
  experimental: {
    taint: true,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              process.env.NODE_ENV === "development"
                ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://clerk-telemetry.com https://*.clerk.accounts.dev https://challenges.cloudflare.com"
                : "script-src 'self' 'unsafe-inline' https://clerk-telemetry.com https://*.clerk.accounts.dev https://challenges.cloudflare.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "font-src 'self' data:",
              "connect-src 'self' ws: wss: https://openapi.twse.com.tw https://clerk.com https://*.clerk.accounts.dev https://clerk-telemetry.com https://img.clerk.com",
              "frame-src https://challenges.cloudflare.com",
              "worker-src blob: 'self'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
      {
        source: "/api/(loans|transactions|entries|portfolio)/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store, max-age=0" },
          { key: "Vary", value: "Cookie, Authorization" },
        ],
      },
    ];
  },
};

export default withPWA(nextConfig);
```

- [ ] **Step 2: Verify build succeeds**

```bash
pnpm --filter @repo/web build
```

Expected: successful build with PWA service worker generated.

- [ ] **Step 3: Commit**

```bash
git add apps/web/next.config.ts
git commit -m "fix(security): add cache-control headers, COOP header, and fix PWA authenticated content caching"
```

---

## Task 3: Protect Proxy Routes via Clerk Middleware (MEDIUM #3)

**Files:**

- Modify: `apps/web/middleware.ts`

- [ ] **Step 1: Update `apps/web/middleware.ts`**

Replace the entire file contents:

```ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedProxy = createRouteMatcher([
  "/api/stocks(.*)",
  "/api/exchange-rate(.*)",
  "/api/cathaylife-rates(.*)",
]);

export default clerkMiddleware((auth, req) => {
  if (isProtectedProxy(req)) auth.protect();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
```

- [ ] **Step 2: Verify type-check**

```bash
pnpm --filter @repo/web type-check
```

Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/middleware.ts
git commit -m "fix(security): require clerk auth on stock and exchange-rate proxy routes"
```

---

## Task 4: Security Event Logging Helper (HIGH #6 / OWASP A09)

**Files:**

- Create: `apps/web/lib/security-log.ts`
- Create: `apps/web/tests/lib/security-log.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/tests/lib/security-log.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { logSecurityEvent } from "../../lib/security-log";

describe("logSecurityEvent", () => {
  it("outputs valid JSON with type and timestamp", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    logSecurityEvent({ type: "auth_fail", resource: "/api/loans" });
    expect(spy).toHaveBeenCalledOnce();
    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    expect(parsed.type).toBe("auth_fail");
    expect(parsed.resource).toBe("/api/loans");
    expect(typeof parsed.ts).toBe("string");
    expect(new Date(parsed.ts).getTime()).toBeGreaterThan(0);
    spy.mockRestore();
  });

  it("omits undefined optional fields from JSON output", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    logSecurityEvent({ type: "ownership_violation", userId: "user_abc" });
    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    expect(parsed.userId).toBe("user_abc");
    expect("resource" in parsed).toBe(false);
    expect("details" in parsed).toBe(false);
    spy.mockRestore();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @repo/web test -- tests/lib/security-log.test.ts
```

Expected: FAIL — `Cannot find module '../../lib/security-log'`

- [ ] **Step 3: Create `apps/web/lib/security-log.ts`**

```ts
type SecurityEventType =
  | "auth_fail"
  | "auth_success"
  | "ownership_violation"
  | "rate_limit_hit"
  | "validation_fail";

interface SecurityEvent {
  type: SecurityEventType;
  userId?: string;
  resource?: string;
  details?: Record<string, unknown>;
}

export function logSecurityEvent(event: SecurityEvent) {
  const payload = { ...event, ts: new Date().toISOString() };
  console.log(JSON.stringify(payload));
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm --filter @repo/web test -- tests/lib/security-log.test.ts
```

Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/security-log.ts apps/web/tests/lib/security-log.test.ts
git commit -m "feat(security): add structured security event logger"
```

---

## Task 5: Wire Security Logging into All Authenticated Routes (HIGH #6)

**Files:**

- Modify: `apps/web/app/api/loans/route.ts`
- Modify: `apps/web/app/api/loans/[id]/route.ts`
- Modify: `apps/web/app/api/loans/[id]/sync/route.ts`
- Modify: `apps/web/app/api/loans/[id]/rate/route.ts`
- Modify: `apps/web/app/api/entries/route.ts`
- Modify: `apps/web/app/api/entries/[id]/route.ts`
- Modify: `apps/web/app/api/entries/[id]/history/route.ts`
- Modify: `apps/web/app/api/entries/[id]/history/[historyId]/route.ts`
- Modify: `apps/web/app/api/transactions/route.ts`
- Modify: `apps/web/app/api/transactions/[id]/route.ts`
- Modify: `apps/web/app/api/portfolio/route.ts`
- Modify: `apps/web/app/api/portfolio/[id]/route.ts`

The pattern is: import `logSecurityEvent`, call it before every `return err("UNAUTHORIZED", ...)` and before every `return err("NOT_FOUND", ...)` that follows an ownership check.

- [ ] **Step 1: Update `apps/web/app/api/loans/route.ts`**

```ts
import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { CreateLoanSchema } from "@repo/shared";
import { loansService } from "@/services/loans.service";
import { ok, err, handleError } from "@/lib/api-response";
import { logSecurityEvent } from "@/lib/security-log";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      logSecurityEvent({ type: "auth_fail", resource: "/api/loans" });
      return err("UNAUTHORIZED", "Authentication required", 401);
    }
    const data = CreateLoanSchema.parse(await req.json());
    const result = await loansService.create(data, userId);
    return ok(result, 201);
  } catch (e) {
    return handleError(e);
  }
}
```

- [ ] **Step 2: Update `apps/web/app/api/loans/[id]/route.ts`**

```ts
import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { UpdateLoanSchema } from "@repo/shared";
import { loansService } from "@/services/loans.service";
import { ok, err, handleError } from "@/lib/api-response";
import { logSecurityEvent } from "@/lib/security-log";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      logSecurityEvent({ type: "auth_fail", resource: "/api/loans/[id]" });
      return err("UNAUTHORIZED", "Authentication required", 401);
    }
    const { id } = await params;
    const loan = await loansService.findById(id, userId);
    if (!loan) {
      logSecurityEvent({ type: "ownership_violation", userId, resource: `loans/${id}` });
      return err("NOT_FOUND", "Loan not found", 404);
    }
    return ok(loan);
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      logSecurityEvent({ type: "auth_fail", resource: "/api/loans/[id]" });
      return err("UNAUTHORIZED", "Authentication required", 401);
    }
    const { id } = await params;
    const existing = await loansService.findById(id, userId);
    if (!existing) {
      logSecurityEvent({ type: "ownership_violation", userId, resource: `loans/${id}` });
      return err("NOT_FOUND", "Loan not found", 404);
    }
    const data = UpdateLoanSchema.parse(await req.json());
    const loan = await loansService.update(existing.id, data, userId);
    return ok(loan);
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      logSecurityEvent({ type: "auth_fail", resource: "/api/loans/[id]" });
      return err("UNAUTHORIZED", "Authentication required", 401);
    }
    const { id } = await params;
    const loan = await loansService.findById(id, userId);
    if (!loan) {
      logSecurityEvent({ type: "ownership_violation", userId, resource: `loans/${id}` });
      return err("NOT_FOUND", "Loan not found", 404);
    }
    await loansService.deleteByEntryId(loan.entryId, userId);
    return ok({ deleted: true });
  } catch (e) {
    return handleError(e);
  }
}
```

- [ ] **Step 3: Update `apps/web/app/api/loans/[id]/sync/route.ts`**

```ts
import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { loansService } from "@/services/loans.service";
import { ok, err, handleError } from "@/lib/api-response";
import { logSecurityEvent } from "@/lib/security-log";

const SyncBodySchema = z.object({
  manualBalance: z.number().min(0).optional(),
  overrideTermMonths: z.number().int().positive().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      logSecurityEvent({ type: "auth_fail", resource: "/api/loans/[id]/sync" });
      return err("UNAUTHORIZED", "Authentication required", 401);
    }
    const { id } = await params;
    const existing = await loansService.findById(id, userId);
    if (!existing) {
      logSecurityEvent({ type: "ownership_violation", userId, resource: `loans/${id}/sync` });
      return err("NOT_FOUND", "Loan not found", 404);
    }
    const body = await req.json().catch(() => ({}));
    const { manualBalance, overrideTermMonths } = SyncBodySchema.parse(body);
    const result = await loansService.syncBalance(existing, manualBalance, overrideTermMonths);
    return ok(result);
  } catch (e) {
    return handleError(e);
  }
}
```

- [ ] **Step 4: Update `apps/web/app/api/loans/[id]/rate/route.ts`**

```ts
import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { UpdateLoanRateSchema } from "@repo/shared";
import { loansService } from "@/services/loans.service";
import { ok, err, handleError } from "@/lib/api-response";
import { logSecurityEvent } from "@/lib/security-log";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      logSecurityEvent({ type: "auth_fail", resource: "/api/loans/[id]/rate" });
      return err("UNAUTHORIZED", "Authentication required", 401);
    }
    const { id } = await params;
    const existing = await loansService.findById(id, userId);
    if (!existing) {
      logSecurityEvent({ type: "ownership_violation", userId, resource: `loans/${id}/rate` });
      return err("NOT_FOUND", "Loan not found", 404);
    }
    const data = UpdateLoanRateSchema.parse(await req.json());
    const loan = await loansService.updateRate(id, data, userId);
    return ok(loan);
  } catch (e) {
    return handleError(e);
  }
}
```

- [ ] **Step 5: Update `apps/web/app/api/entries/route.ts`**

```ts
import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { CreateEntrySchema } from "@repo/shared";
import { entriesService } from "@/services/entries.service";
import { ok, err, handleError } from "@/lib/api-response";
import { logSecurityEvent } from "@/lib/security-log";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      logSecurityEvent({ type: "auth_fail", resource: "/api/entries" });
      return err("UNAUTHORIZED", "Unauthorized", 401);
    }
    const entries = await entriesService.list(userId);
    return ok(entries);
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      logSecurityEvent({ type: "auth_fail", resource: "/api/entries" });
      return err("UNAUTHORIZED", "Unauthorized", 401);
    }
    const data = CreateEntrySchema.parse(await req.json());
    const entry = await entriesService.create(data, userId);
    return ok(entry, 201);
  } catch (e) {
    return handleError(e);
  }
}
```

- [ ] **Step 6: Update `apps/web/app/api/entries/[id]/route.ts`**

```ts
import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { UpdateEntrySchema } from "@repo/shared";
import { entriesService } from "@/services/entries.service";
import { ok, err, handleError } from "@/lib/api-response";
import { logSecurityEvent } from "@/lib/security-log";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      logSecurityEvent({ type: "auth_fail", resource: "/api/entries/[id]" });
      return err("UNAUTHORIZED", "Unauthorized", 401);
    }
    const { id } = await params;
    const existing = await entriesService.findById(id, userId);
    if (!existing) {
      logSecurityEvent({ type: "ownership_violation", userId, resource: `entries/${id}` });
      return err("NOT_FOUND", "Entry not found", 404);
    }
    const data = UpdateEntrySchema.parse(await req.json());
    const entry = await entriesService.update(id, data, userId);
    return ok(entry);
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      logSecurityEvent({ type: "auth_fail", resource: "/api/entries/[id]" });
      return err("UNAUTHORIZED", "Unauthorized", 401);
    }
    const { id } = await params;
    const existing = await entriesService.findById(id, userId);
    if (!existing) {
      logSecurityEvent({ type: "ownership_violation", userId, resource: `entries/${id}` });
      return err("NOT_FOUND", "Entry not found", 404);
    }
    await entriesService.delete(id, userId);
    return ok({ deleted: true });
  } catch (e) {
    return handleError(e);
  }
}
```

- [ ] **Step 7: Update `apps/web/app/api/entries/[id]/history/route.ts`**

```ts
import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { entriesService } from "@/services/entries.service";
import { ok, err, handleError } from "@/lib/api-response";
import { logSecurityEvent } from "@/lib/security-log";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      logSecurityEvent({ type: "auth_fail", resource: "/api/entries/[id]/history" });
      return err("UNAUTHORIZED", "Unauthorized", 401);
    }
    const { id } = await params;
    const existing = await entriesService.findById(id, userId);
    if (!existing) {
      logSecurityEvent({ type: "ownership_violation", userId, resource: `entries/${id}/history` });
      return err("NOT_FOUND", "Entry not found", 404);
    }

    let history = await entriesService.listHistory(id);

    if (history.length === 0 && existing.value !== 0) {
      await entriesService.createHistory(id, {
        delta: existing.value,
        balance: existing.value,
        note: "初始建立",
        createdAt: existing.createdAt,
      });
      history = await entriesService.listHistory(id);
    }

    return ok(history);
  } catch (e) {
    return handleError(e);
  }
}
```

- [ ] **Step 8: Update `apps/web/app/api/entries/[id]/history/[historyId]/route.ts`**

```ts
import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { UpdateEntryHistorySchema } from "@repo/shared";
import { entriesService } from "@/services/entries.service";
import { ok, err, handleError } from "@/lib/api-response";
import { logSecurityEvent } from "@/lib/security-log";

type Params = { params: Promise<{ id: string; historyId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth();
    if (!userId) {
      logSecurityEvent({ type: "auth_fail", resource: "/api/entries/[id]/history/[historyId]" });
      return err("UNAUTHORIZED", "Authentication required", 401);
    }
    const { historyId } = await params;
    const owned = await entriesService.verifyHistoryOwnership(historyId, userId);
    if (!owned) {
      logSecurityEvent({ type: "ownership_violation", userId, resource: `history/${historyId}` });
      return err("NOT_FOUND", "History record not found", 404);
    }
    const data = UpdateEntryHistorySchema.parse(await req.json());
    const history = await entriesService.updateHistory(historyId, data);
    return ok(history);
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth();
    if (!userId) {
      logSecurityEvent({ type: "auth_fail", resource: "/api/entries/[id]/history/[historyId]" });
      return err("UNAUTHORIZED", "Authentication required", 401);
    }
    const { historyId } = await params;
    const owned = await entriesService.verifyHistoryOwnership(historyId, userId);
    if (!owned) {
      logSecurityEvent({ type: "ownership_violation", userId, resource: `history/${historyId}` });
      return err("NOT_FOUND", "History record not found", 404);
    }
    await entriesService.deleteHistory(historyId);
    return ok(null);
  } catch (e) {
    return handleError(e);
  }
}
```

- [ ] **Step 9: Update `apps/web/app/api/transactions/route.ts`**

```ts
import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { CreateTransactionSchema } from "@repo/shared";
import { transactionsService } from "@/services/transactions.service";
import { ok, err, handleError } from "@/lib/api-response";
import { logSecurityEvent } from "@/lib/security-log";

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      logSecurityEvent({ type: "auth_fail", resource: "/api/transactions" });
      return err("UNAUTHORIZED", "Authentication required", 401);
    }
    const month = req.nextUrl.searchParams.get("month") ?? undefined;
    const items = await transactionsService.list(userId, month);
    return ok(items);
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      logSecurityEvent({ type: "auth_fail", resource: "/api/transactions" });
      return err("UNAUTHORIZED", "Authentication required", 401);
    }
    const data = CreateTransactionSchema.parse(await req.json());
    const item = await transactionsService.create(data, userId);
    return ok(item, 201);
  } catch (e) {
    return handleError(e);
  }
}
```

- [ ] **Step 10: Update `apps/web/app/api/transactions/[id]/route.ts`**

```ts
import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { transactionsService } from "@/services/transactions.service";
import { ok, err, handleError } from "@/lib/api-response";
import { logSecurityEvent } from "@/lib/security-log";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      logSecurityEvent({ type: "auth_fail", resource: "/api/transactions/[id]" });
      return err("UNAUTHORIZED", "Authentication required", 401);
    }
    const { id } = await params;
    await transactionsService.delete(id, userId);
    return ok({ deleted: true });
  } catch (e) {
    return handleError(e);
  }
}
```

- [ ] **Step 11: Update `apps/web/app/api/portfolio/route.ts`**

```ts
import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { CreatePortfolioItemSchema } from "@repo/shared";
import { portfolioService } from "@/services/portfolio.service";
import { ok, err, handleError } from "@/lib/api-response";
import { logSecurityEvent } from "@/lib/security-log";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      logSecurityEvent({ type: "auth_fail", resource: "/api/portfolio" });
      return err("UNAUTHORIZED", "Authentication required", 401);
    }
    const items = await portfolioService.list(userId);
    return ok(items);
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      logSecurityEvent({ type: "auth_fail", resource: "/api/portfolio" });
      return err("UNAUTHORIZED", "Authentication required", 401);
    }
    const data = CreatePortfolioItemSchema.parse(await req.json());
    const item = await portfolioService.create(data, userId);
    return ok(item, 201);
  } catch (e) {
    return handleError(e);
  }
}
```

- [ ] **Step 12: Update `apps/web/app/api/portfolio/[id]/route.ts`**

```ts
import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { UpdatePortfolioItemSchema } from "@repo/shared";
import { portfolioService } from "@/services/portfolio.service";
import { ok, err, handleError } from "@/lib/api-response";
import { logSecurityEvent } from "@/lib/security-log";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      logSecurityEvent({ type: "auth_fail", resource: "/api/portfolio/[id]" });
      return err("UNAUTHORIZED", "Authentication required", 401);
    }
    const { id } = await params;
    const existing = await portfolioService.findById(id, userId);
    if (!existing) {
      logSecurityEvent({ type: "ownership_violation", userId, resource: `portfolio/${id}` });
      return err("NOT_FOUND", "Portfolio item not found", 404);
    }
    const data = UpdatePortfolioItemSchema.parse(await req.json());
    const item = await portfolioService.update(id, data, userId);
    return ok(item);
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      logSecurityEvent({ type: "auth_fail", resource: "/api/portfolio/[id]" });
      return err("UNAUTHORIZED", "Authentication required", 401);
    }
    const { id } = await params;
    const existing = await portfolioService.findById(id, userId);
    if (!existing) {
      logSecurityEvent({ type: "ownership_violation", userId, resource: `portfolio/${id}` });
      return err("NOT_FOUND", "Portfolio item not found", 404);
    }
    await portfolioService.delete(id, userId);
    return ok({ deleted: true });
  } catch (e) {
    return handleError(e);
  }
}
```

- [ ] **Step 13: Run all tests**

```bash
pnpm --filter @repo/web test
```

Expected: all tests pass.

- [ ] **Step 14: Type check**

```bash
pnpm --filter @repo/web type-check
```

Expected: no errors.

- [ ] **Step 15: Commit**

```bash
git add apps/web/app/api/
git commit -m "feat(security): wire security event logging into all authenticated API routes"
```

---

## Task 6: Add Fetch Timeouts to Upstream Proxy Routes (LOW #9)

**Files:** all 7 proxy route files

- [ ] **Step 1: Update `apps/web/app/api/stocks/price/route.ts`**

```ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol");
  if (!symbol) {
    return NextResponse.json({ error: "symbol is required" }, { status: 400 });
  }

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 5000);
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
    const res = await fetch(url, {
      signal: ctl.signal,
      cache: "no-store",
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    if (!res.ok) {
      return NextResponse.json({ error: "fetch failed" }, { status: 502 });
    }

    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta) {
      return NextResponse.json({ error: "no data" }, { status: 404 });
    }

    return NextResponse.json({
      symbol,
      price: meta.regularMarketPrice as number,
      currency: meta.currency as string,
    });
  } catch {
    return NextResponse.json({ error: "fetch failed" }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}
```

- [ ] **Step 2: Update `apps/web/app/api/stocks/dividend/route.ts`**

```ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol");
  if (!symbol) {
    return NextResponse.json({ dividendRate: null, dividendYield: null });
  }

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 5000);
  try {
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=summaryDetail`;
    const res = await fetch(url, {
      signal: ctl.signal,
      cache: "no-store",
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    if (!res.ok) {
      return NextResponse.json({ dividendRate: null, dividendYield: null });
    }

    const data = await res.json();
    const detail = data?.quoteSummary?.result?.[0]?.summaryDetail;

    const dividendRate =
      typeof detail?.dividendRate?.raw === "number" ? (detail.dividendRate.raw as number) : null;
    const dividendYield =
      typeof detail?.dividendYield?.raw === "number" ? (detail.dividendYield.raw as number) : null;

    return NextResponse.json({ dividendRate, dividendYield });
  } catch {
    return NextResponse.json({ dividendRate: null, dividendYield: null });
  } finally {
    clearTimeout(timer);
  }
}
```

- [ ] **Step 3: Update `apps/web/app/api/stocks/crypto/route.ts`**

```ts
import { NextResponse } from "next/server";

const COINGECKO_MARKETS_URL =
  "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=";

let cachedAt = 0;
let cachedResult: { code: string; name: string; id: string }[] | null = null;
const CACHE_MS = 24 * 60 * 60 * 1000;

export async function GET() {
  try {
    if (cachedResult && Date.now() - cachedAt < CACHE_MS) {
      return NextResponse.json(cachedResult);
    }

    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 5000);
    let page1: Response, page2: Response;
    try {
      [page1, page2] = await Promise.all([
        fetch(COINGECKO_MARKETS_URL + "1", { signal: ctl.signal, cache: "no-store" }),
        fetch(COINGECKO_MARKETS_URL + "2", { signal: ctl.signal, cache: "no-store" }),
      ]);
    } finally {
      clearTimeout(timer);
    }

    if (!page1.ok || !page2.ok) {
      return NextResponse.json({ error: "Failed to fetch" }, { status: 502 });
    }

    const raw: { id: string; symbol: string; name: string }[] = [
      ...(await page1.json()),
      ...(await page2.json()),
    ];

    const result = raw
      .map((item) => ({
        code: item.symbol?.toUpperCase() ?? "",
        name: item.name ?? "",
        id: item.id ?? "",
      }))
      .filter((s) => s.code && s.name)
      .sort((a, b) => a.code.localeCompare(b.code));

    cachedAt = Date.now();
    cachedResult = result;

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Failed to fetch" }, { status: 502 });
  }
}
```

- [ ] **Step 4: Update `apps/web/app/api/stocks/tw/route.ts`**

Find the `fetchJSON` helper function in this file and add `signal` parameter:

Replace:

```ts
async function fetchJSON(url: string): Promise<Record<string, string>[]> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}
```

With:

```ts
async function fetchJSON(url: string, signal: AbortSignal): Promise<Record<string, string>[]> {
  try {
    const res = await fetch(url, { cache: "no-store", signal });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}
```

Then in the `GET()` function, replace:

```ts
const [allSecurities, companies, tpexSecurities] = await Promise.all([
  fetchJSON(TWSE_ALL),
  fetchJSON(TWSE_COMPANIES),
  fetchJSON(TPEX_ALL),
]);
```

With:

```ts
const ctl = new AbortController();
const timer = setTimeout(() => ctl.abort(), 5000);
let allSecurities: Record<string, string>[],
  companies: Record<string, string>[],
  tpexSecurities: Record<string, string>[];
try {
  [allSecurities, companies, tpexSecurities] = await Promise.all([
    fetchJSON(TWSE_ALL, ctl.signal),
    fetchJSON(TWSE_COMPANIES, ctl.signal),
    fetchJSON(TPEX_ALL, ctl.signal),
  ]);
} finally {
  clearTimeout(timer);
}
```

- [ ] **Step 5: Update `apps/web/app/api/stocks/us/route.ts`**

Inside the `GET()` function, replace:

```ts
const res = await fetch(SEC_TICKERS_URL, {
  cache: "no-store",
  headers: { "User-Agent": "araS-finance-app contact@example.com" },
});
```

With:

```ts
const ctl = new AbortController();
const timer = setTimeout(() => ctl.abort(), 5000);
let res: Response;
try {
  res = await fetch(SEC_TICKERS_URL, {
    signal: ctl.signal,
    cache: "no-store",
    headers: { "User-Agent": "araS-finance-app contact@example.com" },
  });
} finally {
  clearTimeout(timer);
}
```

- [ ] **Step 6: Update `apps/web/app/api/exchange-rate/route.ts`**

```ts
import { NextResponse } from "next/server";

export async function GET() {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 5000);
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      signal: ctl.signal,
      next: { revalidate: 3600 },
    });
    if (!res.ok) throw new Error("Non-OK response");
    const data: { rates: Record<string, number> } = await res.json();
    const twd = data.rates["TWD"];
    if (!twd || twd <= 0) throw new Error("Invalid rate");
    return NextResponse.json({ TWD: twd });
  } catch {
    return NextResponse.json({ error: "fetch failed" }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}
```

- [ ] **Step 7: Update `apps/web/app/api/cathaylife-rates/route.ts`**

Replace the inner `fetch` call only. Find:

```ts
const res = await fetch("https://www.cathaylife.com.tw/cathaylifeins/api/DTODBHZ6/getAllByJoinZ5", {
  headers: {
    "User-Agent": "Mozilla/5.0 (compatible)",
    Referer: "https://www.cathaylife.com.tw/cathaylifeins/common/rate",
    Accept: "application/json",
  },
  next: { revalidate: 43200 },
});
```

Replace with:

```ts
const ctl = new AbortController();
const timer = setTimeout(() => ctl.abort(), 5000);
let res: Response;
try {
  res = await fetch("https://www.cathaylife.com.tw/cathaylifeins/api/DTODBHZ6/getAllByJoinZ5", {
    signal: ctl.signal,
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible)",
      Referer: "https://www.cathaylife.com.tw/cathaylifeins/common/rate",
      Accept: "application/json",
    },
    next: { revalidate: 43200 },
  });
} finally {
  clearTimeout(timer);
}
```

- [ ] **Step 8: Type check**

```bash
pnpm --filter @repo/web type-check
```

Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add apps/web/app/api/stocks/ apps/web/app/api/exchange-rate/ apps/web/app/api/cathaylife-rates/
git commit -m "fix(security): add 5s AbortController timeout to all upstream proxy fetch calls"
```

---

## Task 7: Remove `dangerouslySetInnerHTML` (XSS LOW-1)

**Files:**

- Modify: `apps/web/app/globals.css`
- Modify: `apps/web/components/finance/RetirementPage.tsx`

- [ ] **Step 1: Add WAVE_CSS keyframes to `apps/web/app/globals.css`**

Append to the end of the file:

```css
@keyframes piggy-water-bob {
  from {
    transform: translateY(-2px);
  }
  to {
    transform: translateY(2px);
  }
}

@keyframes modal-slide-up {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}

@keyframes modal-slide-down {
  from {
    transform: translateY(0);
  }
  to {
    transform: translateY(100%);
  }
}

@keyframes modal-scrim-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes modal-scrim-out {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}
```

- [ ] **Step 2: Remove `WAVE_CSS` constant from `RetirementPage.tsx`**

In `apps/web/components/finance/RetirementPage.tsx`, remove line 27:

```ts
const WAVE_CSS = `@keyframes piggy-water-bob{from{transform:translateY(-2px)}to{transform:translateY(2px)}}@keyframes modal-slide-up{from{transform:translateY(100%)}to{transform:translateY(0)}}@keyframes modal-slide-down{from{transform:translateY(0)}to{transform:translateY(100%)}}@keyframes modal-scrim-in{from{opacity:0}to{opacity:1}}@keyframes modal-scrim-out{from{opacity:1}to{opacity:0}}}`;
```

- [ ] **Step 3: Remove the `<style dangerouslySetInnerHTML...>` injection from `RetirementPage.tsx`**

In `apps/web/components/finance/RetirementPage.tsx`, find (around line 609-611):

```tsx
{
}
<style dangerouslySetInnerHTML={{ __html: WAVE_CSS }} />;
```

Delete both lines. The surrounding `<>` fragment and the `<div className="space-y-4 px-4 pb-8">` stay untouched.

- [ ] **Step 4: Type check + lint**

```bash
pnpm --filter @repo/web type-check
pnpm --filter @repo/web lint
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/globals.css apps/web/components/finance/RetirementPage.tsx
git commit -m "fix(security): move WAVE_CSS keyframes to globals.css, remove dangerouslySetInnerHTML"
```

---

## Task 8: Validate localStorage Payloads with Zod (XSS INFO-1)

**Files:**

- Modify: `apps/web/hooks/useExchangeRate.ts`
- Modify: `apps/web/components/finance/RetirementPage.tsx`

- [ ] **Step 1: Update `apps/web/hooks/useExchangeRate.ts`**

Replace the entire file:

```ts
"use client";

import { useState, useEffect } from "react";
import { z } from "zod";

const CACHE_KEY = "usd_twd_rate";
const CACHE_TTL_MS = 86400000; // 24 hours
const DEFAULT_RATE = 32.5;

const CachedRateSchema = z.object({
  rate: z.number().positive(),
  timestamp: z.number().int().nonnegative(),
});

export function useExchangeRate(): {
  rate: number;
  isManual: boolean;
  isLoading: boolean;
  convertToTWD: (usdAmount: number) => number;
  setManualRate: (rate: number) => void;
} {
  const [rate, setRate] = useState<number>(DEFAULT_RATE);
  const [isManual, setIsManual] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadRate() {
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const result = CachedRateSchema.safeParse(JSON.parse(cached));
          if (result.success) {
            const age = Date.now() - result.data.timestamp;
            if (age < CACHE_TTL_MS) {
              setRate(result.data.rate);
              setIsManual(false);
              setIsLoading(false);
              return;
            }
          } else {
            localStorage.removeItem(CACHE_KEY);
          }
        }
      } catch {
        localStorage.removeItem(CACHE_KEY);
      }

      try {
        const res = await fetch("/api/exchange-rate");
        if (!res.ok) throw new Error("Non-OK response");
        const data: { TWD: number } = await res.json();
        const fetched = data.TWD;
        if (!fetched || fetched <= 0) throw new Error("Invalid rate");

        localStorage.setItem(CACHE_KEY, JSON.stringify({ rate: fetched, timestamp: Date.now() }));
        setRate(fetched);
        setIsManual(false);
      } catch {
        setIsManual(true);
        setRate(DEFAULT_RATE);
      } finally {
        setIsLoading(false);
      }
    }

    loadRate();
  }, []);

  function setManualRate(newRate: number) {
    setRate(newRate);
    setIsManual(true);
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ rate: newRate, timestamp: Date.now() }));
    } catch {
      // Ignore storage errors
    }
  }

  function convertToTWD(usdAmount: number): number {
    return usdAmount * rate;
  }

  return { rate, isManual, isLoading, convertToTWD, setManualRate };
}
```

- [ ] **Step 2: Add `StoredParamsSchema` to `RetirementPage.tsx`**

In `apps/web/components/finance/RetirementPage.tsx`, add after the `import` statements and before `const STORAGE_KEY`:

```ts
import { z } from "zod";

const StoredParamsSchema = z
  .object({
    currentAge: z.number().int().positive(),
    retirementAge: z.number().int().positive(),
    monthlyExpense: z.number().nonnegative(),
    inflationRate: z.number().min(0).max(100),
    accRate: z.number().min(0).max(100),
    wdRate: z.number().min(0).max(100),
    swr: z.number().min(0).max(100),
    monthlyContrib: z.number().nonnegative(),
    govPension: z.number().nonnegative(),
  })
  .partial();
```

- [ ] **Step 3: Update the `useEffect` in `RetirementPage.tsx` that reads from localStorage**

Find (around line 339-353):

```ts
useEffect(() => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed: Params = { ...DEFAULTS, ...JSON.parse(saved) };
      setParams(parsed);
      setSensRate(parsed.accRate);
      setSensAge(parsed.retirementAge);
    }
  } catch {
    // ignore invalid stored JSON
  }
  setInitialized(true);
  fetchAll();
}, [fetchAll]);
```

Replace with:

```ts
useEffect(() => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const result = StoredParamsSchema.safeParse(JSON.parse(saved));
      if (result.success) {
        const parsed: Params = { ...DEFAULTS, ...result.data };
        setParams(parsed);
        setSensRate(parsed.accRate);
        setSensAge(parsed.retirementAge);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }
  setInitialized(true);
  fetchAll();
}, [fetchAll]);
```

- [ ] **Step 4: Type check**

```bash
pnpm --filter @repo/web type-check
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/hooks/useExchangeRate.ts apps/web/components/finance/RetirementPage.tsx
git commit -m "fix(security): validate localStorage payloads with Zod before consuming"
```

---

## Task 9: ESLint Security Rules (XSS Recommendation)

**Files:**

- Modify: `packages/eslint-config/react.js`

- [ ] **Step 1: Add security rules to `packages/eslint-config/react.js`**

Replace:

```js
    rules: {
      ...reactHooksPlugin.configs.recommended.rules,
      "react/react-in-jsx-scope": "off",
    },
```

With:

```js
    rules: {
      ...reactHooksPlugin.configs.recommended.rules,
      "react/react-in-jsx-scope": "off",
      "react/no-danger": "error",
      "no-eval": "error",
      "no-implied-eval": "error",
    },
```

- [ ] **Step 2: Run lint across the monorepo**

```bash
pnpm lint
```

Expected: no new lint errors (we already removed `dangerouslySetInnerHTML` in Task 7).

- [ ] **Step 3: Commit**

```bash
git add packages/eslint-config/react.js
git commit -m "fix(security): add react/no-danger, no-eval, no-implied-eval ESLint rules"
```

---

## Verification Checklist

After all tasks complete, verify:

- [ ] `pnpm install && pnpm build` — clean build
- [ ] `pnpm test` — all tests pass
- [ ] `pnpm lint` — no errors
- [ ] `pnpm type-check` — no errors
- [ ] `pnpm audit --audit-level=high` — 0 high advisories (or only unfixed transitive ones)

---

## Out of Scope (Backlog)

These findings from the audits are **not** in this plan because they require infrastructure setup or are low-impact:

- **#4 Per-userId rate limiting** — requires Upstash KV setup; separate task
- **#5 SHA-pin GitHub Actions** — requires `gh action-pin` or Renovate `pinDigests: true`; run `gh action-pin .github/workflows/ci.yml` separately
- **CLAUDE.md doc drift** — remove references to `apps/api/` Express service
- **CSP nonce migration** — replace `'unsafe-inline'` with per-request nonce; multi-day effort
- **Response DTOs (BOPLA)** — add Zod `.pick()` to service layer responses
- **`DELETE /api/me`** — account deletion endpoint
