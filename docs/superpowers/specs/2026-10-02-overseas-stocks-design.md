# 海外股票 設計文件

**狀態：規格定稿，尚未實作（2026-10-02）。**

## 問題

股票只有「台股」「美股」兩個子分類。使用者持有的倫敦掛牌 ETF（`VWRA.L`）、
港股（`0700.HK`）、日股（`7203.T`）等沒地方放，只能丟進「其他投資」，沒有報價、
沒有市值與損益。

報價來源 Yahoo 本來就支援這些市場，`normalizeSymbol` 也允許 `.L` 這類後綴 ——
缺的是分類、選股方式，以及非美元幣別的換算。

## 決策摘要

- **一個「海外股票」子分類統包所有非台、非美市場**，不按國家拆。
- **`Entry.stockCode` 存 Yahoo 完整代號**（`VWRA.L`），`buildYfSymbol` 原樣回傳，
  不加後綴。不改資料庫結構。
- **選股改用 Yahoo 即時搜尋**，不維護清單（英股、港股等沒有免費的完整代號清單）。
- **輔幣報價（`GBp` 等）在伺服器端轉成主幣**，所有用戶端的換匯路徑一次修好。
- **匯率抓不到時不再退回 1**：只要匯率不明，就當作這次報價失敗處理。
- 手機與網頁同時做（網頁目前與手機功能對齊，見 commit `64ec414`）。
- **成本一律存台幣**。付款不是台幣的話，在「依金額」旁邊用換匯計算機換算後帶入；
  不存付款幣別和原幣金額，所以損益是包含匯差的台幣總損益。
- 純 JS 改動，手機以 OTA 發佈。

## 資料模型

不改 schema。

| 欄位          | 值                                                        |
| ------------- | --------------------------------------------------------- |
| `topCategory` | `投資`                                                    |
| `subCategory` | `海外股票`                                                |
| `stockCode`   | Yahoo 完整代號，大寫：`VWRA.L`、`0700.HK`、`7203.T`       |
| `units`       | 持有股數                                                  |
| `value`       | 成本，台幣（跟其他股票一樣，EntryHistory.delta 一律台幣） |

## 後端

### 1. 輔幣正規化 —— `apps/web/services/quotes.service.ts`

Yahoo 對部分市場用輔幣報價，直接拿去查 `<currency>TWD=X` 會查不到。在
`QuotesService.fetchQuote` 回傳前統一轉換：

```ts
// Yahoo 用輔幣報價的市場：價格 ÷ 100、幣別改成主幣。
const MINOR_UNITS: Record<string, string> = {
  GBp: "GBP", // 倫敦（便士）
  GBX: "GBP",
  ZAc: "ZAR", // 約翰尼斯堡（分）
  ILA: "ILS", // 特拉維夫（阿哥拉）
};

export function normalizeQuoteCurrency(price: number, currency: string) {
  const major = MINOR_UNITS[currency];
  return major ? { price: price / 100, currency: major } : { price, currency };
}
```

- 比對**區分大小寫**：`GBp` 是便士，`GBP` 是英鎊。
- 套用在 `fetchFromYahoo` 的回傳值（Finnhub、CoinGecko 的 fallback 一律是 USD，不受影響）。
- `/api/stocks/price` 和 `/api/quotes/[symbol]` 都經過 `fetchQuote`，兩個端點同時修好。

### 2. 股利端點 —— `apps/web/app/api/stocks/dividend/route.ts`

`summaryDetail.dividendRate` 跟報價用同一個幣別。讀取 `summaryDetail.currency`，
用 `normalizeQuoteCurrency` 換算 `dividendRate`，並在回應裡加上 `currency`：

```ts
{ dividendRate: number | null, dividendYield: number | null, currency: string | null }
```

`dividendYield` 是比例，不換算。新增的欄位不影響舊用戶端。

### 3. 搜尋端點 —— `apps/web/app/api/stocks/search/route.ts`（新增）

`GET /api/stocks/search?q=<query>`

