# 行為分析（Analytics）

這份文件說明 araS iOS App 的行為追蹤：埋了哪些事件、為什麼是這些、資料怎麼從
手機流到 PostHog，以及怎麼用這些事件算出三個核心指標。

不熟悉這個專案的人也讀得懂 —— 需要的背景都寫在下面。

---

## 1. 這件事在解什麼問題

araS 是一支已在 App Store 上架的個人資產記錄 App（Expo / React Native），採
免費 + 訂閱制：免費版最多記 20 筆資產／負債，Premium 解除上限並開啟資產配置
分析、股利紀錄、保單管理。

導入分析之前，我們手上**只有 App Store Connect 的取得端數據**：下載數、商店頁
轉換率、付費筆數。這組數據可以告訴我們「下載後 7 天內只有 0.6% 轉付費」，
但完全答不出下一句話 —— **這 99.4% 是在哪一步走掉的？**

可能是：

- 下載後打開，看不懂這是什麼，直接關掉
- 看得懂，但不想用 Apple／Google／LINE 登入
- 登入了，但沒有記下第一筆（沒有 activation，App 對他就是空的）
- 記了帳，但從來沒碰到需要付費的功能（沒看過訂閱頁）
- 看過訂閱頁，但沒買

這五種流失要用**完全不同的方法**去修，而取得端數據無法區分它們。所以這條漏斗
的目標不是「蒐集更多數據」，而是**把一個 0.6% 的數字拆成五段，讓下一步的改動
有依據**。

---

## 2. 事件定義

全部事件都在 `apps/mobile/lib/analytics/events.ts` 定義，**程式碼裡任何地方都
不准出現事件名稱的字串字面量**。原因很實際：事件名稱一旦送出就是歷史資料的
key，打錯字不會報錯，只會讓漏斗默默少算一段。

| 事件                   | 觸發時機                                                    | 參數                                                                  | 用途                                                  |
| ---------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------- |
| `app_open`             | App 進入前景：冷啟動，或從背景（`background`）回到 `active` | `is_first_open: boolean`<br>另有共通參數 `environment`、`app_version` | 漏斗的分母。`is_first_open` 為真的使用者數 = 新安裝數 |
| `onboarding_complete`  | 在登入頁按 ? 開啟三步說明，滑到最後一頁按「開始使用」       | `steps_completed: number`                                             | 有多少人主動看完說明                                  |
| `first_record_created` | 這台裝置**生涯第一筆**資產紀錄寫入成功，只會發生一次        | `seconds_since_first_open: number`                                    | **Activation**，整條漏斗最重要的一個事件              |
| `record_created`       | 每一次成功新增資產／負債紀錄                                | `record_type: string`（頂層分類：流動資金／投資／不動產／負債…）      | 使用深度；哪一類資產最常被記                          |
| `paywall_viewed`       | 訂閱頁真的顯示在畫面上                                      | `trigger_source: string`（見下表）                                    | 有多少人碰到付費牆、從哪個入口碰到                    |
| `subscribe_clicked`    | 點擊訂閱 CTA，**不論後續成功、取消或失敗**                  | `plan: string`（`ANNUAL`／`MONTHLY`…）                                | 訂閱頁本身的說服力                                    |
| `subscribe_success`    | 金流（RevenueCat / StoreKit）回報購買成功                   | `plan: string`、`is_trial: boolean`                                   | 真正的付費轉換                                        |

> **關於 `onboarding_complete` 的重要前提：** 這支 App 沒有強制的新手引導流程。
> 登入頁（Logo + 三顆 OAuth 按鈕）就是第一個畫面，說明是右上角 ? 按鈕開啟的
> bottom sheet，**使用者主動打開才會看到**。所以這個事件量測的是「有多少人
> 主動想搞懂這是什麼、而且看完了」，不是漏斗上一道所有人都會經過的關卡 ——
> 它的絕對數量會遠低於 `app_open`，那是預期內的，不代表壞掉。
>
> 這裡是 7 個事件。原始需求寫「六個事件」但表格列了 7 行；`subscribe_clicked`
> 與 `subscribe_success` 是兩個不同時機、缺一不可 —— 前者量訂閱頁的說服力、
> 後者量金流的完成率，兩者之間的落差就是「想買但沒買成」。所以 7 個全部實作。

### `trigger_source` 的可能值

App 裡每一個進入訂閱頁的入口都會帶上 source，這樣「哪個入口最會帶來付費」
才答得出來：

