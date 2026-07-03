import { NotificationTypeV2, Subtype } from "@apple/app-store-server-library";
import type {
  JWSTransactionDecodedPayload,
  ResponseBodyV2DecodedPayload,
} from "@apple/app-store-server-library";
import { SubscriptionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

function resolveStatus(
  notificationType: NotificationTypeV2 | string | undefined,
  subtype: Subtype | string | undefined,
  transaction: JWSTransactionDecodedPayload
): SubscriptionStatus {
  if (transaction.revocationDate) return SubscriptionStatus.revoked;

  switch (notificationType) {
    case NotificationTypeV2.SUBSCRIBED:
    case NotificationTypeV2.DID_RENEW:
    case NotificationTypeV2.DID_CHANGE_RENEWAL_PREF:
    case NotificationTypeV2.OFFER_REDEEMED:
    case NotificationTypeV2.RENEWAL_EXTENDED:
    case NotificationTypeV2.RENEWAL_EXTENSION:
      return SubscriptionStatus.active;
    case NotificationTypeV2.DID_FAIL_TO_RENEW:
      return subtype === Subtype.GRACE_PERIOD
        ? SubscriptionStatus.grace_period
        : SubscriptionStatus.expired;
    case NotificationTypeV2.EXPIRED:
    case NotificationTypeV2.GRACE_PERIOD_EXPIRED:
      return SubscriptionStatus.expired;
    case NotificationTypeV2.REFUND:
    case NotificationTypeV2.REVOKE:
      return SubscriptionStatus.revoked;
    default:
      // DID_CHANGE_RENEWAL_STATUS, PRICE_INCREASE, CONSUMPTION_REQUEST, TEST,
      // etc. don't themselves change entitlement — fall back to expiresDate.
      return transaction.expiresDate && transaction.expiresDate > Date.now()
        ? SubscriptionStatus.active
        : SubscriptionStatus.expired;
  }
}

export class SubscriptionService {
  // `transaction.appAccountToken` is `deriveAppleAccountToken(clerkUserId)`
  // (see @repo/shared) — set by the mobile purchase flow, not the raw Clerk
  // userId. Notifications without it (e.g. purchases made before that was
  // wired up) can't be attributed to a user and are skipped.
  async upsertFromNotification(
    decoded: ResponseBodyV2DecodedPayload,
    transaction: JWSTransactionDecodedPayload
  ): Promise<void> {
    if (
      !transaction.appAccountToken ||
      !transaction.originalTransactionId ||
      !transaction.productId
    ) {
      return;
    }

    const status = resolveStatus(decoded.notificationType, decoded.subtype, transaction);
    const expiresAt = new Date(transaction.expiresDate ?? Date.now());
    const environment = decoded.data?.environment ?? "Production";

    await prisma.subscription.upsert({
      where: { originalTransactionId: transaction.originalTransactionId },
      create: {
        appleAccountToken: transaction.appAccountToken,
        productId: transaction.productId,
        status,
        expiresAt,
        originalTransactionId: transaction.originalTransactionId,
        environment,
      },
      update: {
        appleAccountToken: transaction.appAccountToken,
        productId: transaction.productId,
        status,
        expiresAt,
        environment,
      },
    });
  }
}

export const subscriptionService = new SubscriptionService();
