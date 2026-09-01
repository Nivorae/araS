import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, AppState, Linking } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  cancelMonthlyReminder,
  ensurePermission,
  getPermissionStatus,
  scheduleMonthlyReminder,
  syncMonthlyReminder,
  DEFAULT_HOUR,
  DEFAULT_MINUTE,
  type ReminderTime,
} from "@/lib/notifications";

const STORAGE_KEY = "settings.monthlyReminderEnabled";
const TIME_KEY = "settings.monthlyReminderTime";

const DEFAULT_TIME: ReminderTime = { hour: DEFAULT_HOUR, minute: DEFAULT_MINUTE };

/** "09:00" → { hour: 9, minute: 0 }。存壞或沒存過都退回預設值。 */
function parseTime(raw: string | null): ReminderTime {
  const m = /^(\d{1,2}):(\d{1,2})$/.exec(raw ?? "");
  if (!m) return DEFAULT_TIME;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return DEFAULT_TIME;
  return { hour, minute };
}

function serializeTime({ hour, minute }: ReminderTime): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/**
 * 設定頁那顆「每月記帳提醒」開關與它的時間。
 *
 * 畫面狀態必須對齊 OS 的實際權限，不能只信任 AsyncStorage —— 使用者隨時可以
 * 在系統設定裡關掉通知，那時開關顯示「開」但其實永遠不會響，比沒有這個功能
 * 更糟。所以：載入時對一次、每次 App 回到前景再對一次。
 *
 * 日期固定每月 1 號，只有時間可調（見 `lib/notifications.ts` 的說明）。
 */
export function useMonthlyReminder() {
  const [enabled, setEnabled] = useState(false);
  const [time, setTimeState] = useState<ReminderTime>(DEFAULT_TIME);
  const [loading, setLoading] = useState(true);
  // 權限檢查是非同步的，AppState 的 callback 讀 state 會讀到閉包裡的舊值。
  const enabledRef = useRef(false);
  const timeRef = useRef(DEFAULT_TIME);

  const apply = useCallback(async (next: boolean) => {
    enabledRef.current = next;
    setEnabled(next);
    await AsyncStorage.setItem(STORAGE_KEY, next ? "1" : "0");
  }, []);

  /** 把畫面狀態拉回與 OS 權限一致，必要時順手續約 Android 的單次排程。 */
  const reconcile = useCallback(async () => {
    const [storedEnabled, storedTime] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEY),
      AsyncStorage.getItem(TIME_KEY),
    ]);
    const parsed = parseTime(storedTime);
    timeRef.current = parsed;
    setTimeState(parsed);

    if (storedEnabled !== "1") {
      await apply(false);
      return;
    }
    if ((await getPermissionStatus()) !== "granted") {
      // 使用者在系統設定裡收回了權限：退回關閉，並清掉已排的通知。
      await cancelMonthlyReminder().catch(() => {});
      await apply(false);
      return;
    }
    await apply(true);
    await syncMonthlyReminder(true, parsed).catch(() => {});
  }, [apply]);

  useEffect(() => {
    reconcile().finally(() => setLoading(false));
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && enabledRef.current) void reconcile();
    });
    return () => sub.remove();
  }, [reconcile]);

  const toggle = useCallback(
    async (next: boolean) => {
      if (loading) return;
      setLoading(true);
      try {
        if (!next) {
          await cancelMonthlyReminder();
          await apply(false);
          return;
        }

        const outcome = await ensurePermission();
        if (outcome !== "granted") {
          // 不是錯誤，是預期路徑：iOS 的系統視窗只會出現一次，之後只能引導。
          Alert.alert(
            "需要通知權限",
            "請到「設定 → Sara Asset → 通知」打開允許通知，就能收到每月提醒。",
            [
              { text: "稍後再說", style: "cancel" },
              { text: "前往設定", onPress: () => void Linking.openSettings() },
            ]
          );
          await apply(false);
          return;
        }

        await scheduleMonthlyReminder(timeRef.current);
        await apply(true);
      } catch {
        // 排程/取消失敗很罕見（通常是系統層級問題），但不能 silent fail ——
        // 開關要退回原狀，使用者才知道這次沒生效。
        await apply(!next);
        Alert.alert("設定失敗", "請稍後再試。");
      } finally {
        setLoading(false);
      }
    },
    [apply, loading]
  );

  /**
   * 換時間。開關關著時只記下來（下次打開就用新時間），開著時立刻重排 ——
   * 同一個排程 id 會覆蓋掉舊的，不會留下兩個提醒。
   */
  const setTime = useCallback(async (hour: number, minute: number) => {
    const next: ReminderTime = { hour, minute };
    const previous = timeRef.current;
    timeRef.current = next;
    setTimeState(next);
    try {
      await AsyncStorage.setItem(TIME_KEY, serializeTime(next));
      if (enabledRef.current) await scheduleMonthlyReminder(next);
    } catch {
      timeRef.current = previous;
      setTimeState(previous);
      Alert.alert("設定失敗", "提醒時間沒有更新，請稍後再試。");
    }
  }, []);

  return { enabled, loading, time, toggle, setTime };
}
