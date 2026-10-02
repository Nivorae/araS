import { useCallback, useEffect, useRef } from "react";
import { AppState, StyleSheet, View } from "react-native";
import {
  RELOCK_AFTER_MS,
  authenticate,
  getLockAvailability,
  isAppLockEnabled,
} from "@/lib/appLock";
import { LockScreen } from "@/components/LockScreen";
import { useAppLockStore } from "@/store/appLockStore";

/**
 * 設定頁開啟「生物辨識解鎖」後，冷啟動、以及在背景待超過 RELOCK_AFTER_MS 再回來
 * 時，蓋一層鎖定畫面在登入後的所有頁面上。
 *
 * 底下的畫面保持 mount（不是改 render 別的東西）：解鎖後回到原本的頁面與捲動
 * 位置，資料也已經在背景載好。
 *
 * 開著的 Modal 是另一個原生視窗，這層蓋不到 —— 所以 App 裡的 Modal 一律用
 * components/Modal.tsx，它在 Modal 裡也畫一層 LockScreen。
 *
 * 只在 `background` 記時間、不看 `inactive` —— iOS 跳出 Face ID 視窗本身就會讓
 * App 進入 inactive，若也算進去，解鎖完馬上又會被鎖回去。
 */
export function AppLockGate({ children }: { children: React.ReactNode }) {
  const setLock = useAppLockStore((st) => st.set);
  const prompting = useRef(false);
  const backgroundedAt = useRef<number | null>(null);

  const unlock = useCallback(async () => {
    if (prompting.current) return;
    prompting.current = true;
    try {
      if (await authenticate()) setLock({ status: "unlocked" });
    } finally {
      prompting.current = false;
    }
  }, [setLock]);

  const lock = useCallback(async () => {
    // 開關可能在上鎖之後被關掉，或手機的生物辨識被移除 —— 那時就不該把人鎖在外面。
    if (!(await isAppLockEnabled())) {
      setLock({ status: "unlocked" });
      return;
    }
    const availability = await getLockAvailability().catch(() => null);
    if (availability?.ok) setLock({ label: availability.label });
    setLock({ status: "locked" });
    void unlock();
  }, [setLock, unlock]);

  // 冷啟動。登出時這個元件卸載，狀態歸回 unlocked，未登入畫面的 Modal 才不會被鎖。
  useEffect(() => {
    setLock({ status: "checking", unlock: () => void unlock() });
    void lock();
    return () => setLock({ status: "unlocked", unlock: () => {} });
  }, [setLock, lock, unlock]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "background") {
        backgroundedAt.current = Date.now();
        return;
      }
      if (next !== "active" || backgroundedAt.current === null) return;
      const away = Date.now() - backgroundedAt.current;
      backgroundedAt.current = null;
      if (away >= RELOCK_AFTER_MS) void lock();
    });
    return () => sub.remove();
  }, [lock]);

  return (
    <View style={s.root}>
      {children}
      <LockScreen />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
});
