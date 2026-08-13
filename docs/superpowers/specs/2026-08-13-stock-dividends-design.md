# 股票股息紀錄設計

**日期**：2026-08-13
**範圍**：`Dividend` 資料模型、現金流沖銷規則、API、mobile UI、Premium 閘門、上線順序
**狀態**：設計定案，待實作
**關聯**：付費分層見 `2026-07-20-premium-tier-design.md`；多幣別的取捨見「幣別處理」一節

---

## 定位

讓使用者手動記錄每一檔股票領到的股利，並用一個按鈕把這筆股利再投資回同一檔股票。整個模組屬 **Premium**。

三個定案原則：

1. **掛在 `Entry` 上，不是 `PortfolioItem`**。`PortfolioItem` 只有 web 的舊 `PortfolioSection` 在用；mobile 的股票是 `Entry`（`subCategory` ∈ 台股/美股/加密貨幣/貴金屬，且有 `stockCode`），持股數存在 `EntryHistory.units`、成本存在 `EntryHistory.delta`。股利紀錄必須掛在 `Entry` 才能跟現有的損益計算對得上。
2. **再投資 = 一次真正的加碼**。新增一筆 `EntryHistory`（`delta` = 股利金額、`units` = 金額 ÷ 價格），與現有 `EntryForm` 的加碼流程同構，`units × 現價 − delta` 的損益公式完全不用改。
3. **現金流真的流動**。股利入帳讓流動資金帳戶餘額增加，再投資讓它減少、股票增加。帳面與真實世界一致，同一筆錢也不會在淨資產裡算兩次。

---

## 資料模型

新增 `Dividend`。它除了紀錄本身，還要記住「這筆股利動了哪些 `EntryHistory`」——刪除時才能精準回帳。

```prisma
model Dividend {
  id        String @id @default(cuid())
  userId    String
  entryId   String
  entry     Entry  @relation("EntryDividends", fields: [entryId], references: [id], onDelete: Cascade)

  payDate   DateTime            // 發放日
  amount    Decimal             // 實收總額（TWD）
  perShare  Decimal?            // 依每股輸入時保留，供殖利率顯示
  shares    Decimal?            // 計算當下的股數
  note      String?

  // 入帳的流動資金帳戶（可不選）
  bankEntryId   String?
  bankEntry     Entry?  @relation("BankDividends", fields: [bankEntryId], references: [id], onDelete: SetNull)
  bankHistoryId String?         // 入帳寫的那筆 EntryHistory
  transactionId String?         // 同步的收入 Transaction

  // 再投資（一筆股利只能再投資一次）
  reinvestedAt          DateTime?
  reinvestAmount        Decimal?
  reinvestPrice         Decimal?
  reinvestUnits         Decimal?
  reinvestHistoryId     String?  // 股票端 +
  reinvestBankHistoryId String?  // 銀行端 −

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId, payDate])
  @@index([entryId])
}
```

`Entry` 需要對應加上兩個反向欄位：

```prisma
dividends     Dividend[] @relation("EntryDividends")
bankDividends Dividend[] @relation("BankDividends")
```

### 欄位決策

| 決策                        | 理由                                                                                       |
| --------------------------- | ------------------------------------------------------------------------------------------ |
| `bankEntryId` 可為空        | 股利可能進沒建檔的帳戶，或使用者就是不想記現金流。不選就完全不動任何流動資金 Entry。       |
| 銀行 Entry 被刪 → `SetNull` | 股利紀錄本身仍有價值（總額、殖利率），不該因為帳戶被刪就消失。                             |
| 股票 Entry 被刪 → `Cascade` | 股利依附於持股，持股不存在時紀錄無意義。                                                   |
| 一筆股利只能再投資一次      | `reinvestedAt` 非 null 即鎖定，UI 按鈕改為「已再投資」灰標。避免同一筆錢被重複投入。       |
| 只有一條反向路徑            | 不做獨立的「撤銷再投資」端點。填錯就刪掉整筆重建。兩條各自沖銷的路徑等於兩份會算錯的邏輯。 |

### 幣別處理

`amount` 一律以 **TWD** 儲存。台股 `perShare` 直接是 TWD；美股/加密貨幣/貴金屬的 `perShare` 以該股報價幣別輸入，表單即時用現有匯率路徑（`useInvestmentMarketValues` 所走的 `/api/exchange-rate`）換算成 TWD 後才送出，並在表單上顯示換算結果。

