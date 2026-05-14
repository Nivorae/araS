# Bank Icon Picker for 金融卡 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a bank icon picker field to `AccountFormPage` that shows only for "金融卡", lets the user pick from a full-screen grid of bank logos, and persists the selected bank code to the database.

**Architecture:** Add `bankCode String?` to the Prisma `Entry` model; propagate it through the shared Zod schema → service → store → UI. Create a new `BankPickerPage` component (static grid, same slide-in pattern as `StockPickerPage`). Integrate the picker into `AccountFormPage` with an "Icon" row rendered only when `subCategoryName === "金融卡"`.

**Tech Stack:** Prisma 6, Zod, React 19, Next.js 15 App Router, Tailwind CSS 4, Vitest

---

## File Map

| Action | Path                                              |
| ------ | ------------------------------------------------- |
| Modify | `apps/web/prisma/schema.prisma`                   |
| Modify | `packages/shared/src/schemas/finance.ts`          |
| Modify | `apps/web/services/entries.service.ts`            |
| Modify | `apps/web/store/useFinanceStore.ts`               |
| Modify | `apps/web/tests/services/entries.service.test.ts` |
| Create | `apps/web/components/finance/BankPickerPage.tsx`  |
| Modify | `apps/web/components/finance/AccountFormPage.tsx` |
| Create | `public/banks/.gitkeep`                           |

---

## Task 1: Prisma Schema Migration

**Files:**

- Modify: `apps/web/prisma/schema.prisma`

- [ ] **Step 1: Add bankCode to Entry model**

In `apps/web/prisma/schema.prisma`, add `bankCode String?` after `stockCode`:

```prisma
model Entry {
  id          String         @id @default(cuid())
  userId      String
  name        String
  topCategory String
  subCategory String
  stockCode   String?
  bankCode    String?
  value       Decimal
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt
  history     EntryHistory[]
  loan        Loan?
  insurance   Insurance?

  @@index([topCategory])
  @@index([userId])
}
```

- [ ] **Step 2: Generate Prisma client and run migration**

```bash
cd apps/web
pnpm db:generate
pnpm db:migrate
```

When prompted for a migration name, enter: `add_bank_code_to_entry`

Expected: migration applied, Prisma client regenerated with `bankCode` field.

- [ ] **Step 3: Commit**

```bash
git add apps/web/prisma/schema.prisma
git commit -m "feat(db): add bankCode field to Entry model"
```

---

## Task 2: Shared Zod Schemas

**Files:**

- Modify: `packages/shared/src/schemas/finance.ts`

- [ ] **Step 1: Add bankCode to EntrySchema and CreateEntrySchema**

In `packages/shared/src/schemas/finance.ts`, update the three schemas:

```ts
export const EntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  topCategory: z.string(),
  subCategory: z.string(),
  stockCode: z.string().nullable().optional(),
  bankCode: z.string().nullable().optional(),
  units: z.number().nullable().optional(),
  value: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
  loan: LoanSchema.nullable().optional(),
});
export type Entry = z.infer<typeof EntrySchema>;

export const CreateEntrySchema = z.object({
  name: z.string().min(1, "名稱為必填"),
  topCategory: z.string().min(1, "大類為必填"),
  subCategory: z.string().min(1, "子類別為必填"),
  stockCode: z.string().optional(),
  bankCode: z.string().optional(),
  units: z.number().optional(),
  value: z.number().positive("金額必須大於 0"),
  createdAt: z.string().optional(),
});
export type CreateEntry = z.infer<typeof CreateEntrySchema>;

// UpdateEntrySchema uses CreateEntrySchema.partial() — no change needed
export const UpdateEntrySchema = CreateEntrySchema.partial();
export type UpdateEntry = z.infer<typeof UpdateEntrySchema>;
```

- [ ] **Step 2: Verify type-check passes**

```bash
pnpm type-check
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/schemas/finance.ts
git commit -m "feat(shared): add bankCode to Entry and CreateEntry schemas"
```

---

## Task 3: Service Layer — Test + Implementation

**Files:**

- Modify: `apps/web/tests/services/entries.service.test.ts`
- Modify: `apps/web/services/entries.service.ts`

- [ ] **Step 1: Write failing test for bankCode passthrough on create**

Append this describe block to `apps/web/tests/services/entries.service.test.ts`:

