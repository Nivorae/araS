# Premium Entitlement + 20-Entry Limit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the paid tier actually enforce — free users are blocked from creating a 21st asset entry, premium users are unlimited, and the entitlement check reads real subscription state.

**Architecture:** `EntitlementsService.isPremium()` (the single existing entitlement choke point) is switched from a hardcoded `true` to a real `Subscription` lookup keyed by `deriveAppleAccountToken(userId)`. `EntriesService.create()` gains a server-side guard that counts the user's entries and throws `EntryLimitError` when a non-premium user is at the limit. The `POST /api/entries` route maps that error to a typed `403 ENTRY_LIMIT_REACHED` envelope. The mobile app flips its optimistic `useIsPremium` default to `false` and, on catching `ENTRY_LIMIT_REACHED`, shows the approved upgrade prompt and routes to the existing paywall. Web surfaces the friendly message inline (no purchase path on web).

**Tech Stack:** Next.js 15 Route Handlers, Prisma 6, Clerk, Vitest (service tests mock `@/lib/prisma`), Expo React Native, expo-router.

## Global Constraints

- `FREE_ENTRY_LIMIT = 20` — free users may hold at most 20 entries; the guard blocks creating the 21st. Copy verbatim.
- **Block on CREATE only.** Existing data is never touched — no read-only downgrade, edits/reads of existing entries always allowed. (Spec 決策三)
- **Server-side enforcement is authoritative.** Client-side premium/count checks are advisory (early UI hints) only, never the sole defence. (Spec 第一階段 1)
- **Premium definition:** a `Subscription` row for `deriveAppleAccountToken(userId)` whose `status` is `active` or `grace_period` AND whose `expiresAt` is in the future. Anything else (`expired`, `revoked`, no row) = free.
- **Error contract:** code `ENTRY_LIMIT_REACHED`, HTTP `403`.
- **Approved upgrade-prompt copy (exact, do not reword):**
  - 標題：`你的資產版圖越來越豐富了`
  - 內文：`身為重度用戶，你值得更大的空間。免費版可記 20 筆，升級 Premium 解鎖無上限，輕鬆管理。`
  - 主按鈕：`解鎖無上限`
  - 次按鈕：`稍後再決定`
- **iOS-only purchase.** Web shows the message but offers no purchase flow. (Spec 訂閱設定需求)
- **Release gating:** this code ships only in the single native release (≥ 2026-08-01) where the subscription is simultaneously purchasable. Flipping `useIsPremium`/`isPremium` to real values is correct for that release; it does not affect production until the native app ships. (Memory: [[project_premium_tier]])
- Conventional Commits, lowercase subject, no scope. Run `pnpm --filter @repo/web exec vitest run <file>` for a single test file.

---

### Task 1: EntitlementsService reads real Subscription state

**Files:**

- Modify: `apps/web/services/entitlements.service.ts`
- Test: `apps/web/tests/services/entitlements.service.test.ts` (create)

**Interfaces:**

- Consumes: `deriveAppleAccountToken(userId: string): string` from `@repo/shared`; `SubscriptionStatus` enum + `prisma.subscription.findUnique` from Prisma.
- Produces: `entitlementsService.isPremium(userId: string): Promise<boolean>` — now returns real state.

- [ ] **Step 1: Write the failing test**

Create `apps/web/tests/services/entitlements.service.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SubscriptionStatus } from "@prisma/client";

vi.mock("@/lib/prisma", () => ({
  prisma: { subscription: { findUnique: vi.fn() } },
}));

import { prisma } from "@/lib/prisma";
import { entitlementsService } from "../../services/entitlements.service";

const USER_ID = "user_test123";
const FUTURE = new Date(Date.now() + 1000 * 60 * 60 * 24);
const PAST = new Date(Date.now() - 1000 * 60 * 60 * 24);

describe("EntitlementsService.isPremium", () => {
  beforeEach(() => vi.clearAllMocks());

  it("looks up the subscription by the derived apple account token, not the raw userId", async () => {
    vi.mocked(prisma.subscription.findUnique).mockResolvedValue(null);
    await entitlementsService.isPremium(USER_ID);
    const arg = vi.mocked(prisma.subscription.findUnique).mock.calls[0]?.[0];
    expect(arg?.where.appleAccountToken).toBeDefined();
    expect(arg?.where.appleAccountToken).not.toBe(USER_ID);
  });

  it("returns false when there is no subscription", async () => {
    vi.mocked(prisma.subscription.findUnique).mockResolvedValue(null);
    expect(await entitlementsService.isPremium(USER_ID)).toBe(false);
  });

  it("returns true for an active, unexpired subscription", async () => {
    vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
      status: SubscriptionStatus.active,
      expiresAt: FUTURE,
    } as never);
    expect(await entitlementsService.isPremium(USER_ID)).toBe(true);
  });

  it("returns true during grace_period when still unexpired", async () => {
    vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
      status: SubscriptionStatus.grace_period,
      expiresAt: FUTURE,
    } as never);
    expect(await entitlementsService.isPremium(USER_ID)).toBe(true);
  });

  it("returns false for an active subscription that has expired", async () => {
    vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
      status: SubscriptionStatus.active,
      expiresAt: PAST,
    } as never);
    expect(await entitlementsService.isPremium(USER_ID)).toBe(false);
  });

  it("returns false for a revoked subscription even if unexpired", async () => {
    vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
      status: SubscriptionStatus.revoked,
      expiresAt: FUTURE,
    } as never);
    expect(await entitlementsService.isPremium(USER_ID)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @repo/web exec vitest run tests/services/entitlements.service.test.ts`
