import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { SubscriptionStatus } from "@prisma/client";

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { subscription: { upsert: vi.fn(), deleteMany: vi.fn() } },
}));

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { POST } from "../../app/api/dev/subscription/route";

function req(body: unknown) {
  return new NextRequest("http://localhost/api/dev/subscription", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const ORIGINAL_ENV = process.env.NODE_ENV;

describe("POST /api/dev/subscription", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "test");
  });
  afterEach(() => {
    vi.stubEnv("NODE_ENV", ORIGINAL_ENV ?? "test");
  });

  it("404s when NODE_ENV is production, before even checking auth", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const res = await POST(req({ action: "activate" }));
    expect(res.status).toBe(404);
    expect(auth).not.toHaveBeenCalled();
  });

  it("401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as never);
    const res = await POST(req({ action: "activate" }));
    expect(res.status).toBe(401);
  });

  it("400 when action is missing or invalid", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "user_1" } as never);
    const res = await POST(req({ action: "nonsense" }));
    expect(res.status).toBe(400);
  });

  it("activate upserts an active Subscription keyed by the derived apple account token, not the raw userId", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "user_1" } as never);
    vi.mocked(prisma.subscription.upsert).mockResolvedValue({} as never);

    const res = await POST(req({ action: "activate" }));

    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual({ isPremium: true });
    const call = vi.mocked(prisma.subscription.upsert).mock.calls[0]?.[0];
    expect(call?.where.appleAccountToken).toBeDefined();
    expect(call?.where.appleAccountToken).not.toBe("user_1");
    expect(call?.create.status).toBe(SubscriptionStatus.active);
    expect(call?.create.environment).toBe("Sandbox");
    expect((call?.create.expiresAt as Date).getTime()).toBeGreaterThan(Date.now());
  });

  it("deactivate deletes the caller's Subscription row and returns isPremium: false", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "user_1" } as never);
    vi.mocked(prisma.subscription.deleteMany).mockResolvedValue({ count: 1 } as never);

    const res = await POST(req({ action: "deactivate" }));

    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual({ isPremium: false });
    const call = vi.mocked(prisma.subscription.deleteMany).mock.calls[0]?.[0];
    expect(call?.where?.appleAccountToken).toBeDefined();
  });
});
