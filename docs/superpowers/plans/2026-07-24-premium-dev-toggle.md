# Premium Dev Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a developer flip their own account between "premium" and "free" from inside the Expo Go app, exercising the real server-side entitlement path, with zero surface area in production.

**Architecture:** A dev-only Next.js route (`/api/dev/subscription`) upserts/deletes the caller's own `Subscription` row directly — bypassing the real Apple webhook — and 404s unconditionally when `NODE_ENV === "production"`. Two `__DEV__`-only buttons on the mobile Settings screen call it, then invalidate the shared fetch cache so `useIsPremium` (and therefore every premium-gated UI path) picks up the new state immediately.

**Tech Stack:** Next.js 15 Route Handlers, Prisma 6, Clerk (`@clerk/nextjs/server`), Vitest (`apps/web`), Expo Router / React Native (`apps/mobile`).

## Global Constraints

- Route MUST return 404 (not 403, not an empty 200) when `process.env.NODE_ENV === "production"` — this is the only real security boundary; verify it first in the handler, before `auth()`.
- `__DEV__` in the mobile UI is a visibility convenience only, never treated as a security check.
- Reuse `deriveAppleAccountToken` from `@repo/shared` — never derive the Apple account token a second way.
- Reuse `ok` / `err` / `handleError` from `apps/web/lib/api-response.ts` for all responses (per `CLAUDE.md` API response envelope).
- `apps/mobile` has no test runner configured (no vitest/jest config, no test script, no existing test files) — mobile-side steps are verified manually, not with automated tests. `apps/web` steps use the existing Vitest setup (`pnpm --filter @repo/web exec vitest run <file>`).

---

### Task 1: Dev-only subscription toggle API route

**Files:**

- Create: `apps/web/app/api/dev/subscription/route.ts`
- Test: `apps/web/tests/api/dev.subscription.route.test.ts`

**Interfaces:**

- Produces: `POST /api/dev/subscription` accepting `{ action: "activate" | "deactivate" }`, returning the standard `ApiResponse<{ isPremium: boolean }>` envelope. Consumed by Task 3 (mobile Settings screen) via `api.post<{ isPremium: boolean }>("/api/dev/subscription", { action })`.

- [ ] **Step 1: Write the failing tests**

```ts
// apps/web/tests/api/dev.subscription.route.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { SubscriptionStatus } from "@prisma/client";

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { subscription: { upsert: vi.fn(), deleteMany: vi.fn() } },
}));

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { POST } from "../../app/api/dev/subscription/route";

function req(body: unknown) {
  return new NextRequest("http://localhost/api/dev/subscription", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const ORIGINAL_ENV = process.env.NODE_ENV;

describe("POST /api/dev/subscription", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "test");
  });
  afterEach(() => {
    vi.stubEnv("NODE_ENV", ORIGINAL_ENV ?? "test");
  });

  it("404s when NODE_ENV is production, before even checking auth", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const res = await POST(req({ action: "activate" }));
    expect(res.status).toBe(404);
    expect(auth).not.toHaveBeenCalled();
  });

  it("401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as never);
    const res = await POST(req({ action: "activate" }));
    expect(res.status).toBe(401);
  });

  it("400 when action is missing or invalid", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "user_1" } as never);
    const res = await POST(req({ action: "nonsense" }));
    expect(res.status).toBe(400);
  });

  it("activate upserts an active Subscription keyed by the derived apple account token, not the raw userId", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "user_1" } as never);
    vi.mocked(prisma.subscription.upsert).mockResolvedValue({} as never);

    const res = await POST(req({ action: "activate" }));

    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual({ isPremium: true });
    const call = vi.mocked(prisma.subscription.upsert).mock.calls[0]?.[0];
    expect(call?.where.appleAccountToken).toBeDefined();
    expect(call?.where.appleAccountToken).not.toBe("user_1");
    expect(call?.create.status).toBe(SubscriptionStatus.active);
    expect(call?.create.environment).toBe("Sandbox");
    expect(call?.create.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("deactivate deletes the caller's Subscription row and returns isPremium: false", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "user_1" } as never);
    vi.mocked(prisma.subscription.deleteMany).mockResolvedValue({ count: 1 } as never);

    const res = await POST(req({ action: "deactivate" }));

    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual({ isPremium: false });
    const call = vi.mocked(prisma.subscription.deleteMany).mock.calls[0]?.[0];
    expect(call?.where.appleAccountToken).toBeDefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @repo/web exec vitest run tests/api/dev.subscription.route.test.ts`
