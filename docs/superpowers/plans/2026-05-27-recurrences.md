# Recurrences (定期項目) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to attach recurring auto-generated transactions to any account (Entry), triggered on app open.

**Architecture:** New `Recurrence` Prisma model linked to `Entry`; a service + API routes handle CRUD and batch processing; `useFinanceStore` runs `process` on every signed-in `fetchAll`; `RecurrenceFormPage` slides in from `AccountFormPage`.

**Tech Stack:** Next.js 15 App Router, Prisma 6 + PostgreSQL, Zod, Zustand, Tailwind CSS 4, Clerk auth

---

### Task 1: Prisma Schema — Add Recurrence model

**Files:**

- Modify: `apps/web/prisma/schema.prisma`

- [ ] **Step 1: Add enum + model to schema**

In `apps/web/prisma/schema.prisma`, add after the `RepaymentType` enum and add `recurrences` to the `Entry` model:

```prisma
// Add after existing RepaymentType enum
enum RecurrenceFreq {
  MONTHLY
  WEEKLY
  BIWEEKLY
  YEARLY
}

model Recurrence {
  id          String         @id @default(cuid())
  userId      String
  entryId     String
  entry       Entry          @relation(fields: [entryId], references: [id], onDelete: Cascade)
  type        String
  amount      Decimal
  category    String
  source      String         @default("daily")
  note        String?
  frequency   RecurrenceFreq
  dayOfMonth  Int?
  dayOfWeek   Int?
  monthOfYear Int?
  startDate   DateTime
  nextRunAt   DateTime
  lastRunAt   DateTime?
  active      Boolean        @default(true)
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt

  @@index([userId, nextRunAt])
  @@index([entryId])
}
```

Also add `recurrences Recurrence[]` inside the `Entry` model block.

- [ ] **Step 2: Create migration and regenerate client**

```bash
cd apps/web && pnpm db:migrate
# When prompted for migration name, enter: add_recurrence_model
pnpm db:generate
```

Expected: migration SQL file created, Prisma client regenerated with `Recurrence` type.

---

### Task 2: Shared Zod Schemas

**Files:**

- Modify: `packages/shared/src/schemas/finance.ts`

- [ ] **Step 1: Add Recurrence schemas at the end of the file**

Append to `packages/shared/src/schemas/finance.ts`:

```typescript
// Recurrence
export const RecurrenceFreqSchema = z.enum(["MONTHLY", "WEEKLY", "BIWEEKLY", "YEARLY"]);
export type RecurrenceFreq = z.infer<typeof RecurrenceFreqSchema>;

export const RecurrenceSchema = z.object({
  id: z.string(),
  entryId: z.string(),
  type: TransactionTypeSchema,
  amount: z.number(),
  category: z.string(),
  source: TransactionSourceSchema,
  note: z.string().nullable(),
  frequency: RecurrenceFreqSchema,
  dayOfMonth: z.number().nullable().optional(),
  dayOfWeek: z.number().nullable().optional(),
  monthOfYear: z.number().nullable().optional(),
  startDate: z.string(),
  nextRunAt: z.string(),
  lastRunAt: z.string().nullable().optional(),
  active: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Recurrence = z.infer<typeof RecurrenceSchema>;

export const CreateRecurrenceSchema = z.object({
  entryId: z.string().min(1),
  type: TransactionTypeSchema,
  amount: z.number().positive("金額必須大於 0"),
  category: z.string().min(1, "類別為必填"),
  source: TransactionSourceSchema.default("daily"),
  note: z.string().optional(),
  frequency: RecurrenceFreqSchema,
  dayOfMonth: z.number().int().min(1).max(31).optional(),
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  monthOfYear: z.number().int().min(1).max(12).optional(),
  startDate: z.string(),
});
export type CreateRecurrence = z.infer<typeof CreateRecurrenceSchema>;

export const UpdateRecurrenceSchema = CreateRecurrenceSchema.omit({ entryId: true }).partial();
export type UpdateRecurrence = z.infer<typeof UpdateRecurrenceSchema>;
```

---

### Task 3: Recurrences Service

**Files:**

- Create: `apps/web/services/recurrences.service.ts`

- [ ] **Step 1: Create the service**