| 值                  | 入口                                        |
| ------------------- | ------------------------------------------- |
| `allocation_tab`    | 資產損益頁的「配置」分頁（Premium 功能）    |
| `dividend_tab`      | 資產損益頁的「股息」分頁（Premium 功能）    |
| `settings_card`     | 設定頁的「升級 Premium」卡片                |
| `entry_limit`       | 新增資產時撞到免費版 20 筆上限的提示        |
| `insurance_form`    | 新增／編輯保單時的 Premium 提示             |
| `dividend_form`     | 新增股利紀錄時的 Premium 提示               |
| `dividend_reinvest` | 股利再投資時的 Premium 提示                 |
| `finance_planning`  | 退休頁切換到「理財規劃」模式（免費帳號）    |
| `unknown`           | 沒帶 source（深連結，或未來新增入口時漏帶） |

`unknown` 是刻意保留的防呆值：漏帶 source 時事件不會消失，只會落在這一格，
在後台一眼就看得出來有東西沒接上。

### 共通參數（super properties）

每個事件都自動帶上：

- `environment`：`development`（`__DEV__` build）或 `production`。開發時產生
  的事件不會污染正式數據 —— 後台只要 filter `environment = production`。
  這個做法沿用專案裡 Sentry 已經在用的同一套分流。
- `app_version`：`app.json` 的版本號，用來比較改版前後的漏斗。

---

## 3. 隱私：什麼**不會**被蒐集

這是一支記錄個人財務的 App，所以隱私邊界必須是設計的一部分，不是事後補的。

**絕不送出：**

- Email、姓名、Clerk userId，或任何帳號識別資訊
- 帳目名稱、金額、任何一筆資產的內容
- 畫面截圖或錄影

**做法上的保證，而不只是承諾：**

1. **使用者識別只用裝置層級匿名 ID。** 我們從不呼叫 PostHog 的 `identify()`，
   使用者在後台就是 SDK 產生的一組匿名 UUID（存在裝置本機的 AsyncStorage）。
   換手機或重裝 = 一個新的匿名使用者，這是刻意的取捨。
2. **關掉所有自動蒐集。** Session Replay 會錄到畫面上的金額，明確關閉；
   autocapture（自動記錄點擊與畫面）需要透過 `<PostHogProvider>` 才會啟用，
   我們刻意不使用那個 Provider。**結果是只有上面表列的事件會被送出，沒有別的。**
3. **型別擋住人為疏失。** `track()` 的簽章綁在 `AnalyticsEventProperties` 這張
   型別表上，想多送一個 email 或金額欄位會是**編譯錯誤**，而不是上線後才在後台
   被發現。
4. `record_created` 只帶頂層分類（例如「投資」），不帶子分類、名稱或金額。

---

## 4. 三個核心指標怎麼算

三個指標對應三段流失。分母刻意是**前一段的結果**而不是全部使用者 —— 這樣每個
數字都只描述「這一段」發生了什麼，壞掉的那一段才指得出來。

### 啟用率（Activation Rate）

```
啟用率 = first_record_created 的使用者數 ÷ is_first_open = true 的 app_open 使用者數
```

「下載並打開 App 的人裡，有多少真的記下了第一筆帳。」

這是整條漏斗最重要的一個數字。一支資產記錄 App 對還沒記過帳的人來說是空的 ——
沒有 activation 就不會有留存，更不會有訂閱。

`first_record_created` 的 `seconds_since_first_open` 還能回答第二個問題：
**有記帳的人花了多久？** 中位數是 90 秒還是 3 天，是完全不同的產品問題。

### Paywall 曝光率

```
Paywall 曝光率 = paywall_viewed 的使用者數 ÷ first_record_created 的使用者數
```

「真的在用 App 的人裡，有多少碰到了付費牆。」

分母刻意用 `first_record_created` 而不是全部使用者：沒記過帳的人本來就不該被
算進「有沒有碰到付費牆」的分母，那只會把數字稀釋到看不出問題。

這個數字太低代表**免費版太夠用**，或付費功能藏得太深 —— 那是定價與功能分界的
問題，不是訂閱頁文案的問題。搭配 `trigger_source` 拆開看，還能知道哪個入口
真的在帶人進來。

### 付費轉換率

```
付費轉換率 = subscribe_success 的使用者數 ÷ paywall_viewed 的使用者數
```

「看過訂閱頁的人裡，有多少真的付了錢。」

