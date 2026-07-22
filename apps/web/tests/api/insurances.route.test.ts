import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));
vi.mock("@/lib/security-log", () => ({ logSecurityEvent: vi.fn() }));
vi.mock("@/services/insurance.service", () => {
  class PremiumRequiredError extends Error {}
  return { insuranceService: { create: vi.fn() }, PremiumRequiredError };
});

import { auth } from "@clerk/nextjs/server";
import { insuranceService, PremiumRequiredError } from "@/services/insurance.service";
import { POST } from "../../app/api/insurances/route";

const VALID = { insurer: "國泰人壽", insuredName: "本人", insuranceType: "MEDICAL" };
function req(body: unknown) {
  return new NextRequest("http://localhost/api/insurances", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/insurances", () => {
  beforeEach(() => vi.clearAllMocks());

  it("401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as never);
    expect((await POST(req(VALID))).status).toBe(401);
  });

  it("403 PREMIUM_REQUIRED when the service rejects a non-premium user", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "u1" } as never);
    vi.mocked(insuranceService.create).mockRejectedValue(new PremiumRequiredError());
    const res = await POST(req(VALID));
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("PREMIUM_REQUIRED");
  });

  it("201 on success", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "u1" } as never);
    vi.mocked(insuranceService.create).mockResolvedValue({ id: "ins-1" } as never);
    expect((await POST(req(VALID))).status).toBe(201);
  });
});