Expected: FAIL — current `isPremium` ignores prisma and returns `true`, so the "no subscription" and "expired" cases fail.

- [ ] **Step 3: Write minimal implementation**

Replace the entire body of `apps/web/services/entitlements.service.ts`:

```ts
import { SubscriptionStatus } from "@prisma/client";
import { deriveAppleAccountToken } from "@repo/shared";
import { prisma } from "@/lib/prisma";

// Single choke point for premium-feature checks. Reads the Subscription row
// written by the App Store Server Notifications webhook (Apple is the source
// of truth). Keyed by deriveAppleAccountToken(userId), NOT the raw Clerk
// userId — the webhook stores the derived UUID (see appleAccountToken.ts).
export class EntitlementsService {
  async isPremium(userId: string): Promise<boolean> {
    const appleAccountToken = deriveAppleAccountToken(userId);
    const sub = await prisma.subscription.findUnique({ where: { appleAccountToken } });
    if (!sub) return false;
    const entitledStatus =
      sub.status === SubscriptionStatus.active || sub.status === SubscriptionStatus.grace_period;
    return entitledStatus && sub.expiresAt.getTime() > Date.now();
  }
}

export const entitlementsService = new EntitlementsService();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @repo/web exec vitest run tests/services/entitlements.service.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/services/entitlements.service.ts apps/web/tests/services/entitlements.service.test.ts
git commit -m "feat: read real subscription state in entitlements check"
```

---

### Task 2: FREE_ENTRY_LIMIT constant + create-entry limit guard

**Files:**

- Create: `packages/shared/src/constants/limits.ts`
- Modify: `packages/shared/src/index.ts:3` (add export)
- Modify: `apps/web/services/entries.service.ts` (imports at top; `create()` at `apps/web/services/entries.service.ts:85`)
- Test: `apps/web/tests/services/entries.service.test.ts` (extend existing)

**Interfaces:**

- Consumes: `entitlementsService.isPremium` (Task 1); `FREE_ENTRY_LIMIT` (this task); `prisma.entry.count`.
- Produces: `FREE_ENTRY_LIMIT` (number) and `EntryLimitError` (class) exported for the route (Task 3); `EntriesService.create` now throws `EntryLimitError` for a non-premium user already holding `FREE_ENTRY_LIMIT` entries.

- [ ] **Step 1: Create the shared constant**

Create `packages/shared/src/constants/limits.ts`:

```ts
// Free-plan asset-entry cap. A non-premium user may hold at most this many
// Entry rows; creating the next one is blocked (existing rows untouched).
// Set to 20 per the premium-tier spec (2026-07-20): only 1 existing user is
// above this, and 15 would have caught 4 core users.
export const FREE_ENTRY_LIMIT = 20;
```

Add to `packages/shared/src/index.ts` (after line 3):

```ts
export * from "./constants/limits";
```

- [ ] **Step 2: Write the failing test**

Add to `apps/web/tests/services/entries.service.test.ts`. First extend the existing `vi.mock("@/lib/prisma", ...)` block so `entry` includes `count: vi.fn()`, then add — after the existing imports (around line 30) — a mock of the entitlements service and the new describe block:

