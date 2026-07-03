# araS Mobile — 發版與營運手冊

這份文件記錄 **App 上架之後**的發版流程、收費規劃與擴容判斷。
（上架前的 EAS build / App Store 送審完整流程，寫在 skill `web-to-ios-expo-app`
→ `references/phase3-eas-appstore.md`。）

目前狀態：**v1 已送審，等待 Apple 審核（2026-06-30 送出）**。

---

## 1. 後續修改的發版流程

先分清楚兩個常被搞混的東西：

|        | Expo Go 測試                       | preview build（內部測試）                                |
| ------ | ---------------------------------- | -------------------------------------------------------- |
| 怎麼跑 | `pnpm start` 掃 QR，**不用 build** | `eas build --profile preview`，產出真 .ipa 裝手機        |
| 跑的是 | 你的 JS 丟進 Expo Go 這個殼        | **你自己真正的原生 binary**                              |
| 用途   | 快速開發、改 JS 即時看             | 驗證真機上的正式版行為（原生模組/圖示/啟動畫面都是真的） |

**判斷準則：改動有沒有碰到原生層？**
沒碰（只有 JS / UI / 邏輯）→ 走 OTA；
有碰（新原生模組、`app.json` 原生欄位、SDK 升級）→ 重 build 送審。

### A. 小修改（純 JS / UI / bug）→ OTA 熱更新，跳過審核

```
改 code → pnpm start 在 Expo Go 測 → eas update --branch production → 使用者重開 App 就更新
```

> ⚠️ **EAS Update（OTA）要先做一次性設定**：裝 `expo-updates`、設定 channel，且 production build
> 必須是「帶 OTA 能力」build 出來的。**目前的 production build 還沒設定 OTA，所以還不能熱更新。**
> → backlog 第 1 項。

### B. 大版本（加原生功能 / 升 SDK / 改 app.json 原生設定）→ 重 build 送審

```
改 code → Expo Go 測 →（可選：preview build 在真機驗證原生行為）
→ 改 app.json 的 version → eas build --profile production
→ eas submit --platform ios --latest
→ App Store Connect：建立新版本 + 填「此版本的新功能」+ 指定 build + 送審
→ Apple 審核 1~3 天
```

### 版本號（兩個概念別搞混）

| 欄位                    | 在哪       | 誰看   | 規則                                                               |
| ----------------------- | ---------- | ------ | ------------------------------------------------------------------ |
| `version`（行銷版本）   | `app.json` | 使用者 | **每次送審手動 +1**（0.1.0 → 0.1.1 → 0.2.0）。已上架的號碼不能重用 |
| `buildNumber`（建置號） | EAS 自動管 | 內部   | `eas.json` 已設 `autoIncrement: true`，EAS 自動 +1，不用管         |

---

## 2. 訂閱制（收費）規劃 — 屬於未來的 v2

**現在的 v1 完全免費、沒有任何 IAP**，所以上架後大家就是免費用，不會有人被收錢。
收費是**之後另開 v2** 才做的，跟現在這版無關，不用急。

### 收費只能用 Apple In-App Purchase（IAP）

iOS App 賣數位內容/訂閱**只能用 Apple IAP**，不能用 Stripe 或導去網頁付款（會被退件）。
Apple 抽成 15~30%（小開發者第一年內 / 年營收 <100 萬美元 → 15%）。

### 建議的收費模式：免費 + 訂閱（月 + 年）

理由：後端（Clerk、Supabase）是**持續性成本**，純買斷會「收一次錢、養一輩子伺服器」→ 長期虧。
訂閱才能讓收入跟成本對齊。建議組合：

- **免費版**：基本記帳（資產/負債/收支）= 吸引下載的鉤子
- **月訂閱**：解鎖投資組合、退休試算、進階圖表
- **年訂閱**：給明顯折扣（買 10 個月送 2 個月），主力營收 + 現金流穩
- （可選）終身買斷當高價選項，不當主力

### 做訂閱需要改的 code / 架構

1. 接 **RevenueCat SDK**（`react-native-purchases`）判斷付費狀態（**月營收 <$2,500 前免費**）
2. **付費牆 UI**（Paywall）+「升級 Premium」畫面
3. **功能鎖**：Premium 功能未付費 → 顯示鎖 + 導去付費牆
4. **資料庫加會員狀態**：Supabase 加訂閱狀態欄位，用 **RevenueCat webhook** 在付費/取消時更新，
   讓 `/api/*` 後端也能在伺服器端驗證（防破解）

#### 目前的鋪路進度（已完成，都還沒真的上線收費）

