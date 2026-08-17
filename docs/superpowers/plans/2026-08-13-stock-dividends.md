# 股票股息紀錄 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓 Premium 使用者手動記錄每檔股票領到的股利，並用一個按鈕把該筆股利再投資回同一檔股票，同時正確帶動流動資金帳戶的現金流。

**Architecture:** 新增 `Dividend` model 掛在股票 `Entry` 上。每筆股利的入帳／再投資都是寫入 `EntryHistory`（與現有加碼流程同構），並把產生的 history id 記回 `Dividend`，刪除時據此精準沖銷。所有寫入包在單一 `prisma.$transaction` 內。Premium 只擋兩個 `POST`，後端 `entitlementsService.isPremium()` 是唯一權威。

**Tech Stack:** Next.js 15 Route Handlers、Prisma 6 + PostgreSQL (Supabase)、Zod (`@repo/shared`)、Vitest、Expo React Native (`apps/mobile`)、Clerk。

**Spec:** `docs/superpowers/specs/2026-08-13-stock-dividends-design.md`

## Global Constraints

- 分支：`feature/stock-dividends`（已從 `origin/main` 開出）。PR 目標是 `develop`，不是 `main`。
- Commit 格式：Conventional Commits，subject 全小寫、無 scope（commitlint + husky 會擋）。
- `.env` 必須指向 **dev** Supabase 專案，絕不可指向生產。任何 `db:*` 指令前先跑 `pnpm db:check`。
- `Dividend.amount` 一律以 **TWD** 儲存。不引入 per-entry 幣別欄位（違反既有的「多幣別 WON'T FIX」決策）。
- 所有 Prisma 查詢必須以 `userId` 收斂，包含入帳銀行那一邊：`findFirst({ where: { id, userId } })`。
- 股票 entry 的判定條件固定為：`STOCK_CATS.includes(subCategory) && !!stockCode`，其中 `STOCK_CATS = ["台股", "美股", "加密貨幣", "貴金屬"]`（來自 `apps/mobile/lib/stockConstants.ts`）。
- 入帳帳戶只接受 `topCategory === "流動資金"` 的 Entry。
- 一筆 `Dividend` 只能再投資一次；已再投資者不可改 `amount`。兩者都回 HTTP 409。
- 錯誤碼固定用 `PREMIUM_REQUIRED`(403)、`UNAUTHORIZED`(401)、`NOT_FOUND`(404)、`CONFLICT`(409)。
- 本功能是純 JS 變更，**不得修改 `apps/mobile/app.json` 的 `version`**（版本號只在原生 build 時 bump）。
- 不做：股利行事曆、批次匯入歷史配息、稅費欄位、CSV 匯出、web UI、獨立的撤銷再投資端點。

---

## File Structure

| 檔案                                                | 責任                                                                                                                    |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `apps/web/prisma/schema.prisma`                     | 新增 `Dividend` model 與 `Entry` 的兩個反向關聯                                                                         |
| `packages/shared/src/schemas/finance.ts`            | `CreateDividendSchema` / `UpdateDividendSchema` / `ReinvestDividendSchema` / `DividendSchema` / `DividendSummarySchema` |
| `apps/web/services/dividends.service.ts`            | 全部業務邏輯：create / list / update / delete / reinvest / summary，含沖銷與重放                                        |
| `apps/web/app/api/dividends/route.ts`               | `GET` 列表、`POST` 新增                                                                                                 |
| `apps/web/app/api/dividends/summary/route.ts`       | `GET` 彙總                                                                                                              |
| `apps/web/app/api/dividends/[id]/route.ts`          | `PATCH` / `DELETE`                                                                                                      |
| `apps/web/app/api/dividends/[id]/reinvest/route.ts` | `POST` 再投資                                                                                                           |
| `apps/web/tests/services/dividends.service.test.ts` | service 單元測試                                                                                                        |
| `apps/mobile/hooks/useFinanceActions.ts`            | 加入 dividend actions                                                                                                   |
| `apps/mobile/components/DividendForm.tsx`           | 新增股利的底部彈窗                                                                                                      |
| `apps/mobile/components/ReinvestSheet.tsx`          | 再投資確認彈窗                                                                                                          |
| `apps/mobile/components/DividendSection.tsx`        | entry 詳情頁的股息區塊                                                                                                  |
| `apps/mobile/app/(app)/entry/[id].tsx`              | 掛載 `DividendSection`                                                                                                  |
| `apps/mobile/app/(app)/dividends.tsx`               | 股息總覽頁                                                                                                              |
| `apps/mobile/app/(app)/settings.tsx`                | 加入總覽頁入口                                                                                                          |

**Service 內部結構**：`dividends.service.ts` 會有三個私有 helper，被多個公開方法共用，避免沖銷邏輯散落：

- `postHistory(tx, entryId, delta, units?, note?)` → 寫一筆 `EntryHistory` 並更新 `Entry.value`，回傳 history id
- `reverseHistory(tx, historyId)` → 刪掉一筆 history、修正後續 balance、回推 `Entry.value`
- `unwind(tx, dividend)` → 對一筆 `Dividend` 的所有 history id 與 transaction 做完整沖銷

---

### Task 1: `Dividend` model 與 migration

**Files:**

- Modify: `apps/web/prisma/schema.prisma`
- Create: `apps/web/prisma/migrations/<timestamp>_add_dividend/migration.sql`（由 `pnpm db:migrate` 產生）

**Interfaces:**

- Consumes: 既有的 `Entry` model
- Produces: Prisma client 上的 `prisma.dividend`，欄位如下 SQL/schema 所示；`Entry` 上新增 `dividends` 與 `bankDividends` 關聯

- [ ] **Step 1: 確認資料庫指向 dev**

Run: `pnpm db:check`
Expected: 通過（不得出現 production 警告）。若失敗，停下來修 `.env`，不要繼續。

- [ ] **Step 2: 在 schema.prisma 的 `Entry` model 加入兩個反向關聯**

在 `apps/web/prisma/schema.prisma` 的 `model Entry` 內，`recurrences Recurrence[]` 那一行之後加入：

```prisma
  dividends     Dividend[] @relation("EntryDividends")
  bankDividends Dividend[] @relation("BankDividends")
```

- [ ] **Step 3: 在 schema.prisma 檔案末尾加入 `Dividend` model**

```prisma
model Dividend {
  id      String @id @default(cuid())
  userId  String
  entryId String
  entry   Entry  @relation("EntryDividends", fields: [entryId], references: [id], onDelete: Cascade)

  payDate  DateTime
  amount   Decimal
  perShare Decimal?
  shares   Decimal?
  note     String?

  bankEntryId   String?
  bankEntry     Entry?  @relation("BankDividends", fields: [bankEntryId], references: [id], onDelete: SetNull)
  bankHistoryId String?
  transactionId String?

  reinvestedAt          DateTime?
  reinvestAmount        Decimal?
  reinvestPrice         Decimal?
  reinvestUnits         Decimal?
  reinvestHistoryId     String?
  reinvestBankHistoryId String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId, payDate])
  @@index([entryId])
}
```

- [ ] **Step 4: 產生 migration**

Run: `pnpm db:migrate --name add_dividend`
Expected: 新的 migration 資料夾出現在 `apps/web/prisma/migrations/`，且指令回報 migration 已套用。

若指令提示要 reset 資料庫，**停下來**回報 —— 表示 dev DB 與 migration 歷史有落差，不要按 yes。

- [ ] **Step 5: 產生 Prisma client 並確認型別存在**

Run: `pnpm db:generate && pnpm type-check`
Expected: 兩者都通過。

- [ ] **Step 6: Commit**

```bash
git add apps/web/prisma/schema.prisma apps/web/prisma/migrations
git commit -m "feat: add dividend model"
```

---

### Task 2: `@repo/shared` Zod schemas

**Files:**

- Modify: `packages/shared/src/schemas/finance.ts`（附加在檔案末尾，緊接在既有 Insurance 區塊之後）

**Interfaces:**

- Consumes: 檔案中既有的 `z` import
- Produces:
  - `CreateDividendSchema` / `CreateDividend`：`{ entryId: string; payDate: string; amount: number; perShare?: number; shares?: number; note?: string; bankEntryId?: string; recordIncome?: boolean }`
  - `UpdateDividendSchema` / `UpdateDividend`：`{ payDate?: string; amount?: number; note?: string | null; bankEntryId?: string | null }`
  - `ReinvestDividendSchema` / `ReinvestDividend`：`{ amount: number; price: number }`
  - `DividendSchema` / `Dividend`
  - `DividendSummarySchema` / `DividendSummary`

- [ ] **Step 1: 寫失敗的測試**

Create `packages/shared/tests/dividend.schema.test.ts`：

```ts
import { describe, it, expect } from "vitest";
import {
  CreateDividendSchema,
  UpdateDividendSchema,
  ReinvestDividendSchema,
} from "../src/schemas/finance";

describe("CreateDividendSchema", () => {
  it("accepts a minimal dividend", () => {
    const parsed = CreateDividendSchema.parse({
      entryId: "entry-1",
      payDate: "2026-08-13",
      amount: 1200,
    });
    expect(parsed.amount).toBe(1200);
    expect(parsed.recordIncome).toBe(true);
  });

  it("rejects a non-positive amount", () => {
    expect(() =>
      CreateDividendSchema.parse({ entryId: "e", payDate: "2026-08-13", amount: 0 })
    ).toThrow();
  });

  it("rejects a missing entryId", () => {
    expect(() => CreateDividendSchema.parse({ payDate: "2026-08-13", amount: 10 })).toThrow();
  });

  it("allows clearing the bank account with null", () => {
    expect(UpdateDividendSchema.parse({ bankEntryId: null }).bankEntryId).toBeNull();
  });

  it("requires a positive price on reinvest", () => {
    expect(() => ReinvestDividendSchema.parse({ amount: 100, price: 0 })).toThrow();
    expect(ReinvestDividendSchema.parse({ amount: 100, price: 25.5 }).price).toBe(25.5);
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `pnpm --filter @repo/shared exec vitest run tests/dividend.schema.test.ts`
Expected: FAIL，錯誤訊息類似 `CreateDividendSchema is not exported` / `does not provide an export named`。

若 `@repo/shared` 沒有 vitest 設定，改用根目錄：`pnpm exec vitest run packages/shared/tests/dividend.schema.test.ts`。

- [ ] **Step 3: 實作 schemas**

附加到 `packages/shared/src/schemas/finance.ts` 末尾：

```ts
// Dividend — 股票股息紀錄（Premium）。amount 一律 TWD，見設計文件「幣別處理」。
export const CreateDividendSchema = z.object({
  entryId: z.string().min(1),
  payDate: z.string().min(1),
  amount: z.number().positive(),
  perShare: z.number().positive().optional(),
  shares: z.number().positive().optional(),
  note: z.string().max(200).optional(),
  // 未指定即不記錄現金流：不會對任何流動資金 Entry 產生 history。
  bankEntryId: z.string().min(1).optional(),
  // 預設同步一筆收入 Transaction，使用者可在表單上關掉。
  recordIncome: z.boolean().default(true),
});
export type CreateDividend = z.infer<typeof CreateDividendSchema>;

export const UpdateDividendSchema = z.object({
  payDate: z.string().min(1).optional(),
  amount: z.number().positive().optional(),
  note: z.string().max(200).nullable().optional(),
  // null 表示「清掉入帳帳戶」，undefined 表示「不動」。
  bankEntryId: z.string().min(1).nullable().optional(),
});
export type UpdateDividend = z.infer<typeof UpdateDividendSchema>;

export const ReinvestDividendSchema = z.object({
  amount: z.number().positive(),
  price: z.number().positive(),
});
export type ReinvestDividend = z.infer<typeof ReinvestDividendSchema>;

export const DividendSchema = z.object({
  id: z.string(),
  entryId: z.string(),
  payDate: z.string(),
  amount: z.number(),
  perShare: z.number().nullable(),
  shares: z.number().nullable(),
  note: z.string().nullable(),
  bankEntryId: z.string().nullable(),
  reinvestedAt: z.string().nullable(),
  reinvestAmount: z.number().nullable(),
  reinvestPrice: z.number().nullable(),
  reinvestUnits: z.number().nullable(),
  createdAt: z.string(),
});
export type Dividend = z.infer<typeof DividendSchema>;

