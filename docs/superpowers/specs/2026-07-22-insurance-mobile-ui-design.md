# 保險模組 Mobile UI 設計（Plan C2）

**日期**：2026-07-22
**範圍**：apps/mobile 保單新增流程、entry 列表呈現、保單詳情頁
**狀態**：設計定案，待寫 plan
**關聯**：

- 欄位模型／流程定案：`2026-07-22-insurance-module-design.md`
- 分層歸屬（Premium）：`2026-07-20-premium-tier-design.md`
- 資料／API 層（已完成）：`2026-07-22-insurance-data-api.md`（Plan C1）
- 專案方向：mobile-first——本設計主導，之後回推簡化版 web（Plan C3）

---

## 背景

Plan C1 已完成保險的資料層與 REST API（`InsuranceService`、`/api/insurances/**`、Zod schema、共用常數），但完全沒有 UI 出口。本設計把它接上 apps/mobile，是 mobile-first 政策下第一個從零設計的新功能——不參照任何既有 web 保險畫面（web 端本來就沒有），之後 Plan C3 會依本設計回推一份簡化版 web UI。

`2026-07-22-insurance-module-design.md` 已定案：保單走獨立新增流程（非沿用一般 entry 表單，因欄位差異大）、entry 列表以新主題色卡片呈現、點進去是獨立的保單詳情頁。本文件把這些原則落地成 apps/mobile 的具體檔案、元件、路由與資料流。

---

## 一、Schema 補丁（先做，屬 C1 收尾）

現況缺口：`entry.insurance`（`InsuranceSummarySchema`）只帶 `insuranceType / insurer / insuredName`，沒有 insurance 自己的 `id`。但 `GET/PATCH/DELETE /api/insurances/[id]` 都是用 insurance 的 `id` 查，且沒有 by-entryId 的查詢路由。保單詳情頁若要串到完整保單資料，目前的 entry list payload不夠。

**修法**：

- `packages/shared/src/schemas/finance.ts` 的 `InsuranceSummarySchema` 新增 `id: z.string()`。
- `apps/web/services/entries.service.ts`（約 line 57）的 Prisma `select: { insuranceType: true, insurer: true, insuredName: true }` 加上 `id: true`。

純新增欄位，不改動既有形狀；`insurance.service.ts`、`/api/insurances/**` route 不需要改。mobile 拿到 `entry.insurance.id` 後即可直接呼叫 `GET /api/insurances/[id]` 取得完整紀錄。

## 二、categoryConfig 調整（apps/mobile/lib/categoryConfig.ts）

「保險」目前是「固定資產」底下的葉節點（line 96），升級為獨立 `TopCategory`：

```ts
{
  name: "保險",
  color: "#B8865E",     // 暖色琥珀棕，目前色盤未用過的色系
  textColor: "#FFFFFF",
  isLiability: false,
  children: [],          // 空——險種選擇不透過分類選單，見下
}
```

`children: []` 是刻意的：險種（7 選一）不是 categoryConfig 的子分類節點，而是保單表單裡的第一步。

`apps/mobile/app/(app)/entry/new.tsx` 加一個特例：點到「保險」這個 TopCategory 時**不走既有的子分類選單**（因為沒有 children 可挑），直接 `router.push('/insurance/new')`。

## 三、新增保單流程

新建：

- `apps/mobile/app/(app)/insurance/new.tsx` — 路由入口，渲染 `InsuranceForm`
- `apps/mobile/components/InsuranceForm.tsx` — 表單本體，完全獨立於 `EntryForm.tsx`

單頁滾動表單，不做分步 wizard（app 目前沒有 wizard 互動模式，維持與其他表單一致的體驗）：

1. **險種**單選（7 顆 chip：壽險/醫療險/癌症險/意外險/儲蓄投資型/長照失能/其他）。一選定，B 區立即展開對應的保障細項選項（局部 state 驅動，不重新導航）。
2. **基本資料**：
   - 保險公司——`InsurerPickerModal`（新建，仿 `BankPickerModal` 的 modal 殼、`StockPickerModal` 的可搜尋清單模式），資料源 `INSURER_LIST`（`packages/shared/src/constants/insurance.ts`）+「其他」自由輸入
   - 被保人——文字輸入，預設帶入「本人」
   - 保單名稱、保單號碼——文字輸入，選填
   - 投保日期——複用既有 `DatePickerModal`
   - 繳費年期（年）、年繳保費——數字輸入，選填
   - 保障期間——文字輸入（終身／定期到 X 歲），選填
