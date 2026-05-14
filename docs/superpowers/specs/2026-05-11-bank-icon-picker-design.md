# Bank Icon Picker for 金融卡

## Overview

Add an "Icon" field to `AccountFormPage` that appears only when `subCategoryName === "金融卡"`. The user taps the row to open a full-screen `BankPickerPage` modal showing a grid of bank logos. The selected bank's `code` is stored as `bankCode` on the `Entry`.

---

## UI

### AccountFormPage — new "Icon" row

- Inserted between the balance row and the 帳戶名稱 row, only when `subCategoryName === "金融卡"`
- Label: **Icon** (left)
- Right side: a 32×32 rounded icon image (`/banks/{code}.png`) when selected; a grey placeholder when not
- Chevron right to indicate tappable
- Tapping opens `BankPickerPage`

### BankPickerPage

New full-screen modal component, same z-index and slide-in pattern as `StockPickerPage`.

- Top nav: back button (left) + title **選擇 Icon** (centre)
- Body: white card with 5-column icon grid
- Each cell: 44×44 rounded square `<img src="/banks/{code}.png" />` with `alt={name}` for accessibility
- Selected bank: blue outline ring (`outline: 2.5px solid`)
- No bank name labels in the grid
- Fallback: if image fails to load (`onError`), show a grey letter-avatar using the first character of the bank name
- No search bar (15 icons is scannable without it)
- Tapping an icon calls `onSelect(bank)` and the caller closes the modal

---

## Bank List

Defined as a constant `BANKS: BankItem[]` in `BankPickerPage.tsx`.

```
code        name
─────────────────────────
bot         台灣銀行
ctbc        中國信託
cathay      國泰世華
esun        玉山銀行
fubon       台北富邦
mega        兆豐銀行
tcb         合作金庫
firstbank   第一銀行
hana        華南銀行
chb         彰化銀行
landbank    台灣土地銀行
sinopac     永豐銀行
taishin     台新銀行
post        中華郵政
hsbc        匯豐銀行
dbs         星展銀行
```

Logo files: `public/banks/{code}.png` — developer sources these from each bank's official site or Wikipedia Wikimedia Commons.

---

## Data Model

### Schema (`apps/web/prisma/schema.prisma`)

Add to `Entry`:

```prisma
bankCode    String?
```

Migration required after schema change (`pnpm db:migrate`).

### Shared schemas (`packages/shared/src/schemas/finance.ts`)

- `EntrySchema`: add `bankCode: z.string().nullable().optional()`
- `CreateEntrySchema`: add `bankCode: z.string().optional()`
- `UpdateEntrySchema`: inherits via `.partial()` — no change needed

### Service (`apps/web/services/entries.service.ts`)

- `create`: destructure `bankCode` alongside `units`, `stockCode`; pass to `prisma.entry.create`
- `update`: include `bankCode` in cleaned update data (same pattern as existing fields)

### Store (`apps/web/store/useFinanceStore.ts`)

- `addEntry` guest path: spread `bankCode` onto `fakeEntry` (same as `stockCode`)
- `addEntry` real path: include `bankCode` in POST body when present
- `updateEntry`: no change needed — `UpdateEntry` type already accepts it via partial schema

---

## AccountFormPage Changes

New state:

```ts
const [selectedBank, setSelectedBank] = useState<BankItem | null>(null);
const [showBankPicker, setShowBankPicker] = useState(false);
```

Reset in the `useEffect` (alongside `setSelectedStock(null)`):

```ts
setSelectedBank(null);
```

Edit pre-fill: extend the `EditItem` interface with `bankCode?: string`. In the `useEffect`, when `editItem?.bankCode` is present, find the matching `BankItem` from `BANKS` and call `setSelectedBank`.

Submit: include `bankCode` when present:

```ts
...(selectedBank ? { bankCode: selectedBank.code } : {}),
```

Icon row renders only when `subCategoryName === "金融卡"`:

```tsx
{subCategoryName === "金融卡" && (
  <>
    <button onClick={() => setShowBankPicker(true)} ...>
      <p>Icon</p>
      {selectedBank
        ? <img src={`/banks/${selectedBank.code}.png`} ... />
        : <div className="placeholder" />}
      <ChevronRight />
    </button>
    <div className="divider" />
  </>
)}
```

---

## Files Touched

| File                                              | Change                                                |
| ------------------------------------------------- | ----------------------------------------------------- |
| `apps/web/prisma/schema.prisma`                   | Add `bankCode String?` to `Entry`                     |
| `packages/shared/src/schemas/finance.ts`          | Add `bankCode` to `EntrySchema` + `CreateEntrySchema` |
| `apps/web/services/entries.service.ts`            | Handle `bankCode` in `create` and `update`            |
| `apps/web/store/useFinanceStore.ts`               | Pass `bankCode` in guest path + POST body             |
| `apps/web/components/finance/AccountFormPage.tsx` | Add Icon row + BankPickerPage integration             |
| `apps/web/components/finance/BankPickerPage.tsx`  | New component                                         |
| `public/banks/`                                   | Add PNG logo files (developer-sourced)                |

---

## Out of Scope

- Search/filter in the picker (15 icons doesn't need it)
- Extending Icon picker to other banking subcategories (可以之後再做)
- Uploading custom bank logos