export const DividendSummarySchema = z.object({
  totalAllTime: z.number(),
  totalThisYear: z.number(),
  byEntry: z.array(
    z.object({
      entryId: z.string(),
      name: z.string(),
      stockCode: z.string().nullable(),
      subCategory: z.string(),
      totalAllTime: z.number(),
      totalThisYear: z.number(),
      costBasis: z.number(),
      yieldOnCost: z.number().nullable(),
    })
  ),
});
export type DividendSummary = z.infer<typeof DividendSummarySchema>;
```

- [ ] **Step 4: 執行測試確認通過**

Run: `pnpm --filter @repo/shared exec vitest run tests/dividend.schema.test.ts`
Expected: 5 tests PASS。

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/schemas/finance.ts packages/shared/tests/dividend.schema.test.ts
git commit -m "feat: add dividend zod schemas"
```

---

### Task 3: Service — 建立股利（含入帳與收入同步）

**Files:**

- Create: `apps/web/services/dividends.service.ts`
- Create: `apps/web/tests/services/dividends.service.test.ts`

**Interfaces:**

- Consumes: `prisma` (`@/lib/prisma`)、`d`/`dn` (`@/lib/serialize`)、`entitlementsService` (`@/services/entitlements.service`)、`CreateDividend` (`@repo/shared`)
- Produces:
  - `class PremiumRequiredError`（本檔案自己的，命名與 `insurance.service.ts` 一致）
  - `class NotFoundError`
  - `class ConflictError`
  - `dividendsService.create(data: CreateDividend, userId: string): Promise<SerializedDividend>`
  - `dividendsService.list(userId: string, entryId?: string): Promise<SerializedDividend[]>`
  - 私有 `postHistory(tx, entryId, delta, units, note): Promise<string>`（回傳 history id）
  - `SerializedDividend` 的形狀與 Task 2 的 `Dividend` type 相同

- [ ] **Step 1: 寫失敗的測試**

Create `apps/web/tests/services/dividends.service.test.ts`：

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(async (arg) => (Array.isArray(arg) ? Promise.all(arg) : arg(txMock))),
    dividend: { findMany: vi.fn(), findFirst: vi.fn() },
    entry: { findMany: vi.fn() },
  },
}));

vi.mock("@/services/entitlements.service", () => ({
  entitlementsService: { isPremium: vi.fn() },
}));

vi.mock("@/lib/serialize", () => ({
  d: (v: unknown) => Number(v),
  dn: (v: unknown) => (v == null ? null : Number(v)),
}));

const txMock = {
  entry: { findFirst: vi.fn(), update: vi.fn() },
  entryHistory: { create: vi.fn(), findFirst: vi.fn(), delete: vi.fn(), updateMany: vi.fn() },
  dividend: { create: vi.fn(), update: vi.fn(), delete: vi.fn(), findFirst: vi.fn() },
  transaction: { create: vi.fn(), deleteMany: vi.fn() },
};

import { entitlementsService } from "../../services/entitlements.service";
import { dividendsService, PremiumRequiredError } from "../../services/dividends.service";

const USER_ID = "user_test123";
const STOCK = {
  id: "stock-1",
  userId: USER_ID,
  name: "台積電",
  subCategory: "台股",
  stockCode: "2330",
  topCategory: "投資",
  value: 100000,
};
const BANK = {
  id: "bank-1",
  userId: USER_ID,
  name: "國泰世華",
  subCategory: "金融卡",
  topCategory: "流動資金",
  value: 50000,
};

function dividendRow(over: Record<string, unknown> = {}) {
  return {
    id: "div-1",
    entryId: STOCK.id,
    userId: USER_ID,
    payDate: new Date("2026-08-13"),
    amount: 1200,
    perShare: null,
    shares: null,
    note: null,
    bankEntryId: null,
    bankHistoryId: null,
    transactionId: null,
    reinvestedAt: null,
    reinvestAmount: null,
    reinvestPrice: null,
    reinvestUnits: null,
    reinvestHistoryId: null,
    reinvestBankHistoryId: null,
    createdAt: new Date("2026-08-13"),
    ...over,
  };
}

