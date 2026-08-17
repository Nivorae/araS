# 手機 App UI 架構

`apps/mobile` 的頁面地圖：每個畫面對應哪個檔案、底下有哪些子頁面 / 子區塊，以及它們用到的共用元件。
路由由 **Expo Router** 以檔案系統決定 —— `app/` 底下的目錄結構就是路由結構，括號目錄 `(app)` / `(auth)` / `(tabs)` 只做分組，不出現在網址裡。

---

## 1. 路由總覽

```
app/
├── _layout.tsx                      根 Layout：Sentry、ClerkProvider、登入導向、RevenueCat 初始化
├── +native-intent.tsx               Universal Link 路徑轉址（/assets→/、/more→/settings…）
│
├── (auth)/
│   └── welcome.tsx                  歡迎 / 登入頁            → /welcome
│
└── (app)/                           須登入。_layout 包 PremiumProvider + Stack
    ├── (tabs)/                      三個主分頁（底部 tab bar 隱藏，導覽用浮動 TopGlassNav）
    │   ├── _layout.tsx              Tabs 容器 + DataLoader（登入後抓一次全部資料）
    │   ├── index.tsx                首頁：資產總覽        → /
    │   ├── transactions.tsx         投資損益              → /transactions
    │   └── retirement.tsx           退休計劃              → /retirement
    │
    ├── entry/
    │   ├── new.tsx                  新增帳戶：分類選擇器   → /entry/new
    │   ├── form.tsx                 新增帳戶：填寫表單     → /entry/form
    │   ├── [id].tsx                 資產項目詳情          → /entry/:id
    │   └── [id]/edit.tsx            編輯項目 / 新增一筆記錄 → /entry/:id/edit
    │
    ├── insurance/
    │   ├── overview.tsx             保單總覽（3D 翻卡）    → /insurance/overview
    │   └── new.tsx                  新增保單              → /insurance/new
    │
    ├── settings.tsx                 設定                  → /settings
    └── paywall.tsx                  付費牆                → /paywall
```

### 導覽層級

| 層級   | 元件                           | 說明                                                               |
| ------ | ------------------------------ | ------------------------------------------------------------------ |
| 全域   | `app/_layout.tsx`              | 未登入 → 強制導向 `/welcome`；已登入而停在 `(auth)` → 導回 `/`     |
| 主導覽 | `components/TopGlassNav.tsx`   | 螢幕上方的浮動玻璃膠囊：三個 tab ＋ 設定 ＋「＋」新增鈕            |
| 分頁   | `app/(app)/(tabs)/_layout.tsx` | 原生底部 tab bar 以 `display: none` 隱藏，導覽完全交給 TopGlassNav |
| 堆疊   | `app/(app)/_layout.tsx`        | 其餘畫面（entry / insurance / settings）以 Stack push 疊上         |

---

## 2. 各頁面結構

### 2.1 歡迎 / 登入 — `app/(auth)/welcome.tsx`

未登入時的唯一入口。

- 背景：`components/FloatingCardsBackground.tsx`（浮動卡片動畫）
- 品牌區：`araS` ／ 個人資產管理工具
- 登入方式：Google OAuth（`hooks/useOAuth.ts`）、LINE OAuth、Apple 登入（`hooks/useAppleAuth.ts`）
- 錯誤訊息由 `lib/clerkError.ts` 轉成中文

### 2.2 首頁 · 資產總覽 — `app/(app)/(tabs)/index.tsx`

| 區塊        | 內容                                                                                     |
| ----------- | ---------------------------------------------------------------------------------------- |
| 上半（40%） | 淨資產金額、👁 隱藏餘額切換、下拉重新整理（僅此區可下拉）                                |
| 下半        | `components/CategoryCardStack.tsx` —— 分類卡片堆疊，可滑動預覽、點擊展開該分類的項目清單 |
| 空狀態      | 「＋ 新增第一筆資產」卡片 → `/entry/new`                                                 |

