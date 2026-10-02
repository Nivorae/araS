import { describe, it, expect, vi, beforeEach } from "vitest";
import { NotificationTypeV2, Subtype } from "@apple/app-store-server-library";
import type {
  JWSTransactionDecodedPayload,
  ResponseBodyV2DecodedPayload,
} from "@apple/app-store-server-library";
import { deriveAppleAccountToken } from "@repo/shared";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    subscription: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
      updateMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
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

const SIGNED_AT = Date.UTC(2026, 9, 1);

function notification(
  type: NotificationTypeV2,
  subtype?: Subtype,
  signedDate = SIGNED_AT
): ResponseBodyV2DecodedPayload {
  return {
    notificationType: type,
    ...(subtype ? { subtype } : {}),
    signedDate,
    data: { environment: "Production" },
  };
}

type Row = { id: string; lastSignedAt: Date | null };
// What findUnique returns, by lookup key.
let byOriginalTransactionId: Row | null;
let byToken: Row | null;

// The fields written by whichever path ran (new row or conditional update).
function written() {
  const created = vi.mocked(prisma.subscription.create).mock.calls[0]?.[0]?.data;
  const updated = vi.mocked(prisma.subscription.updateMany).mock.calls[0]?.[0]?.data;
  return (created ?? updated) as Record<string, unknown>;
}

describe("SubscriptionService.upsertFromNotification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    byOriginalTransactionId = null;
    byToken = null;
    vi.mocked(prisma.subscription.updateMany).mockResolvedValue({ count: 0 });
    vi.mocked(prisma.subscription.findUnique).mockImplementation((async (args: {
      where: { originalTransactionId?: string; appleAccountToken?: string };
    }) => (args.where.originalTransactionId ? byOriginalTransactionId : byToken)) as never);
  });

  it("skips notifications without an appAccountToken", async () => {
    const withoutToken = { ...BASE_TRANSACTION };
    delete withoutToken.appAccountToken;
    await subscriptionService.upsertFromNotification(
      notification(NotificationTypeV2.SUBSCRIBED),
      withoutToken
    );
    expect(prisma.subscription.updateMany).not.toHaveBeenCalled();
    expect(prisma.subscription.create).not.toHaveBeenCalled();
  });

  it("marks SUBSCRIBED as active", async () => {
    await subscriptionService.upsertFromNotification(
      notification(NotificationTypeV2.SUBSCRIBED),
      BASE_TRANSACTION
    );
    expect(written()).toMatchObject({ status: "active" });
  });

  it("marks EXPIRED as expired", async () => {
    await subscriptionService.upsertFromNotification(
      notification(NotificationTypeV2.EXPIRED),
      BASE_TRANSACTION
    );
    expect(written()).toMatchObject({ status: "expired" });
  });

  it("marks DID_FAIL_TO_RENEW + GRACE_PERIOD subtype as grace_period", async () => {
    await subscriptionService.upsertFromNotification(
      notification(NotificationTypeV2.DID_FAIL_TO_RENEW, Subtype.GRACE_PERIOD),
      BASE_TRANSACTION
    );
    expect(written()).toMatchObject({ status: "grace_period" });
  });

  it("marks DID_FAIL_TO_RENEW without grace period as expired", async () => {
    await subscriptionService.upsertFromNotification(
      notification(NotificationTypeV2.DID_FAIL_TO_RENEW),
      BASE_TRANSACTION
    );
    expect(written()).toMatchObject({ status: "expired" });
  });

  it("marks REFUND as revoked", async () => {
    await subscriptionService.upsertFromNotification(
      notification(NotificationTypeV2.REFUND),
      BASE_TRANSACTION
    );
    expect(written()).toMatchObject({ status: "revoked" });
  });

  it("treats a revoked transaction as revoked regardless of notification type", async () => {
    await subscriptionService.upsertFromNotification(notification(NotificationTypeV2.SUBSCRIBED), {
      ...BASE_TRANSACTION,
      revocationDate: Date.now(),
    });
    expect(written()).toMatchObject({ status: "revoked" });
  });

  it("creates the row with the notification's signedDate", async () => {
    await subscriptionService.upsertFromNotification(
      notification(NotificationTypeV2.SUBSCRIBED),
      BASE_TRANSACTION
    );
    expect(prisma.subscription.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        originalTransactionId: BASE_TRANSACTION.originalTransactionId,
        lastSignedAt: new Date(SIGNED_AT),
      }),
    });
  });

  // Apple doesn't guarantee delivery order: a late DID_RENEW must not
  // reactivate a subscription a newer REFUND already revoked.
  it("updates an existing row only if the notification is newer", async () => {
    vi.mocked(prisma.subscription.updateMany).mockResolvedValue({ count: 1 });

    await subscriptionService.upsertFromNotification(
      notification(NotificationTypeV2.REFUND),
      BASE_TRANSACTION
    );

    expect(prisma.subscription.updateMany).toHaveBeenCalledWith({
      where: {
        originalTransactionId: BASE_TRANSACTION.originalTransactionId,
        OR: [{ lastSignedAt: null }, { lastSignedAt: { lt: new Date(SIGNED_AT) } }],
      },
      data: expect.objectContaining({ status: "revoked", lastSignedAt: new Date(SIGNED_AT) }),
    });
    expect(prisma.subscription.create).not.toHaveBeenCalled();
  });

  it("ignores a stale notification for an existing row", async () => {
    byOriginalTransactionId = { id: "sub_1", lastSignedAt: new Date(SIGNED_AT + 1000) };

    await subscriptionService.upsertFromNotification(notification(NotificationTypeV2.DID_RENEW), {
      ...BASE_TRANSACTION,
    });

    expect(prisma.subscription.create).not.toHaveBeenCalled();
    expect(prisma.subscription.update).not.toHaveBeenCalled();
  });

  // appleAccountToken is unique. A row already holding it under another
  // originalTransactionId (a dev row, or a slot taken before this purchase)
  // used to make create() throw on every retry; Apple-verified data wins.
  it("takes over an older row that holds the same appleAccountToken", async () => {
    byToken = { id: "sub_old", lastSignedAt: null };

    await subscriptionService.upsertFromNotification(
      notification(NotificationTypeV2.SUBSCRIBED),
      BASE_TRANSACTION
    );

    expect(prisma.subscription.update).toHaveBeenCalledWith({
      where: { id: "sub_old" },
      data: expect.objectContaining({
        originalTransactionId: BASE_TRANSACTION.originalTransactionId,
        status: "active",
      }),
    });
    expect(prisma.subscription.create).not.toHaveBeenCalled();
  });

  it("leaves a token row alone when it already has a newer notification", async () => {
    byToken = { id: "sub_new", lastSignedAt: new Date(SIGNED_AT + 1000) };

    await subscriptionService.upsertFromNotification(
      notification(NotificationTypeV2.EXPIRED),
      BASE_TRANSACTION
    );

    expect(prisma.subscription.update).not.toHaveBeenCalled();
    expect(prisma.subscription.create).not.toHaveBeenCalled();
  });
});

