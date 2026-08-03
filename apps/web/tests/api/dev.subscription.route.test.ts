import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));
vi.mock("@/services/subscription.service", () => ({
  subscriptionService: { setDevStatus: vi.fn() },
}));

import { auth } from "@clerk/nextjs/server";
import { subscriptionService } from "@/services/subscription.service";
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

  it("activate calls setDevStatus(userId, true) and returns isPremium: true", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "user_1" } as never);
    vi.mocked(subscriptionService.setDevStatus).mockResolvedValue(undefined);

    const res = await POST(req({ action: "activate" }));

    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual({ isPremium: true });
    expect(subscriptionService.setDevStatus).toHaveBeenCalledWith("user_1", true);
  });

  it("deactivate calls setDevStatus(userId, false) and returns isPremium: false", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "user_1" } as never);
    vi.mocked(subscriptionService.setDevStatus).mockResolvedValue(undefined);

    const res = await POST(req({ action: "deactivate" }));

    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual({ isPremium: false });
    expect(subscriptionService.setDevStatus).toHaveBeenCalledWith("user_1", false);
  });
});
