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
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.PREMIUM_OWNER_USER_IDS;
  });

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
  describe("PREMIUM_OWNER_USER_IDS allowlist", () => {
    it("grants premium without touching the database", async () => {
      process.env.PREMIUM_OWNER_USER_IDS = USER_ID;
      expect(await entitlementsService.isPremium(USER_ID)).toBe(true);
      // The short-circuit is the point: an owner stays premium even when the
      // database is unreachable, so no query may be issued.
      expect(prisma.subscription.findUnique).not.toHaveBeenCalled();
    });

    it("accepts a comma-separated list with surrounding whitespace", async () => {
      process.env.PREMIUM_OWNER_USER_IDS = ` user_other , ${USER_ID} `;
      expect(await entitlementsService.isPremium(USER_ID)).toBe(true);
    });

    it("leaves non-listed users on the normal subscription path", async () => {
      process.env.PREMIUM_OWNER_USER_IDS = "user_someone_else";
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue(null);
      expect(await entitlementsService.isPremium(USER_ID)).toBe(false);
      expect(prisma.subscription.findUnique).toHaveBeenCalled();
    });

    it("treats an empty or unset value as nobody, not as everybody", async () => {
      process.env.PREMIUM_OWNER_USER_IDS = "";
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue(null);
      expect(await entitlementsService.isPremium(USER_ID)).toBe(false);
      // An empty string splits to [""], so a bare filter-less implementation
      // would match a user whose id is "" — and, worse, `"".split(",")` never
      // yields an empty array. Guard the blank-id case explicitly.
      expect(await entitlementsService.isPremium("")).toBe(false);
    });
  });
});
