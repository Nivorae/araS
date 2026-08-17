import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { loansService } from "@/services/loans.service";
import { ok, err, handleError } from "@/lib/api-response";
import { logSecurityEvent } from "@/lib/security-log";

const SyncBodySchema = z.object({
  manualBalance: z.number().min(0).optional(),
  overrideTermMonths: z.number().int().positive().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      logSecurityEvent({ type: "auth_fail", resource: "/api/loans/[id]/sync" });
      return err("UNAUTHORIZED", "Authentication required", 401);
    }
    const { id } = await params;
    const existing = await loansService.findById(id, userId);
    if (!existing) {
      logSecurityEvent({ type: "ownership_violation", userId, resource: `loans/${id}/sync` });
      return err("NOT_FOUND", "Loan not found", 404);
    }
    const body = await req.json().catch(() => ({}));
    const { manualBalance, overrideTermMonths } = SyncBodySchema.parse(body);
    const result = await loansService.syncBalance(existing, manualBalance, overrideTermMonths);
    return ok(result);
  } catch (e) {
    return handleError(e);
  }
}