這才是訂閱頁本身的成績。再用 `subscribe_clicked ÷ paywall_viewed`（想買的比例）
與 `subscribe_success ÷ subscribe_clicked`（買成功的比例）拆開，可以分辨兩種
完全不同的問題：**沒人想買**（訂閱頁／定價的問題），還是**想買但買不成**
（金流、Apple 帳號、offering 沒載入的技術問題）。

> 註：分子分母都算**使用者數（unique users）**，不是事件次數。同一個人看 5 次
> 訂閱頁只算 1 個人 —— 用事件次數會讓猶豫不決的人把分母灌爆。

---

## 5. 架構：資料怎麼從 App 流到 PostHog

```
  App 畫面 / 元件
        │  只呼叫 track(ANALYTICS_EVENTS.X, { ... })
        ▼
  lib/analytics/track.ts ─────────── 全 App 唯一碰 PostHog SDK 的地方
        │                            ・整個函式包在 try/catch 內
        │                            ・dev 會 console.log，production 靜默
        ▼
  lib/analytics/client.ts ────────── PostHog client（App 進入點初始化一次）
        │                            ・自動附加 environment / app_version
        │                            ・匿名 distinct_id 存 AsyncStorage
        ▼
  批次緩衝（累積 10 筆或每 10 秒送一次）
        │  HTTPS
        ▼
  PostHog（雲端）───────────────── 事件、漏斗、留存
```

### 分層的理由

| 檔案                                  | 職責                                               |
| ------------------------------------- | -------------------------------------------------- |
| `lib/analytics/events.ts`             | 事件名稱與參數型別的唯一定義來源                   |
| `lib/analytics/client.ts`             | 建立 PostHog client、環境分流、關閉所有自動蒐集    |
| `lib/analytics/track.ts`              | `track()` —— 唯一的送出入口                        |
| `lib/analytics/funnel.ts`             | 需要讀寫持久化旗標的事件（`app_open`、生涯第一筆） |
| `lib/analytics/funnelState.ts`        | AsyncStorage 旗標：首次開啟時間、第一筆送過沒      |
| `lib/analytics/useAppOpenTracking.ts` | AppState 監聽，負責整支 App 的 `app_open`          |

**元件永遠不直接碰 PostHog SDK。** 這樣換掉分析供應商只要改一個檔案；
「不送出個資」這件事也只需要審查一個檔案就能保證。

### 三個刻意的設計決定

**1. 追蹤失敗永遠不影響主流程。**
`track()` 整個函式包在 try/catch 內（連 debug log 都包進去），呼叫端因此不需要
為了埋點自己再包一層。沒有金鑰、SDK 初始化失敗、網路不通，結果都只是「沒有
數據」，不是「使用者存不了資產」。埋點在 `addEntry` 成功**之後**才執行，而且
不 `await` —— 沒有理由讓使用者為了一個分析事件多等一次 AsyncStorage。

**2. `first_record_created` 用本地持久化旗標。**
旗標存在 AsyncStorage（`analytics.firstRecordTracked`）。讀取失敗時**當作
「已經送過」**：重複送出的假 activation 會讓啟用率虛高，比漏送一筆更難察覺、
也更難修。同理，首次開啟時間讀不到時當作「不是第一次開啟」，避免把每次冷啟動
都灌成新安裝、把分母灌水。

**3. `app_open` 只認 `background → active`，不認 `inactive → active`。**
iOS 在拉下通知中心、叫出 App 切換器、甚至跳出系統權限對話框時都會短暫進入
`inactive`。把那些算進去的話 `app_open` 會嚴重灌水，啟用率的分母跟著失真。

`app_open` 的監聽掛在 root layout、**刻意在 Clerk 的 `<ClerkLoaded>` 外面** ——
Clerk 載入失敗時登入牆後面的東西根本不會 mount，而那正是最需要看到數據的時候。
（同一支 App 的更新提示元件也是為了同樣的理由掛在那裡。）

---

## 6. 設定

| 環境變數                      | 說明                                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------------ |
| `EXPO_PUBLIC_POSTHOG_API_KEY` | PostHog project API key。留空 = 追蹤停用（App 一切正常，dev 仍會把事件印在 console） |
| `EXPO_PUBLIC_POSTHOG_HOST`    | `https://us.i.posthog.com` 或 `https://eu.i.posthog.com`，留空預設 US                |

要填三個地方（這是這個專案既有的慣例，原因寫在 `.env.production` 的檔頭註解）：

1. `apps/mobile/.env` —— 本機 Expo Go 開發
2. `apps/mobile/.env.production` —— `eas update`（OTA）用，
   **`eas update` 不讀 `eas.json` 的 env 區塊**
