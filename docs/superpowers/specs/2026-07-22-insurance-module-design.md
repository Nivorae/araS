# 保險模組設計

**日期**：2026-07-22
**範圍**：保險險種、欄位模型、保障清單、schema 調整、新增流程、詳情頁呈現
**狀態**：設計定案，待實作
**關聯**：付費分層見 `2026-07-20-premium-tier-design.md`（保險屬 Premium、決策五）

---

## 定位

保險是 araS 的一個**純呈現分類**，目的是「統計你有哪些保單」，不做專業精算分析（市面保險公司 App 那種深度不是目標）。

三個定案原則：

1. **不計入淨資產**。保險不是資產也不是負債。技術上以 `Entry.includeInChart = false` 讓保險 entry 自動不進淨值圖表與總資產。
2. **走既有新增流程**。透過 `+` → `entry/new` 新增，不進 nav。`entry/new` 由 `categoryConfig` 驅動，加一個「保險」top category 即可。
3. **顯示於 entry 列表**。保險用新主題色卡片顯示，點開卡片列出每筆保單，點進去是獨立的保單詳情頁。

現況：`Insurance` model 已存在但**無任何 UI、資料庫 0 筆**（2026-07-22 確認），因此本次可完全重設計欄位，migration 零風險。

---

## 欄位模型

### A. 核心欄位（全部匯入資料庫）

| 欄位     | 必填 | 型態                               | 空白時                |
| -------- | ---- | ---------------------------------- | --------------------- |
| 保險公司 | ✅   | select（公司清單 + 「其他」自填）  | 擋下，不可送出        |
| 被保人   | ✅   | 文字（自由打字，預設帶入「本人」） | 擋下，不可送出        |
| 險種     | ✅   | select（七選一，見下）             | 擋下，不可送出        |
| 保單名稱 |      | 文字                               | null → 顯示「不確定」 |
| 保單號碼 |      | 文字                               | null → 顯示「不確定」 |
| 投保日期 |      | 日期                               | null → 顯示「不確定」 |
| 繳費年期 |      | 數字（年）                         | null → 顯示「不確定」 |
| 保障期間 |      | 終身／定期到 X 歲                  | null → 顯示「不確定」 |
| 年繳保費 |      | 數字                               | null → 顯示「不確定」 |

**必填規則**：只有 `保險公司 / 被保人 / 險種` 三個硬性必填（空白擋下送出），保住紀錄最低識別度。其餘欄位留白即存 null，前端一律顯示「不確定」——不需要獨立的「不確定」按鈕，留白就是不確定。

### 保險公司清單

保險公司以 select 提供下列 34 家台灣保險公司，並附「其他（自行填寫）」讓使用者輸入清單外的公司。此清單是**前端 UI 常數**（web／mobile 共用一份），資料庫 `insurer` 仍存解析後的字串（選清單 → 存該公司名；選其他 → 存自填文字），不做 enum。

三商美邦人壽、中華郵政（壽險處）、中國信託產險、元大人壽、友邦人壽、台灣人壽、合作金庫人壽、安聯人壽、安達國際人壽、安達產險、宏泰人壽、明台產險、旺旺友聯產險、法國巴黎人壽、法國巴黎產險、泰安產險、保誠人壽、南山人壽、南山產險、第一金人壽、第一產險、國泰人壽、國泰世紀產險、凱基人壽、富邦人壽、富邦產險、華南產險、新光人壽、新光產險、新安東京海上產險、遠雄人壽、臺銀人壽、和泰產險、全球人壽

> 清單為 UI 常數，未來新增/更名保險公司只需改這份常數，不動 schema。

### B. 保障欄位（隨險種變）

- 選定險種後，B 區**預設帶出該險種的建議保障細項**（見下方六份清單）。
- 使用者可**增減**，非必填。
- 每個保障細項用 **select 從該險種清單挑選**，**最多 3 個**，每個填一個數值。
- 有填就寫入資料庫；沒填不寫。

---

## 七種險種與保障清單

險種為必填的單選。每種險種對應一份保障細項清單（供 select，最多選 3 項）。

| 險種        | enum                 | 保障細項清單（選最多 3）                                                            |
| ----------- | -------------------- | ----------------------------------------------------------------------------------- |
| 壽險        | `LIFE`               | 身故/全殘保額、完全失能保險金、祝壽保險金、豁免保費                                 |
| 醫療險      | `MEDICAL`            | 住院日額、實支實付上限、手術費用限額、門診手術金、加護病房日額、出院療養金          |
| 癌症險      | `CANCER`             | 初次罹癌保險金、癌症住院日額、化療/放療給付、癌症手術保險金、癌症身故保險金         |
| 意外險      | `ACCIDENT`           | 意外身故/失能保額、意外實支實付上限、意外住院日額、骨折未住院給付、重大燒燙傷保險金 |
| 儲蓄/投資型 | `SAVINGS_INVESTMENT` | 保額、宣告利率、目前保價金、解約金、累積增值回饋金                                  |
| 長照/失能   | `LONGTERM_CARE`      | 每月給付金、一次性給付金、失能扶助金、豁免保費、身故退還保費                        |
| 其他        | `OTHER`              | 無預設清單——保障細項改為**自由填寫** label + value（最多 3）                        |