這是刻意遵守既有的「多幣別 WON'T FIX」決策：per-entry currency 會破壞淨值圖的歷史快照，股利不該成為破口。

---

## 現金流與原子性

三個寫入動作各自是**單一 `prisma.$transaction`**，樣板是 `loans.service.ts` 與 `insurance.service.ts`（Entry + 子模型同一個交易）。

### 新增一筆股利

1. 建 `Dividend`
2. 若選了銀行帳戶：對該 Entry `createHistory({ delta: +amount, balance: value + amount })`，並 `Entry.value += amount`
3. 若「同步收入」開關開著：建 `Transaction{ type: "income", category: "股利", source: 股票名稱, amount, date: payDate }`

`Transaction` 是獨立帳本、淨資產圖從 `EntryHistory` 快照算，所以兩邊同時記**不會**重複計算淨資產。

### 一鍵再投資

1. 銀行 Entry：`createHistory({ delta: −amount })`，`Entry.value −= amount`
2. 股票 Entry：`createHistory({ delta: +amount, units: amount ÷ price })`，`Entry.value += amount`
3. 寫回 `reinvestedAt` / `reinvestAmount` / `reinvestPrice` / `reinvestUnits` 與兩個 history id

若該筆股利沒有入帳銀行，第 1 步跳過（錢從未進入帳面，也就無從扣除）。

### 刪除一筆股利

完整反向沖銷：刪掉記下來的 2~4 筆 `EntryHistory` 與 `Transaction`，並照 `entries.service.ts` `deleteHistory` 現有的規則重算餘額——對受影響 Entry 的後續 history 做 `balance: { increment: -delta }`，再從最後一筆的 `balance` 回推 `Entry.value`（無 history 時歸 0）。

### 修改一筆股利

`PATCH` 允許改 `payDate` / `amount` / `note` / `bankEntryId`。實作方式是**先完整沖銷再重放**（沿用上面兩段邏輯），而不是就地調整差額——就地調整在「換了入帳帳戶」的情況下會算錯。已再投資的股利不可改 `amount`（回 409），因為再投資金額已經是另一筆既成事實；要改就整筆刪掉重建。

### 所有權

每一次 Entry 查詢都走 `findFirst({ where: { id, userId } })`，**包含入帳銀行那一邊**。否則使用者可以拿別人的 `entryId` 當入帳帳戶，把錢寫進別人的帳。違規時以 `logSecurityEvent` 記錄。

---

## API

| 方法     | 路徑                           | Premium | 說明                                 |
| -------- | ------------------------------ | ------- | ------------------------------------ |
| `GET`    | `/api/dividends?entryId=`      |         | 列表；不帶 `entryId` 回該使用者全部  |
| `GET`    | `/api/dividends/summary`       |         | 年度總額、全期總額、每檔明細、殖利率 |
| `POST`   | `/api/dividends`               | ✅      | 新增                                 |
| `PATCH`  | `/api/dividends/[id]`          |         | 改金額/日期/備註/入帳帳戶            |
| `DELETE` | `/api/dividends/[id]`          |         | 反向沖銷                             |
| `POST`   | `/api/dividends/[id]/reinvest` | ✅      | 再投資                               |

Premium 只擋寫入（兩個 `POST`），讀取與編輯不擋——與保險模組一致，訂閱過期的人不會突然看不到自己輸入過的資料。後端 `entitlementsService.isPremium()` 是唯一權威，不足時回 403 `PREMIUM_REQUIRED`。

新增 service：`apps/web/services/dividends.service.ts`。
`@repo/shared` 新增 `CreateDividendSchema` / `UpdateDividendSchema` / `ReinvestDividendSchema` 與對應型別。

### `summary` 回傳形狀

```ts
{
  totalAllTime: number;
  totalThisYear: number;
  byEntry: Array<{
    entryId: string;
    name: string;
    stockCode: string;
    subCategory: string;
    totalAllTime: number;
    totalThisYear: number;
    costBasis: number; // 該檔累計成本 = 該 entry 所有 EntryHistory.delta 之和
    yieldOnCost: number | null; // totalThisYear / costBasis，costBasis 為 0 時 null
  }>;
}
```