```typescript
import { prisma } from "@/lib/prisma";
import { d } from "@/lib/serialize";
import type { CreateRecurrence, UpdateRecurrence } from "@repo/shared";

type RecurrenceFreq = "MONTHLY" | "WEEKLY" | "BIWEEKLY" | "YEARLY";

function serializeRecurrence(r: {
  id: string;
  entryId: string;
  userId: string;
  type: string;
  amount: import("@prisma/client").Prisma.Decimal;
  category: string;
  source: string;
  note: string | null;
  frequency: RecurrenceFreq;
  dayOfMonth: number | null;
  dayOfWeek: number | null;
  monthOfYear: number | null;
  startDate: Date;
  nextRunAt: Date;
  lastRunAt: Date | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  const { userId: _userId, ...rest } = r;
  return {
    ...rest,
    amount: d(rest.amount),
    startDate: rest.startDate.toISOString(),
    nextRunAt: rest.nextRunAt.toISOString(),
    lastRunAt: rest.lastRunAt?.toISOString() ?? null,
    createdAt: rest.createdAt.toISOString(),
    updatedAt: rest.updatedAt.toISOString(),
  };
}

// Compute the first nextRunAt at or after startDate
function computeInitialNextRunAt(
  frequency: RecurrenceFreq,
  startDate: Date,
  dayOfMonth?: number | null,
  dayOfWeek?: number | null,
  monthOfYear?: number | null
): Date {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);

  switch (frequency) {
    case "MONTHLY": {
      const dom = dayOfMonth ?? 1;
      const candidate = new Date(start.getFullYear(), start.getMonth(), dom);
      if (candidate < start) candidate.setMonth(candidate.getMonth() + 1);
      const lastDay = new Date(candidate.getFullYear(), candidate.getMonth() + 1, 0).getDate();
      candidate.setDate(Math.min(dom, lastDay));
      return candidate;
    }
    case "WEEKLY": {
      const dow = dayOfWeek ?? 0;
      const candidate = new Date(start);
      const diff = (dow - candidate.getDay() + 7) % 7;
      candidate.setDate(candidate.getDate() + diff);
      return candidate;
    }
    case "BIWEEKLY": {
      const dow = dayOfWeek ?? 0;
      const candidate = new Date(start);
      const diff = (dow - candidate.getDay() + 7) % 7;
      candidate.setDate(candidate.getDate() + diff);
      return candidate;
    }
    case "YEARLY": {
      const m = (monthOfYear ?? 1) - 1;
      const dom2 = dayOfMonth ?? 1;
      const candidate = new Date(start.getFullYear(), m, dom2);
      if (candidate < start) candidate.setFullYear(candidate.getFullYear() + 1);
      return candidate;
    }
  }
}

// Advance nextRunAt by one period
export function computeNextRunAt(
  frequency: RecurrenceFreq,
  from: Date,
  dayOfMonth?: number | null,
  monthOfYear?: number | null
): Date {
  const next = new Date(from);
  switch (frequency) {
    case "MONTHLY": {
      next.setMonth(next.getMonth() + 1);
      if (dayOfMonth) {
        const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
        next.setDate(Math.min(dayOfMonth, lastDay));
      }
      break;
    }
    case "WEEKLY":
      next.setDate(next.getDate() + 7);
      break;
    case "BIWEEKLY":
      next.setDate(next.getDate() + 14);
      break;
    case "YEARLY": {
      next.setFullYear(next.getFullYear() + 1);
      if (monthOfYear && dayOfMonth) {
        next.setMonth(monthOfYear - 1);
        const lastDay = new Date(next.getFullYear(), monthOfYear, 0).getDate();
        next.setDate(Math.min(dayOfMonth, lastDay));
      }
      break;
    }
  }
  return next;
}

export class RecurrencesService {
  async list(userId: string, entryId?: string) {
    const rows = await prisma.recurrence.findMany({
      where: { userId, ...(entryId ? { entryId } : {}) },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(serializeRecurrence);
  }

  async create(data: CreateRecurrence, userId: string) {
    const startDate = new Date(data.startDate);
    const nextRunAt = computeInitialNextRunAt(
      data.frequency as RecurrenceFreq,
      startDate,
      data.dayOfMonth,
      data.dayOfWeek,
      data.monthOfYear
    );
    const row = await prisma.recurrence.create({
      data: {
        userId,
        entryId: data.entryId,
        type: data.type,
        amount: data.amount,
        category: data.category,
        source: data.source ?? "daily",
        note: data.note ?? null,
        frequency: data.frequency as RecurrenceFreq,
        dayOfMonth: data.dayOfMonth ?? null,
        dayOfWeek: data.dayOfWeek ?? null,
        monthOfYear: data.monthOfYear ?? null,
        startDate,
        nextRunAt,
      },
    });
    return serializeRecurrence(row);
  }

  async update(id: string, data: UpdateRecurrence, userId: string) {
    const existing = await prisma.recurrence.findFirst({ where: { id, userId } });
    if (!existing) return null;

    const needsRecompute =
      data.frequency !== undefined ||
      data.dayOfMonth !== undefined ||
      data.dayOfWeek !== undefined ||
      data.monthOfYear !== undefined ||
      data.startDate !== undefined;

    const freq = (data.frequency ?? existing.frequency) as RecurrenceFreq;
    const dom = data.dayOfMonth !== undefined ? data.dayOfMonth : existing.dayOfMonth;
    const dow = data.dayOfWeek !== undefined ? data.dayOfWeek : existing.dayOfWeek;
    const moy = data.monthOfYear !== undefined ? data.monthOfYear : existing.monthOfYear;
    const startDate = data.startDate ? new Date(data.startDate) : existing.startDate;

    const nextRunAt = needsRecompute
      ? computeInitialNextRunAt(freq, startDate, dom, dow, moy)
      : existing.nextRunAt;

    const row = await prisma.recurrence.update({
      where: { id },
      data: {
        ...(data.type !== undefined ? { type: data.type } : {}),
        ...(data.amount !== undefined ? { amount: data.amount } : {}),
        ...(data.category !== undefined ? { category: data.category } : {}),
        ...(data.source !== undefined ? { source: data.source } : {}),
        ...(data.note !== undefined ? { note: data.note } : {}),
        ...(data.frequency !== undefined ? { frequency: data.frequency as RecurrenceFreq } : {}),
        ...(data.dayOfMonth !== undefined ? { dayOfMonth: data.dayOfMonth } : {}),
        ...(data.dayOfWeek !== undefined ? { dayOfWeek: data.dayOfWeek } : {}),
        ...(data.monthOfYear !== undefined ? { monthOfYear: data.monthOfYear } : {}),
        ...(data.startDate !== undefined ? { startDate } : {}),
        nextRunAt,
      },
    });
    return serializeRecurrence(row);
  }

  async delete(id: string, userId: string) {
    return prisma.recurrence.deleteMany({ where: { id, userId } });
  }

  async process(userId: string): Promise<number> {
    const now = new Date();
    const pending = await prisma.recurrence.findMany({
      where: { userId, active: true, nextRunAt: { lte: now } },
    });

    let created = 0;
    for (const rec of pending) {
      let nextRun = new Date(rec.nextRunAt);
      const freq = rec.frequency as RecurrenceFreq;
      let safetyLimit = 0;

      while (nextRun <= now && safetyLimit < 366) {
        safetyLimit++;
        await prisma.transaction.create({
          data: {
            userId,
            type: rec.type,
            amount: rec.amount,
            category: rec.category,
            source: rec.source,
            note: rec.note,
            date: nextRun,
          },
        });
        created++;
        nextRun = computeNextRunAt(freq, nextRun, rec.dayOfMonth, rec.monthOfYear);
      }

      await prisma.recurrence.update({
        where: { id: rec.id },
        data: { nextRunAt: nextRun, lastRunAt: now },
      });
    }

    return created;
  }

  async findById(id: string, userId: string) {
    const row = await prisma.recurrence.findFirst({ where: { id, userId } });
    return row ? serializeRecurrence(row) : null;
  }
}

export const recurrencesService = new RecurrencesService();
```

