import { SubscriptionStatus } from "@prisma/client";
import { deriveAppleAccountToken } from "@repo/shared";
import { prisma } from "@/lib/prisma";

// Clerk user ids that are premium without a purchase — the maintainer's own
// accounts. Read from the env on every call rather than at module load so a
// Vercel env change takes effect on the next request instead of the next
// deploy, and so tests can set it per-case.
//
// Server-side only, deliberately: this never reaches the App bundle, so it is
// not something a user can discover or forge. It is also kept out of the
// `Subscription` table on purpose — that table means "Apple says this person
// paid", and seeding it by hand both muddies that meaning and collides with
// the unique `appleAccountToken` if the same account later buys for real.
function ownerUserIds(): string[] {
  return (process.env.PREMIUM_OWNER_USER_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id !== "");
}

// Single choke point for premium-feature checks. Reads the Subscription row
// written by the App Store Server Notifications webhook (Apple is the source
// of truth). Keyed by deriveAppleAccountToken(userId), NOT the raw Clerk
// userId — the webhook stores the derived UUID (see appleAccountToken.ts).
export class EntitlementsService {
  async isPremium(userId: string): Promise<boolean> {
    if (ownerUserIds().includes(userId)) return true;

    const appleAccountToken = deriveAppleAccountToken(userId);
    const sub = await prisma.subscription.findUnique({ where: { appleAccountToken } });
    if (!sub) return false;
    const entitledStatus =
      sub.status === SubscriptionStatus.active || sub.status === SubscriptionStatus.grace_period;
    return entitledStatus && sub.expiresAt.getTime() > Date.now();
  }
}

export const entitlementsService = new EntitlementsService();