`costBasis` 包含再投資產生的成本（因為再投資確實增加了成本基礎，這是「加成本也加股數」語意的必然結果）。`yieldOnCost` 因此會隨再投資略微下降，這是正確的。

---

## Mobile UI

本次只做 mobile（`apps/mobile`），web 的股息頁日後再追。

| 檔案                                             | 內容                                                                                                                                                               |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `components/DividendSection.tsx`                 | 掛進 `app/(app)/entry/[id].tsx`，只在 `STOCK_CATS` 且有 `stockCode` 時渲染。顯示該檔股利列表、累計總額、對成本的殖利率；每列右側是「再投資」按鈕或已再投資的灰標。 |
| `components/DividendForm.tsx`                    | 底部彈窗。欄位：發放日（預設今天）、「依每股股利 / 依總金額」切換、入帳帳戶 picker、同步收入開關、備註。                                                           |
| `components/ReinvestSheet.tsx`                   | 確認彈窗。預填全額與即時現價，即時顯示換算股數。                                                                                                                   |
| `app/(app)/dividends.tsx`                        | 股息總覽頁。本年度／全期總股利、每檔排行、年化殖利率。從首頁投資區塊與設定進入。                                                                                   |
| `store/financeStore.ts` + `useFinanceActions.ts` | 加入 `dividends` 狀態與 CRUD／reinvest actions，沿用現有 store 模式。                                                                                              |

### 表單細節

- 「依每股股利 / 依總金額」切換沿用 `EntryForm` 既有的 segmented control 樣式與 `inputMode` 模式，不另造一套。
- 每股股利用 `/api/stocks/dividend` 的 `dividendRate` 預填（抓不到就留空，不阻擋）；股數從該 entry 現有持股帶入，使用者可改。
- 入帳帳戶 picker 只列 `topCategory === "流動資金"` 的 Entry，可選「不記錄」。

### 再投資彈窗細節

- 金額預填全額、價格預填即時現價，**兩者都可編輯**（支援部分再投資）。
- 現價抓不到時價格欄留空讓使用者手填，而不是直接失敗——台股報價本來就會有抓不到的情況。
- 換算股數允許小數（台股零股、加密貨幣），以 `Decimal` 儲存。
- 送出前顯示三行摘要：銀行 −X、股票 +X、增加 N 股。

### Premium 閘門

Free 使用者看得到區塊與按鈕，按下去出 paywall——沿用 `InsuranceForm.tsx:215` 的模式：`if (!isPremium && !premiumLoading) { promptPremiumUpgrade(); return; }`，前端只是提前攔截，後端才是權威。

---

## 測試

Service 測試照 `apps/web/tests/services/insurance.service.test.ts` 的 `$transaction` mock 寫法。必須蓋到：

- 入帳讓銀行 Entry 的 `value` 與 `balance` 正確增加
- 再投資讓銀行減少、股票增加，且 `units` = 金額 ÷ 價格
- 刪除後所有受影響 Entry 的 `value` 回到原值
- 未選銀行帳戶時，不對任何 Entry 產生 history
- 跨使用者的 `entryId`（含 `bankEntryId`）被拒
- 已再投資的股利不能再投一次（409）
- 已再投資的股利不能改 `amount`（409）

Route 測試蓋 401（無 `userId`）與 403（`PREMIUM_REQUIRED`）。

---

## 上線順序

**順序不可顛倒**：

1. Prisma migration 隨 web 部署到 Vercel，生產 DB 先有 `Dividend` 表
2. 確認生產 API 可用
3. 才對 mobile 發 OTA（`eas update`）

反過來的話，OTA 出去的 App 會打到不存在的表。

本次是純 JS 變更，不需要原生 build，因此**不動 `apps/mobile/app.json` 的版本號**（版本號只在原生 build 時 bump，否則 `appVersion` runtimeVersion 會讓 OTA 無法送達）。

---

## 刻意不做（YAGNI）

- 股利行事曆／預估下次配息
- 自動抓取歷史配息批次匯入
- 扣稅、二代健保補充保費、匯入手續費欄位（台美規則不同，手機上填不完）
- CSV 匯出
- web UI（日後獨立一輪）
- 獨立的「撤銷再投資」端點（刪除整筆即可）