---

### Task 4: API Routes

**Files:**

- Create: `apps/web/app/api/recurrences/route.ts`
- Create: `apps/web/app/api/recurrences/[id]/route.ts`
- Create: `apps/web/app/api/recurrences/process/route.ts`

- [ ] **Step 1: Create `apps/web/app/api/recurrences/route.ts`**

```typescript
import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { CreateRecurrenceSchema } from "@repo/shared";
import { recurrencesService } from "@/services/recurrences.service";
import { ok, err, handleError } from "@/lib/api-response";
import { logSecurityEvent } from "@/lib/security-log";

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      logSecurityEvent({ type: "auth_fail", resource: "/api/recurrences" });
      return err("UNAUTHORIZED", "Authentication required", 401);
    }
    const entryId = req.nextUrl.searchParams.get("entryId") ?? undefined;
    const items = await recurrencesService.list(userId, entryId);
    return ok(items);
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      logSecurityEvent({ type: "auth_fail", resource: "/api/recurrences" });
      return err("UNAUTHORIZED", "Authentication required", 401);
    }
    const data = CreateRecurrenceSchema.parse(await req.json());
    const item = await recurrencesService.create(data, userId);
    return ok(item, 201);
  } catch (e) {
    return handleError(e);
  }
}
```

- [ ] **Step 2: Create `apps/web/app/api/recurrences/[id]/route.ts`**

