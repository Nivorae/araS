import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));
vi.mock("@/lib/security-log", () => ({ logSecurityEvent: vi.fn() }));
vi.mock("@/services/entries.service", () => {
  class EntryLimitError extends Error {}
  return { entriesService: { create: vi.fn() }, EntryLimitError };
});

import { auth } from "@clerk/nextjs/server";
import { entriesService, EntryLimitError } from "@/services/entries.service";
import { POST } from "../../app/api/entries/route";

function postReq(body: unknown) {
  return new NextRequest("http://localhost/api/entries", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const VALID_BODY = {
  name: "台積電",
  topCategory: "流動資金",
  subCategory: "現金",
  value: 1000,
};

describe("POST /api/entries entry-limit handling", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 403 ENTRY_LIMIT_REACHED when the service throws EntryLimitError", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "user_1" } as never);
    vi.mocked(entriesService.create).mockRejectedValue(new EntryLimitError());
    const res = await POST(postReq(VALID_BODY));
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("ENTRY_LIMIT_REACHED");
  });

  it("returns 201 on a normal create", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "user_1" } as never);
    vi.mocked(entriesService.create).mockResolvedValue({ id: "e1", value: 1000 } as never);
    const res = await POST(postReq(VALID_BODY));
    expect(res.status).toBe(201);
  });
});
