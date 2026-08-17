# 每月記帳提醒通知 設計文件

**狀態：已設計，尚未實作。** 這是本地通知的第一版；「新功能推播」是獨立需求，
需要後端 push token 儲存 + 發送機制，不在這份文件範圍內，之後另開一份 spec。

## 問題

使用者沒有任何機制被提醒回來更新當月的資產變化。淨值走勢圖依賴使用者持續記錄
`Entry`，越久沒回來記，走勢圖的資料就越稀疏、越不準。

## 目標

每月固定提醒使用者回來記帳，完全在裝置本機完成，不新增後端或資料庫欄位。

## 設計

### 排程機制：`apps/mobile/lib/notifications.ts`（新增）

封裝所有 `expo-notifications` 呼叫，是唯一碰原生 API 的地方：

- `scheduleMonthlyReminder()` — 呼叫 `Notifications.scheduleNotificationAsync`，
  trigger 為 calendar trigger `{ day: 1, hour: 9, minute: 0, repeats: true }`。
  iOS 原生支援「每月重複」，排一次之後系統自己接管，App 不需要在每次開啟時
  重新排程，也不用處理「App 太久沒開」這種邊界情況。
- `cancelMonthlyReminder()` — `cancelScheduledNotificationAsync`。
- `getPermissionStatus()` — 包裝 `getPermissionsAsync()`。

### UI：`apps/mobile/app/(app)/settings.tsx`

新增一張 **Switch 樣式**的卡片（目前這頁全是點擊跳轉卡，這是第一個 on/off
型態，需要新的卡片變體）。開關狀態存 `AsyncStorage`，**預設關閉** —— 使用者
自己去設定頁打開，符合 Apple 建議的「情境式權限請求」，不在首次啟動就跳權限
視窗。

### 權限與狀態同步

Switch 的畫面狀態要對齊 OS 實際權限，不能只信任 `AsyncStorage`：

1. **首次開啟 Switch** → `getPermissionsAsync()`；狀態是 `undetermined` 才呼叫
   `requestPermissionsAsync()`（這時才彈出 iOS 系統視窗）。
2. **使用者曾經拒絕過** → iOS 只會跳系統視窗一次，之後 `requestPermissionsAsync()`
   不會再跳。要攔截這個狀態，改跳 App 內的 `Alert`，引導使用者去
   「設定 App → 通知」手動開，Switch 維持關閉。
3. **App 從背景回到前景時重新檢查一次權限**（`AppState` 監聽）—— 使用者可能
   在系統設定裡把權限關掉，這時 Switch 要自動退回關閉，不能顯示「開」但
   系統其實已經沒有權限。

### 通知內容

- 標題：「該記錄本月資產了」
- 內文：「更新這個月的資產變化，讓淨值走勢圖保持準確」
- 點擊 → 開啟 App，deep link 到 `(tabs)/index`（首頁資產儀表）

### `app.json` 變更

`plugins` 加入 `expo-notifications`。不需要額外的 `ios.infoPlist` 設定，
套件的 config plugin 會自動處理。

### 對發版流程的影響

裝 `expo-notifications` 會把原生模組編進 binary。照 `mobile-release` skill
的判斷表，這是 **Road B（native rebuild）**，不能用 OTA 推 —— 一旦
`app.json` 的 `plugins` 有變更，就已經觸發 Road B，且套件本身也真的把
Swift/Obj-C 程式碼編進 binary。只有後續**純文案調整**（通知標題/內文字串，
沒動到 `app.json` 或原生套件本身）才能用 OTA 推。

### 錯誤處理

- 排程/取消排程呼叫失敗（罕見，通常是系統層級問題）→ Switch 狀態回退，
  `Alert` 顯示「請稍後再試」，不 silent fail。
- 使用者拒絕權限 → 見上方「權限與狀態同步」第 2 點，不是錯誤，是預期路徑。

### 測試方式

本地排程通知（不同於 remote push）可以在 **Expo Go 裡直接測**，不用等
native rebuild 出真機版本 —— 手動把 trigger 的 `day`/`hour` 改成幾分鐘後
驗證排程/取消/點擊 deep link 是否正常，驗證完再改回正式的
`day: 1, hour: 9`。

## 明確不做的事（YAGNI）

- 不做「新功能推播」（remote push）—— 需要後端存 token、需要發送機制，
  是完全不同的架構，獨立列為未來項目。
- 不做時間選擇器，時間固定 9:00，不開放使用者自訂。
- 不做「依使用者行為動態調整內容」（例如依上月淨值變化客製文案）——
  內容固定，這是 local 排程能做到最大的範圍，動態內容需要 remote push。
