import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, AppState, Linking } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  cancelMonthlyReminder,
  ensurePermission,
  getPermissionStatus,
  scheduleMonthlyReminder,
  syncMonthlyReminder,
} from "@/lib/notifications";

const STORAGE_KEY = "settings.monthlyReminderEnabled";

/**
 * 設定頁那顆「每月記帳提醒」開關的狀態。
 *
 * 畫面狀態必須對齊 OS 的實際權限，不能只信任 AsyncStorage —— 使用者隨時可以
 * 在系統設定裡關掉通知，那時開關顯示「開」但其實永遠不會響，比沒有這個功能
 * 更糟。所以：載入時對一次、每次 App 回到前景再對一次。
 */
export function useMonthlyReminder() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  // 權限檢查是非同步的，AppState 的 callback 讀 state 會讀到閉包裡的舊值。
  const enabledRef = useRef(false);

  const apply = useCallback(async (next: boolean) => {
    enabledRef.current = next;
    setEnabled(next);
    await AsyncStorage.setItem(STORAGE_KEY, next ? "1" : "0");
  }, []);

  /** 把畫面狀態拉回與 OS 權限一致，必要時順手續約 Android 的單次排程。 */
  const reconcile = useCallback(async () => {
    const stored = (await AsyncStorage.getItem(STORAGE_KEY)) === "1";
    if (!stored) {
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
    await syncMonthlyReminder(true).catch(() => {});
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

        await scheduleMonthlyReminder();
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

  return { enabled, loading, toggle };
}