```ts
vi.mock("@/services/entitlements.service", () => ({
  entitlementsService: { isPremium: vi.fn() },
}));

import { entitlementsService } from "../../services/entitlements.service";
import { EntryLimitError } from "../../services/entries.service";
import { FREE_ENTRY_LIMIT } from "@repo/shared";

const VALID_ENTRY = {
  name: "台積電",
  topCategory: "流動資金",
  subCategory: "現金",
  value: 1000,
};

describe("EntriesService.create limit guard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("throws EntryLimitError when a non-premium user is at the limit", async () => {
    vi.mocked(entitlementsService.isPremium).mockResolvedValue(false);
    vi.mocked(prisma.entry.count).mockResolvedValue(FREE_ENTRY_LIMIT);
    await expect(entriesService.create(VALID_ENTRY, USER_ID)).rejects.toBeInstanceOf(
      EntryLimitError
    );
    expect(prisma.entry.create).not.toHaveBeenCalled();
  });

  it("allows a non-premium user below the limit", async () => {
    vi.mocked(entitlementsService.isPremium).mockResolvedValue(false);
    vi.mocked(prisma.entry.count).mockResolvedValue(FREE_ENTRY_LIMIT - 1);
    vi.mocked(prisma.entry.create).mockResolvedValue({ id: "e1", value: 1000 } as never);
    vi.mocked(prisma.entryHistory.create).mockResolvedValue({} as never);
    await entriesService.create(VALID_ENTRY, USER_ID);
    expect(prisma.entry.create).toHaveBeenCalled();
  });

  it("allows a premium user regardless of count (never even counts)", async () => {
    vi.mocked(entitlementsService.isPremium).mockResolvedValue(true);
    vi.mocked(prisma.entry.create).mockResolvedValue({ id: "e1", value: 1000 } as never);
    vi.mocked(prisma.entryHistory.create).mockResolvedValue({} as never);
    await entriesService.create(VALID_ENTRY, USER_ID);
    expect(prisma.entry.count).not.toHaveBeenCalled();
    expect(prisma.entry.create).toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @repo/web exec vitest run tests/services/entries.service.test.ts`
Expected: FAIL — `EntryLimitError` is not exported yet and `create` does no gating.

- [ ] **Step 4: Write minimal implementation**

In `apps/web/services/entries.service.ts`, add to the imports at the top:

```ts
import { entitlementsService } from "@/services/entitlements.service";
import { FREE_ENTRY_LIMIT } from "@repo/shared";
```

Add the error class just above `export class EntriesService {`:

```ts
// Thrown by create() when a non-premium user is already at FREE_ENTRY_LIMIT.
// The route layer maps this to a 403 ENTRY_LIMIT_REACHED envelope.
export class EntryLimitError extends Error {
  constructor() {
    super("Free plan entry limit reached");
    this.name = "EntryLimitError";
  }
}
```

At the very start of `create()` (before destructuring `data`), add the guard:

```ts
async create(data: CreateEntry, userId: string) {
  // Server-side enforcement is the authoritative defence (client hints are
  // advisory). Premium users skip the count entirely.
  const premium = await entitlementsService.isPremium(userId);
  if (!premium) {
    const count = await prisma.entry.count({ where: { userId } });
    if (count >= FREE_ENTRY_LIMIT) throw new EntryLimitError();
  }

  const { units, stockCode, bankCode, createdAt, note, includeInChart, ...rest } = data;
  // ...unchanged below
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @repo/web exec vitest run tests/services/entries.service.test.ts`
Expected: PASS (existing tests + 3 new).

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/constants/limits.ts packages/shared/src/index.ts apps/web/services/entries.service.ts apps/web/tests/services/entries.service.test.ts
git commit -m "feat: block non-premium users at the free entry limit"
```

---

### Task 3: POST /api/entries maps EntryLimitError to 403

**Files:**

- Modify: `apps/web/app/api/entries/route.ts:32` (the `POST` catch)
- Test: `apps/web/tests/api/entries.route.test.ts` (create)

**Interfaces:**

- Consumes: `EntryLimitError` from `@/services/entries.service` (Task 2).
- Produces: HTTP `403` with body `{ success: false, error: { code: "ENTRY_LIMIT_REACHED", message: "已達免費方案的資產筆數上限" } }` when the limit is hit.

- [ ] **Step 1: Write the failing test**

Create `apps/web/tests/api/entries.route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));
vi.mock("@/lib/security-log", () => ({ logSecurityEvent: vi.fn() }));
vi.mock("@/services/entries.service", () => {
  class EntryLimitError extends Error {}
  return { entriesService: { create: vi.fn() }, EntryLimitError };
});