3. **B 區保障細項**（最多 3 項，選填）：
   - 非 OTHER 險種：「+ 新增保障」開一個單選 modal（新建 `CoverageItemPicker`），列出 `INSURANCE_COVERAGE_OPTIONS[type]` 扣掉已選項目；選完帶回一列「label + 數值輸入」，每列可移除
   - OTHER 險種：無預設清單，直接自由輸入 label + 數值，最多 3 列，`key` 前端自動產生識別碼
4. **送出**：`useFinanceActions.ts` 新增 `addInsurance(data)`（POST `/api/insurances`，payload 形狀對齊 `CreateInsuranceSchema`）。成功後呼叫既有 `fetchAll()` 刷新 entries（保單摘要就會出現在列表），`router.back()` 或導回 entry 列表。三個必填欄位（保險公司/被保人/險種）在送出前做 client 端檢查，擋下並提示。

## 四、Entry 列表呈現（apps/mobile/components/CategoryCardStack.tsx）

現有卡頭邏輯是加總該分類全部 entries 的 `value`；保單 `value` 恆為 0，加總會顯示「$0」，不符合「保險卡片不顯示金額，只顯示共 N 張保單」的定案。

**修法**：`CategoryCardStack.tsx` 加一個特例，當 `topCategory.name === "保險"` 時：

- 卡頭顯示「共 N 張保單」（N = 該分類 entries 數）取代金額加總
- 展開後的每一列不顯示金額，改顯示「保險公司 · 險種」
- 點擊列項時，若 `entry.insurance` 存在，用 `entry.insurance.id` 導到 `/insurance/[id]`（而非通用的 `/entry/[id]`）

其餘分類卡片行為不變。

## 五、保單詳情頁

新建 `apps/mobile/app/(app)/insurance/[id].tsx`（`[id]` 是 insurance 自己的 id，不是 entry id）。

資料層：`useFinanceActions.ts` 新增 `fetchInsurance(id)`（GET `/api/insurances/[id]`）。**不進 Zustand store**——這份完整保單資料只有詳情頁用得到，用畫面內 local state（`useState` + `useEffect` on mount）即可，不需要像 `historyByEntry` 那樣做全域快取（YAGNI）。

呈現（比照 `2026-07-22-insurance-module-design.md` 定案的詳情頁結構）：

- **上半**：保險公司、被保人、險種、保單名稱、保單號碼；null 一律顯示「不確定」
- **保障區**：列出 `coverage` JSON 陣列的 1～3 個細項與數值
- **保費/期間區**：年繳保費、繳費年期、保障期間、投保日期；null 顯示「不確定」
- **編輯入口**：重用 `InsuranceForm`，新增 `isEdit` prop 帶入既有值，送出改打 `updateInsurance(id, data)`（PATCH `/api/insurances/[id]`）
- **刪除入口**：確認 `Alert` → `deleteInsurance(id)`（DELETE `/api/insurances/[id]`）→ `fetchAll()` 刷新 entries + `router.back()`

## 六、驗證方式

`apps/mobile` 目前沒有自動化測試，一律走 Expo Go 真機手動驗證（符合既有專案慣例）。本次驗證涵蓋：新增保單（7 種險種各測一次必填擋下 + 完整填寫）→ entry 列表卡片呈現（共 N 張保單、無金額）→ 點進詳情頁（null 顯示不確定）→ 編輯 → 刪除。

因為動到 `packages/shared`（`InsuranceSummarySchema` 加 `id`），需補一個 vitest 案例驗證 `Entry.insurance.id` 有正確序列化；並重跑 `apps/web` 既有的 insurance route 測試（GET/PATCH/DELETE ownership 那 10 案）確認不受影響。

---

## 明確排除（本次不做）

- 不做分步 wizard 表單
- 不做保單列表的搜尋／篩選
- 不做 Plan C3（web UI）——本文件是 C3 的設計依據，但 web 實作另開 plan
- 不處理淨值預測交叉引用保單保價金（見 `insurance-module-design.md` 的「未來備忘」，本階段不阻塞）

## 待解問題

無。設計面已收斂，剩餘為實作事項。