```typescript
import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { UpdateRecurrenceSchema } from "@repo/shared";
import { recurrencesService } from "@/services/recurrences.service";
import { ok, err, handleError } from "@/lib/api-response";
import { logSecurityEvent } from "@/lib/security-log";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      logSecurityEvent({ type: "auth_fail", resource: "/api/recurrences/[id]" });
      return err("UNAUTHORIZED", "Authentication required", 401);
    }
    const { id } = await params;
    const existing = await recurrencesService.findById(id, userId);
    if (!existing) return err("NOT_FOUND", "Recurrence not found", 404);
    const data = UpdateRecurrenceSchema.parse(await req.json());
    const item = await recurrencesService.update(id, data, userId);
    return ok(item);
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      logSecurityEvent({ type: "auth_fail", resource: "/api/recurrences/[id]" });
      return err("UNAUTHORIZED", "Authentication required", 401);
    }
    const { id } = await params;
    const existing = await recurrencesService.findById(id, userId);
    if (!existing) return err("NOT_FOUND", "Recurrence not found", 404);
    await recurrencesService.delete(id, userId);
    return ok({ deleted: true });
  } catch (e) {
    return handleError(e);
  }
}
```

- [ ] **Step 3: Create `apps/web/app/api/recurrences/process/route.ts`**

```typescript
import { auth } from "@clerk/nextjs/server";
import { recurrencesService } from "@/services/recurrences.service";
import { ok, err, handleError } from "@/lib/api-response";
import { logSecurityEvent } from "@/lib/security-log";

export async function POST() {
  try {
    const { userId } = await auth();
    if (!userId) {
      logSecurityEvent({ type: "auth_fail", resource: "/api/recurrences/process" });
      return err("UNAUTHORIZED", "Authentication required", 401);
    }
    const created = await recurrencesService.process(userId);
    return ok({ created });
  } catch (e) {
    return handleError(e);
  }
}
```

---

### Task 5: Zustand Store

**Files:**

- Modify: `apps/web/store/useFinanceStore.ts`

- [ ] **Step 1: Add `Recurrence`, `CreateRecurrence`, `UpdateRecurrence` to imports**

Add to the existing import from `@repo/shared`:

```typescript
import type {
  Entry,
  CreateEntry,
  UpdateEntry,
  Transaction,
  PortfolioItem,
  ValueSnapshot,
  CreateTransaction,
  CreatePortfolioItem,
  Recurrence,
  CreateRecurrence,
  UpdateRecurrence,
} from "@repo/shared";
```

- [ ] **Step 2: Add recurrences to `FinanceState` interface**

Add to the interface:

```typescript
recurrences: Recurrence[];
addRecurrence: (data: CreateRecurrence) => Promise<void>;
updateRecurrence: (id: string, data: UpdateRecurrence) => Promise<void>;
deleteRecurrence: (id: string) => Promise<void>;
```

- [ ] **Step 3: Add recurrences initial state**

In `create((set, get) => ({`, add:

```typescript
recurrences: [],
```

- [ ] **Step 4: Update the signed-in `fetchAll` path**

After the existing `Promise.all` that fetches entries/transactions/portfolio, add process + fetch of recurrences. The block currently ending at:

```typescript
        } catch (e) {
          set({ loading: false, error: e instanceof Error ? e.message : "Failed to fetch data" });
        }
```

Change the try block to also process and fetch recurrences:

```typescript
try {
  const [entries, transactions, portfolio] = await Promise.all([
    apiFetch<Entry[]>("/api/entries"),
    apiFetch<Transaction[]>("/api/transactions"),
    apiFetch<PortfolioItem[]>("/api/portfolio"),
  ]);
  // Process any pending recurrences, then fetch updated list
  await apiFetch<{ created: number }>("/api/recurrences/process", { method: "POST" });
  const [recurrences, updatedTransactions] = await Promise.all([
    apiFetch<Recurrence[]>("/api/recurrences"),
    apiFetch<Transaction[]>("/api/transactions"),
  ]);
  set((s) => {
    const snapshots =
      s.valueSnapshots.length === 0 && entries.length > 0
        ? [makeSnapshot(entries)]
        : s.valueSnapshots;
    return {
      entries,
      transactions: updatedTransactions,
      portfolio,
      recurrences,
      valueSnapshots: snapshots,
      loading: false,
      lastFetchedAt: Date.now(),
    };
  });
} catch (e) {
  set({ loading: false, error: e instanceof Error ? e.message : "Failed to fetch data" });
}
```

- [ ] **Step 5: Add recurrence CRUD actions**

After `deletePortfolioItem`, add:

```typescript
      addRecurrence: async (data) => {
        const item = await apiFetch<Recurrence>("/api/recurrences", {
          method: "POST",
          body: JSON.stringify(data),
        });
        set((s) => ({ recurrences: [...s.recurrences, item] }));
      },

      updateRecurrence: async (id, data) => {
        const item = await apiFetch<Recurrence>(`/api/recurrences/${id}`, {
          method: "PUT",
          body: JSON.stringify(data),
        });
        set((s) => ({
          recurrences: s.recurrences.map((r) => (r.id === id ? item : r)),
        }));
      },

      deleteRecurrence: async (id) => {
        await apiFetch(`/api/recurrences/${id}`, { method: "DELETE" });
        set((s) => ({ recurrences: s.recurrences.filter((r) => r.id !== id) }));
      },
```

---

### Task 6: RecurrenceFormPage Component

**Files:**

- Create: `apps/web/components/finance/RecurrenceFormPage.tsx`

- [ ] **Step 1: Create the component**

