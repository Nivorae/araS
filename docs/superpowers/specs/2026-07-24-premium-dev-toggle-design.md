# Premium Dev Toggle — Design

## Problem

The premium entitlement system is server-authoritative and fail-closed: `EntitlementsService.isPremium(userId)` reads a `Subscription` row that is only ever written by Apple's server-to-server webhook (`apps/web/app/api/webhooks/app-store-notifications/route.ts`). `apps/mobile/lib/purchases.ts` no-ops inside Expo Go (`Constants.executionEnvironment === "storeClient"`), so a real IAP purchase cannot be completed there. This blocks end-to-end testing of premium-gated behavior (paywall, 20-entry free cap, insurance restrictions) during Expo Go development.

## Goal

Let a developer flip their own account between "premium" and "free" from within the Expo Go app, exercising the real server-side entitlement path (not a client-side fake), while guaranteeing this capability cannot be reached in production.

## Design

### Backend: `apps/web/app/api/dev/subscription/route.ts`

- `POST { action: "activate" | "deactivate" }`
- First line: `if (process.env.NODE_ENV === "production") return 404`. This makes the route effectively not exist once deployed to Vercel production — the only guard that matters, since it's server-enforced and can't be bypassed by a modified client.
- Otherwise: `auth()` via Clerk as usual; operates only on the caller's own `Subscription` row, keyed by `deriveAppleAccountToken(userId)` (same derivation used by the real webhook).
- `activate`: upsert with `productId: "dev_test_premium"`, `status: "active"`, `expiresAt: now + 1 year`, `environment: "Sandbox"`, `originalTransactionId: "dev-" + userId`.
- `deactivate`: delete the row.
- Response uses the standard `ok`/`err` envelope.

### Mobile: `apps/mobile/app/(app)/settings.tsx`

- New section gated by `if (__DEV__)`, placed near the existing "升級 Premium" card.
- Two buttons: "模擬升級" and "模擬取消", each calling the endpoint above via the existing API client, then invalidating the `useIsPremium` query so the UI reflects the new state immediately.
- `__DEV__` controls visibility only (a convenience so the buttons don't ship in a production build); it is not the security boundary — the backend `NODE_ENV` check is.

### Data flow

Button press → `POST /api/dev/subscription` → Clerk `auth()` → write/delete `Subscription` row → mobile invalidates `useIsPremium` → same query path production purchases use (`GET /api/entitlements` → `EntitlementsService.isPremium`) now returns the toggled state → all real enforcement (20-entry cap in `entries.service.ts`, insurance restrictions) reacts accordingly.

### Error handling

- Production: route 404s: mobile shows a generic failure alert (should never actually be reachable since the button itself is `__DEV__`-gated).
- Unauthenticated: existing 401 pattern via `auth()`, same as every other route.
- Follows existing `ok`/`err`/`handleError` conventions — no new error-handling pattern introduced.

### Testing

Manual, since this is a dev-only tool:

1. Press "模擬升級" → confirm paywall-gated UI unlocks and adding a 21st entry succeeds.
2. Press "模擬取消" → confirm the cap is enforced again (21st entry blocked) and paywall reappears where expected.
3. Confirm the route 404s when `NODE_ENV=production` is set locally (sanity check on the guard).

## Out of scope

- Any change to the real Apple IAP / RevenueCat flow.
- A general-purpose feature-flag system — this is a single-purpose dev toggle for one entitlement.
- Automated tests — this endpoint only exists in non-production and is not part of the product's tested surface.
