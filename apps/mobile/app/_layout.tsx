import "react-native-url-polyfill/auto";
import * as Sentry from "@sentry/react-native";
import { ClerkProvider, ClerkLoaded, useAuth } from "@clerk/clerk-expo";
import { Slot, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { tokenCache } from "@/lib/tokenCache";
import UpdateBanner from "@/components/UpdateBanner";
import WhatsNewSheet from "@/components/WhatsNewSheet";
import { configurePurchases } from "@/lib/purchases";

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
