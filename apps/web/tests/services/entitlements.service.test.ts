import { describe, it, expect, vi, beforeEach } from "vitest";
import { SubscriptionStatus } from "@prisma/client";

vi.mock("@/lib/prisma", () => ({
  prisma: { subscription: { findUnique: vi.fn() } },
}));

import { prisma } from "@/lib/prisma";
import { entitlementsService } from "../../services/entitlements.service";

const USER_ID = "user_test123";
const FUTURE = new Date(Date.now() + 1000 * 60 * 60 * 24);
const PAST = new Date(Date.now() - 1000 * 60 * 60 * 24);

describe("EntitlementsService.isPremium", () => {
  beforeEach(() => vi.clearAllMocks());

  it("looks up the subscription by the derived apple account token, not the raw userId", async () => {
    vi.mocked(prisma.subscription.findUnique).mockResolvedValue(null);
    await entitlementsService.isPremium(USER_ID);
    const arg = vi.mocked(prisma.subscription.findUnique).mock.calls[0]?.[0];
    expect(arg?.where.appleAccountToken).toBeDefined();
    expect(arg?.where.appleAccountToken).not.toBe(USER_ID);
  });

  it("returns false when there is no subscription", async () => {
    vi.mocked(prisma.subscription.findUnique).mockResolvedValue(null);
    expect(await entitlementsService.isPremium(USER_ID)).toBe(false);
  });

  it("returns true for an active, unexpired subscription", async () => {
    vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
      status: SubscriptionStatus.active,
      expiresAt: FUTURE,
    } as never);
    expect(await entitlementsService.isPremium(USER_ID)).toBe(true);
  });

  it("returns true during grace_period when still unexpired", async () => {
    vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
      status: SubscriptionStatus.grace_period,
      expiresAt: FUTURE,
    } as never);
    expect(await entitlementsService.isPremium(USER_ID)).toBe(true);
  });

  it("returns false for an active subscription that has expired", async () => {
    vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
      status: SubscriptionStatus.active,
      expiresAt: PAST,
    } as never);
    expect(await entitlementsService.isPremium(USER_ID)).toBe(false);
  });

  it("returns false for a revoked subscription even if unexpired", async () => {
    vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
      status: SubscriptionStatus.revoked,
      expiresAt: FUTURE,
    } as never);
    expect(await entitlementsService.isPremium(USER_ID)).toBe(false);
  });
});
