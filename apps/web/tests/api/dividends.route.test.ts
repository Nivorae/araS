import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));
vi.mock("@/services/dividends.service", async () => {
  const actual = await vi.importActual<typeof import("../../services/dividends.service")>(
    "../../services/dividends.service"
  );
  return {
    ...actual,
    dividendsService: { list: vi.fn(), create: vi.fn(), summary: vi.fn() },
  };
});
vi.mock("@/lib/security-log", () => ({ logSecurityEvent: vi.fn() }));

import { auth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { dividendsService, PremiumRequiredError } from "../../services/dividends.service";
import { GET, POST } from "../../app/api/dividends/route";

const USER_ID = "user_test123";

function postReq(body: unknown) {
  return new NextRequest("http://localhost/api/dividends", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("/api/dividends", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ userId: USER_ID } as never);
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as never);
    const res = await GET(new NextRequest("http://localhost/api/dividends"));
    expect(res.status).toBe(401);
  });

  it("returns 403 PREMIUM_REQUIRED for a free user", async () => {
    vi.mocked(dividendsService.create).mockRejectedValue(new PremiumRequiredError());
    const res = await POST(postReq({ entryId: "e1", payDate: "2026-08-13", amount: 100 }));
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("PREMIUM_REQUIRED");
  });

  it("returns 400 on invalid input", async () => {
    const res = await POST(postReq({ entryId: "e1", payDate: "2026-08-13", amount: -5 }));
    expect(res.status).toBe(400);
    expect(dividendsService.create).not.toHaveBeenCalled();
  });

  it("returns 201 with the created dividend", async () => {
    vi.mocked(dividendsService.create).mockResolvedValue({ id: "div-1" } as never);
    const res = await POST(postReq({ entryId: "e1", payDate: "2026-08-13", amount: 100 }));
    expect(res.status).toBe(201);
    expect((await res.json()).data.id).toBe("div-1");
  });

  it("passes entryId through to the service", async () => {
    vi.mocked(dividendsService.list).mockResolvedValue([] as never);
    await GET(new NextRequest("http://localhost/api/dividends?entryId=e1"));
    expect(dividendsService.list).toHaveBeenCalledWith(USER_ID, "e1");
  });
});
