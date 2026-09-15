import { Tabs } from "expo-router";
import { View } from "react-native";
import { useAuth } from "@clerk/clerk-expo";
import { useEffect, useRef, type ComponentProps } from "react";
import { useFinanceActions } from "@/hooks/useFinanceActions";
import { TopGlassNav } from "@/components/TopGlassNav";

// expo-router 沒有直接匯出 bottom-tabs 的 options 型別，從 Tabs 的 props 取出來
// （screenOptions 可以是物件或函式，這裡只要物件那一種）。
type BottomTabOptions = Exclude<
  NonNullable<ComponentProps<typeof Tabs>["screenOptions"]>,
  (...args: never[]) => unknown
>;

/**
 * 換分頁時的進場／離場：依導覽列上的左右順序滑入，同時淡入並從略小的尺寸放大到
 * 原尺寸。`progress` 是 -1（在目前分頁左邊）／0（目前分頁）／1（右邊），所以往右
 * 邊的分頁走時新頁從右側進來、舊頁往左退，往回走則相反。
 *
 * opacity 與 scale 夾在範圍內，避免彈簧過衝時畫面變透明或放大超過原尺寸；只有
 * translateX 允許一點過衝，那一下回彈就是跟 TopGlassNav 圖示同一種「落地」手感。
 */
const sceneStyleInterpolator: NonNullable<BottomTabOptions["sceneStyleInterpolator"]> = ({
  current,
}) => ({
  sceneStyle: {
    opacity: current.progress.interpolate({
      inputRange: [-1, -0.5, 0, 0.5, 1],
      outputRange: [0, 0.2, 1, 0.2, 0],
      extrapolate: "clamp",
    }),
    transform: [
      {
        translateX: current.progress.interpolate({
          inputRange: [-1, 0, 1],
          outputRange: [-48, 0, 48],
        }),
      },
      {
        scale: current.progress.interpolate({
          inputRange: [-1, 0, 1],
          outputRange: [0.96, 1, 0.96],
          extrapolate: "clamp",
        }),
      },
    ],
  },
});

// 與 TopGlassNav 的 SPRING_HIGHLIGHT 同一組 stiffness/damping，換頁和導覽列的
// 圖示一起動、一起停。
const transitionSpec: NonNullable<BottomTabOptions["transitionSpec"]> = {
  animation: "spring",
  config: { stiffness: 240, damping: 24, mass: 1 },
};

function DataLoader() {
  const { isSignedIn } = useAuth();
  const { fetchAll } = useFinanceActions();
  const fetched = useRef(false);

  useEffect(() => {
    if (isSignedIn && !fetched.current) {
      fetched.current = true;
      fetchAll();
    }
  }, [isSignedIn, fetchAll]);

  return null;
}

export default function TabsLayout() {
  return (
    <View style={{ flex: 1, backgroundColor: "#f2f2f7" }}>
      <DataLoader />
      <Tabs
        screenOptions={{
          headerShown: false,
          // Bottom tab bar hidden — navigation lives in the floating TopGlassNav.
          tabBarStyle: { display: "none" },
          animation: "shift",
          sceneStyleInterpolator,
          transitionSpec,
        }}
      >
        {/* 資產頁不套用共用的淡入滑動，改由卡片堆疊在 focus 時一張張進場。 */}
        <Tabs.Screen name="index" options={{ animation: "none" }} />
        <Tabs.Screen name="transactions" />
        {/* 退休頁不套用共用的淡入滑動，改由頁面自己在 focus 時重播進場動畫。 */}
        <Tabs.Screen name="retirement" options={{ animation: "none" }} />
      </Tabs>
      <TopGlassNav />
    </View>
  );
}
