import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { trackAppOpen } from "./funnel";

/**
 * 在 App 進入點掛一次，負責整支 App 的 `app_open`。
 *
 * 兩個觸發時機：
 *  1. 冷啟動 —— 這個 hook mount 的時候。
 *  2. 從背景喚醒 —— AppState 由 `background` 轉回 `active`。
 *
 * 刻意**不**把 `inactive` → `active` 算成一次開啟：iOS 在拉下通知中心、
 * 叫出 App 切換器、甚至跳出系統權限對話框時都會短暫進入 `inactive`，
 * 把那些算進去的話 `app_open` 會嚴重灌水，啟用率的分母跟著失真。
 */
export function useAppOpenTracking(): void {
  const previousState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    // 冷啟動的那一次。
    void trackAppOpen();

    const subscription = AppState.addEventListener("change", (nextState) => {
      const wasBackgrounded = previousState.current === "background";
      previousState.current = nextState;
      if (wasBackgrounded && nextState === "active") void trackAppOpen();
    });

    return () => subscription.remove();
  }, []);
}
