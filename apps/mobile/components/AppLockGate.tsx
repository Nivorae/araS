import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Pressable, StyleSheet, Text, View } from "react-native";
import { Lock } from "lucide-react-native";
import {
  RELOCK_AFTER_MS,
  authenticate,
  getLockAvailability,
  isAppLockEnabled,
} from "@/lib/appLock";

type Status = "checking" | "locked" | "unlocked";

/**
 * 設定頁開啟「生物辨識解鎖」後，冷啟動、以及在背景待超過 RELOCK_AFTER_MS 再回來
 * 時，蓋一層鎖定畫面在登入後的所有頁面上。
 *
 * 底下的畫面保持 mount（不是改 render 別的東西）：解鎖後回到原本的頁面與捲動
 * 位置，資料也已經在背景載好。
 *
 * 只在 `background` 記時間、不看 `inactive` —— iOS 跳出 Face ID 視窗本身就會讓
 * App 進入 inactive，若也算進去，解鎖完馬上又會被鎖回去。
 */
export function AppLockGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>("checking");
  const [label, setLabel] = useState("生物辨識");
  const prompting = useRef(false);
  const backgroundedAt = useRef<number | null>(null);

  const unlock = useCallback(async () => {
    if (prompting.current) return;
    prompting.current = true;
    try {
      if (await authenticate()) setStatus("unlocked");
    } finally {
      prompting.current = false;
    }
  }, []);

  const lock = useCallback(async () => {
    // 開關可能在上鎖之後被關掉，或手機的生物辨識被移除 —— 那時就不該把人鎖在外面。
    if (!(await isAppLockEnabled())) {
      setStatus("unlocked");
      return;
    }
    const availability = await getLockAvailability().catch(() => null);
    if (availability?.ok) setLabel(availability.label);
    setStatus("locked");
    void unlock();
  }, [unlock]);

  // 冷啟動
  useEffect(() => {
    void lock();
  }, [lock]);

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
      {status !== "unlocked" && (
        <View style={s.overlay}>
          {status === "locked" && (
            <>
              <View style={s.iconWrap}>
                <Lock size={32} color="#ffffff" />
              </View>
              <Text style={s.title}>araS 已鎖定</Text>
              <Text style={s.sub}>{`使用${label}或手機密碼解鎖`}</Text>
              <Pressable
                onPress={() => void unlock()}
                style={({ pressed }) => [s.button, { opacity: pressed ? 0.8 : 1 }]}
                accessibilityRole="button"
              >
                <Text style={s.buttonText}>解鎖</Text>
              </Pressable>
            </>
          )}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#0a0a0f",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    zIndex: 1000,
    elevation: 1000,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  title: { fontSize: 20, fontWeight: "700", color: "#ffffff" },
  sub: { fontSize: 14, color: "rgba(255,255,255,0.6)", marginTop: 8, textAlign: "center" },
  button: {
    marginTop: 32,
    backgroundColor: "#ffffff",
    borderRadius: 999,
    paddingHorizontal: 40,
    paddingVertical: 14,
  },
  buttonText: { fontSize: 16, fontWeight: "600", color: "#0a0a0f" },
});
