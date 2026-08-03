import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));
vi.mock("@/lib/security-log", () => ({ logSecurityEvent: vi.fn() }));
vi.mock("@/services/insurance.service", () => {
  class PremiumRequiredError extends Error {}
  return {
    insuranceService: {
      create: vi.fn(),
      findById: vi.fn(),
      update: vi.fn(),
      deleteByEntryId: vi.fn(),
    },
    PremiumRequiredError,
  };
});

import { auth } from "@clerk/nextjs/server";
import { logSecurityEvent } from "@/lib/security-log";
import { insuranceService, PremiumRequiredError } from "@/services/insurance.service";
import { POST } from "../../app/api/insurances/route";
import { GET, PATCH, DELETE } from "../../app/api/insurances/[id]/route";

const VALID = { insurer: "國泰人壽", insuredName: "本人", insuranceType: "MEDICAL" };
function req(body: unknown) {
  return new NextRequest("http://localhost/api/insurances", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function detailReq(method: string, body?: unknown) {
  return new NextRequest(`http://localhost/api/insurances/ins-1`, {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

function detailParams(id = "ins-1") {
  return { params: Promise.resolve({ id }) };
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

describe("GET /api/insurances/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as never);
    const res = await GET(detailReq("GET"), detailParams());
    expect(res.status).toBe(401);
  });

  it("404 when findById returns null (ownership miss)", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "u1" } as never);
    vi.mocked(insuranceService.findById).mockResolvedValue(null as never);
    const res = await GET(detailReq("GET"), detailParams("ins-1"));
    expect(res.status).toBe(404);
    expect(logSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "ownership_violation" })
    );
  });

  it("200 with the insurance data on success", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "u1" } as never);
    const insurance = { id: "ins-1", entryId: "entry-1", insurer: "國泰人壽" };
    vi.mocked(insuranceService.findById).mockResolvedValue(insurance as never);
    const res = await GET(detailReq("GET"), detailParams("ins-1"));
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual(insurance);
  });
});

describe("PATCH /api/insurances/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  const UPDATE_BODY = { insurer: "新光人壽" };

  it("401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as never);
    const res = await PATCH(detailReq("PATCH", UPDATE_BODY), detailParams());
    expect(res.status).toBe(401);
  });

  it("404 when findById returns null (ownership miss), before update is attempted", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "u1" } as never);
    vi.mocked(insuranceService.findById).mockResolvedValue(null as never);
    const res = await PATCH(detailReq("PATCH", UPDATE_BODY), detailParams("ins-1"));
    expect(res.status).toBe(404);
    expect(insuranceService.update).not.toHaveBeenCalled();
  });

  it("200 on success, calling update with the parsed body", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "u1" } as never);
    vi.mocked(insuranceService.findById).mockResolvedValue({
      id: "ins-1",
      entryId: "entry-1",
    } as never);
    vi.mocked(insuranceService.update).mockResolvedValue({ id: "ins-1", ...UPDATE_BODY } as never);
    const res = await PATCH(detailReq("PATCH", UPDATE_BODY), detailParams("ins-1"));
    expect(res.status).toBe(200);
    expect(insuranceService.update).toHaveBeenCalledWith("ins-1", UPDATE_BODY, "u1");
  });

  it("403 PREMIUM_REQUIRED when update throws PremiumRequiredError", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "u1" } as never);
    vi.mocked(insuranceService.findById).mockResolvedValue({
      id: "ins-1",
      entryId: "entry-1",
    } as never);
    vi.mocked(insuranceService.update).mockRejectedValue(new PremiumRequiredError());
    const res = await PATCH(detailReq("PATCH", UPDATE_BODY), detailParams("ins-1"));
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("PREMIUM_REQUIRED");
  });
});

describe("DELETE /api/insurances/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as never);
    const res = await DELETE(detailReq("DELETE"), detailParams());
    expect(res.status).toBe(401);
  });

  it("404 when findById returns null (ownership miss)", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "u1" } as never);
    vi.mocked(insuranceService.findById).mockResolvedValue(null as never);
    const res = await DELETE(detailReq("DELETE"), detailParams("ins-1"));
    expect(res.status).toBe(404);
    expect(insuranceService.deleteByEntryId).not.toHaveBeenCalled();
  });

  it("200 on success, deleting by the found insurance's entryId (not the route id param)", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "u1" } as never);
    vi.mocked(insuranceService.findById).mockResolvedValue({
      id: "ins-1",
      entryId: "entry-999",
    } as never);
    vi.mocked(insuranceService.deleteByEntryId).mockResolvedValue({ count: 1 } as never);
    const res = await DELETE(detailReq("DELETE"), detailParams("ins-1"));
    expect(res.status).toBe(200);
    expect(insuranceService.deleteByEntryId).toHaveBeenCalledWith("entry-999", "u1");
    expect(insuranceService.deleteByEntryId).not.toHaveBeenCalledWith("ins-1", "u1");
  });
});
