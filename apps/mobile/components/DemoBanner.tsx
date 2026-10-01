import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { exitDemo } from "@/lib/demo/session";
import { useDemoStore } from "@/store/demoStore";

// 示範模式中常駐在最上方。它自己吃掉頂端的安全區，底下的畫面由 (app)/_layout
// 包的那層 SafeAreaProvider 重新量測，所以不會再多留一次瀏海的空間。
export function DemoBanner() {
  const active = useDemoStore((s) => s.engine !== null);
  const insets = useSafeAreaInsets();
  if (!active) return null;

  function confirmLeave() {
    Alert.alert("離開示範", "示範中的修改不會儲存，離開後會回到你自己的資料。", [
      { text: "繼續體驗", style: "cancel" },
      { text: "離開示範", style: "destructive", onPress: () => exitDemo("manual") },
    ]);
  }

  return (
    <View style={[s.root, { paddingTop: insets.top + 6 }]}>
      <Text style={s.label} numberOfLines={1}>
        示範資料 · 修改不會儲存
      </Text>
      <View style={s.actions}>
        <Pressable
          onPress={() => exitDemo("upgrade")}
          hitSlop={6}
          style={({ pressed }) => [s.upgradeBtn, { opacity: pressed ? 0.8 : 1 }]}
        >
          <Text style={s.upgradeText}>升級</Text>
        </Pressable>
        <Pressable
          onPress={confirmLeave}
          hitSlop={6}
          style={({ pressed }) => [s.leaveBtn, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Text style={s.leaveText}>離開示範</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: "#374254",
  },
  label: { flexShrink: 1, fontSize: 13, fontWeight: "600", color: "#ffffff" },
  actions: { flexDirection: "row", alignItems: "center", gap: 8 },
  upgradeBtn: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "#ffffff",
  },
  upgradeText: { fontSize: 12, fontWeight: "700", color: "#374254" },
  leaveBtn: { paddingVertical: 5, paddingHorizontal: 4 },
  leaveText: { fontSize: 12, fontWeight: "600", color: "rgba(255,255,255,0.8)" },
});