3. `apps/mobile/eas.json` 的 `preview` 與 `production` env 區塊 —— `eas build` 用

`EXPO_PUBLIC_*` 會被 inline 進 JS bundle，本來就是公開值。PostHog 的 project
API key 只能寫入、不能讀取資料，跟 Clerk publishable key、RevenueCat SDK key
屬於同一類。

---

## 7. 驗證

### dev 環境：不開後台也能驗

Debug 模式在 `__DEV__` 下自動開啟，每個事件都會印在 Metro 的 console：

```
[analytics] app_open { is_first_open: true }
[analytics] onboarding_complete { steps_completed: 3 }
[analytics] record_created { record_type: '流動資金' }
[analytics] first_record_created { seconds_since_first_open: 47 }
```

即使沒填 `EXPO_PUBLIC_POSTHOG_API_KEY` 也照印 —— 可以先確認觸發時機正確，
再去接後台。

要重演「首次開啟 + 第一筆」的情境，可用這兩個只給測試用的函式：

```ts
import { resetFunnelStateForTesting } from "@/lib/analytics";
```

或直接在模擬器／裝置上重裝 App。（說明 sheet 沒有持久化旗標 —— 它每次都能從
? 按鈕打開，不需要重設。）

### 手動測試步驟（送出全部 7 個事件）

1. **重裝 App**（或呼叫上面兩個 reset），確保旗標乾淨
2. 開啟 App → `app_open`（`is_first_open: true`）
3. 在登入頁按右上角 ?，滑完三頁說明按「開始使用」→ `onboarding_complete`
4. 登入（Apple／Google／LINE）
5. 新增第一筆資產 → `record_created` **加上** `first_record_created`
6. 再新增一筆 → 只有 `record_created`（`first_record_created` 不該再出現）
7. 到「資產損益」頁點「配置」分頁（免費帳號）→ `paywall_viewed`
   （`trigger_source: allocation_tab`）
8. 在訂閱頁點「取得完整權限」→ `subscribe_clicked`
9. 完成沙盒購買 → `subscribe_success`
10. 把 App 切到背景，等幾秒再切回來 → `app_open`（`is_first_open: false`）

> 第 8、9 步需要 **TestFlight 或正式版**。Expo Go 沒有 RevenueCat 的原生模組，
> 訂閱頁會進入 preview 模式 —— 此時 `subscribe_clicked` 仍會送出（點擊就是
> 點擊），但無法產生 `subscribe_success`。

### 在 PostHog 後台確認

1. **Activity**（即時事件流）：做上面的手動測試時開著這一頁，事件應該在幾秒內
   出現。這是最快的「有沒有接上」檢查。
2. **Data management → Events**：確認七個名稱都在列表裡，且拼寫正確
   （全小寫 snake_case）。
3. 點進任一事件看它的 properties，確認 `is_first_open`、`record_type`、
   `trigger_source` 等參數有值，且 `environment` 正確。
4. **Insights → Funnel**：依序加入
   `app_open` → `first_record_created` → `paywall_viewed` → `subscribe_success`，
   filter 設 `environment = production`，轉換視窗設 7 天。這張圖就是本文件
   第 4 節三個指標的視覺版本。
5. **檢查有沒有漏接的入口**：把 `paywall_viewed` 依 `trigger_source` 分組，
   若 `unknown` 佔比不是 0，代表有某個入口沒帶 source。

---

## 8. 已知範圍與取捨

- **只有 iOS／App 端。** 網頁版（`apps/web`）沒有埋，訂閱本來就只有 iOS IAP。
- **保單（insurance）不算 `record_created`。** 保單是 Premium 專屬的展示型模組，
  不是「記一筆帳」，算進去會讓 activation 的定義變模糊。
- **說明 sheet 中途關掉不送事件。** 沒看完就是沒看完，用「有 `app_open` 卻沒有
  `onboarding_complete`」來量測，比多送一個帶旗標的事件乾淨。
- **沒有裝置／OS 細節。** PostHog 的 `$os_version`、`$device_name`、`$locale`
  這類欄位需要 `expo-device`／`expo-application`／`expo-localization`，
  這次刻意不裝（避免為了分析多帶三個原生模組）。事件本身完全不受影響，
  漏斗也不需要它們。
- **換裝置 = 新使用者。** 匿名 ID 是裝置層級的，這是隱私上的刻意取捨；代價是
  跨裝置的使用者會被重複計算。
