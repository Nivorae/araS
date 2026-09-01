import "react-native-url-polyfill/auto";
import * as Sentry from "@sentry/react-native";
import { ClerkProvider, ClerkLoaded, useAuth } from "@clerk/clerk-expo";
import { Slot, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { tokenCache } from "@/lib/tokenCache";
import { initAnalytics, useAppOpenTracking } from "@/lib/analytics";
import UpdateBanner from "@/components/UpdateBanner";
import WhatsNewSheet from "@/components/WhatsNewSheet";
import { configurePurchases } from "@/lib/purchases";
import { configureNotificationHandler } from "@/lib/notifications";
import * as Notifications from "expo-notifications";

const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

Sentry.init({
  ...(sentryDsn ? { dsn: sentryDsn } : {}),
  enabled: !!sentryDsn,
  tracesSampleRate: 0.1,
  // Dev and production share one DSN, so without this every event a developer
  // generates on a LAN build lands in the same stream as real user crashes —
  // which makes triaging a production report needlessly hard.
  environment: __DEV__ ? "development" : "production",
});

// 行為分析。跟上面的 Sentry 一樣在模組載入時就啟動，這樣任何畫面第一次
// 呼叫 track() 之前 client 一定已經存在；沒有金鑰時它自己會靜默停用。
initAnalytics();

// 讓 App 在前景時也會顯示本機排程通知（預設會被 iOS 吞掉）。同樣在模組載入時
// 設定，才不會漏接「App 正開著時剛好到 9:00」這種情況。
configureNotificationHandler();

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

function InitialLayout() {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded) return;
    const inAuthGroup = segments[0] === "(auth)";
    if (isSignedIn && inAuthGroup) {
      router.replace("/");
    } else if (!isSignedIn && !inAuthGroup) {
      // Land on the welcome/landing screen first (matches web's "/" landing),
      // not straight into the sign-in form.
      router.replace("/welcome");
    }
  }, [isLoaded, isSignedIn, segments, router]);

  useEffect(() => {
    if (isSignedIn && userId) configurePurchases(userId);
  }, [isSignedIn, userId]);

  // 點擊每月提醒通知 → 回到首頁資產儀表。掛在這裡（而不是設定頁）是因為使用者
  // 點通知時 App 可能根本沒開，只有 root 保證存在。未登入時什麼都不做，登入
  // 導向由上面那個 effect 負責。
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const url = response.notification.request.content.data?.url;
      if (typeof url === "string" && isSignedIn) router.replace(url as never);
    });
    return () => sub.remove();
  }, [isSignedIn, router]);

  if (!isLoaded) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return <Slot />;
}

export default Sentry.wrap(function RootLayout() {
  // 掛在 root 而不是 InitialLayout：InitialLayout 在 <ClerkLoaded> 裡面，Clerk
  // 載入失敗時它根本不會 mount，`app_open` 就會跟著消失 —— 而那正是最需要看到
  // 數據的時候。理由同下面 UpdateBanner 的註解。
  useAppOpenTracking();

  if (!publishableKey) {
    throw new Error(
      "Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY. Copy .env.example to .env and set it."
    );
  }

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <ClerkLoaded>
        <InitialLayout />
      </ClerkLoaded>
      {/*
        更新提示掛在 root、而且刻意在 <ClerkLoaded> 外面 —— 登入牆外（含還沒登入、
        Clerk 還在載入）也要看得到。教訓來自設定頁的版號顯示：它藏在登入牆後面，
        剛好是登入出問題時最看不到的地方。
      */}
      <UpdateBanner />
      <WhatsNewSheet />
    </ClerkProvider>
  );
});
