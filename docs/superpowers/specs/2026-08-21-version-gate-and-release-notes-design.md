# 版本閘門（強制更新）與更新紀錄 設計文件

**狀態：已設計，尚未實作。** 兩個功能寫在同一份 spec，因為它們共用同一條敘事線
（「這個 App 的版本是什麼、變過什麼」），而且**可以用同一次 OTA 出去**——兩者
都是純 JS，不碰原生層，不需要送審。

## 問題

### 1. 沒有任何機制強制使用者升級 native 版本

`UpdateBanner` 只處理 **OTA**（`Updates.useUpdates()` 的 `isUpdatePending`），
對「App Store 上有新的 native 版本」一無所知。目前唯一的升級途徑是 iOS 自動
更新，而它可以被使用者關掉、也可能因為儲存空間不足而長期不執行。

這在後端做出不相容變更時會變成真正的問題：舊 binary 打新 API 只會拿到看不懂的
錯誤，而我們沒有任何手段告訴那個人「你必須去 App Store 更新」。

### 2. 使用者看不到歷史改版紀錄

`WhatsNewSheet` 只在更新套用後的第一次啟動顯示**最新一版**的說明，關掉就再也
找不回來（`shouldShowWhatsNew()` 以 id 判斷，同一個 id 只顯示一次）。
`CHANGELOG.md` 有完整歷史，但那是 repo 檔案，使用者看不到，格式也是寫給開發者
看的（`（已上架）`、`### OTA`）。

## 目標

1. 伺服器端可即時調整的版本門檻：低於門檻 → 不可關閉的擋板；低於最新版 → 可
   關閉的柔性提示。
2. App 內有一個可以隨時回去瀏覽的更新紀錄畫面，涵蓋 App Store 版本與 OTA 條目。

---

## 先決限制（設計繞著這三條走）

1. **檢查程式碼必須先在使用者手上。** 判斷「你太舊了」的是**舊 binary 自己**。
   這段是純 JS，可以用 OTA 送給目前 1.2 的使用者；但 1.1 以前、拿不到 OTA 的
   人永遠擋不到——無解，只能靠 iOS 自動更新。這跟 `UpdateBanner` 當初「載著
   banner 的那次更新本身仍然是靜默的」是同一個道理。
2. **門檻值不能寫死在 App 裡。** 寫死的話，要擋 1.2 就得先發一版 1.3 去講——
   遞迴。門檻必須是伺服器上可即時調整的值。
3. **門檻值永遠不能超過 App Store 上「已上架」的版本。** 一旦超過，所有人被鎖死
   而且無路可走（按了更新也沒有新版可裝）。這是這個功能唯一的致命失敗模式，用
   流程護欄擋（見「對發版流程的影響」）。

---

## 設計 A：版本閘門

### 資料流

```
Vercel env（MIN_SUPPORTED_APP_VERSION / LATEST_APP_VERSION）
   ↓
GET /api/app-version        公開、Cache-Control: s-maxage=300
   ↓  App 冷啟動時抓一次
useVersionGate()  →  evaluateVersionGate(Constants.expoConfig.version, payload)
   ↓
<VersionGate />   掛在 root layout，且在 <ClerkLoaded> 外面
```

### `packages/shared/src/appVersion.ts`（新增）

純函式，放 shared 的唯一理由是**可測**：`apps/mobile` 沒有 test script，只有
`apps/web` 這側有 vitest。

- `compareAppVersion(a, b): -1 | 0 | 1 | null`
  - `app.json` 的 `version` 是兩段式的 `"1.2"`，比較前補齊三段（`1.2` → `1.2.0`）
  - 任一段不是數字、或字串為空 → 回 `null`，呼叫端一律解讀為「放行」

### `apps/web/app/api/app-version/route.ts`（新增）

- **公開路由**。`middleware.ts` 目前只對行情代理呼叫 `auth.protect()`，不需要改。
  閘門必須在登入牆外可用，否則「登入流程壞掉的舊版」正好是最該擋卻擋不到的。
