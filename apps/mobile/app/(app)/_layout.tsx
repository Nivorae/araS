import { useEffect } from "react";
import { View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { PremiumProvider } from "@/hooks/useIsPremium";
import { useDemoBackgroundTimeout } from "@/hooks/useDemoBackgroundTimeout";
import { AppLockGate } from "@/components/AppLockGate";
import { DemoBanner } from "@/components/DemoBanner";
import { exitDemo } from "@/lib/demo/session";
import { isDemoActive, useDemoStore } from "@/store/demoStore";
import { dismissKeyboardOnLeave } from "@/lib/keyboard";

// 進出示範模式後把使用者帶到該去的畫面。放在 Stack 外面，Stack 因為 key 改變
// 而重新掛載時它不受影響。
function DemoNavigator() {
  const router = useRouter();
  const pendingNav = useDemoStore((s) => s.pendingNav);

  useEffect(() => {
    if (!pendingNav) return;
    useDemoStore.getState().clearPendingNav();
    // 等這一輪 commit 結束再導：Stack 在同一輪重新掛載，太早送出的導覽動作會
    // 落在還沒準備好的 navigator 上。
    setTimeout(() => {
      if (router.canDismiss()) router.dismissAll();
      router.replace(pendingNav.replace as never);
      if (pendingNav.push) router.push(pendingNav.push as never);
    }, 0);
  }, [pendingNav, router]);

  return null;
}

export default function AppLayout() {
  const generation = useDemoStore((s) => s.generation);
  useDemoBackgroundTimeout();

  // 示範中登出：這個 layout 會被卸載，順手結束示範，下次登入才不會還停在裡面。
  useEffect(
    () => () => {
      if (isDemoActive()) exitDemo("sign_out");
    },
    []
  );

  return (
    <PremiumProvider>
      <AppLockGate>
        <View style={{ flex: 1 }}>
          <DemoBanner />
          <DemoNavigator />
          {/* 巢狀的 SafeAreaProvider 會以自己的位置重新量安全區：橫幅出現時，底下
              畫面的頂端 inset 變成 0，不會在橫幅下方再留一次瀏海的高度。 */}
          <SafeAreaProvider style={{ flex: 1 }}>
            {/* key：進出示範時整個畫面樹重新掛載。分頁畫面掛載後不會卸載，
                (tabs)/_layout 的 DataLoader 也只抓一次，不重新掛載的話前一個
                狀態的資料會留在畫面上。 */}
            <Stack
              key={generation}
              screenOptions={{ headerShown: false }}
              screenListeners={dismissKeyboardOnLeave}
            >
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="entry/new" />
              <Stack.Screen name="entry/form" />
              <Stack.Screen name="entry/[id]" />
              <Stack.Screen name="entry/[id]/edit" />
              <Stack.Screen name="insurance/overview" />
              <Stack.Screen name="insurance/new" />
              <Stack.Screen name="settings" />
            </Stack>
          </SafeAreaProvider>
        </View>
      </AppLockGate>
    </PremiumProvider>
  );
}
