import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));
vi.mock("@/services/loans.service", () => ({ loansService: { create: vi.fn() } }));
vi.mock("@/lib/security-log", () => ({ logSecurityEvent: vi.fn() }));

import { auth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { loansService } from "@/services/loans.service";
import { EntryLimitError } from "../../services/entries.service";
import { POST } from "../../app/api/loans/route";

const BODY = {
  loanName: "信貸",
  category: "信貸",
  totalAmount: 100000,
  annualInterestRate: 2,
  termMonths: 12,
  startDate: "2026-01-01",
  gracePeriodMonths: 0,
  repaymentType: "principal_interest",
};

function postReq() {
  return new NextRequest("http://localhost/api/loans", {
    method: "POST",
    body: JSON.stringify(BODY),
  });
}

describe("POST /api/loans", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ userId: "user_test123" } as never);
  });

  // Same envelope as POST /api/entries, so the mobile EntryForm's existing
  // ENTRY_LIMIT_REACHED handler shows the upgrade prompt for loans too.
  it("returns 403 ENTRY_LIMIT_REACHED when the free cap is hit", async () => {
    vi.mocked(loansService.create).mockRejectedValue(new EntryLimitError());

    const res = await POST(postReq());
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error.code).toBe("ENTRY_LIMIT_REACHED");
  });

  it("returns 201 when the loan is created", async () => {
    vi.mocked(loansService.create).mockResolvedValue({ id: "entry-1" } as never);

    const res = await POST(postReq());

    expect(res.status).toBe(201);
  });
});
