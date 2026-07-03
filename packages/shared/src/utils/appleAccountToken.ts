import { v5 as uuidv5 } from "uuid";

// Fixed, arbitrary namespace UUID for this app — must never change, or every
// derived token (and therefore every Subscription lookup) breaks.
const ARAS_APPLE_ACCOUNT_TOKEN_NAMESPACE = "d4b6a6b2-8f3e-4a3a-9e3a-2e6f6b6b2d1e";

// Apple's StoreKit2 `appAccountToken` must be a UUID, but our internal user
// IDs (Clerk) are not. This derives a stable, one-way UUID from a Clerk userId
// so the same value can be recomputed on both the purchase side (mobile,
// passed to RevenueCat/StoreKit2) and the verification side (web, matching an
// App Store Server Notification's `appAccountToken` back to a Subscription
// row) without needing a separate mapping table.
export function deriveAppleAccountToken(userId: string): string {
  return uuidv5(userId, ARAS_APPLE_ACCOUNT_TOKEN_NAMESPACE);
}
