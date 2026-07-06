import { describe, it, expect, vi, beforeEach } from "vitest";
import { NotificationTypeV2, Subtype } from "@apple/app-store-server-library";
import type {
  JWSTransactionDecodedPayload,
  ResponseBodyV2DecodedPayload,
} from "@apple/app-store-server-library";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    subscription: {
      upsert: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { subscriptionService } from "../../services/subscription.service";

const BASE_TRANSACTION: JWSTransactionDecodedPayload = {
  appAccountToken: "11111111-1111-1111-1111-111111111111",
  originalTransactionId: "1000000000000001",
  productId: "premium_monthly",
  expiresDate: Date.now() + 1000 * 60 * 60 * 24 * 30,
};

function notification(type: NotificationTypeV2, subtype?: Subtype): ResponseBodyV2DecodedPayload {
  return {
    notificationType: type,
    ...(subtype ? { subtype } : {}),
    data: { environment: "Production" },
  };
}

describe("SubscriptionService.upsertFromNotification", () => {
  beforeEach(() => vi.clearAllMocks());

  it("skips notifications without an appAccountToken", async () => {
    const withoutToken = { ...BASE_TRANSACTION };
    delete withoutToken.appAccountToken;
    await subscriptionService.upsertFromNotification(
      notification(NotificationTypeV2.SUBSCRIBED),
      withoutToken
    );
    expect(prisma.subscription.upsert).not.toHaveBeenCalled();
  });

  it("marks SUBSCRIBED as active", async () => {
    await subscriptionService.upsertFromNotification(
      notification(NotificationTypeV2.SUBSCRIBED),
      BASE_TRANSACTION
    );
    expect(prisma.subscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ status: "active" }) })
    );
  });

  it("marks EXPIRED as expired", async () => {
    await subscriptionService.upsertFromNotification(
      notification(NotificationTypeV2.EXPIRED),
      BASE_TRANSACTION
    );
    expect(prisma.subscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ status: "expired" }) })
    );
  });

  it("marks DID_FAIL_TO_RENEW + GRACE_PERIOD subtype as grace_period", async () => {
    await subscriptionService.upsertFromNotification(
      notification(NotificationTypeV2.DID_FAIL_TO_RENEW, Subtype.GRACE_PERIOD),
      BASE_TRANSACTION
    );
    expect(prisma.subscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ status: "grace_period" }) })
    );
  });

  it("marks DID_FAIL_TO_RENEW without grace period as expired", async () => {
    await subscriptionService.upsertFromNotification(
      notification(NotificationTypeV2.DID_FAIL_TO_RENEW),
      BASE_TRANSACTION
    );
    expect(prisma.subscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ status: "expired" }) })
    );
  });

  it("marks REFUND as revoked", async () => {
    await subscriptionService.upsertFromNotification(
      notification(NotificationTypeV2.REFUND),
      BASE_TRANSACTION
    );
    expect(prisma.subscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ status: "revoked" }) })
    );
  });

  it("treats a revoked transaction as revoked regardless of notification type", async () => {
    await subscriptionService.upsertFromNotification(notification(NotificationTypeV2.SUBSCRIBED), {
      ...BASE_TRANSACTION,
      revocationDate: Date.now(),
    });
    expect(prisma.subscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ status: "revoked" }) })
    );
  });

  it("upserts keyed on originalTransactionId", async () => {
    await subscriptionService.upsertFromNotification(
      notification(NotificationTypeV2.SUBSCRIBED),
      BASE_TRANSACTION
    );
    expect(prisma.subscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { originalTransactionId: BASE_TRANSACTION.originalTransactionId },
      })
    );
  });
});