describe("SubscriptionService.setDevStatus", () => {
  beforeEach(() => vi.clearAllMocks());

  it("activate upserts keyed by the derived apple account token with status active", async () => {
    const userId = "user_1";
    const expectedToken = deriveAppleAccountToken(userId);

    await subscriptionService.setDevStatus(userId, true);

    expect(prisma.subscription.upsert).toHaveBeenCalledTimes(1);
    const call = vi.mocked(prisma.subscription.upsert).mock.calls[0]?.[0];
    expect(call?.where.appleAccountToken).toBe(expectedToken);
    expect(call?.where.appleAccountToken).not.toBe(userId);
    expect(call?.create).toMatchObject({
      appleAccountToken: expectedToken,
      productId: "dev_test_premium",
      status: "active",
      environment: "Sandbox",
      originalTransactionId: `dev-${userId}`,
    });
    expect((call?.create.expiresAt as Date).getTime()).toBeGreaterThan(Date.now());
    expect(call?.update).toMatchObject({
      productId: "dev_test_premium",
      status: "active",
      environment: "Sandbox",
    });
    expect(
      (call?.update as { originalTransactionId?: string }).originalTransactionId
    ).toBeUndefined();
  });

  it("deactivate calls deleteMany keyed by the derived apple account token", async () => {
    const userId = "user_1";
    const expectedToken = deriveAppleAccountToken(userId);

    await subscriptionService.setDevStatus(userId, false);

    expect(prisma.subscription.deleteMany).toHaveBeenCalledWith({
      where: { appleAccountToken: expectedToken },
    });
  });
});