- 投資類項目的金額以**市值**顯示（`hooks/useInvestmentMarketValues.ts`），首次載入時以 spinner 擋住總額，避免先閃成本價
- 點項目：保險 → `/insurance/overview?focus=<id>`；其餘 → `/entry/:id`
- 卡片上的「＋」：保險 → `/insurance/new`；其餘 → `/entry/new?topCategory=<分類>`

### 2.3 投資損益 — `app/(app)/(tabs)/transactions.tsx`

上方是資產／負債天秤（`components/BalanceScale.tsx`），下方是**三個子分頁**（切換用 `display:none`，元件不卸載，所以來回切不會重新抓資料）：

| 子分頁 | 元件                                 | 權限        |
| ------ | ------------------------------------ | ----------- |
| 走勢   | `components/InvestmentChart.tsx`     | 免費        |
| 配置   | `components/AssetAllocationView.tsx` | **Premium** |
| 股息   | `components/DividendOverview.tsx`    | **Premium** |

免費用戶點「配置」或「股息」會直接跳 `/paywall`（伺服器端同樣有 403 把關）。

### 2.4 退休計劃 — `app/(app)/(tabs)/retirement.tsx`

單頁但分成數個可摺疊區段：

1. 標題區：目標達成率
2. **參數設定**（可摺疊）：退休規劃 / 通膨與報酬假設 / 持續投入
3. 追蹤卡：財務自由日預測、被動收入覆蓋率
4. **資產成長趨勢圖** — `components/retirement/ProjectionChart.tsx`
5. 情境模擬：年化報酬率、退休年齡兩支滑桿
6. **退休金流排程表**（可摺疊）：年齡／年份／投報／提領／餘額
7. 說明彈窗 — `components/retirement/InfoModal.tsx`

計算邏輯集中在 `lib/retirement.ts`。

### 2.5 新增帳戶（兩段式）

**第一段 · 分類選擇器 — `app/(app)/entry/new.tsx`**

- 上方大圖示 Hero 顯示目前主分類
- 中間主分類色點列（現金／投資／不動產／應收款／負債／保險…，定義在 `lib/categoryConfig.ts`）
- 下方 3 欄子分類網格；有下一層的子分類（如 股票 → 台股／美股）會鑽入，並在網格首格插入「返回」
- 選到最末層 → push `/entry/form`；選到「保險」→ 改走 `/insurance/new`

**第二段 · 表單 — `app/(app)/entry/form.tsx`**

薄殼，實際 UI 全在 `components/EntryForm.tsx`。表單內含的彈窗：

- `components/StockPickerModal.tsx` — 股票／貴金屬搜尋
- `components/BankPickerModal.tsx` — 銀行選擇（配 `components/BankLogo.tsx`）
- `components/DatePickerModal.tsx` — 日期
- `components/LoanFormFields.tsx` — 負債類專用欄位（貸款）

### 2.6 資產項目詳情 — `app/(app)/entry/[id].tsx`

| 區塊     | 內容                                                                      |
| -------- | ------------------------------------------------------------------------- |
| 標題卡   | 名稱、分類色、銀行 logo、目前金額；股票類另顯示損益（紅漲綠跌）           |
| 動作鈕   | ＋ 新增一筆記錄 → `/entry/:id/edit?mode=add`；✏️ 編輯 → `/entry/:id/edit` |
| 股息     | `components/DividendSection.tsx`（僅股票類）                              |
| 交易記錄 | 依「年月」分組的歷史清單，可編輯／刪除                                    |
| 彈窗     | 編輯記錄 Sheet（日期、變動金額、股數）                                    |

`DividendSection` 底下再開兩個 Sheet：`components/DividendForm.tsx`（登錄股息）與 `components/ReinvestSheet.tsx`（股息再投入）。

### 2.7 編輯項目 — `app/(app)/entry/[id]/edit.tsx`

同樣是薄殼，共用 `components/EntryForm.tsx`，以 `mode` 參數區分兩種用途：

- `?mode=add` → 新增一筆異動記錄（鎖住股票選擇器）
- 無參數 → 編輯基本資料（名稱、金額、股數、備註、是否計入圖表）

### 2.8 保單總覽 — `app/(app)/insurance/overview.tsx`

