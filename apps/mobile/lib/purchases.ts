import Purchases from "react-native-purchases";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { deriveAppleAccountToken } from "@repo/shared";

const apiKey = Platform.select({
  ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY,
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY,
});

// Subscriptions ship on iOS only for now. There is no Google Play Billing
// product, no RevenueCat Android app, and — decisively — no backend handling of
// Google's real-time developer notifications, which are what would have to
// write the Subscription row that entitlements.service reads. So the Android
// key is deliberately unset, and this flag is what the UI branches on.
//
// It exists because `isPurchasesConfigured()` alone cannot tell the two
// no-store cases apart: "Expo Go, native module missing" (show preview plans)
// and "Android, nothing to sell" (say so). Conflating them made a production
// Android build show placeholder NT$300／NT$30 prices nobody could buy.
export const SUBSCRIPTIONS_SUPPORTED = Boolean(apiKey);

// RevenueCat's native store module does not exist inside Expo Go — calling
// Purchases.configure() there throws "Invalid API key / native store not
// available" and, being uncaught, crashes the whole app on login.
const isExpoGo = Constants.executionEnvironment === "storeClient";

let configured = false;
// Serialises identity switches so a purchase can wait for the latest one.
let identifying: Promise<void> = Promise.resolve();

async function identifyAs(appUserID: string): Promise<void> {
  if ((await Purchases.getAppUserID()) !== appUserID) await Purchases.logIn(appUserID);
}

// Configures RevenueCat using the derived Apple account token (a UUID) as the
// appUserID — NOT the raw Clerk userId.
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
// configure() runs once per process; after that, a different account signing
// in on the same device switches RevenueCat with logIn(). Without the switch
// the previous account's token stays attached, and the new account's purchase
// is credited to the old one.
//
// No-op without an API key, inside Expo Go, or if the native store is
// unavailable — a subscription-config failure must never crash the app.
export function configurePurchases(userId: string): void {
  if (!apiKey || isExpoGo) return;
  const appUserID = deriveAppleAccountToken(userId);
  if (!configured) {
    try {
      Purchases.configure({ apiKey, appUserID });
      configured = true;
    } catch (e) {
      console.warn("configurePurchases failed; continuing without RevenueCat", e);
    }
    return;
  }
  identifying = identifying.then(() =>
    identifyAs(appUserID).catch((e) => console.warn("Purchases.logIn failed", e))
  );
}

// Await before purchasing or restoring: true only once RevenueCat is
// identified as `userId`. Retries the switch once; on false the caller must not
// buy, or the purchase would be attributed to whoever RevenueCat still names.
export async function ensurePurchasesUser(userId: string): Promise<boolean> {
  const appUserID = deriveAppleAccountToken(userId);
  await identifying;
  try {
    await identifyAs(appUserID);
    return (await Purchases.getAppUserID()) === appUserID;
  } catch (e) {
    console.warn("ensurePurchasesUser failed", e);
    return false;
  }
}

export function isPurchasesConfigured(): boolean {
  return configured;
}
