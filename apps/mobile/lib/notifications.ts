import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

/**
 * 每月記帳提醒 —— 唯一碰 `expo-notifications` 原生 API 的地方。
 *
 * 完全在裝置本機排程（local notification），沒有後端、沒有 push token、
 * 沒有資料庫欄位。設計文件見
 * `docs/superpowers/specs/2026-08-13-monthly-reminder-notification-design.md`。
 */

/** 固定的排程 id，讓「取消」不需要先查 id、重排也不會留下第二份。 */
const IDENTIFIER = "monthly-record-reminder";

/** 每月 1 號 9:00。時間刻意不開放自訂（見設計文件的 YAGNI 段）。 */
const DAY_OF_MONTH = 1;
const HOUR = 9;

const CONTENT: Notifications.NotificationContentInput = {
  title: "該記錄本月資產了",
  body: "更新這個月的資產變化，讓淨值走勢圖保持準確",
  // 點擊後由 root layout 的 response listener 讀這個值，導回首頁資產儀表。
  data: { url: "/" },
};

/**
 * App 在前景時也要把通知顯示出來。
 *
 * 沒有 handler 的話，iOS 預設把前景收到的通知直接吞掉 —— 開發時「排 10 秒後
 * 觸發、停在 App 裡等」會看起來像排程失敗，實際上只是沒被渲染。
 */
export function configureNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

/**
 * 下一個「1 號 9:00」的絕對時間，給不支援月曆重複觸發的平台用。
 */
function nextOccurrence(from = new Date()): Date {
  const next = new Date(from.getFullYear(), from.getMonth(), DAY_OF_MONTH, HOUR, 0, 0, 0);
  if (next <= from) next.setMonth(next.getMonth() + 1);
  return next;
}

/**
 * iOS 原生支援「每月重複」的月曆觸發：排一次之後系統自己接管，App 不需要在
 * 每次啟動時重排，也不必處理「太久沒開 App」。
 *
 * Android 沒有等價的月曆觸發，只能排單一時間點，所以那邊改排「下一次」，
 * 並在每次 App 回到前景時由 `syncMonthlyReminder()` 重新續約。
 */
function trigger(): Notifications.NotificationTriggerInput {
  if (Platform.OS === "ios") {
    return {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      day: DAY_OF_MONTH,
      hour: HOUR,
      minute: 0,
      repeats: true,
    };
  }
  return {
    type: Notifications.SchedulableTriggerInputTypes.DATE,
    date: nextOccurrence(),
  };
}

/** 排定提醒。重複呼叫是安全的 —— 同一個 id 會覆蓋掉舊的排程。 */
export async function scheduleMonthlyReminder(): Promise<void> {
  await cancelMonthlyReminder();
  await Notifications.scheduleNotificationAsync({
    identifier: IDENTIFIER,
    content: CONTENT,
    trigger: trigger(),
  });
}

export async function cancelMonthlyReminder(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(IDENTIFIER);
}

export async function isMonthlyReminderScheduled(): Promise<boolean> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  return scheduled.some((n) => n.identifier === IDENTIFIER);
}

/**
 * Android 的續約：開關開著、但排程已經觸發過（或從未排過）就補排一次。
 * iOS 的重複排程不會消失，這裡自然什麼都不做。
 */
export async function syncMonthlyReminder(enabled: boolean): Promise<void> {
  if (!enabled) return;
  if (await isMonthlyReminderScheduled()) return;
  await scheduleMonthlyReminder();
}

export type PermissionOutcome = "granted" | "denied" | "blocked";

export async function getPermissionStatus(): Promise<PermissionOutcome> {
  const { status } = await Notifications.getPermissionsAsync();
  if (status === "granted") return "granted";
  // iOS 只會跳一次系統視窗，`undetermined` 才有機會再問；被拒絕過就是 blocked，
  // 只能引導使用者去系統設定開。
  return status === "undetermined" ? "denied" : "blocked";
}

/**
 * 需要權限時才問。回傳 `blocked` 代表系統視窗不會再出現，呼叫端該改跳 App 內
 * 的說明並把開關留在關閉。
 */
export async function ensurePermission(): Promise<PermissionOutcome> {
  const current = await getPermissionStatus();
  if (current !== "denied") return current;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted" ? "granted" : "blocked";
}
