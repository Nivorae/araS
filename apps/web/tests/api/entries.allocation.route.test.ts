import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));
vi.mock("@/lib/security-log", () => ({ logSecurityEvent: vi.fn() }));
vi.mock("@/services/entries.service", () => ({
  entriesService: { getAssetAllocation: vi.fn() },
}));
vi.mock("@/services/entitlements.service", () => ({
  entitlementsService: { isPremium: vi.fn() },
}));

import { auth } from "@clerk/nextjs/server";
import { entriesService } from "@/services/entries.service";
import { entitlementsService } from "@/services/entitlements.service";
import { GET } from "../../app/api/entries/allocation/route";

describe("GET /api/entries/allocation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as never);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 403 PREMIUM_REQUIRED for a non-premium user", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "user_1" } as never);
    vi.mocked(entitlementsService.isPremium).mockResolvedValue(false);
    const res = await GET();
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error.code).toBe("PREMIUM_REQUIRED");
    expect(entriesService.getAssetAllocation).not.toHaveBeenCalled();
  });

  it("returns the allocation for a premium user", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "user_1" } as never);
    vi.mocked(entitlementsService.isPremium).mockResolvedValue(true);
    vi.mocked(entriesService.getAssetAllocation).mockResolvedValue({
      breakdown: [],
      concentrationWarnings: [],
      debtToAssetRatio: null,
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(entriesService.getAssetAllocation).toHaveBeenCalledWith("user_1");
  });
});
