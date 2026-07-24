# 資產配置分析 設計文件

**日期**：2026-07-24
**範圍**：Premium 資產配置分析功能——mobile 端實作（web 端另開後續 spec）
**狀態**：設計定案，待實作

---

## 背景

`2026-07-20-premium-tier-design.md` 定案的第一階段兩項工作之一（另一項「20 筆免費上限」已完成）。原文件只給了一句話範圍：「純計算，不改 schema，以 `Entry.topCategory`/`subCategory` 聚合，做各類佔比、集中度風險提示、資產/負債結構比」，本文件補完細節。

---

## 決策

### 決策一：進入點——併入投資損益頁的走勢圖切換

原規劃是「併入淨值圖表」，但查證後發現 mobile 資產頁（`(tabs)/index.tsx`）只有一個淨值數字，沒有任何歷史走勢圖表可掛；真正符合「淨值圖表（歷史）」的元件其實是 `(tabs)/transactions.tsx`（收支頁，UI 標題「投資損益」）裡的 `InvestmentChart`，已經在畫 `totalAssets`／`netWorth` 的期間長條圖。

改為在 `transactions.tsx` 加一個切換（「走勢」⇄「配置」），不新增頁面、不新增路由，兩者共用同一塊 `chartZone`。

### 決策二：一次顯示三件事

切到「資產配置」後，同一畫面內顯示：

1. 各類資產佔比清單（純文字列表 + 百分比，不畫圖表）
2. 集中度風險提示（單一 entry 佔比過高時的警示）
3. 資產/負債結構比（單一比率數字）

### 決策三：百分比分母——用「總資產」，不是「淨資產」

原文件寫「佔淨資產比重」，但淨資產 = 資產 − 負債，若用戶負債偏高，淨資產可能被壓得很小，導致單一類別佔比失真超過 100%（例：淨資產 50 萬，但持有 300 萬股票，算出「股票佔淨資產 600%」）。

修正後的分工：

- **佔比清單 + 集中度風險** → 分母改用「總資產」（不含負債、不含保險——保險本已 `includeInChart=false` 排除），所有類別加總等於 100%，是正常的資產配置概念。
- **資產/負債結構比** → 維持原意，呈現槓桿高不高，公式為「總負債 ÷ 總資產」。

### 決策四：集中度風險——單一 entry、40% 閾值

抓「單一 entry」層級（而非整個 topCategory 大類），貼近「單押一檔」的風險直覺。閾值 40%，與原設計文件的範例一致。若同時有多筆 entry 超標，全部列出，不只顯示第一筆。

### 決策五：免費用戶——直接彈 paywall

免費用戶點下「資產配置」切換鈕時，行為與現有 20 筆上限一致（`2dc21cc feat: prompt upgrade and open paywall when entry limit hit`）：直接開現有 paywall 畫面，不做模糊預覽。

**Server 端必須同步擋**：API 本身要對 free 用戶回 403，不能只靠前端擋切換鈕——參照 `entries.service.ts` 的 `EntryLimitError` 模式，client 端判斷僅用於提前呈現 paywall，不可作為唯一防線。

### 決策六：平台範圍——mobile 先做，web 後跟

符合專案現行慣例（mobile-first, web follows），且 premium 只有 iOS IAP。此 spec 僅涵蓋 mobile；web 端待此功能穩定後另開後續 spec。

---

## 計算邏輯

資料來源：`Entry`（`userId` scope），排除 `includeInChart=false`（保單本已排除）。資產/負債的判定沿用 `categoryConfig.ts` 各 topCategory 既有的 `isLiability` 旗標。

```
總資產 = Σ value，where !isLiability
總負債 = Σ value，where isLiability

佔比清單 = 依 topCategory 分組（僅資產類），
           每組 Σ value / 總資產，由大到小排序

集中度警示 = 資產類 entries 中，
             value / 總資產 >= 0.4 的每一筆，
             回傳 { entryId, name, percentage }

結構比 = 總負債 / 總資產
         （總資產為 0 時回傳 null，前端顯示「尚無資料」，避免除以零）
```

---

## API / Service

- **新增** `entriesService.getAssetAllocation(userId)`，回傳：
  ```ts
  {
    breakdown: {
      topCategory: string;
      value: number;
      percentage: number;
    }
    [];
    concentrationWarnings: {
      entryId: string;
      name: string;
      percentage: number;
    }
    [];
    debtToAssetRatio: number | null;
  }
  ```
- **新增路由** `GET /api/entries/allocation`：
  - `auth()` 檢查 → 401
  - `entitlementsService.isPremium(userId)` 檢查 → 非 premium 回 403（沿用 `ENTRY_LIMIT_REACHED` 類似的明確錯誤碼，例如 `PREMIUM_REQUIRED`）
  - 呼叫 service，`ok()` 包裝回傳

## 前端（mobile）——已實作

- `apps/mobile/app/(app)/(tabs)/transactions.tsx`：header 內加「走勢／配置」二段式 pill toggle，`chartZone` 依 `view` state 切換渲染 `InvestmentChart` 或新元件 `AssetAllocationView`
- Free 用戶（`useIsPremium`）點「配置」→ 直接 `router.push("/paywall")`，不切換畫面
- Premium 用戶 → 切到 `AssetAllocationView`（`apps/mobile/components/AssetAllocationView.tsx`），內部呼叫 `GET /api/entries/allocation`，渲染佔比清單、集中度警示、負債佔總資產比率

## 測試

- **Service 單元測試**（mock Prisma，`apps/web/tests/services/entries.service.test.ts`）：分類佔比計算、40% 集中度警示（含未達標不觸發）、`includeInChart=false` 排除、負債類別排除＋`debtToAssetRatio` 計算、總資產為 0 時的除以零保護 — 共 6 個測項，全數 TDD red→green
- **Route 測試**（`apps/web/tests/api/entries.allocation.route.test.ts`）：未登入 401、free 用戶 403 `PREMIUM_REQUIRED`（且不呼叫 service）、premium 用戶 200
- Mobile 端目前無自動化測試基礎設施（`apps/mobile` 無任何 `.test.ts(x)` 檔案、`package.json` 無 `test` script），UI 部分僅靠 lint + type-check 把關，與現有其他 mobile 功能開發模式一致

## 明確排除

- Web 端實作（後續另開 spec）
- 淨值預測、多幣別換算（第二階段項目，不在此範圍）
