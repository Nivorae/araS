import Purchases from "react-native-purchases";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { deriveAppleAccountToken } from "@repo/shared";

const apiKey = Platform.select({
  ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY,
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY,
});

// RevenueCat's native store module does not exist inside Expo Go — calling
// Purchases.configure() there throws "Invalid API key / native store not
// available" and, being uncaught, crashes the whole app on login.
const isExpoGo = Constants.executionEnvironment === "storeClient";

let configured = false;

// Configures RevenueCat once, tying its appUserID to the Clerk user so
// purchases are attributed to the same identity everything else is keyed by.
// appUserID must be the derived UUID, not the raw Clerk id: RevenueCat's iOS
// SDK only sets StoreKit's appAccountToken (which the webhook matches on)
// when appUserID is a valid UUID, and the raw `user_...` id is not one.
// No-op without an API key, inside Expo Go, or if the native store is
// unavailable — a subscription-config failure must never crash the app.
export function configurePurchases(userId: string): void {
  if (!apiKey || configured || isExpoGo) return;
  try {
    Purchases.configure({ apiKey, appUserID: deriveAppleAccountToken(userId) });
    configured = true;
  } catch (e) {
    console.warn("configurePurchases failed; continuing without RevenueCat", e);
  }
}

export function isPurchasesConfigured(): boolean {
  return configured;
}
