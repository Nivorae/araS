import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { exitDemo } from "@/lib/demo/session";
import { isDemoActive } from "@/store/demoStore";

const DEMO_BACKGROUND_LIMIT_MS = 10 * 60 * 1000;

/**
 * App 在背景超過 10 分鐘就結束示範。
 *
 * 這是防止「把示範模式當免費 Premium 長期使用」的唯一機制：真的在記帳的人用的是
 * 好幾天的時間跨度，沒有人能每 10 分鐘回來維持一次。只認 `background`，不認
 * `inactive` —— 拉下通知中心、切換器都會短暫進 inactive，那不算離開。
 */
export function useDemoBackgroundTimeout(): void {
  const backgroundedAt = useRef<number | null>(null);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "background") {
        backgroundedAt.current = Date.now();
        return;
      }
      if (next !== "active" || backgroundedAt.current === null) return;
      const away = Date.now() - backgroundedAt.current;
      backgroundedAt.current = null;
      if (isDemoActive() && away > DEMO_BACKGROUND_LIMIT_MS) exitDemo("timeout");
    });
    return () => sub.remove();
  }, []);
}