- 回既有的 `ok()` 信封：

  ```jsonc
  {
    "minSupportedVersion": "1.2", // MIN_SUPPORTED_APP_VERSION，未設定時 "0.0"
    "latestVersion": "1.2", // LATEST_APP_VERSION，未設定時 "0.0"
    "iosStoreUrl": "https://apps.apple.com/app/id6785747999",
    "message": "", // 擋板上的補充說明，預設空字串
  }
  ```

- 兩個 env 未設定時一律回 `"0.0"`：**沒設定 = 不擋任何人**，跟整體的 fail-open
  方向一致。
- `Cache-Control: s-maxage=300` 讓 Vercel edge 擋掉流量。這支會被每次冷啟動打到，
  但值一天也不會變一次。
- 不讀資料庫，所以不需要 `handleError` 的 Prisma 分支，但仍沿用 `ok()` 以維持
  信封一致。

### `apps/mobile/lib/versionGate.ts`（新增）

沿用 `lib/whatsNew.ts` 的寫法：不 import React、不 import 任何 hook，讓判斷邏輯
可以單獨閱讀、單獨推理。

- `parseVersionGate(json: unknown): VersionGateConfig | null` — 形狀不對回 null
- `evaluateVersionGate({ currentVersion, config }): "blocked" | "outdated" | "ok"`
  - `config` 為 null、或 `compareAppVersion` 回 `null` → `"ok"`
  - `current < minSupportedVersion` → `"blocked"`
  - `current < latestVersion` → `"outdated"`
  - 其餘 → `"ok"`

### `apps/mobile/hooks/useVersionGate.ts`（新增）

- 掛載時打一次，之後不重打（版本在一次 App 生命週期內不會變）。
- **直接用 `fetch`，不走 `lib/api.ts`**：那支封裝會強制附帶 Clerk token，而閘門
  必須在還沒登入、甚至 Clerk 還在載入時就能運作。URL 用同一個
  `EXPO_PUBLIC_API_URL`。
- 回傳 `{ state, config }`，初始為 `"ok"`——**還沒拿到答案時不擋人**。

### `apps/mobile/components/VersionGate.tsx`（新增）

兩種畫面，共用同一份文案來源：

| state        | 畫面                                                                                                                        |
| ------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `"blocked"`  | 全螢幕、**不可關閉**（`Modal` + `onRequestClose` 不做事）：標題「請更新至最新版本」、`message`、一顆「前往 App Store 更新」 |
| `"outdated"` | 底部提示條，沿用 `UpdateBanner` 的視覺與「稍後」dismiss 模式（本次啟動內不再出現）                                          |
| `"ok"`       | `return null`                                                                                                               |

「前往 App Store 更新」用 `Linking.openURL(config.iosStoreUrl)`。Android 目前
沒有上架，`iosStoreUrl` 就是唯一連結；真的上 Play 之後再依 `Platform.OS` 分流。

### `apps/mobile/app/_layout.tsx`（修改）

在 `<UpdateBanner />` 旁掛 `<VersionGate />`，同樣放在 `<ClerkLoaded>` 外面，
理由與該處既有註解相同（登入牆外也要看得到）。

### 失效行為：全部 fail-open

網路失敗、HTTP 非 200、JSON 形狀不對、版本字串解析不出來、env 未設定——**一律
當作 `"ok"`，不擋任何人**。API 掛掉不能等於全體使用者開不了 App。這個方向是刻意
的，跟 `shouldShowWhatsNew()` 的「失效方向是少講、不是講錯」是同一種取捨。

---

## 設計 B：更新紀錄

### `apps/mobile/lib/releaseNotes.ts`（新增）

```ts
export interface ReleaseNote {
  id: string; // 沿用現有 whatsNew 的 id 規則：改文案就要改 id
  version: string; // "1.2"
  date: string; // "2026/08/19"
  channel: "store" | "ota";
  sections: WhatsNewSection[];
}

/** 新 → 舊。由 /git:changelog 往頭部插入。 */
export const RELEASE_NOTES: ReleaseNote[] = [];
```

一份資料兩個用途：`RELEASE_NOTES[0]` 是「本次更新」sheet 的內容，整份陣列是
更新紀錄畫面的內容。