```ts
describe("EntriesService.create — bankCode", () => {
  beforeEach(() => vi.clearAllMocks());

  it("passes bankCode to prisma when provided", async () => {
    const fakeEntry = {
      id: "e1",
      name: "Test",
      topCategory: "銀行",
      subCategory: "金融卡",
      stockCode: null,
      bankCode: "ctbc",
      value: { toNumber: () => 5000 },
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: USER_ID,
    };
    vi.mocked(prisma.entry.create).mockResolvedValue(fakeEntry as never);
    vi.mocked(prisma.entryHistory.create).mockResolvedValue({} as never);

    await entriesService.create(
      {
        name: "Test",
        topCategory: "銀行",
        subCategory: "金融卡",
        value: 5000,
        bankCode: "ctbc",
      },
      USER_ID
    );

    expect(prisma.entry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ bankCode: "ctbc" }),
      })
    );
  });

  it("sets bankCode to null when not provided", async () => {
    const fakeEntry = {
      id: "e2",
      name: "Test",
      topCategory: "銀行",
      subCategory: "金融卡",
      stockCode: null,
      bankCode: null,
      value: { toNumber: () => 5000 },
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: USER_ID,
    };
    vi.mocked(prisma.entry.create).mockResolvedValue(fakeEntry as never);
    vi.mocked(prisma.entryHistory.create).mockResolvedValue({} as never);

    await entriesService.create(
      { name: "Test", topCategory: "銀行", subCategory: "金融卡", value: 5000 },
      USER_ID
    );

    expect(prisma.entry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ bankCode: null }),
      })
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm --filter @repo/web test -- apps/web/tests/services/entries.service.test.ts
```

Expected: the two new tests FAIL (bankCode not yet handled in service).

- [ ] **Step 3: Update entries.service.ts create method**

In `apps/web/services/entries.service.ts`, update the `create` method to destructure and explicitly pass `bankCode`:

```ts
async create(data: CreateEntry, userId: string) {
  const { units, stockCode, bankCode, createdAt, ...rest } = data;
  const timestamp = createdAt ? new Date(createdAt) : undefined;

  const entry = await prisma.entry.create({
    data: {
      ...rest,
      userId,
      stockCode: stockCode ?? null,
      bankCode: bankCode ?? null,
      ...(timestamp !== undefined ? { createdAt: timestamp } : {}),
    },
  });

  await prisma.entryHistory.create({
    data: {
      entryId: entry.id,
      delta: entry.value,
      balance: entry.value,
      units: units ?? null,
      ...(timestamp !== undefined ? { createdAt: timestamp } : {}),
    },
  });

  return { ...entry, value: d(entry.value) };
}
```