Expected: FAIL — `Cannot find module '../../app/api/dev/subscription/route'`

- [ ] **Step 3: Write the route**

```ts
// apps/web/app/api/dev/subscription/route.ts
import { auth } from "@clerk/nextjs/server";
import { SubscriptionStatus } from "@prisma/client";
import { deriveAppleAccountToken } from "@repo/shared";
import { prisma } from "@/lib/prisma";
import { ok, err, handleError } from "@/lib/api-response";

const DEV_PRODUCT_ID = "dev_test_premium";
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

// Dev-only escape hatch: lets a developer flip their OWN Subscription row
// without a real Apple purchase, so premium-gated behavior (paywall, the
// 20-entry free cap, insurance restrictions) can be exercised end-to-end from
// Expo Go, where apps/mobile/lib/purchases.ts no-ops (no real IAP possible).
// The NODE_ENV check below is the only thing that matters for safety — it
// must run before anything else, so this route 404s (doesn't exist) once
// deployed to Vercel production, regardless of what any client sends.
export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return err("NOT_FOUND", "Not found", 404);
  }

  try {
    const { userId } = await auth();
    if (!userId) {
      return err("UNAUTHORIZED", "Unauthorized", 401);
    }

    const body = (await req.json().catch(() => null)) as { action?: string } | null;
    if (body?.action !== "activate" && body?.action !== "deactivate") {
      return err("VALIDATION_ERROR", "action must be 'activate' or 'deactivate'", 400);
    }

    const appleAccountToken = deriveAppleAccountToken(userId);

    if (body.action === "activate") {
      await prisma.subscription.upsert({
        where: { appleAccountToken },
        create: {
          appleAccountToken,
          productId: DEV_PRODUCT_ID,
          status: SubscriptionStatus.active,
          expiresAt: new Date(Date.now() + ONE_YEAR_MS),
          originalTransactionId: `dev-${userId}`,
          environment: "Sandbox",
        },
        update: {
          productId: DEV_PRODUCT_ID,
          status: SubscriptionStatus.active,
          expiresAt: new Date(Date.now() + ONE_YEAR_MS),
          environment: "Sandbox",
        },
      });
    } else {
      // deleteMany (not delete) — no-throw if the row never existed, matching
      // this codebase's ownership-scoped delete convention (see CLAUDE.md).
      await prisma.subscription.deleteMany({ where: { appleAccountToken } });
    }

    return ok({ isPremium: body.action === "activate" });
  } catch (e) {
    return handleError(e);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @repo/web exec vitest run tests/api/dev.subscription.route.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/api/dev/subscription/route.ts apps/web/tests/api/dev.subscription.route.test.ts
git commit -m "feat: add dev-only endpoint to simulate premium status"
```

---

### Task 2: Cache invalidation for `useCachedFetch`

**Files:**

- Modify: `apps/mobile/hooks/useCachedFetch.ts`

**Interfaces:**

- Consumes: nothing new (still uses `useApi()` from `apps/mobile/lib/api.ts`, unchanged signature).
- Produces: `invalidateCachedFetch(endpoint: string): void` — drops the cached value for `endpoint` and forces every currently-mounted `useCachedFetch(endpoint)` (and `useIsPremium`, which wraps it) to refetch. Consumed by Task 3.

No test file: `apps/mobile` has no test runner configured (verified — no vitest/jest config, no `test` script, no existing `*.test.ts` files in the package). This step is verified manually in Task 3's end-to-end check, where the invalidate call is exercised through the real UI flow.

- [ ] **Step 1: Read the current file**

Already read — current content is:

```ts
import { useEffect, useState } from "react";
import { useApi } from "@/lib/api";

export interface CachedFetchState<T> {
  data: T | null;
  loading: boolean;
  error: boolean;
}

const caches = new Map<string, unknown>();

export function useCachedFetch<T>(endpoint: string): CachedFetchState<T> {
  const api = useApi();
  const cached = caches.has(endpoint) ? (caches.get(endpoint) as T) : null;
  const [data, setData] = useState<T | null>(cached);
  const [loading, setLoading] = useState(cached === null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    api
      .get<T>(endpoint)
      .then((d) => {
        caches.set(endpoint, d);
        if (active) {
          setData(d);
          setError(false);
        }
      })
      .catch(() => {
        if (active && !caches.has(endpoint)) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [api, endpoint]);

  return { data, loading, error };
}
```

- [ ] **Step 2: Replace it with the version that supports invalidation**

```ts
import { useEffect, useState } from "react";
import { useApi } from "@/lib/api";

export interface CachedFetchState<T> {
  data: T | null;
  /** True only on the very first fetch, when we have no cached value to show. */
  loading: boolean;
  /** True only when there's no cached value to fall back on. */
  error: boolean;
}

// Module-level cache keyed by endpoint, shared across every mount for the
// app's lifetime. First fetch shows a spinner; later mounts of the same
// endpoint show the cached value immediately while a background revalidate
// keeps it fresh — no flash, no refetch-on-every-tab-switch.
const caches = new Map<string, unknown>();
const listeners = new Map<string, Set<() => void>>();

// Drops the cached value for `endpoint` and tells every mounted
// useCachedFetch(endpoint) instance to refetch right away. Used by the
// dev-only premium toggle (apps/mobile/app/(app)/settings.tsx) so flipping
// the simulated subscription shows up without restarting the app.
export function invalidateCachedFetch(endpoint: string): void {
  caches.delete(endpoint);
  listeners.get(endpoint)?.forEach((notify) => notify());
}

export function useCachedFetch<T>(endpoint: string): CachedFetchState<T> {
  const api = useApi();
  const cached = caches.has(endpoint) ? (caches.get(endpoint) as T) : null;
  const [data, setData] = useState<T | null>(cached);
  const [loading, setLoading] = useState(cached === null);
  const [error, setError] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const notify = () => setVersion((v) => v + 1);
    let set = listeners.get(endpoint);
    if (!set) {
      set = new Set();
      listeners.set(endpoint, set);
    }
    set.add(notify);
    return () => {
      set!.delete(notify);
    };
  }, [endpoint]);

  useEffect(() => {
    let active = true;
    if (!caches.has(endpoint)) setLoading(true);
    api
      .get<T>(endpoint)
      .then((d) => {
        caches.set(endpoint, d);
        if (active) {
          setData(d);
          setError(false);
        }
      })
      .catch(() => {
        if (active && !caches.has(endpoint)) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `version` is a
    // deliberate refetch trigger, not a value the effect reads.
  }, [api, endpoint, version]);

  return { data, loading, error };
}
```

- [ ] **Step 3: Type-check**

Run: `pnpm --filter @repo/mobile exec tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/hooks/useCachedFetch.ts
git commit -m "feat: add invalidateCachedFetch for forcing a refetch"
```

---

### Task 3: Dev toggle buttons on the Settings screen

**Files:**

- Modify: `apps/mobile/app/(app)/settings.tsx`

**Interfaces:**

- Consumes: `invalidateCachedFetch(endpoint: string): void` from Task 2 (`@/hooks/useCachedFetch`); `POST /api/dev/subscription` from Task 1, via the existing `api.post<{ isPremium: boolean }>(path, data)` from `useApi()` (`apps/mobile/lib/api.ts`).
- Produces: nothing consumed elsewhere — this is the leaf UI.

- [ ] **Step 1: Add the import and dev-toggle handler**

In `apps/mobile/app/(app)/settings.tsx`, add to the imports:

```tsx
import { invalidateCachedFetch } from "@/hooks/useCachedFetch";
```

Inside `SettingsScreen`, alongside the existing `deleting` state (after the `const [deleting, setDeleting] = useState(false);` line), add:

```tsx
const [devToggling, setDevToggling] = useState(false);

async function simulatePremium(action: "activate" | "deactivate") {
  if (devToggling) return;
  setDevToggling(true);
  try {
    await api.post("/api/dev/subscription", { action });
    invalidateCachedFetch("/api/entitlements");
  } catch (e) {
    const msg = e instanceof ApiError || e instanceof Error ? e.message : "請稍後再試";
    Alert.alert("模擬失敗", msg);
  } finally {
    setDevToggling(false);
  }
}
```

- [ ] **Step 2: Add the `__DEV__`-only section to the JSX**

In the `s.stack` view, immediately after the existing premium `SettingCard` (the one with `label={premiumLoading ? "讀取中…" : ...}`) and before the "登出" `SettingCard`, add:

```tsx
{
  __DEV__ ? (
    <>
      <SettingCard
        icon={Check}
        label="模擬升級（僅開發模式）"
        color="#34C759"
        textColor="#ffffff"
        loading={devToggling}
        disabled={devToggling}
        onPress={() => simulatePremium("activate")}
      />
      <SettingCard
        icon={Trash2}
        label="模擬取消（僅開發模式）"
        color="#FF9500"
        textColor="#ffffff"
        loading={devToggling}
        disabled={devToggling}
        onPress={() => simulatePremium("deactivate")}
      />
    </>
  ) : null;
}
```

`Check` and `Trash2` are already imported from `lucide-react-native` at the top of the file — no new icon imports needed.

- [ ] **Step 3: Type-check**

Run: `pnpm --filter @repo/mobile exec tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Manual end-to-end verification in Expo Go**

Prerequisites: `apps/web` dev server running locally (`pnpm dev`) with `NODE_ENV` NOT set to `production` (the default for `next dev`), and `apps/mobile`'s `.env` `EXPO_PUBLIC_API_URL` pointing at it (per `apps/mobile/.env.example`).

1. Launch the mobile app in Expo Go, sign in, go to Settings (`/settings`).
2. Confirm the two new cards ("模擬升級（僅開發模式）" / "模擬取消（僅開發模式）") are visible below "升級 Premium" — this only happens in dev, so seeing them at all is the `__DEV__` gate working.
3. Tap "模擬升級（僅開發模式）". Confirm the "升級 Premium" card immediately flips to "已升級 Premium" with a checkmark (proves `invalidateCachedFetch` correctly forced `useIsPremium` to refetch).
4. Go create entries until you have 21 total (or however many you're short of 20). Confirm the 21st entry is accepted (proves the toggle reached the real `EntitlementsService.isPremium` path used by `apps/web/services/entries.service.ts`'s `FREE_ENTRY_LIMIT` check, not just a client-side flag).
5. Tap "模擬取消（僅開發模式）". Confirm the card flips back to "升級 Premium".
6. Attempt to add one more entry while already at/over 20. Confirm it's now blocked with the free-tier limit error (proves the cap re-engages).

The production 404 guard itself is already covered by Task 1's automated test (`NODE_ENV === "production"` case) — no separate manual check against a production build is needed here.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/app/\(app\)/settings.tsx
git commit -m "feat: add dev-only premium simulation toggle to settings"
```

---

## Plan Self-Review Notes

- **Spec coverage:** Backend route + NODE_ENV guard → Task 1. Mobile `__DEV__` buttons → Task 3. Cache invalidation (needed for the buttons to have visible effect, not explicitly named in the spec but required by its "手機端 invalidate `useIsPremium` 的 query" line) → Task 2. Manual E2E testing steps from the spec's "測試方式" section → Task 3 Step 4.
- **Type consistency:** `action: "activate" | "deactivate"` string literal used identically in the route (Task 1), the mobile handler (Task 3), and the tests. `invalidateCachedFetch(endpoint: string): void` signature (Task 2) matches its one call site (Task 3). `{ isPremium: boolean }` response shape matches what `useIsPremium` already expects from `/api/entitlements` (unchanged) and what Task 1's route returns.
- **No placeholders:** every step has complete, runnable code — confirmed by re-reading each step above.