- 已在 `middleware.ts` 的 `/api/stocks/*` 保護範圍內；路由內照慣例自己呼叫
  `auth()`，沒有 `userId` 就回 401 並 `logSecurityEvent({ type: "auth_fail", resource: "/api/stocks/search" })`。
- `q` 去掉前後空白後必須是 1–40 字元，否則 400 `{ error: "q is required" }`。
- 上游：`https://query2.finance.yahoo.com/v1/finance/search?q=<q>&quotesCount=20&newsCount=0&listsCount=0`，
  透過 `fetchWithRetry`，帶 `User-Agent: Mozilla/5.0`，`next: { revalidate: 3600 }`。
  上游回 401 時用 `getYahooCrumb()` 帶 crumb 重試一次（同股利端點的做法）；仍失敗就回 502。
- 過濾規則（全部要成立）：
  - `quoteType` 是 `EQUITY` 或 `ETF`
  - `normalizeSymbol(symbol)` 通過
  - 代號含 `.`（美股沒有後綴，請使用者改用「美股」分類）
  - 後綴不是 `.TW` / `.TWO`（台股請使用者改用「台股」分類）
- 回應沿用其他 `/api/stocks/*` 的格式，直接回陣列、不包 envelope：

```ts
type OverseasSearchItem = {
  code: string; // "VWRA.L"
  name: string; // longname ?? shortname ?? symbol
  exchange: string; // exchDisp ?? exchange，例如 "London"
};
```

- 過濾後沒有結果就回 `[]`（200）。
- 搜尋邏輯放在 `apps/web/services/stock-search.service.ts`，路由只負責 HTTP，方便寫單元測試。

### 4. 股利記錄 —— `apps/web/services/dividends.service.ts`

`STOCK_CATS` 加上 `海外股票`。

## 共用常數

`海外股票` 這個字串在兩邊都定義成常數 `OVERSEAS_SUBCATEGORY`，不直接寫字面值。

### 手機 `apps/mobile/lib/stockConstants.ts`

- `INVESTMENT_CATS`：在 `美股` 後面加 `海外股票`
- `STOCK_CATS`：`["台股", "美股", "海外股票", "加密貨幣", "貴金屬"]`
- `buildYfSymbol`：`subCategory === OVERSEAS_SUBCATEGORY` 時回傳 `code.toUpperCase()`
- `getUnitsLabel`：`海外股票` 回傳 `持有股數`
- `StockItem` 加上選填的 `exchange?: string`

### 網頁 `apps/web/lib/stockSymbol.ts`

`buildYfSymbol` 同上。`AccountFormPage.tsx`（三處）和 `EntryDetailPage.tsx`（一處）
目前各自用三元運算式重寫後綴邏輯，**全部改成呼叫 `buildYfSymbol`**；不然海外代號
會拿到錯的後綴。

### 分類設定

`apps/mobile/lib/categoryConfig.ts` 和 `apps/web/components/finance/categoryConfig.ts`：
在「股票」底下的 `美股` 後面加 `{ name: "海外股票", icon: Globe }`（`lucide-react-native` /
`lucide-react` 的 `Globe`）。

### 其他寫死清單的地方

| 檔案                                              | 改動                                                                           |
| ------------------------------------------------- | ------------------------------------------------------------------------------ |
| `apps/mobile/lib/demo/engine.ts` `STOCK_CATS`     | 加 `海外股票`（demo 模式可以記錄股利）                                         |
| `apps/web/components/finance/AccountFormPage.tsx` | `INVESTMENT_CATEGORIES`、`STOCK_PICKER_CATEGORIES` 加上去；單位標籤 `持有股數` |
| `apps/web/components/finance/EntryDetailPage.tsx` | `STOCK_PICKER_CATEGORIES`、`DIVIDEND_CATEGORIES` 加上去                        |

demo 模式的 `/api/stocks/*` 本來就會直接打真的 API（`router.ts` 的 `PASSTHROUGH_PREFIXES`），
搜尋端點不用另外處理。

## 選股 UI

### 手機 `apps/mobile/components/StockPickerModal.tsx`