**`OTHER` 的特例**：這是我們沒想到的險種的 catch-all。因為沒有預設保障清單，B 區改為讓使用者自由輸入保障名稱與數值（最多 3 筆），仍存成同樣的 `{ key, label, value }` 結構（`key` 可為自動產生的識別碼）。

---

## Schema 調整

現有 `Insurance` model 的欄位是為儲蓄/投資型設計的（`declaredRate`、`cashValueData`、`surrenderValue`、`accumulatedBonus` 等），無法涵蓋六種險種。因資料庫 0 筆，直接重設計。

### 新 `Insurance` model（方向）

```prisma
enum InsuranceType {
  LIFE
  MEDICAL
  CANCER
  ACCIDENT
  SAVINGS_INVESTMENT
  LONGTERM_CARE
  OTHER
}

model Insurance {
  id             String        @id @default(cuid())
  entryId        String        @unique
  entry          Entry         @relation(fields: [entryId], references: [id], onDelete: Cascade)

  // 核心必填
  insurer        String                        // 保險公司
  insuredName    String                        // 被保人
  insuranceType  InsuranceType                 // 險種

  // 核心選填（null = 不確定）
  policyName     String?
  policyNumber   String?
  startDate      DateTime?                     // 投保日期
  paymentTermYears Int?                        // 繳費年期
  coveragePeriod String?                       // 保障期間：終身 / 定期到 X 歲
  annualPremium  Decimal?                      // 年繳保費

  // 保障細項（最多 3）：[{ key, label, value }]
  coverage       Json          @default("[]")

  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt
}
```

**設計說明**

- `null` 統一代表「不確定」，前端據此顯示；不另設 flag 欄位。
- `coverage` 用 JSON array 存最多 3 筆 `{ key, label, value }`，因為保障細項是「每險種一份清單、選填、可增減」，用固定欄位會膨脹成幾十個 nullable column。
- 舊的儲蓄型專屬欄位（`declaredRate`、`cashValueData`、`sumInsured`、`surrenderValue`、`accumulatedBonus`、`accumulatedSumIncrease`、`currentAge`、`isPeriodicPayout`、`currency`、`premiumTotal`、`lastUpdatedAt`）移除；儲蓄/投資型的保價金、宣告利率改由 `coverage` JSON 承載。

### Zod schema（@repo/shared）

- 新增 `InsuranceType` enum（含 `OTHER`）與保單建立/更新 schema。
- `insurer` 存字串（清單或自填皆可）；公司清單屬 UI 常數，不在 schema 驗證。
- `coverage` 驗證：array 長度 ≤ 3，每項 `{ key, label, value }`；`LIFE`～`LONGTERM_CARE` 的 `key` 須屬於該險種合法清單，`OTHER` 允許自由 label（`key` 自動產生）。
- 三個必填欄位在 schema 層強制。

---

## 新增流程

1. `+` → `entry/new`：`categoryConfig` 新增「保險」top category（新主題色，標記為不計入淨值）。
2. 選「保險」→ 進保單表單（**新表單，非沿用一般 entry 表單**，因欄位差異大）。
3. 表單先選**險種**（必填），B 區保障細項清單隨之切換。
4. 送出：建立 `Entry`（`includeInChart = false`）+ 關聯 `Insurance`。

### 兩端都要改（monorepo）

- `apps/mobile/lib/categoryConfig.ts` **和** `apps/web/components/finance/categoryConfig.ts` 各加一份「保險」category。
- 保單表單頁：mobile 與 web 各一。
- 保單詳情頁：mobile 與 web 各一。

---

## 詳情頁呈現

保險分類卡片**不顯示金額**，只顯示「共 N 張保單」（符合純呈現定位）。對應地，保險 `Entry.value` 存 `0`（因 `includeInChart = false`，不影響淨值）。

點保險卡片 → 列出該分類下每張保單 → 點單張 → 獨立詳情頁：

- **上半**：保險公司、被保人、險種、保單名稱/號碼；null 欄位顯示「不確定」。
- **保障區**：列出 coverage 的 1～3 個細項與數值（如「住院日額 $2,000」）。
- **保費/期間區**：年繳保費、繳費年期、保障期間、投保日期；null 顯示「不確定」。
- 編輯/刪除入口。

呈現要比照 web 既有卡片風格（glass morphism、同色系），mobile 需先讀 web 版對齊。

---

## 已定案（原待解問題）

1. **保險卡片顯示金額** → 已定：不顯示金額，只顯示「共 N 張保單」；`Entry.value` 存 0。
2. **被保人輸入方式** → 已定：自由打字，預設帶入「本人」。

## 未來備忘（本階段不需處理）

- **淨值預測的交叉影響**：付費 spec 決策七的淨值預測原本想引用儲蓄型保單的宣告利率／保價金。舊 `Insurance` 有專屬欄位，重設計後這些改存於 `coverage` JSON。將來實作淨值預測時，需改從 JSON 取值，或重新評估是否納入保單現金價值。純屬提醒，本階段不阻塞、不需決定。
