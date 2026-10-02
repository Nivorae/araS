import { Pressable, StyleSheet, Text, View } from "react-native";
import { Lock } from "lucide-react-native";
import { useAppLockStore } from "@/store/appLockStore";

/**
 * 鎖定畫面本體。蓋滿所在的容器：主畫面一層（AppLockGate），每個開著的 Modal
 * 裡各一層（components/Modal.tsx）—— Modal 是另一個原生視窗，只蓋主畫面的話
 * 開著的 Modal 會浮在鎖定畫面上面。
 */
export function LockScreen() {
  const status = useAppLockStore((st) => st.status);
  const label = useAppLockStore((st) => st.label);
  const unlock = useAppLockStore((st) => st.unlock);

  if (status === "unlocked") return null;

  return (
    <View style={s.overlay}>
      {status === "locked" && (
        <>
          <View style={s.iconWrap}>
            <Lock size={32} color="#ffffff" />
          </View>
          <Text style={s.title}>araS 已鎖定</Text>
          <Text style={s.sub}>{`使用${label}或手機密碼解鎖`}</Text>
          <Pressable
            onPress={unlock}
            style={({ pressed }) => [s.button, { opacity: pressed ? 0.8 : 1 }]}
            accessibilityRole="button"
          >
            <Text style={s.buttonText}>解鎖</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
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
