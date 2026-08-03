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

// Configures RevenueCat once, using the derived Apple account token (a UUID)
// as the appUserID — NOT the raw Clerk userId.
//
// This is load-bearing for entitlement attribution: the backend's source of
// truth is Apple's App Store Server Notifications (see web
// subscription.service.ts / entitlements.service.ts), which key the
// Subscription row by the transaction's `appAccountToken`. RevenueCat's iOS
// SDK only populates StoreKit's `appAccountToken` when the appUserID is a
// valid UUID — passing the raw Clerk id (not a UUID) leaves it unset, so the
// webhook can't attribute the purchase and a paying user never becomes
// premium. deriveAppleAccountToken(userId) is the same UUID the webhook
// matches against, so purchases attribute correctly.
//
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
