import { useCallback, useEffect, useState } from "react";
import { Alert } from "react-native";
import {
  authenticate,
  getLockAvailability,
  isAppLockEnabled,
  setAppLockEnabled,
} from "@/lib/appLock";

/**
 * 設定頁那顆「生物辨識解鎖」開關。
 *
 * 開啟前先實際驗證一次：確認這台手機真的能解得開，才不會把使用者鎖在自己的
 * App 外面。關閉也要驗證 —— 否則撿到解鎖中手機的人一鍵就能把保護拿掉。
 */
export function useAppLockSetting() {
  const [enabled, setEnabled] = useState(false);
  const [label, setLabel] = useState("生物辨識");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const [stored, availability] = await Promise.all([
        isAppLockEnabled(),
        getLockAvailability().catch(() => null),
      ]);
      if (availability?.ok) setLabel(availability.label);
      setEnabled(stored);
      setLoading(false);
    })();
  }, []);

  const toggle = useCallback(async (next: boolean) => {
    setLoading(true);
    try {
      if (next) {
        const availability = await getLockAvailability().catch(() => null);
        if (!availability?.ok) {
          Alert.alert(
            "無法啟用",
            availability?.reason === "not-enrolled"
              ? "請先在手機的系統設定中設定臉部辨識或指紋。"
              : "這台裝置不支援生物辨識。"
          );
          return;
        }
        setLabel(availability.label);
      }
      if (!(await authenticate(next ? "確認啟用解鎖" : "確認關閉解鎖"))) return;
      await setAppLockEnabled(next);
      setEnabled(next);
    } finally {
      setLoading(false);
    }
  }, []);

  return { enabled, label, loading, toggle };
}