`subCategory === OVERSEAS_SUBCATEGORY` 時進入**遠端搜尋模式**，其他分類維持原本的
「載入整份清單、本機過濾」：

- 開啟時不載入清單。
- 輸入框 placeholder：`輸入代號或名稱，例如 VWRA、0700、7203`。
- 停止輸入 400ms 後呼叫 `/api/stocks/search?q=`；用遞增的 request id 只採用最新一次的
  回應，避免舊的結果蓋掉新的。
- 每一列：上方 `code`，下方 `name · exchange`（沿用現有 `s.code` / `s.stockName` 樣式）。
- 「最近選過」照原本邏輯，存 key `stockRecent:海外股票`，含 `exchange`。

| 狀態                     | 畫面                                                                         |
| ------------------------ | ---------------------------------------------------------------------------- |
| 尚未輸入                 | 有紀錄就顯示「最近選過」；沒有的話置中灰字：`搜尋倫敦、香港、東京等海外市場` |
| 搜尋中                   | 置中 `ActivityIndicator` + `搜尋中…`                                         |
| 沒有結果                 | `找不到符合的股票。美股請到「美股」，台股請到「台股」分類新增。`             |
| 失敗（非 2xx／網路錯誤） | `搜尋失敗，請稍後再試`                                                       |
| 有結果                   | 結果清單                                                                     |

### 網頁 `apps/web/components/finance/StockPickerPage.tsx`

行為、文案、debounce、狀態都跟手機相同。

### 選定之後

`EntryForm.tsx` 選股後原本就會抓價格，並顯示 `{currency} × {匯率}`，海外股票直接沿用。
因為伺服器已經做過輔幣正規化，`ISF.L`（Yahoo 報 `GBp`）會顯示 `GBP × 41.xx`，不會出現 `GBp`。

## 付款幣別：只記台幣，提供換匯計算機

使用者買海外股票時，可能用台幣（複委託台幣交割）、美元，或該國貨幣付款。**App 只記台幣
成本**，不另外存付款幣別或原幣金額。如果付款不是用台幣，用計算機換算成台幣後帶入。

### 入口 —— `apps/mobile/components/EntryForm.tsx`

- 在「依金額」模式下，「投入金額 (TWD)」標籤右邊放一個小按鈕，圖示用 `lucide-react-native`
  的 `Calculator`（16px，`#8e8e93`），`hitSlop` 8。
- **只有報價幣別不是台幣時才顯示**（`currency !== "TWD"`），也就是美股、海外股票、加密貨幣、
  貴金屬會有，台股不會有。還沒選股、還不知道幣別時不顯示。
- 「依股數」模式不顯示：那個模式是股數 × 股價，不需要使用者輸入金額。

### 計算機 —— `apps/mobile/components/FxCalculatorSheet.tsx`（新增）

用 `@/components/Modal` 做的底部表單，props：

```ts
interface Props {
  visible: boolean;
  onClose: () => void;
  quoteCurrency: string; // 這檔股票的報價幣別，例如 "GBP"
  quoteFxRate: number | null; // 表單已經抓到的報價幣別匯率，沒有就是 null
  onApply: (twdAmount: number) => void;
}
```

由上到下的欄位：

1. **付款幣別**：放在「外幣金額」輸入框右邊的按鈕，只顯示目前的幣別（例如 `JPY 日圓 ⌄`）。點了收起鍵盤、在輸入框下方展開 4 欄的幣別格子（全部一次看得到，不橫向滑動），選定後收起；回到輸入框打字也會收起。
   格子的選項由 `apps/mobile/lib/fx.ts` 的 `calculatorCurrencies(quoteCurrency)` 產生：報價幣別排第一，
   後面接常用幣別 `POPULAR_CURRENCIES`（USD 美元、JPY 日圓、EUR 歐元、KRW 韓圓、GBP 英鎊、
   HKD 港幣、CNY 人民幣、AUD 澳幣、SGD 新加坡幣、CAD 加幣、CHF 瑞士法郎），不重複。報價幣別
   不在清單裡（例如 SEK）時，按鈕只顯示代碼。預設選報價幣別。這些幣別在 Yahoo 都有
   `<幣別>TWD=X`（2026-10-02 驗證過）。