No change needed to `update` — `bankCode` already flows through the `cleaned` object from `updateData`.

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm --filter @repo/web test -- apps/web/tests/services/entries.service.test.ts
```

Expected: all tests PASS including the two new ones.

- [ ] **Step 5: Commit**

```bash
git add apps/web/services/entries.service.ts apps/web/tests/services/entries.service.test.ts
git commit -m "feat(api): pass bankCode through entries service create"
```

---

## Task 4: Store — Guest Path Merge Fix

**Files:**

- Modify: `apps/web/store/useFinanceStore.ts`

- [ ] **Step 1: Update the merge path in addEntry to include bankCode**

In `apps/web/store/useFinanceStore.ts`, find the `addEntry` merge path (the `if (existing)` block) and add `bankCode`:

```ts
if (existing) {
  const merged = await apiFetch<Entry>(`/api/entries/${existing.id}`, {
    method: "PUT",
    body: JSON.stringify({
      value: existing.value + data.value,
      ...(data.stockCode ? { stockCode: data.stockCode } : {}),
      ...(data.bankCode ? { bankCode: data.bankCode } : {}),
      ...(data.units != null ? { units: data.units } : {}),
    }),
  });
```

- [ ] **Step 2: Verify type-check passes**

```bash
pnpm type-check
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/store/useFinanceStore.ts
git commit -m "feat(web): include bankCode in entry merge path"
```

---

## Task 5: BankPickerPage Component

**Files:**

- Create: `apps/web/components/finance/BankPickerPage.tsx`

- [ ] **Step 1: Create the component**

Create `apps/web/components/finance/BankPickerPage.tsx` with the full content below:

```tsx
"use client";

import { ChevronLeft } from "lucide-react";

export interface BankItem {
  code: string;
  name: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (bank: BankItem) => void;
  selectedCode?: string | null;
}

export const BANKS: BankItem[] = [
  { code: "bot", name: "台灣銀行" },
  { code: "ctbc", name: "中國信託" },
  { code: "cathay", name: "國泰世華" },
  { code: "esun", name: "玉山銀行" },
  { code: "fubon", name: "台北富邦" },
  { code: "mega", name: "兆豐銀行" },
  { code: "tcb", name: "合作金庫" },
  { code: "firstbank", name: "第一銀行" },
  { code: "hana", name: "華南銀行" },
  { code: "chb", name: "彰化銀行" },
  { code: "landbank", name: "台灣土地銀行" },
  { code: "sinopac", name: "永豐銀行" },
  { code: "taishin", name: "台新銀行" },
  { code: "post", name: "中華郵政" },
  { code: "hsbc", name: "匯豐銀行" },
  { code: "dbs", name: "星展銀行" },
];

export function BankPickerPage({ open, onClose, onSelect, selectedCode }: Props) {
  const handleSelect = (bank: BankItem) => {
    onSelect(bank);
    onClose();
  };

  return (
    <div
      className={`fixed inset-0 z-[80] bg-[#f2f2f7] transition-transform duration-300 ease-in-out ${
        open ? "translate-x-0" : "pointer-events-none translate-x-full"
      }`}
    >
      <div className="mx-auto max-w-md px-4 pt-14">
        <div className="mb-6 flex items-center">
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm"
          >
            <ChevronLeft size={20} className="text-[#1c1c1e]" />
          </button>
          <h1 className="ml-4 text-[20px] font-bold text-[#1c1c1e]">選擇 Icon</h1>
        </div>

        <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
          <div className="grid grid-cols-5 gap-3 p-4">
            {BANKS.map((bank) => (
              <button
                key={bank.code}
                onClick={() => handleSelect(bank)}
                className={`flex items-center justify-center rounded-xl p-1.5 transition-all active:bg-[#f2f2f7] ${
                  selectedCode === bank.code
                    ? "outline outline-2 outline-offset-1 outline-[#374254]"
                    : ""
                }`}
              >
                <div className="relative h-11 w-11">
                  <img
                    src={`/banks/${bank.code}.png`}
                    alt={bank.name}
                    className="h-full w-full rounded-xl object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                      const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
                      if (fallback) fallback.style.display = "flex";
                    }}
                  />
                  <div className="absolute inset-0 hidden items-center justify-center rounded-xl bg-[#e5e5ea] text-[11px] font-bold text-[#636366]">
                    {bank.name[0]}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify type-check passes**

```bash
pnpm type-check
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/finance/BankPickerPage.tsx
git commit -m "feat(web): add BankPickerPage component for bank icon selection"
```

---

## Task 6: AccountFormPage Integration

**Files:**

- Modify: `apps/web/components/finance/AccountFormPage.tsx`

- [ ] **Step 1: Add imports and extend EditItem interface**

At the top of `apps/web/components/finance/AccountFormPage.tsx`, add the import:

```ts
import { BankPickerPage, BANKS, type BankItem } from "./BankPickerPage";
```

Extend the `EditItem` interface to include `bankCode`:

```ts
interface EditItem {
  id: string;
  name: string;
  value: number;
  category: string;
  bankCode?: string | null;
}
```

- [ ] **Step 2: Add selectedBank and showBankPicker state**

After the `const [priceLoading, setPriceLoading] = useState(false);` line, add:

```ts
const [selectedBank, setSelectedBank] = useState<BankItem | null>(null);
const [showBankPicker, setShowBankPicker] = useState(false);
```

- [ ] **Step 3: Reset and pre-fill selectedBank in the useEffect**

Inside the `useEffect` that runs on `open` change, after the `setSelectedStock(null);` line, add:

```ts
setSelectedBank(
  editItem?.bankCode ? (BANKS.find((b) => b.code === editItem.bankCode) ?? null) : null
);
```

- [ ] **Step 4: Include bankCode in handleSubmit**

Inside the `handleSubmit` function, in the `else` (non-loan) branch, update the `addEntry` and `updateEntry` calls to spread `bankCode`:

For the `isEdit` branch:

```ts
await updateEntry(editItem.id, {
  name: finalName,
  topCategory,
  subCategory: subCategoryName,
  value,
  ...(selectedStock ? { stockCode: selectedStock.code } : {}),
  ...(unitsParsed != null ? { units: unitsParsed } : {}),
  ...(selectedBank ? { bankCode: selectedBank.code } : {}),
});
```

For the `addEntry` branch:

```ts
await addEntry({
  name: finalName,
  topCategory,
  subCategory: subCategoryName,
  value,
  ...(selectedStock ? { stockCode: selectedStock.code } : {}),
  ...(unitsParsed != null ? { units: unitsParsed } : {}),
  ...(selectedBank ? { bankCode: selectedBank.code } : {}),
  createdAt: date,
});
```

- [ ] **Step 5: Add the Icon row in JSX**

Inside the white card `<div className="overflow-hidden rounded-2xl bg-white shadow-sm">`, locate the `<div className="mx-5 h-px bg-[#f2f2f7]" />` divider that comes just before the "Account Name" section. Insert the Icon row + divider immediately after it:

```tsx
<div className="mx-5 h-px bg-[#f2f2f7]" />;

{
  /* Icon — only for 金融卡 */
}
{
  subCategoryName === "金融卡" && !isLoan && (
    <>
      <button
        onClick={() => setShowBankPicker(true)}
        className="flex w-full items-center justify-between px-5 py-4 active:bg-[#f2f2f7]"
      >
        <p className="text-[16px] font-medium text-[#1c1c1e]">Icon</p>
        <div className="flex items-center gap-2">
          {selectedBank ? (
            <div className="relative h-8 w-8">
              <img
                src={`/banks/${selectedBank.code}.png`}
                alt={selectedBank.name}
                className="h-full w-full rounded-lg object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                  const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
                  if (fallback) fallback.style.display = "flex";
                }}
              />
              <div className="absolute inset-0 hidden items-center justify-center rounded-lg bg-[#e5e5ea] text-[10px] font-bold text-[#636366]">
                {selectedBank.name[0]}
              </div>
            </div>
          ) : (
            <div className="h-8 w-8 rounded-lg bg-[#f2f2f7]" />
          )}
          <ChevronRight size={16} className="text-[#c7c7cc]" />
        </div>
      </button>
      <div className="mx-5 h-px bg-[#f2f2f7]" />
    </>
  );
}

{
  /* Account Name */
}
```

- [ ] **Step 6: Render BankPickerPage at the bottom of the component**

Just before the closing `</>` of the returned JSX (after the existing `<StockPickerPage ... />` element), add:

```tsx
<BankPickerPage
  open={showBankPicker}
  onClose={() => setShowBankPicker(false)}
  onSelect={(bank) => setSelectedBank(bank)}
  selectedCode={selectedBank?.code}
/>
```

- [ ] **Step 7: Verify type-check passes**

```bash
pnpm type-check
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add apps/web/components/finance/AccountFormPage.tsx
git commit -m "feat(web): add bank icon picker to AccountFormPage for 金融卡"
```

---

## Task 7: Assets Directory

**Files:**

- Create: `public/banks/.gitkeep`

- [ ] **Step 1: Create the banks assets directory**

```bash
mkdir -p apps/web/public/banks
touch apps/web/public/banks/.gitkeep
```

- [ ] **Step 2: Source and add bank logo PNG files**

Add a PNG logo file for each of the 16 banks to `apps/web/public/banks/`. The filename must match the bank code exactly (e.g., `ctbc.png`, `esun.png`).

Recommended sources:

- Each bank's official website (brand/press kit pages usually have logo downloads)
- Wikipedia Wikimedia Commons (search the bank name, SVG logos available and freely licensed)

Files to add:

```
apps/web/public/banks/bot.png        (台灣銀行)
apps/web/public/banks/ctbc.png       (中國信託)
apps/web/public/banks/cathay.png     (國泰世華)
apps/web/public/banks/esun.png       (玉山銀行)
apps/web/public/banks/fubon.png      (台北富邦)
apps/web/public/banks/mega.png       (兆豐銀行)
apps/web/public/banks/tcb.png        (合作金庫)
apps/web/public/banks/firstbank.png  (第一銀行)
apps/web/public/banks/hana.png       (華南銀行)
apps/web/public/banks/chb.png        (彰化銀行)
apps/web/public/banks/landbank.png   (台灣土地銀行)
apps/web/public/banks/sinopac.png    (永豐銀行)
apps/web/public/banks/taishin.png    (台新銀行)
apps/web/public/banks/post.png       (中華郵政)
apps/web/public/banks/hsbc.png       (匯豐銀行)
apps/web/public/banks/dbs.png        (星展銀行)
```

If a logo file is missing, the UI automatically falls back to a grey letter avatar — so you can add logos incrementally.

Recommended size: 128×128 px PNG with transparent background.

- [ ] **Step 3: Commit**

```bash
git add apps/web/public/banks/
git commit -m "feat(assets): add bank logo files for icon picker"
```

---

## Task 8: Manual Verification

- [ ] **Step 1: Start the dev server**

```bash
pnpm dev
```

- [ ] **Step 2: Open the app at http://localhost:3000**

Navigate to the finance section. Add a new account under a category that uses "金融卡" as the sub-category.

- [ ] **Step 3: Verify Icon row appears**

In `AccountFormPage`, the "Icon" row should appear between the balance input and 帳戶名稱 — only when sub-category is "金融卡". It should not appear for other sub-categories (e.g., 活期存款).

- [ ] **Step 4: Verify BankPickerPage opens**

Tap the Icon row. The `BankPickerPage` should slide in from the right showing the 5-column icon grid. Banks with logo files show the image; missing logos show a grey letter avatar.

- [ ] **Step 5: Verify selection persists in the form**

Select a bank. The modal closes, and the form Icon row should now show the selected bank's logo (or letter avatar).

- [ ] **Step 6: Verify saving works**

Save the entry. Reload the page. Edit the same entry — the Icon row should pre-populate with the bank you previously selected.

- [ ] **Step 7: Verify other sub-categories are unaffected**

Open `AccountFormPage` for 活期存款, 投資基金, 房屋貸款 — confirm no Icon row appears in any of these.