import { auth } from "@clerk/nextjs/server";
import { entriesService, EntryLimitError } from "@/services/entries.service";
import { POST } from "../../app/api/entries/route";

function postReq(body: unknown) {
  return new NextRequest("http://localhost/api/entries", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const VALID_BODY = {
  name: "台積電",
  topCategory: "流動資金",
  subCategory: "現金",
  value: 1000,
};

describe("POST /api/entries entry-limit handling", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 403 ENTRY_LIMIT_REACHED when the service throws EntryLimitError", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "user_1" } as never);
    vi.mocked(entriesService.create).mockRejectedValue(new EntryLimitError());
    const res = await POST(postReq(VALID_BODY));
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("ENTRY_LIMIT_REACHED");
  });

  it("returns 201 on a normal create", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "user_1" } as never);
    vi.mocked(entriesService.create).mockResolvedValue({ id: "e1", value: 1000 } as never);
    const res = await POST(postReq(VALID_BODY));
    expect(res.status).toBe(201);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @repo/web exec vitest run tests/api/entries.route.test.ts`
Expected: FAIL — the route currently routes `EntryLimitError` through `handleError`, producing a `500 INTERNAL_ERROR`, not `403 ENTRY_LIMIT_REACHED`.

- [ ] **Step 3: Write minimal implementation**

In `apps/web/app/api/entries/route.ts`, update the import on line 4 and the `POST` catch. New import line:

```ts
import { entriesService, EntryLimitError } from "@/services/entries.service";
```

Replace the `POST` catch block:

```ts
  } catch (e) {
    if (e instanceof EntryLimitError) {
      return err("ENTRY_LIMIT_REACHED", "已達免費方案的資產筆數上限", 403);
    }
    return handleError(e);
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @repo/web exec vitest run tests/api/entries.route.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/api/entries/route.ts apps/web/tests/api/entries.route.test.ts
git commit -m "feat: return 403 entry-limit error from entries route"
```

---

### Task 4: Mobile useIsPremium defaults to non-premium

**Files:**

- Modify: `apps/mobile/hooks/useIsPremium.ts`

**Interfaces:**

- Consumes: `GET /api/entitlements` → `{ isPremium: boolean }`.
- Produces: `useIsPremium(): boolean` — now defaults to `false` and, on fetch failure, resolves to `false` (fail-closed, matching server enforcement).

- [ ] **Step 1: Update the default and failure fallback**

In `apps/mobile/hooks/useIsPremium.ts`, change the initial state and the catch fallback from `true` to `false`, and update the stale comment:

```ts
import { useEffect, useState } from "react";
import { useApi } from "@/lib/api";

// Source of truth is the backend (EntitlementsService), not RevenueCat's
// client-side CustomerInfo — the client can't self-report premium status.
// Defaults to false and fails closed: an unverified client is treated as free,
// matching the authoritative server-side enforcement.
export function useIsPremium(): boolean {
  const api = useApi();
  const [isPremium, setIsPremium] = useState(false);

  useEffect(() => {
    api
      .get<{ isPremium: boolean }>("/api/entitlements")
      .then((data) => setIsPremium(data.isPremium))
      .catch(() => setIsPremium(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return isPremium;
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `pnpm --filter @repo/mobile exec tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/hooks/useIsPremium.ts
git commit -m "feat: default mobile premium check to fail-closed"
```

---

### Task 5: Mobile shows upgrade prompt and routes to paywall on limit

**Files:**

- Modify: `apps/mobile/components/EntryForm.tsx:400` (the `handleSubmit` catch)

**Interfaces:**

- Consumes: `ApiError` (from `@/lib/api`) — thrown by the api client with `.code` set to `ENTRY_LIMIT_REACHED` on a 403; `useRouter` from `expo-router`; `Alert` from `react-native`.
- Produces: on `ENTRY_LIMIT_REACHED`, an `Alert` with the approved copy whose primary button navigates to `/paywall`; other errors keep the existing inline behaviour.

- [ ] **Step 1: Confirm the api client exposes the error code**

`apps/mobile/lib/api.ts` already throws `new ApiError(body.error.code, body.error.message, res.status)` for non-success envelopes, so a 403 surfaces as `ApiError` with `code === "ENTRY_LIMIT_REACHED"`. Verify `ApiError` and `useRouter` are importable in `EntryForm.tsx`; add imports if missing:

```ts
import { Alert } from "react-native";
import { useRouter } from "expo-router";
import { ApiError } from "@/lib/api";
```

If the component does not already hold a router, add near the top of the component body:

```ts
const router = useRouter();
```

- [ ] **Step 2: Update the handleSubmit catch**

Replace the `catch (e)` block in `handleSubmit` (`apps/mobile/components/EntryForm.tsx:400`):

```ts
    } catch (e) {
      if (e instanceof ApiError && e.code === "ENTRY_LIMIT_REACHED") {
        Alert.alert(
          "你的資產版圖越來越豐富了",
          "身為重度用戶，你值得更大的空間。免費版可記 20 筆，升級 Premium 解鎖無上限，輕鬆管理。",
          [
            { text: "稍後再決定", style: "cancel" },
            { text: "解鎖無上限", onPress: () => router.push("/paywall") },
          ]
        );
        return;
      }
      setError(e instanceof Error ? e.message : "儲存失敗，請重試");
    } finally {
      setSubmitting(false);
    }
```

- [ ] **Step 3: Verify it type-checks**

Run: `pnpm --filter @repo/mobile exec tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Manual smoke test (device/simulator)**

With a non-premium test account already holding 20 entries, add another. Expected: the Alert appears with the exact title/body; "解鎖無上限" opens the paywall; "稍後再決定" dismisses. (Requires the dev API reachable per project LAN setup.)

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/components/EntryForm.tsx
git commit -m "feat: prompt upgrade and open paywall when entry limit hit"
```

---

### Task 6: Web surfaces the limit message instead of failing silently

**Files:**

- Modify: `apps/web/components/finance/AccountFormPage.tsx:460-465` (the `handleSubmit` try/finally)

**Interfaces:**

- Consumes: the store's `addEntry`, which calls `apiFetch` — that throws `new Error(json.error.message)` (see `apps/web/store/useFinanceStore.ts:33`), i.e. the friendly Chinese message `已達免費方案的資產筆數上限` on a 403.
- Produces: on failure, the message is shown to the user (web has no purchase path, so it points them to the app); success path unchanged.

- [ ] **Step 1: Add a catch that surfaces the message**

In `apps/web/components/finance/AccountFormPage.tsx`, the `handleSubmit` currently has `try { ... } finally { setSubmitting(false); }` with no `catch`, so a thrown limit error silently prevents `onSaved()`. Add a `catch` before `finally`:

```ts
      onSaved();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "儲存失敗，請重試";
      // Web has no in-app purchase path (iOS-only IAP); point users to the app.
      window.alert(
        msg.includes("上限")
          ? `${msg}。請於 araS App 內升級 Premium 解鎖無上限。`
          : msg
      );
    } finally {
      setSubmitting(false);
    }
```

- [ ] **Step 2: Verify it type-checks**

Run: `pnpm --filter @repo/web exec tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/finance/AccountFormPage.tsx
git commit -m "feat: surface entry-limit message on web add form"
```

---

## Self-Review

**Spec coverage (premium spec 第一階段 1 — 資產筆數上限):**

- Entitlement reads real `Subscription` by derived token, active/grace + unexpired → Task 1. ✅
- `entries.service` create path blocks non-premium at 20, existing data untouched → Task 2. ✅
- Typed error code to the client → Task 3 (`ENTRY_LIMIT_REACHED` / 403). ✅
- Server-side is the authoritative check → Tasks 2/3; client is advisory → Tasks 4/5. ✅
- Approved paywall copy used verbatim → Task 5. ✅
- iOS-only purchase; web message only → Task 6. ✅
- 資產配置分析 (premium spec 第一階段 2) is **out of scope for this plan** — it is Plan B (separate). Insurance is Plan C. Noted intentionally.

**Placeholder scan:** No TBD/TODO; every code step shows full code; every test step shows assertions. ✅

**Type consistency:** `EntryLimitError` defined in `entries.service.ts` (Task 2), imported by the route (Task 3) and mocked identically in tests. `FREE_ENTRY_LIMIT` defined in `@repo/shared` (Task 2), consumed by service + test. `isPremium(userId): Promise<boolean>` signature consistent across Tasks 1–2. Error code string `ENTRY_LIMIT_REACHED` identical in Tasks 3 and 5. ✅

**Ordering note:** Task 2 depends on Task 1 (service calls `entitlementsService.isPremium`). Task 3 depends on Task 2 (`EntryLimitError`). Tasks 4–6 depend on the 403 contract from Task 3. Execute in order.