2. **外幣金額**：`decimal-pad`，開啟時自動 focus，右邊顯示目前選的幣別。
3. **匯率**：預先帶入匯率，可以改成實際換匯的匯率。下方小字的提示：
   - 帶入的是即時匯率：`即時匯率，可改成實際成交匯率`
   - 抓不到匯率：欄位留空，placeholder 是 `請輸入匯率`，提示改成 `抓不到即時匯率，請手動輸入`
   - 匯率來源：選 `quoteCurrency` 而且 `quoteFxRate` 有值，就直接用它；否則呼叫
     `/api/stocks/price?symbol=<幣別>TWD=X`，抓取時欄位顯示 `ActivityIndicator`。**失敗時不退回 1。**
   - 切換幣別時重新帶入該幣別的匯率；使用者手動改過的匯率會被換掉（換了幣別，
     舊匯率本來就不適用）。
4. **結果**：`= NT$ 31,234`，即時計算 `外幣金額 × 匯率`，四捨五入到整數，用 `formatCurrency`
   格式化。任一欄位不是正數時顯示 `= NT$ --`。
5. **按鈕「帶入」**：任一欄位不是正數時 disabled。按下後呼叫 `onApply(Math.round(結果))`
   並關閉。`EntryForm` 收到後 `setAmountStr(String(twdAmount))`，再清掉 `error`。

關閉、或按左上「取消」時不改動表單。每次打開都是空白的外幣金額；計算機的輸入不保存、
不上傳。

### 網頁

網頁的 `AccountFormPage.tsx` 沒有「依金額」模式（只能輸入股數 × 股價），所以**這次不加計算機**。
網頁使用者手動輸入原幣股價時，本來就會自動換算成台幣。

## 匯率失敗處理

下列地方查不到 `<currency>TWD=X` 時會**退回匯率 1**，結果把外幣金額直接當成台幣。
以前只有美元，這個問題被掩蓋了；加入多幣別之後一定會踩到，所以一起修：

| 位置                                                         | 改成                                                                         |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| `apps/mobile/hooks/useInvestmentMarketValues.ts` `toTwdRate` | 回傳 `null`；呼叫端 `continue`，該筆不放進 `result`，沿用成本                |
| `apps/mobile/app/(app)/entry/[id].tsx` 股價 effect           | 匯率為 `null` 時整次報價視為失敗，畫面上保留原本的數字                       |
| `apps/mobile/app/(app)/entry/[id].tsx` `loadFundQuote`       | 同上                                                                         |
| `apps/mobile/components/EntryForm.tsx` `fetchPriceFor`       | 匯率失敗時不設定 `originalPrice`，維持「抓不到價格」的狀態，讓使用者手動輸入 |
| `apps/web/components/finance/AccountFormPage.tsx`（三處）    | 同 `EntryForm`                                                               |

`DividendForm` 和 `ReinvestSheet`（兩邊）已經用 `fxLoading` 擋送出，並提示使用者改用
台幣總額輸入，**不用改**。

### 網頁詳情頁的既有 bug —— `apps/web/components/finance/EntryDetailPage.tsx`

- **市值完全沒換匯**：`currentMarketValue = totalUnits * currentPrice`，用的是原幣價格，
  所以網頁上美股的市值和損益現在就是錯的（美元數字直接當台幣用）。改成跟手機
  `[id].tsx` 一樣，分開存 `currentPrice`（原幣，只用來顯示）和 `currentPriceTWD`
  （換算後的台幣價），市值、`totalPnL`、每筆的 `recordPnL` 都改用 `currentPriceTWD`；
  非台幣時在「當日股價」旁邊標上幣別。匯率失敗就照上表的規則，當作報價失敗。
- **股利估算寫死 `USDTWD=X`**：改成用股利端點回傳的 `currency`，`currency === "TWD"`
  時不換算。

## 資產配置