### `WhatsNewSheet` / `lib/whatsNew.ts`（修改）

- `WhatsNewSheet` 改讀 `RELEASE_NOTES[0]`。
- `shouldShowWhatsNew()` **一行不改**——它已經是「比對 id」的邏輯，跟文案從哪來
  無關。
- `parseWhatsNew()` 連同 `app.json` 的 `extra.whatsNew` 一起**刪除**：來源變成
  型別安全的 TS 模組後，那層針對「來源不明的 JSON」的防禦性解析沒有守備對象了。
  順帶消掉一顆地雷——不再需要為了改文案去編輯 `app.json`，也就不可能手滑碰到
  `version`（那會讓 OTA 直接送不出去）。
- sheet 底部加「查看完整更新紀錄」：先關 sheet 再 `router.push("/release-notes")`。

### `apps/mobile/app/(app)/release-notes.tsx`（新增）

路由 `/release-notes`。刻意**不**放在 `app/(app)/settings/` 底下——`settings.tsx`
已經是檔案，再開同名目錄只會製造混淆。

- 依 `version` 分組，最上面那組標「目前版本」（比對 `Constants.expoConfig.version`）
- 組內每筆依 `date` 由新到舊；`channel: "ota"` 的條目標日期
- 沿用設定頁的卡片視覺與 `useResponsive` 的置中欄

### `apps/mobile/app/(app)/settings.tsx`（修改）

加一張「更新紀錄」卡片，導向 `/release-notes`。

### 回填範圍

現有 `extra.whatsNew` 那筆 + `CHANGELOG.md` 的 1.2 區段（20 筆 OTA 條目，照日期
歸組）。1.1 以前不回填：那些使用者本來也沒有這個畫面。

---

## 對發版流程的影響

### `.claude/skills/mobile-release/SKILL.md`（修改）

新增最後一步：**App Store 狀態變成「可供銷售」之後**，才把 Vercel 的
`MIN_SUPPORTED_APP_VERSION` / `LATEST_APP_VERSION` 調上去。

審核期間門檻一定要低於審核中的版本，否則審核員手上的 build 會被自己的擋板擋住，
直接退件。

### `.claude/commands/git/changelog.md`（修改）

第 6.6 步從「同步 `app.json` 的 `extra.whatsNew`」改為「往
`apps/mobile/lib/releaseNotes.ts` 的陣列頭插入一筆」。同步負擔不變，欄位多了
`version` / `date` / `channel`（`--ota` → `"ota"`，`--release` → `"store"`）。
「不要碰 `app.json` 的 `version`」那段警語隨之移除——不再需要編輯 `app.json`。

### `.env.example` / `CLAUDE.md`（修改）

補上兩個 env 的說明，寫清楚「未設定 = 不擋任何人」與「不得超過已上架版本」。

---

## 測試

`apps/mobile` 沒有 test script，所以自動化驗證只可能發生在 `packages/shared`
（用 `apps/web` 的 vitest 跑）：

- `compareAppVersion`：`"1.2"` vs `"1.2.0"` 相等、`"1.10"` > `"1.9"`、
  `"1.3"` > `"1.2"`、`""` / `"abc"` / `undefined` 回 `null`
- `evaluateVersionGate`：blocked / outdated / ok 三條路徑，加上 config 為 null
  與版本無法解析時都回 `"ok"`

`apps/web` 這側再加一個 route 測試：env 未設定時回 `"0.0"`。

App 端的判斷邏輯（`lib/versionGate.ts`）刻意寫成不依賴 React 的純函式，理由與
`lib/whatsNew.ts` 相同：在沒有測試環境的地方，「能被單獨讀懂」就是驗證方式。

## 發版順序

兩個功能都是純 JS → **同一次 OTA 出去，不必送審**。

唯一的順序限制：功能 A 的擋板碼要先透過 OTA 進到 1.2 使用者手上，之後調高
`MIN_SUPPORTED_APP_VERSION` 才擋得到人。所以第一次上線時，兩個 env 都維持
`"0.0"`（或不設定），確認 OTA 已鋪開後再開始使用這個旋鈕。
