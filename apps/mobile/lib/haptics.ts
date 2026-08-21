import * as Haptics from "expo-haptics";

/**
 * 觸覺回饋（Taptic Engine）的單一進出口。集中在這裡是為了讓「用哪種力道」是
 * 一個專案級決定，而不是散在每個元件裡各自猜。
 *
 * ⚠️ `expo-haptics` 是原生模組，**不能靠 OTA 送**。`app.json` 的 runtimeVersion
 * policy 是 `appVersion`，所以在下一次 native rebuild 之前，任何含這支檔案的
 * bundle 都不可以 `eas update` 出去 —— 它會被推到沒有這個原生模組的既有 binary
 * 上，一呼叫就爆。要生效的路徑是：bump version → native rebuild → 送審上架。
 *
 * 刻意不用 react-native 內建的 `Vibration`：iOS 上它只有一種又重又長的預設
 * 震動，用在「點一下清單項目」會很吵，不是 Apple 的那種輕點感。
 *
 * 全部 fire-and-forget。`impactAsync` 在不支援的裝置（Android 模擬器、關掉
 * 系統觸覺的手機）上會 reject，而觸覺失敗絕對不該讓使用者的操作失敗，所以一律
 * 吞掉 —— 這是回饋，不是功能。
 */

/** 輕點：一般點擊確認用。 */
export function pressFeedback(): void {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** 中等力道：長按觸發、即將出現破壞性選項時用。 */
export function longPressFeedback(): void {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}
