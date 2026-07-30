import { SubscriptionStatus } from "@prisma/client";
import { deriveAppleAccountToken } from "@repo/shared";
import { prisma } from "@/lib/prisma";

// Single choke point for premium-feature checks. Reads the Subscription row
// written by the App Store Server Notifications webhook (Apple is the source
// of truth). Keyed by deriveAppleAccountToken(userId), NOT the raw Clerk
// userId — the webhook stores the derived UUID (see appleAccountToken.ts).
export class EntitlementsService {
  async isPremium(userId: string): Promise<boolean> {
    const appleAccountToken = deriveAppleAccountToken(userId);
    const sub = await prisma.subscription.findUnique({ where: { appleAccountToken } });
    if (!sub) return false;
    const entitledStatus =
      sub.status === SubscriptionStatus.active || sub.status === SubscriptionStatus.grace_period;
    return entitledStatus && sub.expiresAt.getTime() > Date.now();
  }
}

export const entitlementsService = new EntitlementsService();