```typescript
"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, Check } from "lucide-react";
import { Spinner } from "../ui/Spinner";
import { useFinanceStore } from "../../store/useFinanceStore";
import type { Recurrence } from "@repo/shared";

type RecurrenceFreq = "MONTHLY" | "WEEKLY" | "BIWEEKLY" | "YEARLY";
type TxType = "income" | "expense";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  entryId: string;
  color: string;
  subCategoryName: string;
  editItem?: Recurrence | null;
}

const FREQ_OPTIONS: { value: RecurrenceFreq; label: string }[] = [
  { value: "MONTHLY", label: "每月" },
  { value: "WEEKLY", label: "每週" },
  { value: "BIWEEKLY", label: "每兩週" },
  { value: "YEARLY", label: "每年" },
];

const DAY_OF_WEEK_OPTIONS = ["日", "一", "二", "三", "四", "五", "六"];

const MONTH_OPTIONS = [
  "1月", "2月", "3月", "4月", "5月", "6月",
  "7月", "8月", "9月", "10月", "11月", "12月",
];

export function RecurrenceFormPage({
  open,
  onClose,
  onSaved,
  entryId,
  color,
  subCategoryName,
  editItem,
}: Props) {
  const { addRecurrence, updateRecurrence } = useFinanceStore();

  const [type, setType] = useState<TxType>("expense");
  const [amountStr, setAmountStr] = useState("");
  const [category, setCategory] = useState(subCategoryName);
  const [frequency, setFrequency] = useState<RecurrenceFreq>("MONTHLY");
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [monthOfYear, setMonthOfYear] = useState(1);
  const [yearDay, setYearDay] = useState(1);
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split("T")[0] ?? "");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (editItem) {
      setType(editItem.type as TxType);
      setAmountStr(String(editItem.amount));
      setCategory(editItem.category);
      setFrequency(editItem.frequency as RecurrenceFreq);
      setDayOfMonth(editItem.dayOfMonth ?? 1);
      setDayOfWeek(editItem.dayOfWeek ?? 1);
      setMonthOfYear(editItem.monthOfYear ?? 1);
      setYearDay(editItem.dayOfMonth ?? 1);
      setStartDate(editItem.startDate.split("T")[0] ?? "");
      setNote(editItem.note ?? "");
    } else {
      setType("expense");
      setAmountStr("");
      setCategory(subCategoryName);
      setFrequency("MONTHLY");
      setDayOfMonth(1);
      setDayOfWeek(1);
      setMonthOfYear(1);
      setYearDay(1);
      setStartDate(new Date().toISOString().split("T")[0] ?? "");
      setNote("");
    }
    setError(null);
  }, [open, editItem, subCategoryName]);

  const handleSubmit = async () => {
    const amount = parseFloat(amountStr);
    if (!amountStr || isNaN(amount) || amount <= 0) {
      setError("請輸入有效金額");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const payload = {
        entryId,
        type,
        amount,
        category: category.trim() || subCategoryName,
        source: "daily" as const,
        note: note.trim() || undefined,
        frequency,
        dayOfMonth: frequency === "MONTHLY" ? dayOfMonth : frequency === "YEARLY" ? yearDay : undefined,
        dayOfWeek: frequency === "WEEKLY" || frequency === "BIWEEKLY" ? dayOfWeek : undefined,
        monthOfYear: frequency === "YEARLY" ? monthOfYear : undefined,
        startDate,
      };
      if (editItem) {
        const { entryId: _eid, ...updatePayload } = payload;
        await updateRecurrence(editItem.id, updatePayload);
      } else {
        await addRecurrence(payload);
      }
      onSaved();
    } catch {
      setError("儲存失敗，請再試一次");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className={`fixed inset-0 z-[90] flex flex-col bg-[#f2f2f7] transition-transform duration-300 ease-in-out ${
        open ? "translate-x-0" : "pointer-events-none translate-x-full"
      }`}
    >
      <div className="mx-auto w-full max-w-md px-4 pt-14">
        {/* Nav */}
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm"
          >
            <ChevronLeft size={20} className="text-[#1c1c1e]" />
          </button>
          <p className="text-[18px] font-bold text-[#1c1c1e]">
            {editItem ? "編輯定期項目" : "新增定期項目"}
          </p>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm disabled:opacity-40"
          >
            {submitting ? (
              <span style={{ color }}>
                <Spinner size={20} />
              </span>
            ) : (
              <Check size={20} className="text-[#1c1c1e]" strokeWidth={2.5} />
            )}
          </button>
        </div>

        <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
          {/* Type */}
          <div className="flex divide-x divide-[#f2f2f7]">
            {(["expense", "income"] as TxType[]).map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className="flex-1 py-3.5 text-[15px] font-semibold transition-colors"
                style={{
                  backgroundColor: type === t ? color + "18" : "transparent",
                  color: type === t ? color : "#8e8e93",
                }}
              >
                {t === "expense" ? "支出" : "收入"}
              </button>
            ))}
          </div>

          <div className="mx-5 h-px bg-[#f2f2f7]" />

          {/* Amount */}
          <div className="flex items-center justify-between px-5 py-4">
            <p className="text-[16px] font-medium text-[#1c1c1e]">金額</p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={amountStr}
                onChange={(e) => { setAmountStr(e.target.value); setError(null); }}
                placeholder="0"
                className="w-28 bg-transparent text-right text-[20px] font-semibold text-[#1c1c1e] outline-none placeholder:text-[#c7c7cc]"
              />
              <span className="rounded-full bg-[#1c1c1e] px-2.5 py-1 text-[11px] font-bold text-white">
                TWD
              </span>
            </div>
          </div>

          <div className="mx-5 h-px bg-[#f2f2f7]" />

          {/* Category */}
          <div className="flex items-center justify-between px-5 py-4">
            <p className="shrink-0 text-[16px] font-medium text-[#1c1c1e]">類別</p>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder={subCategoryName}
              className="ml-4 min-w-0 flex-1 bg-transparent text-right text-[14px] text-[#8e8e93] outline-none placeholder:text-[#c7c7cc]"
            />
          </div>

          <div className="mx-5 h-px bg-[#f2f2f7]" />

          {/* Frequency */}
          <div className="px-5 py-4">
            <p className="mb-3 text-[16px] font-medium text-[#1c1c1e]">頻率</p>
            <div className="flex gap-2">
              {FREQ_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setFrequency(opt.value)}
                  className="flex-1 rounded-full py-2 text-[13px] font-semibold transition-colors"
                  style={{
                    backgroundColor: frequency === opt.value ? color : "#f2f2f7",
                    color: frequency === opt.value ? "white" : "#8e8e93",
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mx-5 h-px bg-[#f2f2f7]" />

          {/* Timing */}
          {frequency === "MONTHLY" && (
            <div className="flex items-center justify-between px-5 py-4">
              <p className="text-[16px] font-medium text-[#1c1c1e]">每月第幾號</p>
              <select
                value={dayOfMonth}
                onChange={(e) => setDayOfMonth(Number(e.target.value))}
                className="bg-transparent text-[15px] font-semibold text-[#1c1c1e] outline-none"
              >
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>{d} 號</option>
                ))}
              </select>
            </div>
          )}

          {(frequency === "WEEKLY" || frequency === "BIWEEKLY") && (
            <div className="px-5 py-4">
              <p className="mb-3 text-[16px] font-medium text-[#1c1c1e]">星期幾</p>
              <div className="flex gap-1.5">
                {DAY_OF_WEEK_OPTIONS.map((label, idx) => (
                  <button
                    key={idx}
                    onClick={() => setDayOfWeek(idx)}
                    className="flex-1 rounded-full py-2 text-[13px] font-semibold transition-colors"
                    style={{
                      backgroundColor: dayOfWeek === idx ? color : "#f2f2f7",
                      color: dayOfWeek === idx ? "white" : "#8e8e93",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {frequency === "YEARLY" && (
            <div className="flex items-center justify-between px-5 py-4">
              <p className="text-[16px] font-medium text-[#1c1c1e]">每年幾月幾號</p>
              <div className="flex items-center gap-2">
                <select
                  value={monthOfYear}
                  onChange={(e) => setMonthOfYear(Number(e.target.value))}
                  className="bg-transparent text-[15px] font-semibold text-[#1c1c1e] outline-none"
                >
                  {MONTH_OPTIONS.map((label, idx) => (
                    <option key={idx + 1} value={idx + 1}>{label}</option>
                  ))}
                </select>
                <select
                  value={yearDay}
                  onChange={(e) => setYearDay(Number(e.target.value))}
                  className="bg-transparent text-[15px] font-semibold text-[#1c1c1e] outline-none"
                >
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>{d} 號</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="mx-5 h-px bg-[#f2f2f7]" />

          {/* Start date */}
          <div className="flex items-center justify-between px-5 py-4">
            <p className="shrink-0 text-[16px] font-medium text-[#1c1c1e]">開始日期</p>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent text-right text-[14px] text-[#8e8e93] outline-none"
            />
          </div>

          <div className="mx-5 h-px bg-[#f2f2f7]" />

          {/* Note */}
          <div className="px-5 py-4">
            <p className="mb-2 text-[16px] font-medium text-[#1c1c1e]">備註</p>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="選填"
              className="w-full bg-transparent text-[14px] text-[#8e8e93] outline-none placeholder:text-[#c7c7cc]"
            />
          </div>
        </div>

        {error && <p className="mt-3 text-center text-[13px] text-[#ff3b30]">{error}</p>}
      </div>
    </div>
  );
}
```

