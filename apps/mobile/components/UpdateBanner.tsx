import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View } from "react-native";
import * as Updates from "expo-updates";
import { CONTENT_MAX_WIDTH, useResponsive } from "@/hooks/useResponsive";

/**
 * 更新已下載完成時，從底部滑出的提示條。
 *
 * 為什麼需要它：`fallbackToCacheTimeout` 是預設的 0，所以套用一次 OTA 需要開
 * **兩次** App —— 第一次開啟仍跑舊 bundle 並在背景下載，第二次開啟才生效。習慣
 * 看一眼就滑掉的使用者，下載會被反覆中斷，永遠停在舊版。這個 banner 把兩次收斂
 * 成一次：`Updates.reloadAsync()` 直接套用剛下載好的 bundle。
 *
 * 這是**舊** bundle 在顯示的東西，所以它只講「有新版本」這種與版本無關的話 ——
 * 「新版做了什麼」由新 bundle 自己帶的 `WhatsNewSheet` 負責（見 lib/whatsNew.ts）。
 * 也因此，載著這個 banner 的那次 OTA 本身仍然是靜默的：那時在跑的舊 bundle 還
 * 沒有這段程式碼。從再下一次更新開始才看得到。
 */
export default function UpdateBanner() {
  const { isUpdatePending } = Updates.useUpdates();
  const { isTablet } = useResponsive();
  // 使用者按「稍後」後，本次 App 生命週期內不再出現；下次冷啟動時新 bundle 會
  // 自然生效，不需要額外記住這個決定。
  const [dismissed, setDismissed] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const translateY = useRef(new Animated.Value(160)).current;

  const visible = isUpdatePending && !dismissed;

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: visible ? 0 : 160,
      stiffness: 180,
      damping: 22,
      mass: 1,
      useNativeDriver: true,
    }).start();
  }, [visible, translateY]);

  const handleReload = async () => {
    setRestarting(true);
    try {
      await Updates.reloadAsync();
    } catch {
      // Expo Go／dev 會直接 throw，正式環境也可能在極少數狀況失敗。使用者按了
      // 卻沒反應比看不到按鈕更糟，所以退回「稍後」的狀態：下次冷啟動照樣生效。
      setRestarting(false);
      setDismissed(true);
    }
  };

  if (!isUpdatePending) return null;

  return (
    <View style={s.wrap} pointerEvents="box-none">
      <Animated.View
        style={[s.banner, isTablet && s.bannerTablet, { transform: [{ translateY }] }]}
        pointerEvents={visible ? "auto" : "none"}
      >
        <Text style={s.title}>✨ 有新版本已準備好</Text>
        <View style={s.actions}>
          <Pressable
            onPress={() => setDismissed(true)}
            disabled={restarting}
            style={({ pressed }) => [s.btn, s.btnGhost, pressed && s.btnPressed]}
          >
            <Text style={s.btnGhostText}>稍後</Text>
          </Pressable>
          <Pressable
            onPress={handleReload}
            disabled={restarting}
            style={({ pressed }) => [s.btn, s.btnPrimary, pressed && s.btnPressed]}
          >
            {restarting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={s.btnPrimaryText}>立即重啟</Text>
            )}
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  // 掛在 root 的絕對定位層：填滿螢幕但不吃事件，只有 banner 本身可以被點。
  wrap: { ...StyleSheet.absoluteFillObject, justifyContent: "flex-end", zIndex: 200 },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginHorizontal: 16,
    marginBottom: 32,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: "#1c1c1e",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.24,
    shadowRadius: 16,
    elevation: 10,
  },
  // 同 ReinvestSheet：iPad 上不要拉成 1024pt 的長條。
  bannerTablet: { width: CONTENT_MAX_WIDTH, alignSelf: "center" },
  title: { flexShrink: 1, fontSize: 14, color: "#fff", fontWeight: "600" },
  actions: { flexDirection: "row", alignItems: "center", gap: 8 },
  btn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    minWidth: 64,
    alignItems: "center",
  },
  btnGhost: { backgroundColor: "rgba(255,255,255,0.14)" },
  btnGhostText: { fontSize: 13, color: "#fff" },
  btnPrimary: { backgroundColor: "#66788E" },
  btnPrimaryText: { fontSize: 13, color: "#fff", fontWeight: "600" },
  btnPressed: { opacity: 0.7 },
});