describe("DividendsService.create", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(entitlementsService.isPremium).mockResolvedValue(true);
    txMock.entry.findFirst.mockImplementation(async ({ where }: { where: { id: string } }) =>
      where.id === STOCK.id ? STOCK : where.id === BANK.id ? BANK : null
    );
    txMock.entryHistory.create.mockResolvedValue({ id: "hist-1" });
    txMock.dividend.create.mockResolvedValue(dividendRow());
    txMock.dividend.update.mockResolvedValue(dividendRow());
    txMock.transaction.create.mockResolvedValue({ id: "tx-1" });
  });

  it("rejects a non-premium user before touching the database", async () => {
    vi.mocked(entitlementsService.isPremium).mockResolvedValue(false);
    await expect(
      dividendsService.create(
        { entryId: STOCK.id, payDate: "2026-08-13", amount: 1200, recordIncome: true },
        USER_ID
      )
    ).rejects.toBeInstanceOf(PremiumRequiredError);
    expect(txMock.dividend.create).not.toHaveBeenCalled();
  });

  it("writes no entry history when no bank account is given", async () => {
    await dividendsService.create(
      { entryId: STOCK.id, payDate: "2026-08-13", amount: 1200, recordIncome: false },
      USER_ID
    );
    expect(txMock.entryHistory.create).not.toHaveBeenCalled();
    expect(txMock.entry.update).not.toHaveBeenCalled();
  });

  it("credits the bank entry when a bank account is given", async () => {
    await dividendsService.create(
      {
        entryId: STOCK.id,
        payDate: "2026-08-13",
        amount: 1200,
        bankEntryId: BANK.id,
        recordIncome: false,
      },
      USER_ID
    );
    expect(txMock.entryHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ entryId: BANK.id, delta: 1200, balance: 51200 }),
    });
    expect(txMock.entry.update).toHaveBeenCalledWith({
      where: { id: BANK.id },
      data: { value: 51200 },
    });
  });

  it("records an income transaction when recordIncome is true", async () => {
    await dividendsService.create(
      { entryId: STOCK.id, payDate: "2026-08-13", amount: 1200, recordIncome: true },
      USER_ID
    );
    expect(txMock.transaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: USER_ID,
        type: "income",
        category: "股利",
        source: "台積電",
        amount: 1200,
      }),
    });
  });

  it("rejects a stock entry owned by someone else", async () => {
    txMock.entry.findFirst.mockResolvedValue(null);
    await expect(
      dividendsService.create(
        { entryId: "someone-else", payDate: "2026-08-13", amount: 1200, recordIncome: true },
        USER_ID
      )
    ).rejects.toThrow();
  });

  it("rejects a bank entry that is not 流動資金", async () => {
    txMock.entry.findFirst.mockImplementation(async ({ where }: { where: { id: string } }) =>
      where.id === STOCK.id ? STOCK : { ...BANK, topCategory: "投資" }
    );
    await expect(
      dividendsService.create(
        {
          entryId: STOCK.id,
          payDate: "2026-08-13",
          amount: 1200,
          bankEntryId: BANK.id,
          recordIncome: false,
        },
        USER_ID
      )
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `pnpm --filter @repo/web exec vitest run tests/services/dividends.service.test.ts`
Expected: FAIL —— `Failed to resolve import "../../services/dividends.service"`。

- [ ] **Step 3: 實作 service 的 create 與 list**

Create `apps/web/services/dividends.service.ts`：

```ts
import type { Prisma } from "@prisma/client";
import type { CreateDividend } from "@repo/shared";
import { prisma } from "@/lib/prisma";
import { d, dn } from "@/lib/serialize";
import { entitlementsService } from "@/services/entitlements.service";

// 與 insurance.service.ts 同名同義：route 會把它映成 403 PREMIUM_REQUIRED。
export class PremiumRequiredError extends Error {
  constructor() {
    super("Premium subscription required");
    this.name = "PremiumRequiredError";
  }
}

export class NotFoundError extends Error {
  constructor(message = "Not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

const STOCK_CATS = ["台股", "美股", "加密貨幣", "貴金屬"];
const CASH_TOP_CATEGORY = "流動資金";

type Tx = Prisma.TransactionClient;

function serializeDividend(row: {
  id: string;
  entryId: string;
  payDate: Date;
  amount: Prisma.Decimal;
  perShare: Prisma.Decimal | null;
  shares: Prisma.Decimal | null;
  note: string | null;
  bankEntryId: string | null;
  reinvestedAt: Date | null;
  reinvestAmount: Prisma.Decimal | null;
  reinvestPrice: Prisma.Decimal | null;
  reinvestUnits: Prisma.Decimal | null;
  createdAt: Date;
}) {
  return {
    id: row.id,
    entryId: row.entryId,
    payDate: row.payDate.toISOString(),
    amount: d(row.amount),
    perShare: dn(row.perShare),
    shares: dn(row.shares),
    note: row.note,
    bankEntryId: row.bankEntryId,
    reinvestedAt: row.reinvestedAt ? row.reinvestedAt.toISOString() : null,
    reinvestAmount: dn(row.reinvestAmount),
    reinvestPrice: dn(row.reinvestPrice),
    reinvestUnits: dn(row.reinvestUnits),
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * 寫一筆 EntryHistory 並把 Entry.value 移到新的 running balance，回傳 history id。
 * balance 的語意跟 entries.service.ts 一致：這一筆之後的餘額。
 */
async function postHistory(
  tx: Tx,
  entry: { id: string; value: Prisma.Decimal | number },
  delta: number,
  units: number | null,
  note: string | null
): Promise<string> {
  const balance = Number(entry.value) + delta;
  const row = await tx.entryHistory.create({
    data: { entryId: entry.id, delta, balance, units, note },
  });
  await tx.entry.update({ where: { id: entry.id }, data: { value: balance } });
  return row.id;
}

/** 擁有權 + 分類檢查合一。找不到或分類不符就丟，呼叫端不必各自判斷。 */
async function requireStockEntry(tx: Tx, entryId: string, userId: string) {
  const entry = await tx.entry.findFirst({ where: { id: entryId, userId } });
  if (!entry) throw new NotFoundError("股票項目不存在");
  if (!STOCK_CATS.includes(entry.subCategory) || !entry.stockCode) {
    throw new ConflictError("此項目不是股票，無法記錄股利");
  }
  return entry;
}

async function requireCashEntry(tx: Tx, entryId: string, userId: string) {
  const entry = await tx.entry.findFirst({ where: { id: entryId, userId } });
  if (!entry) throw new NotFoundError("入帳帳戶不存在");
  if (entry.topCategory !== CASH_TOP_CATEGORY) {
    throw new ConflictError("入帳帳戶必須是流動資金");
  }
  return entry;
}

export class DividendsService {
  async create(data: CreateDividend, userId: string) {
    if (!(await entitlementsService.isPremium(userId))) throw new PremiumRequiredError();

    return prisma.$transaction(async (tx) => {
      const stock = await requireStockEntry(tx, data.entryId, userId);

      let bankHistoryId: string | null = null;
      if (data.bankEntryId) {
        const bank = await requireCashEntry(tx, data.bankEntryId, userId);
        bankHistoryId = await postHistory(tx, bank, data.amount, null, `${stock.name} 股利`);
      }

      let transactionId: string | null = null;
      if (data.recordIncome) {
        const txRow = await tx.transaction.create({
          data: {
            userId,
            type: "income",
            amount: data.amount,
            category: "股利",
            source: stock.name,
            date: new Date(data.payDate),
            note: data.note ?? null,
          },
        });
        transactionId = txRow.id;
      }

      const row = await tx.dividend.create({
        data: {
          userId,
          entryId: data.entryId,
          payDate: new Date(data.payDate),
          amount: data.amount,
          perShare: data.perShare ?? null,
          shares: data.shares ?? null,
          note: data.note ?? null,
          bankEntryId: data.bankEntryId ?? null,
          bankHistoryId,
          transactionId,
        },
      });
      return serializeDividend(row);
    });
  }

  async list(userId: string, entryId?: string) {
    const rows = await prisma.dividend.findMany({
      where: { userId, ...(entryId ? { entryId } : {}) },
      orderBy: { payDate: "desc" },
    });
    return rows.map(serializeDividend);
  }
}

export const dividendsService = new DividendsService();
```

- [ ] **Step 4: 執行測試確認通過**

Run: `pnpm --filter @repo/web exec vitest run tests/services/dividends.service.test.ts`
Expected: 6 tests PASS。

- [ ] **Step 5: Commit**

```bash
git add apps/web/services/dividends.service.ts apps/web/tests/services/dividends.service.test.ts
git commit -m "feat: add dividend create and list service"
```

---

### Task 4: Service — 刪除與沖銷

**Files:**

- Modify: `apps/web/services/dividends.service.ts`
- Modify: `apps/web/tests/services/dividends.service.test.ts`

**Interfaces:**

- Consumes: Task 3 的 `postHistory`、`serializeDividend`、`NotFoundError`
- Produces:
  - 私有 `reverseHistory(tx, historyId): Promise<void>`
  - 私有 `unwind(tx, dividend): Promise<void>` —— 沖銷一筆 dividend 的所有 history 與 transaction
  - `dividendsService.delete(id: string, userId: string): Promise<void>`

- [ ] **Step 1: 寫失敗的測試**

附加到 `apps/web/tests/services/dividends.service.test.ts`：

```ts
describe("DividendsService.delete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    txMock.entryHistory.findFirst.mockImplementation(
      async ({
        where,
        orderBy,
      }: {
        where: { id?: string; entryId?: string };
        orderBy?: unknown;
      }) => {
        // 沖銷時先讀被刪的那一筆，再讀剩下的最後一筆來回推 Entry.value。
        if (where.id)
          return { id: where.id, entryId: BANK.id, delta: 1200, createdAt: new Date("2026-08-13") };
        if (orderBy)
          return {
            id: "hist-prev",
            entryId: BANK.id,
            delta: 0,
            balance: 50000,
            createdAt: new Date("2026-08-01"),
          };
        return null;
      }
    );
  });

  it("reverses the bank credit and deletes the income transaction", async () => {
    txMock.dividend.findFirst.mockResolvedValue(
      dividendRow({ bankEntryId: BANK.id, bankHistoryId: "hist-1", transactionId: "tx-1" })
    );

    await dividendsService.delete("div-1", USER_ID);

    expect(txMock.entryHistory.delete).toHaveBeenCalledWith({ where: { id: "hist-1" } });
    expect(txMock.entryHistory.updateMany).toHaveBeenCalledWith({
      where: { entryId: BANK.id, createdAt: { gt: new Date("2026-08-13") } },
      data: { balance: { increment: -1200 } },
    });
    expect(txMock.entry.update).toHaveBeenCalledWith({
      where: { id: BANK.id },
      data: { value: 50000 },
    });
    expect(txMock.transaction.deleteMany).toHaveBeenCalledWith({
      where: { id: "tx-1", userId: USER_ID },
    });
    expect(txMock.dividend.delete).toHaveBeenCalledWith({ where: { id: "div-1" } });
  });

  it("reverses both legs of a reinvested dividend", async () => {
    txMock.dividend.findFirst.mockResolvedValue(
      dividendRow({
        bankEntryId: BANK.id,
        bankHistoryId: "hist-1",
        reinvestedAt: new Date("2026-08-14"),
        reinvestHistoryId: "hist-stock",
        reinvestBankHistoryId: "hist-bank-debit",
      })
    );

    await dividendsService.delete("div-1", USER_ID);

    const deletedIds = txMock.entryHistory.delete.mock.calls.map((c) => c[0].where.id);
    expect(deletedIds).toEqual(expect.arrayContaining(["hist-1", "hist-stock", "hist-bank-debit"]));
  });

  it("throws NotFoundError for another user's dividend", async () => {
    txMock.dividend.findFirst.mockResolvedValue(null);
    await expect(dividendsService.delete("div-1", USER_ID)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("sets the entry value to 0 when no history remains", async () => {
    txMock.dividend.findFirst.mockResolvedValue(
      dividendRow({ bankEntryId: BANK.id, bankHistoryId: "hist-1" })
    );
    txMock.entryHistory.findFirst.mockImplementation(
      async ({ where, orderBy }: { where: { id?: string }; orderBy?: unknown }) => {
        if (where.id)
          return { id: "hist-1", entryId: BANK.id, delta: 1200, createdAt: new Date("2026-08-13") };
        if (orderBy) return null;
        return null;
      }
    );

    await dividendsService.delete("div-1", USER_ID);

    expect(txMock.entry.update).toHaveBeenCalledWith({
      where: { id: BANK.id },
      data: { value: 0 },
    });
  });
});
```

同時把 test 檔頂端的 import 補上 `NotFoundError`：

```ts
import {
  dividendsService,
  PremiumRequiredError,
  NotFoundError,
} from "../../services/dividends.service";
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `pnpm --filter @repo/web exec vitest run tests/services/dividends.service.test.ts`
Expected: FAIL —— `dividendsService.delete is not a function`。

- [ ] **Step 3: 實作 reverseHistory / unwind / delete**

在 `apps/web/services/dividends.service.ts` 的 `requireCashEntry` 之後插入兩個 helper：

```ts
/**
 * 刪掉一筆 EntryHistory 並把帳修回去。規則完全照 entries.service.ts 的
 * deleteHistory：後續 history 的 running balance 一起位移，Entry.value 由
 * 剩下的最後一筆 balance 回推（一筆都不剩時歸 0）。
 */
async function reverseHistory(tx: Tx, historyId: string): Promise<void> {
  const existing = await tx.entryHistory.findFirst({ where: { id: historyId } });
  if (!existing) return;
  const delta = Number(existing.delta);

  await tx.entryHistory.delete({ where: { id: historyId } });

  await tx.entryHistory.updateMany({
    where: { entryId: existing.entryId, createdAt: { gt: existing.createdAt } },
    data: { balance: { increment: -delta } },
  });

  const last = await tx.entryHistory.findFirst({
    where: { entryId: existing.entryId },
    orderBy: { createdAt: "desc" },
  });
  await tx.entry.update({
    where: { id: existing.entryId },
    data: { value: last ? Number(last.balance) : 0 },
  });
}

/**
 * 把一筆 dividend 造成的所有帳面影響沖掉（history 與收入 transaction），但不刪
 * dividend 本身 —— delete 會刪掉它，update 會接著重放。
 *
 * 沖銷順序是「後寫的先沖」：再投資的兩筆晚於入帳那筆，先沖它們才能讓
 * reverseHistory 的 balance 位移落在正確的區間上。
 */
async function unwind(
  tx: Tx,
  dividend: {
    id: string;
    userId: string;
    bankHistoryId: string | null;
    transactionId: string | null;
    reinvestHistoryId: string | null;
    reinvestBankHistoryId: string | null;
  }
): Promise<void> {
  if (dividend.reinvestHistoryId) await reverseHistory(tx, dividend.reinvestHistoryId);
  if (dividend.reinvestBankHistoryId) await reverseHistory(tx, dividend.reinvestBankHistoryId);
  if (dividend.bankHistoryId) await reverseHistory(tx, dividend.bankHistoryId);
  if (dividend.transactionId) {
    await tx.transaction.deleteMany({
      where: { id: dividend.transactionId, userId: dividend.userId },
    });
  }
}
```

在 `DividendsService` class 內加入方法：

```ts
  async delete(id: string, userId: string) {
    await prisma.$transaction(async (tx) => {
      const dividend = await tx.dividend.findFirst({ where: { id, userId } });
      if (!dividend) throw new NotFoundError("股利紀錄不存在");
      await unwind(tx, dividend);
      await tx.dividend.delete({ where: { id } });
    });
  }
```

- [ ] **Step 4: 執行測試確認通過**

Run: `pnpm --filter @repo/web exec vitest run tests/services/dividends.service.test.ts`
Expected: 10 tests PASS。

- [ ] **Step 5: Commit**

```bash
git add apps/web/services/dividends.service.ts apps/web/tests/services/dividends.service.test.ts
git commit -m "feat: add dividend delete with history reversal"
```

---

### Task 5: Service — 一鍵再投資

**Files:**

- Modify: `apps/web/services/dividends.service.ts`
- Modify: `apps/web/tests/services/dividends.service.test.ts`

**Interfaces:**

- Consumes: Task 3 的 `postHistory` / `requireStockEntry`、Task 4 的 `NotFoundError` / `ConflictError`
- Produces: `dividendsService.reinvest(id: string, data: ReinvestDividend, userId: string): Promise<SerializedDividend>`

- [ ] **Step 1: 寫失敗的測試**

附加到 `apps/web/tests/services/dividends.service.test.ts`：

```ts
describe("DividendsService.reinvest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(entitlementsService.isPremium).mockResolvedValue(true);
    txMock.entry.findFirst.mockImplementation(async ({ where }: { where: { id: string } }) =>
      where.id === STOCK.id ? STOCK : where.id === BANK.id ? BANK : null
    );
    txMock.entryHistory.create.mockResolvedValue({ id: "hist-new" });
    txMock.dividend.update.mockResolvedValue(
      dividendRow({
        reinvestedAt: new Date("2026-08-14"),
        reinvestAmount: 1200,
        reinvestPrice: 600,
        reinvestUnits: 2,
      })
    );
  });

  it("debits the bank and credits the stock with derived units", async () => {
    txMock.dividend.findFirst.mockResolvedValue(
      dividendRow({ bankEntryId: BANK.id, bankHistoryId: "hist-1" })
    );

    await dividendsService.reinvest("div-1", { amount: 1200, price: 600 }, USER_ID);

    expect(txMock.entryHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ entryId: BANK.id, delta: -1200, balance: 48800 }),
    });
    expect(txMock.entryHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ entryId: STOCK.id, delta: 1200, units: 2, balance: 101200 }),
    });
  });

  it("skips the bank leg when the dividend has no bank account", async () => {
    txMock.dividend.findFirst.mockResolvedValue(dividendRow());

    await dividendsService.reinvest("div-1", { amount: 1200, price: 600 }, USER_ID);

    const entryIds = txMock.entryHistory.create.mock.calls.map((c) => c[0].data.entryId);
    expect(entryIds).toEqual([STOCK.id]);
  });

  it("rejects reinvesting the same dividend twice", async () => {
    txMock.dividend.findFirst.mockResolvedValue(
      dividendRow({ reinvestedAt: new Date("2026-08-14") })
    );

    await expect(
      dividendsService.reinvest("div-1", { amount: 1200, price: 600 }, USER_ID)
    ).rejects.toBeInstanceOf(ConflictError);
    expect(txMock.entryHistory.create).not.toHaveBeenCalled();
  });

  it("rejects an amount larger than the dividend", async () => {
    txMock.dividend.findFirst.mockResolvedValue(dividendRow());

    await expect(
      dividendsService.reinvest("div-1", { amount: 5000, price: 600 }, USER_ID)
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("rejects a non-premium user", async () => {
    vi.mocked(entitlementsService.isPremium).mockResolvedValue(false);
    await expect(
      dividendsService.reinvest("div-1", { amount: 1200, price: 600 }, USER_ID)
    ).rejects.toBeInstanceOf(PremiumRequiredError);
  });
});
```

把 test 檔頂端的 import 補上 `ConflictError`：

```ts
import {
  dividendsService,
  PremiumRequiredError,
  NotFoundError,
  ConflictError,
} from "../../services/dividends.service";
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `pnpm --filter @repo/web exec vitest run tests/services/dividends.service.test.ts`
Expected: FAIL —— `dividendsService.reinvest is not a function`。

- [ ] **Step 3: 實作 reinvest**

先在檔案頂端的 type import 加上 `ReinvestDividend`：

```ts
import type { CreateDividend, ReinvestDividend } from "@repo/shared";
```

在 `DividendsService` class 內加入：

```ts
  async reinvest(id: string, data: ReinvestDividend, userId: string) {
    if (!(await entitlementsService.isPremium(userId))) throw new PremiumRequiredError();

    return prisma.$transaction(async (tx) => {
      const dividend = await tx.dividend.findFirst({ where: { id, userId } });
      if (!dividend) throw new NotFoundError("股利紀錄不存在");
      if (dividend.reinvestedAt) throw new ConflictError("這筆股利已經再投資過了");
      if (data.amount > Number(dividend.amount)) {
        throw new ConflictError("再投資金額不可超過股利金額");
      }

      const stock = await requireStockEntry(tx, dividend.entryId, userId);
      const units = data.amount / data.price;

      // 銀行端先扣：錢要先離開帳戶才進股票，兩筆 history 的時序才讀得懂。
      // 沒有入帳帳戶的股利代表這筆錢從未進入帳面，自然無從扣除。
      let reinvestBankHistoryId: string | null = null;
      if (dividend.bankEntryId) {
        const bank = await requireCashEntry(tx, dividend.bankEntryId, userId);
        reinvestBankHistoryId = await postHistory(
          tx,
          bank,
          -data.amount,
          null,
          `${stock.name} 股利再投資`
        );
      }

      const reinvestHistoryId = await postHistory(
        tx,
        stock,
        data.amount,
        units,
        "股利再投資"
      );

      const row = await tx.dividend.update({
        where: { id },
        data: {
          reinvestedAt: new Date(),
          reinvestAmount: data.amount,
          reinvestPrice: data.price,
          reinvestUnits: units,
          reinvestHistoryId,
          reinvestBankHistoryId,
        },
      });
      return serializeDividend(row);
    });
  }
```

- [ ] **Step 4: 執行測試確認通過**

Run: `pnpm --filter @repo/web exec vitest run tests/services/dividends.service.test.ts`
Expected: 15 tests PASS。

- [ ] **Step 5: Commit**

```bash
git add apps/web/services/dividends.service.ts apps/web/tests/services/dividends.service.test.ts
git commit -m "feat: add dividend reinvest service"
```

---

### Task 6: Service — 修改（沖銷後重放）

**Files:**

- Modify: `apps/web/services/dividends.service.ts`
- Modify: `apps/web/tests/services/dividends.service.test.ts`

**Interfaces:**

- Consumes: Task 4 的 `unwind`、Task 3 的 `postHistory` / `requireCashEntry` / `requireStockEntry`
- Produces: `dividendsService.update(id: string, data: UpdateDividend, userId: string): Promise<SerializedDividend>`

- [ ] **Step 1: 寫失敗的測試**

附加到 `apps/web/tests/services/dividends.service.test.ts`：

```ts
describe("DividendsService.update", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(entitlementsService.isPremium).mockResolvedValue(true);
    txMock.entry.findFirst.mockImplementation(async ({ where }: { where: { id: string } }) =>
      where.id === STOCK.id ? STOCK : where.id === BANK.id ? BANK : null
    );
    txMock.entryHistory.create.mockResolvedValue({ id: "hist-new" });
    txMock.entryHistory.findFirst.mockImplementation(
      async ({ where, orderBy }: { where: { id?: string }; orderBy?: unknown }) => {
        if (where.id)
          return { id: where.id, entryId: BANK.id, delta: 1200, createdAt: new Date("2026-08-13") };
        if (orderBy)
          return {
            id: "hist-prev",
            entryId: BANK.id,
            delta: 0,
            balance: 50000,
            createdAt: new Date("2026-08-01"),
          };
        return null;
      }
    );
    txMock.dividend.update.mockResolvedValue(dividendRow({ amount: 2000 }));
  });

  it("unwinds the old posting and replays the new amount", async () => {
    txMock.dividend.findFirst.mockResolvedValue(
      dividendRow({ bankEntryId: BANK.id, bankHistoryId: "hist-1", transactionId: "tx-1" })
    );

    await dividendsService.update("div-1", { amount: 2000 }, USER_ID);

    expect(txMock.entryHistory.delete).toHaveBeenCalledWith({ where: { id: "hist-1" } });
    expect(txMock.transaction.deleteMany).toHaveBeenCalledWith({
      where: { id: "tx-1", userId: USER_ID },
    });
    expect(txMock.entryHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ entryId: BANK.id, delta: 2000 }),
    });
  });

  it("refuses to change the amount of a reinvested dividend", async () => {
    txMock.dividend.findFirst.mockResolvedValue(
      dividendRow({ reinvestedAt: new Date("2026-08-14") })
    );

    await expect(
      dividendsService.update("div-1", { amount: 2000 }, USER_ID)
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("clears the bank posting when bankEntryId is set to null", async () => {
    txMock.dividend.findFirst.mockResolvedValue(
      dividendRow({ bankEntryId: BANK.id, bankHistoryId: "hist-1" })
    );

    await dividendsService.update("div-1", { bankEntryId: null }, USER_ID);

    expect(txMock.entryHistory.delete).toHaveBeenCalledWith({ where: { id: "hist-1" } });
    expect(txMock.entryHistory.create).not.toHaveBeenCalled();
    expect(txMock.dividend.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ bankEntryId: null, bankHistoryId: null }),
      })
    );
  });

  it("throws NotFoundError for another user's dividend", async () => {
    txMock.dividend.findFirst.mockResolvedValue(null);
    await expect(dividendsService.update("div-1", { amount: 1 }, USER_ID)).rejects.toBeInstanceOf(
      NotFoundError
    );
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `pnpm --filter @repo/web exec vitest run tests/services/dividends.service.test.ts`
Expected: FAIL —— `dividendsService.update is not a function`。

- [ ] **Step 3: 實作 update**

先在檔案頂端的 type import 加上 `UpdateDividend`：

```ts
import type { CreateDividend, ReinvestDividend, UpdateDividend } from "@repo/shared";
```

在 `DividendsService` class 內加入：

```ts
  /**
   * 先完整沖銷再重放，而不是就地調整差額。就地調整在「換了入帳帳戶」時會把
   * 差額記到錯的帳上；沖銷重放只有一套規則，也就只有一處會錯。
   *
   * 已再投資的股利不能改金額 —— 再投資是另一筆既成事實，改了會讓兩者對不上。
   * 要改就整筆刪掉重建。
   */
  async update(id: string, data: UpdateDividend, userId: string) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.dividend.findFirst({ where: { id, userId } });
      if (!existing) throw new NotFoundError("股利紀錄不存在");
      if (existing.reinvestedAt && data.amount !== undefined) {
        throw new ConflictError("已再投資的股利不可修改金額，請刪除後重新建立");
      }

      const stock = await requireStockEntry(tx, existing.entryId, userId);

      const amount = data.amount ?? Number(existing.amount);
      const payDate = data.payDate ? new Date(data.payDate) : existing.payDate;
      const note = data.note === undefined ? existing.note : data.note;
      const bankEntryId =
        data.bankEntryId === undefined ? existing.bankEntryId : data.bankEntryId;
      const hadIncome = existing.transactionId !== null;

      await unwind(tx, existing);

      let bankHistoryId: string | null = null;
      if (bankEntryId) {
        const bank = await requireCashEntry(tx, bankEntryId, userId);
        bankHistoryId = await postHistory(tx, bank, amount, null, `${stock.name} 股利`);
      }

      let transactionId: string | null = null;
      if (hadIncome) {
        const txRow = await tx.transaction.create({
          data: {
            userId,
            type: "income",
            amount,
            category: "股利",
            source: stock.name,
            date: payDate,
            note: note ?? null,
          },
        });
        transactionId = txRow.id;
      }

      // 沖銷把再投資那兩筆也刪掉了，所以 reinvest* 一併歸零 —— 使用者要重新
      // 按一次再投資。這是刻意的：金額或帳戶變了，舊的再投資已不成立。
      const row = await tx.dividend.update({
        where: { id },
        data: {
          payDate,
          amount,
          note: note ?? null,
          bankEntryId,
          bankHistoryId,
          transactionId,
          reinvestedAt: null,
          reinvestAmount: null,
          reinvestPrice: null,
          reinvestUnits: null,
          reinvestHistoryId: null,
          reinvestBankHistoryId: null,
        },
      });
      return serializeDividend(row);
    });
  }
