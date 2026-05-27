# 定期項目（Recurrences）設計文件

**日期：** 2026-05-27  
**狀態：** 已核准，待實作

---

## 目標

讓用戶在任意帳戶（Entry）下設定定期自動交易，例如每月薪資入帳、每月帳單支出、每月定期定額投資等。系統在用戶開啟 App 時自動補齊未產生的 Transaction 紀錄。

---

## 核心行為

- **自動產生**：不需用戶確認，到期直接建立 Transaction。
- **觸發時機**：`fetchAll(isSignedIn: true)` 結尾呼叫 `POST /api/recurrences/process`，每次開 App 自動補齊。
- **產生後**：Transaction 與手動新增的完全相同，可編輯或刪除。
- **適用範圍**：所有 Entry 類別（投資、負債、一般帳戶皆可）。

---

## 支援頻率

| 頻率     | 所需欄位                            | 範例      |
| -------- | ----------------------------------- | --------- |
| MONTHLY  | `dayOfMonth` (1–31)                 | 每月 5 號 |
| WEEKLY   | `dayOfWeek` (0=日…6=六)             | 每週一    |
| BIWEEKLY | `dayOfWeek`                         | 每兩週一  |
| YEARLY   | `monthOfYear` (1–12) + `dayOfMonth` | 每年 3/15 |

---

## 資料模型

### Prisma Schema 新增

```prisma
model Recurrence {
  id          String         @id @default(cuid())
  userId      String
  entryId     String
  entry       Entry          @relation(fields: [entryId], references: [id], onDelete: Cascade)
  type        String         // "income" | "expense"
  amount      Decimal
  category    String
  source      String         @default("daily") // "daily" | "emergency" | "excluded"
  note        String?
  frequency   RecurrenceFreq
  dayOfMonth  Int?           // MONTHLY / YEARLY
  dayOfWeek   Int?           // WEEKLY / BIWEEKLY
  monthOfYear Int?           // YEARLY
  startDate   DateTime
  nextRunAt   DateTime
  lastRunAt   DateTime?
  active      Boolean        @default(true)
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt

  @@index([userId, nextRunAt])
  @@index([entryId])
}

enum RecurrenceFreq {
  MONTHLY
  WEEKLY
  BIWEEKLY
  YEARLY
}
```

`Entry` model 加上：

```prisma
recurrences Recurrence[]
```

### Shared Schemas（`packages/shared/src/schemas/finance.ts`）

- `RecurrenceFreqSchema` — z.enum
- `RecurrenceSchema` — 完整 type
- `CreateRecurrenceSchema` — 建立用
- `UpdateRecurrenceSchema` — 部分更新用

---

## API Routes

| Method | Path                           | 說明                 |
| ------ | ------------------------------ | -------------------- |
| GET    | `/api/recurrences?entryId=...` | 列出某帳戶的定期項目 |
| POST   | `/api/recurrences`             | 新增                 |
| PUT    | `/api/recurrences/[id]`        | 編輯                 |
| DELETE | `/api/recurrences/[id]`        | 刪除                 |
| POST   | `/api/recurrences/process`     | 處理所有到期定期項目 |

### `process` 邏輯

1. 查詢 `active = true AND nextRunAt <= NOW()` 的所有 recurrences（屬於該 userId）
2. 對每一筆：
   - 建立 `Transaction`（type/amount/category/source/note/date=nextRunAt）
   - 計算並更新 `nextRunAt`
   - 更新 `lastRunAt = NOW()`
3. 若同一個 recurrence 跨越多個週期（例如用戶很久沒開 App），迴圈補齊每一期

### `computeNextRunAt` 規則

- MONTHLY：下個月同一天（dayOfMonth）
- WEEKLY：7 天後
- BIWEEKLY：14 天後
- YEARLY：明年同月同日

若目標日期不存在（如 2/30），使用當月最後一天。

---

## Service 層

新增 `apps/web/services/recurrences.service.ts`：

- `list(userId, entryId?)` — 列出
- `create(data, userId)` — 建立，計算初始 `nextRunAt`（從 `startDate` 起第一個符合條件的日期）
- `update(id, data, userId)` — 更新，若 frequency/timing 改變則重算 `nextRunAt`
- `delete(id, userId)` — 刪除
- `process(userId)` — 批次產生到期交易，回傳建立的 Transaction 數量

---

## Zustand Store

`useFinanceStore` 新增：

```typescript
recurrences: Recurrence[];
addRecurrence: (data: CreateRecurrence) => Promise<void>;
updateRecurrence: (id: string, data: UpdateRecurrence) => Promise<void>;
deleteRecurrence: (id: string) => Promise<void>;
```

`fetchAll` 的 signed-in 路徑結尾加：

```typescript
await apiFetch("/api/recurrences/process", { method: "POST" });
const recurrences = await apiFetch<Recurrence[]>("/api/recurrences");
set({ recurrences });
```

---

## UI

### AccountFormPage 修改

- 「新增定期」按鈕改為功能性，點擊 `setShowRecurrenceForm(true)`
- 定期項目列表：每列顯示 `[類型] 頻率描述 | 金額 | 類別`，右側編輯/刪除按鈕
- 新增 `RecurrenceFormPage` 元件，從右側 slide-in（z-[90]，高於 AccountFormPage 的 z-[70]）

### RecurrenceFormPage（新元件）

路徑：`apps/web/components/finance/RecurrenceFormPage.tsx`

Props：

```typescript
interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  entryId: string;
  color: string;
  editItem?: Recurrence | null;
}
```

表單欄位（由上而下）：

1. **類型** — income / expense segmented control
2. **金額** — 數字輸入 + TWD badge
3. **類別** — 文字輸入（預設帶入帳戶 subCategory）
4. **頻率** — 每月 / 每週 / 每兩週 / 每年（4 選 1 pill）
5. **時間設定**（動態）：
   - 每月：第幾號（1–31 picker）
   - 每週 / 每兩週：星期幾（一到日 segmented）
   - 每年：月份 + 日期
6. **開始日期** — date input（預設今天）
7. **備註** — 選填 text input

---

## 總覽

定期項目在各帳戶 AccountFormPage 管理，不另開全域頁面。未來可在 EntryDetailPage 加入顯示。

---

## 範圍外（本次不做）

- 暫停 / 恢復單筆定期項目
- 自訂結束日期
- 跳過單次（skip one occurrence）
- 全域定期項目總覽頁面
