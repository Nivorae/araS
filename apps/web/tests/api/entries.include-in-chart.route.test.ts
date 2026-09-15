import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));
vi.mock("@/lib/security-log", () => ({ logSecurityEvent: vi.fn() }));
vi.mock("@/services/entitlements.service", () => ({
  entitlementsService: { isPremium: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    entry: { findFirst: vi.fn(), update: vi.fn() },
    entryHistory: { create: vi.fn() },
  },
}));

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { PUT } from "../../app/api/entries/[id]/route";

const EXISTING = {
  id: "e1",
  userId: "user_1",
  name: "現金",
  topCategory: "流動資金",
  subCategory: "現金",
  value: new Prisma.Decimal(1000),
  includeInChart: true,
  loan: null,
};

describe("PUT /api/entries/[id] 納入圖表", () => {
  beforeEach(() => vi.clearAllMocks());

  it("persists includeInChart:false from a basic-info edit", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "user_1" } as never);
    vi.mocked(prisma.entry.findFirst).mockResolvedValue(EXISTING as never);
    vi.mocked(prisma.entry.update).mockImplementation((async (args: {
      data: Record<string, unknown>;
    }) => ({ ...EXISTING, ...args.data })) as never);

    const req = new NextRequest("http://localhost/api/entries/e1", {
      method: "PUT",
      body: JSON.stringify({ name: "現金", includeInChart: false }),
    });
    const res = await PUT(req, { params: Promise.resolve({ id: "e1" }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(prisma.entry.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ includeInChart: false }) })
    );
    expect(json.data.includeInChart).toBe(false);
  });
});