```

- [ ] **Step 4: 執行測試確認通過**

Run: `pnpm --filter @repo/web exec vitest run tests/services/dividends.service.test.ts`
Expected: 19 tests PASS。

- [ ] **Step 5: Commit**

```bash
git add apps/web/services/dividends.service.ts apps/web/tests/services/dividends.service.test.ts
git commit -m "feat: add dividend update with unwind and replay"
```

---

### Task 7: Service — summary 彙總

**Files:**

- Modify: `apps/web/services/dividends.service.ts`
- Modify: `apps/web/tests/services/dividends.service.test.ts`

**Interfaces:**

- Consumes: `prisma.dividend.findMany`、`prisma.entry.findMany`
- Produces: `dividendsService.summary(userId: string): Promise<DividendSummary>`（形狀見 Task 2 的 `DividendSummarySchema`）

- [ ] **Step 1: 寫失敗的測試**

附加到 `apps/web/tests/services/dividends.service.test.ts`：

```ts
describe("DividendsService.summary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("totals all-time and this-year dividends per entry with yield on cost", async () => {
    const thisYear = new Date().getFullYear();
    vi.mocked(prisma.dividend.findMany).mockResolvedValue([
      { entryId: STOCK.id, amount: 1000, payDate: new Date(`${thisYear}-03-01`) },
      { entryId: STOCK.id, amount: 500, payDate: new Date(`${thisYear - 2}-03-01`) },
    ] as never);
    vi.mocked(prisma.entry.findMany).mockResolvedValue([
      {
        id: STOCK.id,
        name: "台積電",
        stockCode: "2330",
        subCategory: "台股",
        history: [{ delta: 100000 }],
      },
    ] as never);

    const result = await dividendsService.summary(USER_ID);

    expect(result.totalAllTime).toBe(1500);
    expect(result.totalThisYear).toBe(1000);
    expect(result.byEntry).toHaveLength(1);
    expect(result.byEntry[0]).toMatchObject({
      entryId: STOCK.id,
      name: "台積電",
      totalAllTime: 1500,
      totalThisYear: 1000,
      costBasis: 100000,
      yieldOnCost: 1,
    });
  });

  it("returns null yield when cost basis is zero", async () => {
    vi.mocked(prisma.dividend.findMany).mockResolvedValue([
      { entryId: STOCK.id, amount: 100, payDate: new Date() },
    ] as never);
    vi.mocked(prisma.entry.findMany).mockResolvedValue([
      {
        id: STOCK.id,
        name: "台積電",
        stockCode: "2330",
        subCategory: "台股",
        history: [{ delta: 0 }],
      },
    ] as never);

    const result = await dividendsService.summary(USER_ID);

    expect(result.byEntry[0].yieldOnCost).toBeNull();
  });

  it("returns zeroes when the user has no dividends", async () => {
    vi.mocked(prisma.dividend.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.entry.findMany).mockResolvedValue([] as never);

    const result = await dividendsService.summary(USER_ID);

    expect(result).toEqual({ totalAllTime: 0, totalThisYear: 0, byEntry: [] });
  });
});
```

同時把 test 檔頂端的 import 補上 `prisma`（沖銷測試只用 txMock，summary 走的是 `prisma` 本身）：

```ts
import { prisma } from "@/lib/prisma";
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `pnpm --filter @repo/web exec vitest run tests/services/dividends.service.test.ts`
Expected: FAIL —— `dividendsService.summary is not a function`。

- [ ] **Step 3: 實作 summary**

在 `DividendsService` class 內加入：

```ts
  /**
   * yieldOnCost 用「本年度股利 ÷ 累計成本」。costBasis 是該 entry 所有
   * EntryHistory.delta 之和，因此包含再投資產生的成本 —— 再投資確實增加了成本
   * 基礎，殖利率隨之略降是正確的，不是 bug。
   */
  async summary(userId: string) {
    const currentYear = new Date().getFullYear();

    const [dividends, entries] = await Promise.all([
      prisma.dividend.findMany({
        where: { userId },
        select: { entryId: true, amount: true, payDate: true },
      }),
      prisma.entry.findMany({
        where: { userId, subCategory: { in: STOCK_CATS } },
        select: {
          id: true,
          name: true,
          stockCode: true,
          subCategory: true,
          history: { select: { delta: true } },
        },
      }),
    ]);

    const perEntry = new Map<string, { allTime: number; thisYear: number }>();
    let totalAllTime = 0;
    let totalThisYear = 0;

    for (const row of dividends) {
      const amount = Number(row.amount);
      const isThisYear = row.payDate.getFullYear() === currentYear;
      totalAllTime += amount;
      if (isThisYear) totalThisYear += amount;

      const acc = perEntry.get(row.entryId) ?? { allTime: 0, thisYear: 0 };
      acc.allTime += amount;
      if (isThisYear) acc.thisYear += amount;
      perEntry.set(row.entryId, acc);
    }

    const byEntry = entries
      .filter((e) => perEntry.has(e.id))
      .map((e) => {
        const acc = perEntry.get(e.id)!;
        const costBasis = e.history.reduce((s, h) => s + Number(h.delta), 0);
        return {
          entryId: e.id,
          name: e.name,
          stockCode: e.stockCode,
          subCategory: e.subCategory,
          totalAllTime: acc.allTime,
          totalThisYear: acc.thisYear,
          costBasis,
          yieldOnCost: costBasis > 0 ? acc.thisYear / costBasis : null,
        };
      })
      .sort((a, b) => b.totalAllTime - a.totalAllTime);

    return { totalAllTime, totalThisYear, byEntry };
  }
```

- [ ] **Step 4: 執行測試確認通過**

Run: `pnpm --filter @repo/web exec vitest run tests/services/dividends.service.test.ts`
Expected: 22 tests PASS。

- [ ] **Step 5: Commit**

```bash
git add apps/web/services/dividends.service.ts apps/web/tests/services/dividends.service.test.ts
git commit -m "feat: add dividend summary service"
```

---

### Task 8: Route Handlers — `/api/dividends` 與 `/api/dividends/summary`

**Files:**

- Create: `apps/web/app/api/dividends/route.ts`
- Create: `apps/web/app/api/dividends/summary/route.ts`
- Create: `apps/web/tests/api/dividends.route.test.ts`

**Interfaces:**

- Consumes: `dividendsService`、`PremiumRequiredError` / `NotFoundError` / `ConflictError`、`CreateDividendSchema`、`ok`/`err`/`handleError`、`logSecurityEvent`
- Produces: `GET`/`POST` handlers；錯誤映射表（下面 Task 9 的 route 會重用同一套映射）