---

### Task 7: AccountFormPage Integration

**Files:**

- Modify: `apps/web/components/finance/AccountFormPage.tsx`

- [ ] **Step 1: Add imports and new state**

Add to existing imports:

```typescript
import { RecurrenceFormPage } from "./RecurrenceFormPage";
import { useFinanceStore } from "../../store/useFinanceStore"; // already imported
import { Trash2, Pencil } from "lucide-react";
import type { Recurrence } from "@repo/shared";
```

Add `recurrences` and `deleteRecurrence` to the destructure from `useFinanceStore`:

```typescript
const { addEntry, updateEntry, fetchAll, entries, recurrences, deleteRecurrence } =
  useFinanceStore();
```

Add state variables:

```typescript
const [showRecurrenceForm, setShowRecurrenceForm] = useState(false);
const [editRecurrence, setEditRecurrence] = useState<Recurrence | null>(null);
```

Compute `entryRecurrences` via useMemo (only relevant when editing):

```typescript
const entryRecurrences = useMemo(
  () => (editItem ? recurrences.filter((r) => r.entryId === editItem.id) : []),
  [recurrences, editItem]
);
```

- [ ] **Step 2: Replace the existing 定期項目 section (lines 734–752)**

Replace the entire static section with:

```tsx
{
  /* Recurrences section */
}
<div className="mt-6">
  <div className="mb-3 flex items-center justify-between">
    <div className="flex items-center gap-2">
      <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#1c1c1e]">
        <RefreshCw size={16} className="text-[#1c1c1e]" />
      </div>
      <p className="text-[17px] font-semibold text-[#1c1c1e]">定期項目</p>
    </div>
    <button
      onClick={() => {
        setEditRecurrence(null);
        setShowRecurrenceForm(true);
      }}
      className="rounded-full border border-[#1c1c1e] px-4 py-1.5 text-[13px] font-medium text-[#1c1c1e] active:bg-[#e5e5ea]"
    >
      新增定期
    </button>
  </div>

  {entryRecurrences.length > 0 ? (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
      {entryRecurrences.map((rec, idx) => (
        <div key={rec.id}>
          {idx > 0 && <div className="mx-5 h-px bg-[#f2f2f7]" />}
          <div className="flex items-center gap-3 px-5 py-3.5">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
              style={{
                backgroundColor: categoryColor + "20",
                color: categoryColor,
              }}
            >
              {rec.type === "income" ? "+" : "−"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold text-[#1c1c1e]">
                {rec.frequency === "MONTHLY"
                  ? `每月 ${rec.dayOfMonth} 號`
                  : rec.frequency === "WEEKLY"
                    ? `每週${["日", "一", "二", "三", "四", "五", "六"][rec.dayOfWeek ?? 0]}`
                    : rec.frequency === "BIWEEKLY"
                      ? `每兩週${["日", "一", "二", "三", "四", "五", "六"][rec.dayOfWeek ?? 0]}`
                      : `每年 ${rec.monthOfYear}/${rec.dayOfMonth}`}
              </p>
              <p className="text-[12px] text-[#8e8e93]">{rec.category}</p>
            </div>
            <p
              className="text-[15px] font-semibold"
              style={{ color: rec.type === "income" ? "#34c759" : "#ff3b30" }}
            >
              {rec.type === "income" ? "+" : "−"}
              {rec.amount.toLocaleString()}
            </p>
            <div className="flex gap-1">
              <button
                onClick={() => {
                  setEditRecurrence(rec);
                  setShowRecurrenceForm(true);
                }}
                className="flex h-8 w-8 items-center justify-center rounded-full active:bg-[#f2f2f7]"
              >
                <Pencil size={14} className="text-[#8e8e93]" />
              </button>
              <button
                onClick={() => deleteRecurrence(rec.id)}
                className="flex h-8 w-8 items-center justify-center rounded-full active:bg-[#f2f2f7]"
              >
                <Trash2 size={14} className="text-[#ff3b30]" />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  ) : (
    <div className="flex gap-3 rounded-2xl bg-white p-4 shadow-sm">
      <Info size={18} className="mt-0.5 shrink-0 text-[#8e8e93]" />
      <p className="text-[13px] leading-relaxed text-[#8e8e93]">
        新增定期交易，例如帳單、薪資、租金等。可以先填入預估金額，之後再依實際情況調整。
      </p>
    </div>
  )}
</div>;
```

- [ ] **Step 3: Add RecurrenceFormPage to the JSX return (before closing `</>`)**

Add alongside the existing `StockPickerPage` and `BankPickerPage`:

```tsx
<RecurrenceFormPage
  open={showRecurrenceForm}
  onClose={() => setShowRecurrenceForm(false)}
  onSaved={() => setShowRecurrenceForm(false)}
  entryId={editItem?.id ?? ""}
  color={categoryColor}
  subCategoryName={subCategoryName}
  editItem={editRecurrence}
/>
```