- ✅ 1、2、3 已完成（`react-native-purchases` 已裝、`app/(app)/paywall.tsx` 付費牆畫面已建、
  `EntitlementsService.isPremium()` 是集中判斷點，目前永遠回傳 `true`，還沒鎖任何功能）。
- ⚠️ **4 的 webhook 選錯了方向，需要重做**：目前 `/api/webhooks/app-store-notifications`
  直接驗證 Apple 原始的 JWS 通知——這是「不用 RevenueCat、自己接 StoreKit2」時的正確做法。
  但你用的是 **RevenueCat SDK**，實際流程是「Apple 通知 RevenueCat → RevenueCat 再用它自己的
  webhook 通知你」，Apple 不會直接打到我們的 endpoint，所以這支 webhook 目前**收不到真實流量**。
  之後真的要做訂閱時，需要另外建一支接收 **RevenueCat 自己 webhook 格式**的 endpoint
  （建議等你申請好 RevenueCat 帳號、能看到他們 dashboard 上實際的 webhook payload 範例後再做，
  這樣才能對照官方文件驗證欄位正確，避免憑印象猜錯格式）。
  `Subscription` 資料表本身不用重做，兩種 webhook 更新的都是同一張表。

### 訂閱商品什麼時候開？

**訂閱商品不能單獨存在，必須跟「第一個使用它的 App 版本」一起送審。**

```
v1（現在）= 免費上架，先累積使用者
   ↓
v2 = 寫好訂閱 code + 在 App Store Connect 建立訂閱商品 → 一起送審
   ↓
Apple 同時審核 App binary + 訂閱商品 → 通過後訂閱才生效
```

所以你無法、也不會在現在這版偷偷開收費，放心。

---

## 3. TestFlight — 何時需要

|                 | Expo Go                           | TestFlight                           |
| --------------- | --------------------------------- | ------------------------------------ |
| 本質            | App Store 上現成的殼，載入你的 JS | 你真正編譯的 binary（跟上架版一樣）  |
| 能測 IAP 付費？ | **不能**                          | **能**（IAP sandbox）                |
| 對象            | 自己開發用                        | 真實測試者（內部 100 / 外部 10,000） |

**會需要 TestFlight 的情境：**

1. **測訂閱付費**（最關鍵）— Expo Go 無法測 IAP，做 v2 訂閱時**一定**要用 TestFlight 在 sandbox 測整個流程
2. 加了 Expo Go 不支援的原生模組，要用真 binary 驗證
3. 想先給朋友/早期使用者 beta 測試再正式上架
4. 大改版送審前的最後真機驗證，降低被退件風險

---

## 4. 擴容判斷 — Clerk / Supabase 免費額度

兩邊都有 dashboard 用量頁 + 會寄 email 警告，不會在不知情下爆掉。
**升級沒有遷移成本**（同專案點 Upgrade 加信用卡即可），唯一要提前規劃的是 **Clerk 網域**。

### Clerk（登入）

- 免費正式環境約 **10,000 MAU**（以官方 dashboard 為準），超過 → Pro 約 $25/月
- **真正的瓶頸是 dev 實例硬上限 100 人**。使用者要超過 100 → 必須先**升級到 Clerk 正式環境**：
  需要**自己的網域 + DNS CNAME + 自己的 Google/LINE OAuth 憑證**（約 NT$400/年買網域）。
  → 接近 80~100 人時就要開始準備，別等撞牆。升級時 Vercel 環境變數與 mobile `eas.json` 一起
  從 `pk_test_` 換成 `pk_live`。

### Supabase（資料庫）

- 免費：500MB 資料庫、2GB 流量/月、**閒置 7 天會暫停專案**
- 財務資料很小，500MB 可撐數萬使用者 → 先爆的通常是「流量」或「閒置暫停」，不是容量
- 超過 → Pro $25/月（8GB、不暫停、每日備份）

### 判斷準則

1. 兩個 dashboard 都開**用量警告 / billing alert**
2. 到任一硬上限 **~80%** 就升級，別等爆
3. 唯一要提前的是 **Clerk 網域**（要買網域 + 設 DNS + 申請 OAuth，不是按一下）

---

## Backlog（v1 上架後依序推進）

- [ ] **設定 EAS Update（OTA）** — 之後小改可跳審核熱更新
- [ ] **v2 訂閱制** — RevenueCat + Supabase 會員狀態 + 付費牆 + TestFlight 測付費 → 連訂閱商品一起送審
- [ ] **Clerk 正式環境遷移** — 接近 100 使用者前處理（買網域 + DNS + 自己的 OAuth 憑證）
- [ ] 確認 App Store Connect 發佈方式設為「手動發佈」，掌握上架時機