- [ ] **Step 1: 寫失敗的測試**

Create `apps/web/tests/api/dividends.route.test.ts`：

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));
vi.mock("@/services/dividends.service", async () => {
  const actual = await vi.importActual<typeof import("../../services/dividends.service")>(
    "../../services/dividends.service"
  );
  return {
    ...actual,
    dividendsService: { list: vi.fn(), create: vi.fn(), summary: vi.fn() },
  };
});
vi.mock("@/lib/security-log", () => ({ logSecurityEvent: vi.fn() }));

import { auth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { dividendsService, PremiumRequiredError } from "../../services/dividends.service";
import { GET, POST } from "../../app/api/dividends/route";

const USER_ID = "user_test123";

function postReq(body: unknown) {
  return new NextRequest("http://localhost/api/dividends", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("/api/dividends", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ userId: USER_ID } as never);
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as never);
    const res = await GET(new NextRequest("http://localhost/api/dividends"));
    expect(res.status).toBe(401);
  });

  it("returns 403 PREMIUM_REQUIRED for a free user", async () => {
    vi.mocked(dividendsService.create).mockRejectedValue(new PremiumRequiredError());
    const res = await POST(postReq({ entryId: "e1", payDate: "2026-08-13", amount: 100 }));
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("PREMIUM_REQUIRED");
  });

  it("returns 400 on invalid input", async () => {
    const res = await POST(postReq({ entryId: "e1", payDate: "2026-08-13", amount: -5 }));
    expect(res.status).toBe(400);
    expect(dividendsService.create).not.toHaveBeenCalled();
  });

  it("returns 201 with the created dividend", async () => {
    vi.mocked(dividendsService.create).mockResolvedValue({ id: "div-1" } as never);
    const res = await POST(postReq({ entryId: "e1", payDate: "2026-08-13", amount: 100 }));
    expect(res.status).toBe(201);
    expect((await res.json()).data.id).toBe("div-1");
  });

  it("passes entryId through to the service", async () => {
    vi.mocked(dividendsService.list).mockResolvedValue([] as never);
    await GET(new NextRequest("http://localhost/api/dividends?entryId=e1"));
    expect(dividendsService.list).toHaveBeenCalledWith(USER_ID, "e1");
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `pnpm --filter @repo/web exec vitest run tests/api/dividends.route.test.ts`
Expected: FAIL —— 無法解析 `../../app/api/dividends/route`。

- [ ] **Step 3: 實作 routes**

Create `apps/web/app/api/dividends/route.ts`：

```ts
import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { CreateDividendSchema } from "@repo/shared";
import {
  dividendsService,
  PremiumRequiredError,
  NotFoundError,
  ConflictError,
} from "@/services/dividends.service";
import { ok, err, handleError } from "@/lib/api-response";
import { logSecurityEvent } from "@/lib/security-log";

// 共用的 service 錯誤映射。routes 只做 HTTP 轉譯，判斷全在 service。
export function mapDividendError(e: unknown) {
  if (e instanceof PremiumRequiredError) {
    return err("PREMIUM_REQUIRED", "此功能需要 Premium 訂閱", 403);
  }
  if (e instanceof NotFoundError) return err("NOT_FOUND", e.message, 404);
  if (e instanceof ConflictError) return err("CONFLICT", e.message, 409);
  return handleError(e);
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      logSecurityEvent({ type: "auth_fail", resource: "/api/dividends" });
      return err("UNAUTHORIZED", "Authentication required", 401);
    }
    const entryId = req.nextUrl.searchParams.get("entryId") ?? undefined;
    return ok(await dividendsService.list(userId, entryId));
  } catch (e) {
    return mapDividendError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      logSecurityEvent({ type: "auth_fail", resource: "/api/dividends" });
      return err("UNAUTHORIZED", "Authentication required", 401);
    }
    const data = CreateDividendSchema.parse(await req.json());
    return ok(await dividendsService.create(data, userId), 201);
  } catch (e) {
    return mapDividendError(e);
  }
}
```

Create `apps/web/app/api/dividends/summary/route.ts`：

```ts
import { auth } from "@clerk/nextjs/server";
import { dividendsService } from "@/services/dividends.service";
import { ok, err, handleError } from "@/lib/api-response";
import { logSecurityEvent } from "@/lib/security-log";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      logSecurityEvent({ type: "auth_fail", resource: "/api/dividends/summary" });
      return err("UNAUTHORIZED", "Authentication required", 401);
    }
    return ok(await dividendsService.summary(userId));
  } catch (e) {
    return handleError(e);
  }
}
```

- [ ] **Step 4: 執行測試確認通過**

Run: `pnpm --filter @repo/web exec vitest run tests/api/dividends.route.test.ts`
Expected: 5 tests PASS。

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/api/dividends apps/web/tests/api/dividends.route.test.ts
git commit -m "feat: add dividends list and create endpoints"
```

---

### Task 9: Route Handlers — `[id]` 與 `[id]/reinvest`

**Files:**

- Create: `apps/web/app/api/dividends/[id]/route.ts`
- Create: `apps/web/app/api/dividends/[id]/reinvest/route.ts`
- Modify: `apps/web/tests/api/dividends.route.test.ts`

**Interfaces:**

- Consumes: Task 8 的 `mapDividendError`、`UpdateDividendSchema` / `ReinvestDividendSchema`
- Produces: `PATCH` / `DELETE` / `POST` handlers

- [ ] **Step 1: 寫失敗的測試**

附加到 `apps/web/tests/api/dividends.route.test.ts`（並把頂端的 service mock 補上三個方法）：

```ts
// 把檔案頂端的 dividendsService mock 改成：
//   dividendsService: { list: vi.fn(), create: vi.fn(), summary: vi.fn(),
//                       update: vi.fn(), delete: vi.fn(), reinvest: vi.fn() },

import { POST as reinvestPOST } from "../../app/api/dividends/[id]/reinvest/route";
import { DELETE, PATCH } from "../../app/api/dividends/[id]/route";
import { ConflictError, NotFoundError } from "../../services/dividends.service";

const params = { params: Promise.resolve({ id: "div-1" }) };

describe("/api/dividends/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ userId: USER_ID } as never);
  });

  it("returns 404 for another user's dividend", async () => {
    vi.mocked(dividendsService.delete).mockRejectedValue(new NotFoundError("股利紀錄不存在"));
    const res = await DELETE(new NextRequest("http://localhost/api/dividends/div-1"), params);
    expect(res.status).toBe(404);
  });

  it("returns 409 when changing the amount of a reinvested dividend", async () => {
    vi.mocked(dividendsService.update).mockRejectedValue(
      new ConflictError("已再投資的股利不可修改金額，請刪除後重新建立")
    );
    const res = await PATCH(
      new NextRequest("http://localhost/api/dividends/div-1", {
        method: "PATCH",
        body: JSON.stringify({ amount: 500 }),
        headers: { "Content-Type": "application/json" },
      }),
      params
    );
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("CONFLICT");
  });

  it("returns 200 on a successful reinvest", async () => {
    vi.mocked(dividendsService.reinvest).mockResolvedValue({
      id: "div-1",
      reinvestUnits: 2,
    } as never);
    const res = await reinvestPOST(
      new NextRequest("http://localhost/api/dividends/div-1/reinvest", {
        method: "POST",
        body: JSON.stringify({ amount: 1200, price: 600 }),
        headers: { "Content-Type": "application/json" },
      }),
      params
    );
    expect(res.status).toBe(200);
    expect((await res.json()).data.reinvestUnits).toBe(2);
  });

  it("returns 401 on reinvest when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as never);
    const res = await reinvestPOST(
      new NextRequest("http://localhost/api/dividends/div-1/reinvest", {
        method: "POST",
        body: JSON.stringify({ amount: 1200, price: 600 }),
        headers: { "Content-Type": "application/json" },
      }),
      params
    );
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `pnpm --filter @repo/web exec vitest run tests/api/dividends.route.test.ts`
Expected: FAIL —— 無法解析 `../../app/api/dividends/[id]/route`。

- [ ] **Step 3: 實作 routes**

Create `apps/web/app/api/dividends/[id]/route.ts`：

```ts
import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { UpdateDividendSchema } from "@repo/shared";
import { dividendsService } from "@/services/dividends.service";
import { mapDividendError } from "@/app/api/dividends/route";
import { ok, err } from "@/lib/api-response";
import { logSecurityEvent } from "@/lib/security-log";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const { userId } = await auth();
    if (!userId) {
      logSecurityEvent({ type: "auth_fail", resource: "/api/dividends/[id]" });
      return err("UNAUTHORIZED", "Authentication required", 401);
    }
    const { id } = await params;
    const data = UpdateDividendSchema.parse(await req.json());
    return ok(await dividendsService.update(id, data, userId));
  } catch (e) {
    return mapDividendError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const { userId } = await auth();
    if (!userId) {
      logSecurityEvent({ type: "auth_fail", resource: "/api/dividends/[id]" });
      return err("UNAUTHORIZED", "Authentication required", 401);
    }
    const { id } = await params;
    await dividendsService.delete(id, userId);
    return ok({ id });
  } catch (e) {
    return mapDividendError(e);
  }
}
```

Create `apps/web/app/api/dividends/[id]/reinvest/route.ts`：

```ts
import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ReinvestDividendSchema } from "@repo/shared";
import { dividendsService } from "@/services/dividends.service";
import { mapDividendError } from "@/app/api/dividends/route";
import { ok, err } from "@/lib/api-response";
import { logSecurityEvent } from "@/lib/security-log";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const { userId } = await auth();
    if (!userId) {
      logSecurityEvent({ type: "auth_fail", resource: "/api/dividends/[id]/reinvest" });
      return err("UNAUTHORIZED", "Authentication required", 401);
    }
    const { id } = await params;
    const data = ReinvestDividendSchema.parse(await req.json());
    return ok(await dividendsService.reinvest(id, data, userId));
  } catch (e) {
    return mapDividendError(e);
  }
}
```

- [ ] **Step 4: 執行測試確認通過並檢查型別**

Run: `pnpm --filter @repo/web exec vitest run tests/api/dividends.route.test.ts && pnpm type-check`
Expected: 9 tests PASS，type-check 通過。

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/api/dividends apps/web/tests/api/dividends.route.test.ts
git commit -m "feat: add dividend update delete and reinvest endpoints"
```

---

### Task 10: Mobile — `useFinanceActions` 的 dividend actions

**Files:**

- Modify: `apps/mobile/hooks/useFinanceActions.ts`

**Interfaces:**

- Consumes: `api` (`@/lib/api`)、`@repo/shared` 的 `Dividend` / `CreateDividend` / `UpdateDividend` / `ReinvestDividend` / `DividendSummary`
- Produces（都放進 hook 的 return 物件）:
  - `fetchDividends(entryId?: string): Promise<Dividend[]>`
  - `addDividend(data: CreateDividend): Promise<Dividend>`
  - `updateDividend(id: string, data: UpdateDividend): Promise<Dividend>`
  - `deleteDividend(id: string): Promise<void>`
  - `reinvestDividend(id: string, data: ReinvestDividend): Promise<Dividend>`
  - `fetchDividendSummary(): Promise<DividendSummary>`

- [ ] **Step 1: 加入 type imports**

在 `apps/mobile/hooks/useFinanceActions.ts` 頂端的 `import type { ... } from "@repo/shared"` 清單中加入：

```ts
  Dividend,
  CreateDividend,
  UpdateDividend,
  ReinvestDividend,
  DividendSummary,
```

- [ ] **Step 2: 實作 actions**

在 `fetchInsurances` 定義之後、`return {` 之前插入：

```ts
// 股利紀錄刻意不進 financeStore：跟保險模組一樣 on-demand 抓取。它會改動
// Entry.value（入帳與再投資都寫 EntryHistory），所以呼叫端在變更後要自己跑一次
// fetchAll() 讓 entry 值同步 —— 再多一份 store slice 只會多一處會走味的狀態。
const fetchDividends = useCallback(
  async (entryId?: string): Promise<Dividend[]> =>
    api.get<Dividend[]>(
      `/api/dividends${entryId ? `?entryId=${encodeURIComponent(entryId)}` : ""}`
    ),
  [api]
);

const addDividend = useCallback(
  async (data: CreateDividend): Promise<Dividend> => api.post<Dividend>("/api/dividends", data),
  [api]
);

const updateDividend = useCallback(
  async (id: string, data: UpdateDividend): Promise<Dividend> =>
    api.patch<Dividend>(`/api/dividends/${id}`, data),
  [api]
);

const deleteDividend = useCallback(
  async (id: string): Promise<void> => {
    await api.delete(`/api/dividends/${id}`);
  },
  [api]
);

const reinvestDividend = useCallback(
  async (id: string, data: ReinvestDividend): Promise<Dividend> =>
    api.post<Dividend>(`/api/dividends/${id}/reinvest`, data),
  [api]
);

const fetchDividendSummary = useCallback(
  async (): Promise<DividendSummary> => api.get<DividendSummary>("/api/dividends/summary"),
  [api]
);
```

- [ ] **Step 3: 加進 return 物件**

在 `return { ... }` 中，`fetchInsurances,` 之後加入：

```ts
    fetchDividends,
    addDividend,
    updateDividend,
    deleteDividend,
    reinvestDividend,
    fetchDividendSummary,
```

- [ ] **Step 4: 驗證型別與 lint**

Run: `pnpm type-check && pnpm lint`
Expected: 兩者都通過。

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/hooks/useFinanceActions.ts
git commit -m "feat: add dividend api actions to mobile"
```

---

### Task 11: Mobile — `DividendForm` 新增股利彈窗

**Files:**

- Create: `apps/mobile/components/DividendForm.tsx`

**Interfaces:**

- Consumes: Task 10 的 `addDividend`、`useIsPremium` (`@/hooks/useIsPremium`)、`useFinanceStore` (`@/store/financeStore`)、`useApi`
- Produces: 預設匯出 `DividendForm`，props：

```ts
interface DividendFormProps {
  visible: boolean;
  entryId: string;
  entryName: string;
  subCategory: string;
  stockCode: string;
  currentShares: number | null;
  onClose: () => void;
  onSaved: () => void; // 呼叫端負責在此重抓列表並跑 fetchAll()
}
```

- [ ] **Step 1: 建立元件骨架與 premium 攔截**

Create `apps/mobile/components/DividendForm.tsx`：

```tsx
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useApi } from "@/lib/api";
import { useFinanceActions } from "@/hooks/useFinanceActions";
import { useIsPremium } from "@/hooks/useIsPremium";
import { useFinanceStore } from "@/store/financeStore";
import { buildYfSymbol } from "@/lib/stockConstants";

interface DividendFormProps {
  visible: boolean;
  entryId: string;
  entryName: string;
  subCategory: string;
  stockCode: string;
  currentShares: number | null;
  onClose: () => void;
  onSaved: () => void;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function DividendForm({
  visible,
  entryId,
  entryName,
  subCategory,
  stockCode,
  currentShares,
  onClose,
  onSaved,
}: DividendFormProps) {
  const api = useApi();
  const router = useRouter();
  const { addDividend, fetchAll } = useFinanceActions();
  const { isPremium, loading: premiumLoading } = useIsPremium();

  // 入帳帳戶只能是流動資金。從 store 讀，不再打一次 API。
  const cashEntries = useFinanceStore((s) => s.entries.filter((e) => e.topCategory === "流動資金"));

  const [mode, setMode] = useState<"perShare" | "amount">("perShare");
  const [payDate, setPayDate] = useState(todayISO());
  const [perShareStr, setPerShareStr] = useState("");
  const [sharesStr, setSharesStr] = useState(currentShares != null ? String(currentShares) : "");
  const [amountStr, setAmountStr] = useState("");
  const [bankEntryId, setBankEntryId] = useState<string | null>(null);
  const [recordIncome, setRecordIncome] = useState(true);
  const [note, setNote] = useState("");
  const [fxRate, setFxRate] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isTWD = subCategory === "台股";

  // 非台股的 perShare 以報價幣別輸入，換算成 TWD 才送出（設計文件「幣別處理」）。
  useEffect(() => {
    if (!visible || isTWD) {
      setFxRate(1);
      return;
    }
    let active = true;
    (async () => {
      try {
        const r = await api.get<{ rate: number }>("/api/exchange-rate");
        if (active && typeof r?.rate === "number" && r.rate > 0) setFxRate(r.rate);
      } catch {
        // 抓不到匯率就維持 1，並在畫面上提示使用者改用「依總金額」輸入 TWD。
      }
    })();
    return () => {
      active = false;
    };
  }, [visible, isTWD, api]);

  // 每股股利預填。抓不到就留空，絕不阻擋輸入。
  useEffect(() => {
    if (!visible || perShareStr !== "") return;
    let active = true;
    (async () => {
      try {
        const symbol = buildYfSymbol(subCategory, stockCode);
        if (!symbol) return;
        const r = await api.get<{ dividendRate: number | null }>(
          `/api/stocks/dividend?symbol=${encodeURIComponent(symbol)}`
        );
        if (active && r?.dividendRate != null) setPerShareStr(String(r.dividendRate));
      } catch {
        // 預填只是方便，失敗不影響手動輸入。
      }
    })();
    return () => {
      active = false;
    };
  }, [visible, subCategory, stockCode, api, perShareStr]);

  const amountTWD = useMemo(() => {
    if (mode === "amount") return parseFloat(amountStr) || 0;
    const perShare = parseFloat(perShareStr) || 0;
    const shares = parseFloat(sharesStr) || 0;
    return perShare * shares * fxRate;
  }, [mode, amountStr, perShareStr, sharesStr, fxRate]);

  const promptPremiumUpgrade = () => {
    Alert.alert("股息紀錄是 Premium 功能", "升級 Premium 即可記錄股利並一鍵再投資。", [
      { text: "稍後再決定", style: "cancel" },
      { text: "解鎖 Premium", onPress: () => router.push("/paywall") },
    ]);
  };

  const handleSubmit = async () => {
    if (amountTWD <= 0) {
      setError("請輸入大於 0 的股利金額");
      return;
    }
    // 前端只是提前攔截讓 free 使用者立刻看到 paywall；後端才是權威。
    if (!premiumLoading && !isPremium) {
      promptPremiumUpgrade();
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await addDividend({
        entryId,
        payDate,
        amount: Math.round(amountTWD * 100) / 100,
        ...(mode === "perShare" && parseFloat(perShareStr) > 0
          ? { perShare: parseFloat(perShareStr) }
          : {}),
        ...(mode === "perShare" && parseFloat(sharesStr) > 0
          ? { shares: parseFloat(sharesStr) }
          : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
        ...(bankEntryId ? { bankEntryId } : {}),
        recordIncome,
      });
      // 入帳會改動 Entry.value，所以重抓一次讓首頁與詳情頁的金額同步。
      await fetchAll();
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "儲存失敗，請稍後再試");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.sheet}>
          <View style={s.handle} />
          <Text style={s.title}>新增股利 · {entryName}</Text>

          <ScrollView style={s.body}>
            <View style={s.segment}>
              {[
                { m: "perShare" as const, label: "依每股股利" },
                { m: "amount" as const, label: "依總金額" },
              ].map(({ m, label }) => (
                <Pressable
                  key={m}
                  onPress={() => setMode(m)}
                  style={[s.segmentBtn, mode === m && s.segmentBtnActive]}
                >
                  <Text style={[s.segmentText, mode === m && s.segmentTextActive]}>{label}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={s.label}>發放日</Text>
            <TextInput
              style={s.input}
              value={payDate}
              onChangeText={setPayDate}
              placeholder="YYYY-MM-DD"
              autoCorrect={false}
            />

            {mode === "perShare" ? (
              <>
                <Text style={s.label}>每股股利{isTWD ? "（TWD）" : "（報價幣別）"}</Text>
                <TextInput
                  style={s.input}
                  value={perShareStr}
                  onChangeText={setPerShareStr}
                  keyboardType="decimal-pad"
                  placeholder="例如 4.5"
                />
                <Text style={s.label}>股數</Text>
                <TextInput
                  style={s.input}
                  value={sharesStr}
                  onChangeText={setSharesStr}
                  keyboardType="decimal-pad"
                  placeholder="持股數"
                />
              </>
            ) : (
              <>
                <Text style={s.label}>總金額（TWD）</Text>
                <TextInput
                  style={s.input}
                  value={amountStr}
                  onChangeText={setAmountStr}
                  keyboardType="decimal-pad"
                  placeholder="實收總額"
                />
              </>
            )}

            <Text style={s.computed}>換算後入帳：NT$ {amountTWD.toLocaleString()}</Text>

            <Text style={s.label}>入帳帳戶</Text>
            <View style={s.bankList}>
              <Pressable
                onPress={() => setBankEntryId(null)}
                style={[s.bankChip, bankEntryId === null && s.bankChipActive]}
              >
                <Text style={s.bankChipText}>不記錄</Text>
              </Pressable>
              {cashEntries.map((e) => (
                <Pressable
                  key={e.id}
                  onPress={() => setBankEntryId(e.id)}
                  style={[s.bankChip, bankEntryId === e.id && s.bankChipActive]}
                >
                  <Text style={s.bankChipText}>{e.name}</Text>
                </Pressable>
              ))}
            </View>

            <View style={s.switchRow}>
              <Text style={s.label}>同步記為收入</Text>
              <Switch value={recordIncome} onValueChange={setRecordIncome} />
            </View>

            <Text style={s.label}>備註</Text>
            <TextInput style={s.input} value={note} onChangeText={setNote} placeholder="選填" />

            {error && <Text style={s.error}>{error}</Text>}
          </ScrollView>

          <View style={s.actions}>
            <Pressable onPress={onClose} style={[s.btn, s.btnGhost]}>
              <Text style={s.btnGhostText}>取消</Text>
            </Pressable>
            <Pressable
              onPress={handleSubmit}
              disabled={submitting}
              style={[s.btn, s.btnPrimary, submitting && s.btnDisabled]}
            >
              <Text style={s.btnPrimaryText}>{submitting ? "儲存中…" : "儲存"}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "88%",
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#d1d1d6",
    alignSelf: "center",
    marginTop: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1c1c1e",
    textAlign: "center",
    marginVertical: 14,
  },
  body: { paddingHorizontal: 20 },
  segment: {
    flexDirection: "row",
    backgroundColor: "#f2f2f7",
    borderRadius: 10,
    padding: 3,
    marginBottom: 16,
  },
  segmentBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center" },
  segmentBtnActive: { backgroundColor: "#fff" },
  segmentText: { fontSize: 13, color: "#8e8e93" },
  segmentTextActive: { color: "#1c1c1e", fontWeight: "600" },
  label: { fontSize: 13, color: "#8e8e93", marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: "#e5e5ea",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: "#1c1c1e",
  },
  computed: { fontSize: 14, fontWeight: "600", color: "#66788E", marginTop: 14 },
  bankList: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  bankChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: "#f2f2f7",
  },
  bankChipActive: { backgroundColor: "#66788E" },
  bankChipText: { fontSize: 13, color: "#1c1c1e" },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  error: { color: "#d93025", fontSize: 13, marginTop: 12 },
  actions: { flexDirection: "row", gap: 12, padding: 20 },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  btnGhost: { backgroundColor: "#f2f2f7" },
  btnGhostText: { fontSize: 15, color: "#1c1c1e" },
  btnPrimary: { backgroundColor: "#66788E" },
  btnPrimaryText: { fontSize: 15, color: "#fff", fontWeight: "600" },
  btnDisabled: { opacity: 0.5 },
});
```

- [ ] **Step 2: 確認 `/api/exchange-rate` 的回傳欄位名**

Run: `grep -n "rate" apps/web/app/api/exchange-rate/route.ts`
Expected: 看到實際的欄位名。**若不是 `rate`**，把 Step 1 中 `api.get<{ rate: number }>` 與 `r.rate` 改成實際欄位名。這是唯一需要現場核對的地方。

- [ ] **Step 3: 驗證型別與 lint**

Run: `pnpm type-check && pnpm lint`
Expected: 兩者都通過。

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/components/DividendForm.tsx
git commit -m "feat: add mobile dividend form"
```

---

### Task 12: Mobile — `ReinvestSheet` 再投資確認彈窗

**Files:**

- Create: `apps/mobile/components/ReinvestSheet.tsx`

**Interfaces:**

- Consumes: Task 10 的 `reinvestDividend` / `fetchAll`、`useIsPremium`、`useApi`、`buildYfSymbol`
- Produces: 預設匯出 `ReinvestSheet`，props：

```ts
interface ReinvestSheetProps {
  visible: boolean;
  dividendId: string;
  dividendAmount: number;
  entryName: string;
  subCategory: string;
  stockCode: string;
  bankName: string | null; // null 表示這筆股利沒有入帳帳戶
  onClose: () => void;
  onDone: () => void;
}
```

- [ ] **Step 1: 建立元件**

Create `apps/mobile/components/ReinvestSheet.tsx`：

```tsx
import { useEffect, useMemo, useState } from "react";
import { Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useApi } from "@/lib/api";
import { useFinanceActions } from "@/hooks/useFinanceActions";
import { useIsPremium } from "@/hooks/useIsPremium";
import { buildYfSymbol } from "@/lib/stockConstants";

interface ReinvestSheetProps {
  visible: boolean;
  dividendId: string;
  dividendAmount: number;
  entryName: string;
  subCategory: string;
  stockCode: string;
  bankName: string | null;
  onClose: () => void;
  onDone: () => void;
}

export default function ReinvestSheet({
  visible,
  dividendId,
  dividendAmount,
  entryName,
  subCategory,
  stockCode,
  bankName,
  onClose,
  onDone,
}: ReinvestSheetProps) {
  const api = useApi();
  const router = useRouter();
  const { reinvestDividend, fetchAll } = useFinanceActions();
  const { isPremium, loading: premiumLoading } = useIsPremium();

  const [amountStr, setAmountStr] = useState(String(dividendAmount));
  const [priceStr, setPriceStr] = useState("");
  const [priceLoading, setPriceLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setAmountStr(String(dividendAmount));
    setError(null);
  }, [visible, dividendAmount]);

  // 現價只是預填。台股報價本來就會有抓不到的情況 —— 那時把價格欄留空讓使用者
  // 手填，而不是讓整個再投資失敗。
  useEffect(() => {
    if (!visible) return;
    let active = true;
    setPriceLoading(true);
    (async () => {
      try {
        const symbol = buildYfSymbol(subCategory, stockCode);
        if (!symbol) return;
        const r = await api.get<{ price: number | null }>(
          `/api/stocks/price?symbol=${encodeURIComponent(symbol)}`
        );
        if (active && r?.price != null) setPriceStr(String(r.price));
      } catch {
        // 留空，使用者手填。
      } finally {
        if (active) setPriceLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [visible, subCategory, stockCode, api]);

  const amount = parseFloat(amountStr) || 0;
  const price = parseFloat(priceStr) || 0;
  const units = useMemo(() => (price > 0 ? amount / price : 0), [amount, price]);

  const handleSubmit = async () => {
    if (amount <= 0) return setError("請輸入大於 0 的再投資金額");
    if (amount > dividendAmount) return setError("再投資金額不可超過股利金額");
    if (price <= 0) return setError("請輸入價格（抓不到現價時可手動填入）");
    if (!premiumLoading && !isPremium) {
      Alert.alert("股息紀錄是 Premium 功能", "升級 Premium 即可一鍵再投資。", [
        { text: "稍後再決定", style: "cancel" },
        { text: "解鎖 Premium", onPress: () => router.push("/paywall") },
      ]);
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await reinvestDividend(dividendId, { amount, price });
      await fetchAll();
      onDone();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "再投資失敗，請稍後再試");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.sheet}>
          <View style={s.handle} />
          <Text style={s.title}>再投資 · {entryName}</Text>

          <View style={s.body}>
            <Text style={s.label}>再投資金額（TWD）</Text>
            <TextInput
              style={s.input}
              value={amountStr}
              onChangeText={setAmountStr}
              keyboardType="decimal-pad"
            />

            <Text style={s.label}>買入價格{priceLoading ? "（讀取現價中…）" : ""}</Text>
            <TextInput
              style={s.input}
              value={priceStr}
              onChangeText={setPriceStr}
              keyboardType="decimal-pad"
              placeholder="抓不到現價時請手動填入"
            />

            <View style={s.summary}>
              {bankName ? (
                <Text style={s.summaryLine}>
                  {bankName}　−NT$ {amount.toLocaleString()}
                </Text>
              ) : (
                <Text style={s.summaryMuted}>這筆股利未記錄入帳帳戶，不會扣款</Text>
              )}
              <Text style={s.summaryLine}>
                {entryName}　+NT$ {amount.toLocaleString()}
              </Text>
              <Text style={s.summaryLine}>增加　{units > 0 ? units.toFixed(4) : "—"} 股</Text>
            </View>

            {error && <Text style={s.error}>{error}</Text>}
          </View>

          <View style={s.actions}>
            <Pressable onPress={onClose} style={[s.btn, s.btnGhost]}>
              <Text style={s.btnGhostText}>取消</Text>
            </Pressable>
            <Pressable
              onPress={handleSubmit}
              disabled={submitting}
              style={[s.btn, s.btnPrimary, submitting && s.btnDisabled]}
            >
              <Text style={s.btnPrimaryText}>{submitting ? "處理中…" : "確認再投資"}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#d1d1d6",
    alignSelf: "center",
    marginTop: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1c1c1e",
    textAlign: "center",
    marginVertical: 14,
  },
  body: { paddingHorizontal: 20 },
  label: { fontSize: 13, color: "#8e8e93", marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: "#e5e5ea",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: "#1c1c1e",
  },
  summary: { backgroundColor: "#f2f2f7", borderRadius: 12, padding: 14, marginTop: 18, gap: 6 },
  summaryLine: { fontSize: 14, color: "#1c1c1e" },
  summaryMuted: { fontSize: 13, color: "#8e8e93" },
  error: { color: "#d93025", fontSize: 13, marginTop: 12 },
  actions: { flexDirection: "row", gap: 12, padding: 20 },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  btnGhost: { backgroundColor: "#f2f2f7" },
  btnGhostText: { fontSize: 15, color: "#1c1c1e" },
  btnPrimary: { backgroundColor: "#66788E" },
  btnPrimaryText: { fontSize: 15, color: "#fff", fontWeight: "600" },
  btnDisabled: { opacity: 0.5 },
});
```

- [ ] **Step 2: 確認 `/api/stocks/price` 的回傳欄位名**

Run: `grep -n "price\|NextResponse.json" apps/web/app/api/stocks/price/route.ts | head -20`
Expected: 看到實際的欄位名。**若不是 `price`**，把 Step 1 中 `api.get<{ price: number | null }>` 與 `r.price` 改成實際欄位名。

- [ ] **Step 3: 驗證型別與 lint**

Run: `pnpm type-check && pnpm lint`
Expected: 兩者都通過。

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/components/ReinvestSheet.tsx
git commit -m "feat: add mobile reinvest confirmation sheet"
```

---

### Task 13: Mobile — `DividendSection` 並掛進 entry 詳情頁

**Files:**

- Create: `apps/mobile/components/DividendSection.tsx`
- Modify: `apps/mobile/app/(app)/entry/[id].tsx`

**Interfaces:**

- Consumes: Task 10 的 `fetchDividends` / `deleteDividend` / `fetchAll`、Task 11 的 `DividendForm`、Task 12 的 `ReinvestSheet`
- Produces: 預設匯出 `DividendSection`，props：

```ts
interface DividendSectionProps {
  entryId: string;
  entryName: string;
  subCategory: string;
  stockCode: string;
  currentShares: number | null;
  costBasis: number; // 用來算對成本的殖利率
}
```

- [ ] **Step 1: 建立 `DividendSection`**

Create `apps/mobile/components/DividendSection.tsx`：

```tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import type { Dividend } from "@repo/shared";
import { useFinanceActions } from "@/hooks/useFinanceActions";
import { useFinanceStore } from "@/store/financeStore";
import DividendForm from "@/components/DividendForm";
import ReinvestSheet from "@/components/ReinvestSheet";

interface DividendSectionProps {
  entryId: string;
  entryName: string;
  subCategory: string;
  stockCode: string;
  currentShares: number | null;
  costBasis: number;
}

export default function DividendSection({
  entryId,
  entryName,
  subCategory,
  stockCode,
  currentShares,
  costBasis,
}: DividendSectionProps) {
  const { fetchDividends, deleteDividend, fetchAll } = useFinanceActions();
  const entries = useFinanceStore((s) => s.entries);

  const [rows, setRows] = useState<Dividend[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [reinvestTarget, setReinvestTarget] = useState<Dividend | null>(null);

  const load = useCallback(async () => {
    try {
      setRows(await fetchDividends(entryId));
    } catch {
      // 讀取失敗就維持現有列表 —— 這是輔助資訊，不該讓詳情頁整頁失敗。
    }
  }, [fetchDividends, entryId]);

  useEffect(() => {
    void load();
  }, [load]);

  const total = useMemo(() => rows.reduce((s, r) => s + r.amount, 0), [rows]);
  const yieldOnCost = costBasis > 0 ? (total / costBasis) * 100 : null;

  const bankNameOf = (d: Dividend) =>
    d.bankEntryId ? (entries.find((e) => e.id === d.bankEntryId)?.name ?? null) : null;

  const confirmDelete = (d: Dividend) => {
    Alert.alert("刪除這筆股利？", "入帳與再投資的紀錄會一併沖銷，帳戶餘額回到原本的金額。", [
      { text: "取消", style: "cancel" },
      {
        text: "刪除",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteDividend(d.id);
            await fetchAll();
            await load();
          } catch (e) {
            Alert.alert("刪除失敗", e instanceof Error ? e.message : "請稍後再試");
          }
        },
      },
    ]);
  };

  return (
    <View style={s.section}>
      <View style={s.header}>
        <Text style={s.title}>股息</Text>
        <Pressable onPress={() => setFormOpen(true)} hitSlop={8}>
          <Text style={s.addBtn}>+ 新增</Text>
        </Pressable>
      </View>

      <View style={s.statRow}>
        <Text style={s.statLabel}>累計股利</Text>
        <Text style={s.statValue}>NT$ {total.toLocaleString()}</Text>
      </View>
      {yieldOnCost != null && (
        <View style={s.statRow}>
          <Text style={s.statLabel}>對成本殖利率</Text>
          <Text style={s.statValue}>{yieldOnCost.toFixed(2)}%</Text>
        </View>
      )}

      <View style={s.card}>
        {rows.length === 0 ? (
          <Text style={s.empty}>還沒有股利紀錄</Text>
        ) : (
          rows.map((d, i) => (
            <View key={d.id}>
              {i > 0 && <View style={s.separator} />}
              <Pressable onLongPress={() => confirmDelete(d)} style={s.row}>
                <View>
                  <Text style={s.rowDate}>{d.payDate.slice(0, 10)}</Text>
                  {d.perShare != null && (
                    <Text style={s.rowMeta}>
                      每股 {d.perShare} × {d.shares ?? "—"} 股
                    </Text>
                  )}
                </View>
                <View style={s.rowRight}>
                  <Text style={s.rowAmount}>+NT$ {d.amount.toLocaleString()}</Text>
                  {d.reinvestedAt ? (
                    <Text style={s.reinvested}>
                      已再投資 {d.reinvestUnits != null ? `${d.reinvestUnits.toFixed(4)} 股` : ""}
                    </Text>
                  ) : (
                    <Pressable onPress={() => setReinvestTarget(d)} hitSlop={6}>
                      <Text style={s.reinvestBtn}>再投資</Text>
                    </Pressable>
                  )}
                </View>
              </Pressable>
            </View>
          ))
        )}
      </View>
      <Text style={s.hint}>長按一筆紀錄可刪除</Text>

      <DividendForm
        visible={formOpen}
        entryId={entryId}
        entryName={entryName}
        subCategory={subCategory}
        stockCode={stockCode}
        currentShares={currentShares}
        onClose={() => setFormOpen(false)}
        onSaved={load}
      />

      {reinvestTarget && (
        <ReinvestSheet
          visible
          dividendId={reinvestTarget.id}
          dividendAmount={reinvestTarget.amount}
          entryName={entryName}
          subCategory={subCategory}
          stockCode={stockCode}
          bankName={bankNameOf(reinvestTarget)}
          onClose={() => setReinvestTarget(null)}
          onDone={load}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  section: { paddingHorizontal: 20, paddingTop: 24 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  title: { fontSize: 13, fontWeight: "600", color: "#1c1c1e" },
  addBtn: { fontSize: 13, color: "#66788E", fontWeight: "600" },
  statRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  statLabel: { fontSize: 13, color: "#8e8e93" },
  statValue: { fontSize: 13, fontWeight: "600", color: "#1c1c1e" },
  card: { backgroundColor: "#fff", borderRadius: 14, marginTop: 10, paddingHorizontal: 14 },
  separator: { height: 1, backgroundColor: "#f2f2f7" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  rowDate: { fontSize: 14, color: "#1c1c1e" },
  rowMeta: { fontSize: 12, color: "#8e8e93", marginTop: 2 },
  rowRight: { alignItems: "flex-end", gap: 4 },
  rowAmount: { fontSize: 14, fontWeight: "600", color: "#1c1c1e" },
  reinvestBtn: { fontSize: 12, color: "#66788E", fontWeight: "600" },
  reinvested: { fontSize: 12, color: "#8e8e93" },
  empty: { fontSize: 13, color: "#8e8e93", paddingVertical: 18, textAlign: "center" },
  hint: { fontSize: 11, color: "#c7c7cc", marginTop: 8, textAlign: "center" },
});
```

- [ ] **Step 2: 掛進 entry 詳情頁**

在 `apps/mobile/app/(app)/entry/[id].tsx`：

先加 import（放在其他 `@/components` import 附近）：

```tsx
import DividendSection from "@/components/DividendSection";
```

然後在「交易記錄」區塊（`<View style={s.historySection}>`）之前插入。`isStockEntry` 已存在於該檔第 194 行，`stockCode` / `subCategory` 也已是既有變數：

```tsx
{
  isStockEntry && entry.stockCode && (
    <DividendSection
      entryId={entry.id}
      entryName={entry.name}
      subCategory={entry.subCategory}
      stockCode={entry.stockCode}
      currentShares={history.reduce((sum, h) => sum + (h.units ?? 0), 0) || null}
      costBasis={history.reduce((sum, h) => sum + h.delta, 0)}
    />
  );
}
```

- [ ] **Step 3: 在裝置上驗證**

Run: `pnpm dev`，然後用 Expo Go 開啟 App。以 Premium 帳號進入一檔台股 entry。
Expected:

- 「股息」區塊出現在「交易記錄」之上
- `+ 新增` 可開表單，每股股利已預填（或留空但不報錯）
- 儲存後列表出現該筆、累計股利與殖利率更新、選定的銀行帳戶餘額增加
- 「再投資」彈窗顯示三行摘要，確認後股票 entry 的股數與價值增加、銀行餘額減少
- 長按刪除後，兩邊餘額都回到原本的金額

以非 Premium 帳號（或用 dev toggle 關掉訂閱）重試，儲存時應彈出 paywall 提示。

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/components/DividendSection.tsx "apps/mobile/app/(app)/entry/[id].tsx"
git commit -m "feat: add dividend section to entry detail"
```

---

### Task 14: Mobile — 股息總覽頁

**Files:**

- Create: `apps/mobile/app/(app)/dividends.tsx`
- Modify: `apps/mobile/app/(app)/settings.tsx`

**Interfaces:**

- Consumes: Task 10 的 `fetchDividendSummary`、`DividendSummary` type
- Produces: `/dividends` 路由（Expo Router 檔案式路由，`app/(app)/dividends.tsx` 即 `/dividends`）

- [ ] **Step 1: 建立總覽頁**

Create `apps/mobile/app/(app)/dividends.tsx`：

```tsx
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import type { DividendSummary } from "@repo/shared";
import { useFinanceActions } from "@/hooks/useFinanceActions";

export default function DividendsScreen() {
  const router = useRouter();
  const { fetchDividendSummary } = useFinanceActions();
  const [summary, setSummary] = useState<DividendSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setSummary(await fetchDividendSummary());
    } catch (e) {
      setError(e instanceof Error ? e.message : "讀取失敗");
    }
  }, [fetchDividendSummary]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <View style={s.root}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <ChevronLeft size={24} color="#1c1c1e" />
        </Pressable>
        <Text style={s.headerTitle}>股息總覽</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={s.body}>
        {error && <Text style={s.error}>{error}</Text>}

        <View style={s.totals}>
          <View style={s.totalBox}>
            <Text style={s.totalLabel}>本年度股利</Text>
            <Text style={s.totalValue}>NT$ {(summary?.totalThisYear ?? 0).toLocaleString()}</Text>
          </View>
          <View style={s.totalBox}>
            <Text style={s.totalLabel}>全期累計</Text>
            <Text style={s.totalValue}>NT$ {(summary?.totalAllTime ?? 0).toLocaleString()}</Text>
          </View>
        </View>

        <Text style={s.sectionTitle}>各檔明細</Text>
        <View style={s.card}>
          {!summary || summary.byEntry.length === 0 ? (
            <Text style={s.empty}>還沒有股利紀錄</Text>
          ) : (
            summary.byEntry.map((row, i) => (
              <View key={row.entryId}>
                {i > 0 && <View style={s.separator} />}
                <Pressable style={s.row} onPress={() => router.push(`/entry/${row.entryId}`)}>
                  <View>
                    <Text style={s.rowName}>{row.name}</Text>
                    <Text style={s.rowMeta}>
                      {row.stockCode ?? "—"} · {row.subCategory}
                    </Text>
                  </View>
                  <View style={s.rowRight}>
                    <Text style={s.rowAmount}>NT$ {row.totalAllTime.toLocaleString()}</Text>
                    <Text style={s.rowMeta}>
                      {row.yieldOnCost != null
                        ? `殖利率 ${(row.yieldOnCost * 100).toFixed(2)}%`
                        : "殖利率 —"}
                    </Text>
                  </View>
                </Pressable>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f2f2f7" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 16, fontWeight: "600", color: "#1c1c1e" },
  body: { paddingHorizontal: 20, paddingBottom: 40 },
  totals: { flexDirection: "row", gap: 12 },
  totalBox: { flex: 1, backgroundColor: "#fff", borderRadius: 14, padding: 16 },
  totalLabel: { fontSize: 12, color: "#8e8e93" },
  totalValue: { fontSize: 18, fontWeight: "700", color: "#1c1c1e", marginTop: 6 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1c1c1e",
    marginTop: 24,
    marginBottom: 10,
  },
  card: { backgroundColor: "#fff", borderRadius: 14, paddingHorizontal: 14 },
  separator: { height: 1, backgroundColor: "#f2f2f7" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
  },
  rowName: { fontSize: 15, color: "#1c1c1e" },
  rowMeta: { fontSize: 12, color: "#8e8e93", marginTop: 2 },
  rowRight: { alignItems: "flex-end" },
  rowAmount: { fontSize: 15, fontWeight: "600", color: "#1c1c1e" },
  empty: { fontSize: 13, color: "#8e8e93", paddingVertical: 20, textAlign: "center" },
  error: { color: "#d93025", fontSize: 13, marginBottom: 12 },
});
```

- [ ] **Step 2: 在設定頁加入入口**

在 `apps/mobile/app/(app)/settings.tsx` 中找到現有的列表項（例如指向 `/insurance/overview` 的那一列），照同樣的樣式與元件在其後新增一列：文字「股息總覽」，`onPress` 為 `router.push("/dividends")`。圖示用 `lucide-react-native` 的 `HandCoins`。

**照該檔案現有的列樣式寫，不要自創新的容器或 StyleSheet。**

- [ ] **Step 3: 驗證型別與 lint**

Run: `pnpm type-check && pnpm lint`
Expected: 兩者都通過。

- [ ] **Step 4: 在裝置上驗證**

Expected: 設定頁多出「股息總覽」一列；點進去顯示本年度／全期總額與各檔明細；點某一檔會導到該 entry 詳情頁。

- [ ] **Step 5: Commit**

```bash
git add "apps/mobile/app/(app)/dividends.tsx" "apps/mobile/app/(app)/settings.tsx"
git commit -m "feat: add dividend overview screen"
```

---

### Task 15: 全套驗證與交付

**Files:**

- Modify: `docs/TODO.md`

- [ ] **Step 1: 跑完整品質檢查**

Run: `pnpm lint && pnpm type-check && pnpm test`
Expected: 全部通過。CI 只在 PR 到 `main` 和 push 到 `main` 時跑，所以這一步是唯一的把關 —— 有任何失敗就修到全綠，不要帶著紅燈往下走。

- [ ] **Step 2: 確認測試覆蓋率門檻**

Run: `pnpm test:coverage`
Expected: 通過 80% 門檻。若 `dividends.service.ts` 拉低了覆蓋率，補上未覆蓋分支的測試（最可能是 `requireCashEntry` 的分類錯誤分支與 `reverseHistory` 的 early return）。

- [ ] **Step 3: 更新 TODO**

在 `docs/TODO.md` 加一行記錄本功能已完成，並註明**上線順序**：Prisma migration 必須先隨 web 部署到 Vercel、確認生產 API 可用，才能對 mobile 發 `eas update`。照該檔案既有的格式寫。

- [ ] **Step 4: 確認沒有動到版本號**

Run: `git diff origin/main --stat -- apps/mobile/app.json`
Expected: 無輸出（本功能是純 JS 變更，`version` 不該有任何改動）。

- [ ] **Step 5: Commit 並開 PR**

```bash
git add docs/TODO.md
git commit -m "docs: note dividend feature rollout order"
git push -u origin feature/stock-dividends
```

然後開 PR，**base 是 `develop`，不是 `main`**：

```bash
gh pr create --base develop --title "feat: 股票股息紀錄（Premium）" --body "$(cat <<'EOF'
## Summary
新增 Premium 的股票股息紀錄：手動輸入每檔股票的股利、可選入帳到流動資金帳戶、一鍵再投資回同一檔股票。

## Design
`docs/superpowers/specs/2026-08-13-stock-dividends-design.md`

## Rollout order
1. Prisma migration 隨 web 部署到 Vercel
2. 確認生產 API 可用
3. 才對 mobile 發 `eas update`

純 JS 變更，未修改 `apps/mobile/app.json` 的 version。

## Test plan
- `pnpm lint && pnpm type-check && pnpm test` 全綠
- 裝置實測：新增股利、入帳餘額變動、再投資雙邊過帳、刪除完整沖銷、free 帳號出 paywall

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review

**1. Spec coverage**

| Spec 章節                          | 實作於                                                                                                                              |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 資料模型 `Dividend` + `Entry` 關聯 | Task 1                                                                                                                              |
| 幣別處理（TWD 儲存、報價幣別輸入） | Task 11 Step 1（`fxRate` 換算）                                                                                                     |
| Zod schemas                        | Task 2                                                                                                                              |
| 新增股利（入帳 + 收入同步）        | Task 3                                                                                                                              |
| 刪除與沖銷                         | Task 4                                                                                                                              |
| 一鍵再投資                         | Task 5                                                                                                                              |
| 修改（沖銷後重放）                 | Task 6                                                                                                                              |
| summary 與 `yieldOnCost`           | Task 7                                                                                                                              |
| 所有權（含 bankEntryId）           | Task 3（`requireStockEntry` / `requireCashEntry`），Task 3 Step 1 有對應測試                                                        |
| API 表格全部 6 個端點              | Task 8（GET/POST/summary）、Task 9（PATCH/DELETE/reinvest）                                                                         |
| Premium 只擋兩個 POST              | Task 3 / Task 5 的 `isPremium` 檢查 + Task 8 的 `mapDividendError`                                                                  |
| `DividendForm`                     | Task 11                                                                                                                             |
| `ReinvestSheet`                    | Task 12                                                                                                                             |
| `DividendSection` + 掛載           | Task 13                                                                                                                             |
| 股息總覽頁 + 入口                  | Task 14                                                                                                                             |
| `useFinanceActions`（不進 store）  | Task 10                                                                                                                             |
| 測試清單全部 7 項                  | Task 3（premium、無銀行、入帳、收入、跨使用者、分類）、Task 4（沖銷回原值）、Task 5（重複再投資 409）、Task 6（已再投資改金額 409） |
| Route 測試 401 / 403               | Task 8                                                                                                                              |
| 上線順序、不動版本號               | Task 15                                                                                                                             |

無遺漏。

**2. Placeholder scan**

無 TBD / TODO / 「參考 Task N」。兩處刻意的現場核對（Task 11 Step 2 的 `/api/exchange-rate` 欄位名、Task 12 Step 2 的 `/api/stocks/price` 欄位名）都給了具體指令與修正方式，不是模糊指示。Task 14 Step 2 要求照既有列樣式寫而不給程式碼，因為 `settings.tsx` 的列元件必須就地沿用，貼一段猜測的 JSX 反而會造成不一致。

**3. Type consistency**

- `postHistory(tx, entry, delta, units, note)` 在 Task 3 定義，Task 5、Task 6 以相同 5 參數呼叫。
- `reverseHistory(tx, historyId)` / `unwind(tx, dividend)` 在 Task 4 定義，Task 6 以相同簽名呼叫。
- `requireStockEntry` / `requireCashEntry` 在 Task 3 定義，Task 5、Task 6 沿用同名。
- `mapDividendError` 在 Task 8 定義並匯出，Task 9 兩個 route 都從 `@/app/api/dividends/route` import 同名。
- `PremiumRequiredError` / `NotFoundError` / `ConflictError` 三個類別名貫穿 Task 3–9 一致。
- `CreateDividend` / `UpdateDividend` / `ReinvestDividend` / `Dividend` / `DividendSummary` 在 Task 2 定義，Task 3/5/6/7/10–14 使用同名。
- `DividendSection` 的 props 在 Task 13 的 Interfaces 宣告，Step 2 的掛載呼叫傳入完全相同的 6 個 prop。
- `DividendForm` / `ReinvestSheet` 的 props 在 Task 11 / 12 宣告，Task 13 的呼叫端逐一對上。
