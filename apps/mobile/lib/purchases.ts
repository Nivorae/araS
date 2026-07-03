import Purchases from "react-native-purchases";
import { Platform } from "react-native";

const apiKey = Platform.select({
  ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY,
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY,
});

let configured = false;

// Configures RevenueCat once, tying its appUserID to the Clerk user so
// purchases are attributed to the same identity everything else is keyed by.
// No-op without an API key — this app has no real subscription products yet.
export function configurePurchases(userId: string): void {
  if (!apiKey || configured) return;
  Purchases.configure({ apiKey, appUserID: userId });
  configured = true;
}

export function isPurchasesConfigured(): boolean {
  return configured;
}
