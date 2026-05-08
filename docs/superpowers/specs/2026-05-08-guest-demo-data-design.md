# Guest Demo Data Design

**Date:** 2026-05-08  
**Status:** Approved

## Overview

Add per-user data isolation via Clerk `userId` on all data models. Unauthenticated guests see static demo data loaded from a JSON file; authenticated users see and manage their own database records.

## Goals

- Only logged-in users can read/write their own data
- Guests browse with demo data (no DB access)
- Guest mutations apply optimistically in UI state only — they vanish on refresh
- Zero changes to page/component files

## Non-Goals

- No demo banner or explicit "demo mode" UI indicator
- No server-side demo data serving (demo JSON loads client-side only)
- No guest-specific routes or duplicate pages

## Architecture

### Data Flow

```
Guest  → useFinanceStore.fetchAll(false) → import demo.json → UI state
Signed → useFinanceStore.fetchAll(true)  → /api/* (userId filtered) → UI state

Guest mutation  → update UI state only (fake id, no API call)
Signed mutation → API call + refetch
```

### 1. Prisma Schema Changes

Add `userId String` to three top-level models. `Loan`, `Insurance`, and `EntryHistory` are accessed only through their parent `Entry`, so they do not need a direct `userId`.

```prisma
model Entry {
  userId  String
  // ... existing fields unchanged
  @@index([userId])
}

model Transaction {
  userId  String
  // ... existing fields unchanged
  @@index([userId])
}

model PortfolioItem {
  userId  String
  // ... existing fields unchanged
  @@index([userId])
}
```

### 2. Migration Strategy

Three-step migration to safely add the non-nullable column:

1. Add `userId String?` (nullable) — existing rows allowed
2. Run SQL: `UPDATE "Entry" SET "userId" = 'user_3DQekdndCosGqQz3CsR9q5mMvcm' WHERE "userId" IS NULL` (same for Transaction, PortfolioItem)
3. Change to `userId String` (non-nullable) — all rows now have a value

Demo JSON export runs before migration so it captures the current data in its clean state.

**Owner userId for existing data:** `user_3DQekdndCosGqQz3CsR9q5mMvcm`

### 3. API Routes

Every route that reads or writes user-owned data adds Clerk `auth()` and filters by `userId`.

**Affected routes:**

- `GET/POST /api/entries`
- `GET/PUT/DELETE /api/entries/[id]`
- `GET/POST/PUT/DELETE /api/entries/[id]/history`
- `GET/POST /api/transactions`
- `GET/DELETE /api/transactions/[id]`
- `GET/POST /api/portfolio`
- `GET/DELETE /api/portfolio/[id]`
- `GET/POST /api/loans`
- `GET/PUT/DELETE /api/loans/[id]`
- `POST /api/loans/[id]/rate`
- `POST /api/loans/[id]/sync`

**Pattern for Entry / Transaction / PortfolioItem:**

```typescript
import { auth } from "@clerk/nextjs/server";

const { userId } = await auth();
if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

// GET
const records = await prisma.entry.findMany({ where: { userId } });

// POST
const record = await prisma.entry.create({ data: { ...body, userId } });

// PUT/DELETE — include userId in where to prevent cross-user access
await prisma.entry.update({ where: { id, userId }, data: body });
await prisma.entry.delete({ where: { id, userId } });
```

**Pattern for Loan / Insurance (no direct userId — filter via Entry relation):**

```typescript
// GET all loans for user
const loans = await prisma.loan.findMany({
  where: { entry: { userId } },
});

// DELETE — verify ownership through entry
const loan = await prisma.loan.findFirst({
  where: { id, entry: { userId } },
});
if (!loan) return Response.json({ error: "Not found" }, { status: 404 });
await prisma.loan.delete({ where: { id } });
```

Market data routes (`/api/stocks/*`, `/api/quotes/*`, `/api/exchange-rate`, `/api/cathaylife-rates`) are public and do not change.

### 4. Zustand Store (`useFinanceStore`)

Add `isGuest: boolean` to store state. `fetchAll` accepts `isSignedIn` and branches:

```typescript
async fetchAll(isSignedIn: boolean) {
  if (!isSignedIn) {
    const demo = await import("@/data/demo.json");
    set({
      entries: demo.entries,
      transactions: demo.transactions,
      portfolio: demo.portfolio,
      isGuest: true,
    });
    return;
  }
  set({ isGuest: false });
  // existing parallel fetch logic unchanged
}
```

All mutation functions (`addEntry`, `updateEntry`, `deleteEntry`, `addTransaction`, `updateTransaction`, `deleteTransaction`, `addPortfolioItem`, `deletePortfolioItem`) check `isGuest`:

```typescript
async addEntry(data) {
  if (get().isGuest) {
    const fakeEntry = { ...data, id: `demo-${Date.now()}` };
    set(state => ({ entries: [...state.entries, fakeEntry] }));
    return;
  }
  // existing API call logic unchanged
}
```

Finance layout calls `fetchAll(isSignedIn)` using `useAuth()` from `@clerk/nextjs`.

### 5. Demo JSON

**Location:** `apps/web/data/demo.json`

**Shape:**

```json
{
  "entries": [],
  "transactions": [],
  "portfolio": [],
  "loans": [],
  "insurance": []
}
```

Populated by a one-time export script that reads the current DB and writes clean JSON (stripping internal Prisma fields like `createdAt` where not needed by the UI). The export script is deleted after use.

## Implementation Order

1. Export current DB data → `demo.json`
2. Prisma schema: add nullable `userId` fields + `pnpm db:migrate`
3. SQL backfill: set `userId` on all existing rows
4. Prisma schema: make `userId` non-nullable + `pnpm db:migrate`
5. Update all affected API routes
6. Update `useFinanceStore`: add `isGuest`, update `fetchAll` + all mutations
7. Finance layout: pass `isSignedIn` to `fetchAll`
8. Test: guest flow (demo data loads, mutations are UI-only) + signed-in flow (CRUD works, data isolated)

## Testing Criteria

- Guest: navigating to `/assets` shows demo data without API calls
- Guest: adding/editing/deleting an entry updates the UI but resets on refresh
- Guest: no 401 errors in console (API is never called)
- Signed-in: only own records are returned from all API routes
- Signed-in: creating a record sets `userId` automatically
- Signed-in: cannot read/update/delete another user's records (PUT/DELETE return 404)