`apps/mobile/components/AssetAllocationView.tsx` 的「台股／美股比例」改成按市場累加：

- 累加 `台股`、`美股`、`海外股票` 三個值。
- 標題沒有海外持股時維持 `台股／美股比例`；有的話改成 `股票市場比例`。
- 內文只列金額大於 0 的市場：`台股 52.1% / 美股 30.4% / 海外 17.5%`。
- 三個都是 0 時維持現有的空狀態文案。

## 不做的事

- **不按國家細分**，也不在配置圖拆出各國比重。
- **不支援基金、指數、期貨的搜尋結果**（`quoteType` 只收 `EQUITY`、`ETF`）。
- **不搬移既有資料**：放在「其他投資」的海外持股由使用者自己刪掉重建。
- **不拆分股價損益和匯差損益**：要拆就得在每筆交易存原幣金額和匯率（`EntryHistory`
  加欄位）。在那之前輸入的紀錄沒有原幣資料，以後也拆不出來。
- **網頁不加換匯計算機**（網頁沒有「依金額」模式）。
- **不加網頁付費牆相關改動**（見 CLAUDE.md「Known won't-fix」）。
- **行銷頁、`llms.txt` 先不改**：等手機版上線後再一起更新 SEO 那幾個檔案，避免頁面寫
  「支援海外股票」但 App 還沒有這個功能。

## 測試

單元測試（`apps/web/tests/`，Prisma 與 `fetch` 都 mock 掉）：

- `quotes.service`：`GBp 4500` → `GBP 45`；`GBP 45` 不變；`ZAc`、`ILA` 各一個案例；
  `USD`、`TWD` 不變。
- `stock-search.service`：
  - 過濾掉無後綴（美股）、`.TW`、`.TWO`、`MUTUALFUND`、`INDEX`、不符 `SYMBOL_PATTERN` 的代號
  - `name` 的 fallback 順序：`longname` → `shortname` → `symbol`
  - 上游 401 → 帶 crumb 重試；再失敗就丟錯
- `/api/stocks/search` 路由：未登入回 401、`q` 空字串或超過 40 字回 400、上游失敗回 502、
  過濾後沒有結果回 `[]`。
- `/api/stocks/dividend`：`GBp` 的 `dividendRate` 會 ÷100，並回傳 `currency: "GBP"`。
- `dividends.service`：`海外股票` 的項目可以建立股利紀錄。
- `tests/mobile-demo/engine.*`：demo 引擎接受 `海外股票` 的股利紀錄。
- `apps/mobile/lib/fx.ts`（測試在 `tests/mobile/fx.test.ts`）：匯率抓不到、回應不是正數時回 `null`，不回 1；同一次刷新每個幣別只查一次。

實機驗證（Expo Go，dev server）：

1. 新增 → 投資 → 股票 → 海外股票 → 搜尋 `VWRA` → 選 `VWRA.L` → 價格顯示 `USD × 匯率`。
2. 新增 `ISF.L`（Yahoo 報 `GBp`）→ 價格顯示 `GBP`，約 10 鎊（不是一千多便士）。
3. 新增 `0700.HK` → 顯示 `HKD`。
4. 首頁總資產與投資頁的市值有算進這三筆；資產配置顯示「股票市場比例」。
5. 搜尋 `AAPL`、`2330` → 出現「美股請到…」的提示。
6. 在 `VWRL.L` 記錄一筆股利 → 成功入帳。
7. 新增 `ISF.L` → 依金額 → 點計算機 → 預設選 GBP，匯率已帶入 → 輸入 `1000` →
   顯示 `= NT$ 4x,xxx` → 切到 JPY，匯率換成日圓匯率（約 0.2）→ 按「帶入」，投入金額欄位變成那個數字。
8. 台股的「依金額」不出現計算機按鈕；`VWRA.L`（美元報價）的計算機第一顆是 USD，清單裡不會再出現第二顆 USD。
9. 網頁打開同一筆 `VWRA.L` 和一筆美股的詳情頁 → 市值是台幣，跟手機上的數字一樣。