- 保單以 3D 卡片堆疊呈現，可左右翻閱；`?focus=<id>` 可直接定位到某張保單
- 點卡片 → 展開全螢幕詳情，底部動作列有「編輯」「刪除」
- 編輯模式直接內嵌 `components/InsuranceForm.tsx`（`detailMode: view | edit`）
- 此頁自帶 `TopGlassNav`，「＋」改成新增保單

### 2.9 新增保單 — `app/(app)/insurance/new.tsx`

薄殼，UI 在 `components/InsuranceForm.tsx`；內含 `components/InsurerPickerModal.tsx`（保險公司）與 `components/CoverageItemPicker.tsx`（保障項目）。**Premium 限定**。

### 2.10 設定 — `app/(app)/settings.tsx`

- 升級 Premium ／ 已升級 Premium → `/paywall`
- 管理訂閱（已訂閱時）
- 模擬升級／模擬取消（**僅 `__DEV__`**）
- 登出
- 刪除帳號（危險區，永久刪除）
- 版本資訊：`app.json` 的 version ＋ `Updates.createdAt`

### 2.11 付費牆 — `app/(app)/paywall.tsx`

`FloatingCardsBackground` 背景 ＋ 功能清單 ＋ 月／年方案卡（年繳標「最划算」）＋ 訂閱鈕 ＋ 回復購買 ＋ 自動續訂揭露 ＋ 使用條款／隱私權政策／支援連結。方案資料來自 RevenueCat（`lib/purchases.ts`）；Expo Go 下走預覽模式。

---

## 3. 共用元件對照表

| 元件                                                                            | 被誰用                                                         |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `TopGlassNav`                                                                   | 三個 tab、`insurance/overview`                                 |
| `FloatingCardsBackground`                                                       | `welcome`、`paywall`                                           |
| `CategoryCardStack`                                                             | 首頁                                                           |
| `BalanceScale` / `InvestmentChart` / `AssetAllocationView` / `DividendOverview` | 投資損益                                                       |
| `ProjectionChart` / `InfoModal`                                                 | 退休計劃                                                       |
| `EntryForm`                                                                     | `entry/form`、`entry/[id]/edit`                                |
| `InsuranceForm`                                                                 | `insurance/new`、`insurance/overview`                          |
| `DividendSection` → `DividendForm` / `ReinvestSheet`                            | `entry/[id]`                                                   |
| `StockPickerModal`                                                              | `EntryForm`、`DividendForm`                                    |
| `BankPickerModal` / `BankLogo`                                                  | `EntryForm`、`entry/[id]`                                      |
| `DatePickerModal`                                                               | `EntryForm`、`InsuranceForm`、`DividendForm`、`LoanFormFields` |
| `LoanFormFields`                                                                | `EntryForm`（負債類）                                          |
| `InsurerPickerModal` / `CoverageItemPicker`                                     | `InsuranceForm`                                                |

## 4. 狀態與資料層

| 檔案                                                                            | 職責                                                     |
| ------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `store/financeStore.ts`                                                         | Zustand：entries、valueSnapshots 等全域財務資料          |
| `hooks/useFinanceActions.ts`                                                    | 所有讀寫 API 的動作（`fetchAll` 等）                     |
| `hooks/useIsPremium.ts`                                                         | `PremiumProvider` ＋ 全域 `isPremium` 判斷               |
| `hooks/useInvestmentMarketValues.ts`                                            | 股票 / 貴金屬即時市值                                    |
| `hooks/useFocusRefresh.ts`                                                      | 回到頁面時重新整理                                       |
| `hooks/useAssetAllocation.ts` / `useCachedFetch.ts`                             | 資產配置分析（含快取）                                   |
| `lib/api.ts`                                                                    | 帶 Clerk token 的 fetch 封裝、`ApiError`                 |
| `lib/categoryConfig.ts`                                                         | 分類樹（名稱、顏色、圖示、是否負債）—— UI 分類的唯一來源 |
| `lib/format.ts` / `chartAggregation.ts` / `retirement.ts` / `stockConstants.ts` | 純計算與格式化                                           |
