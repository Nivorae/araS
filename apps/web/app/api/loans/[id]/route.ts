import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { UpdateLoanSchema } from "@repo/shared";
import { loansService } from "@/services/loans.service";
import { ok, err, handleError } from "@/lib/api-response";
import { logSecurityEvent } from "@/lib/security-log";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      logSecurityEvent({ type: "auth_fail", resource: "/api/loans/[id]" });
      return err("UNAUTHORIZED", "Authentication required", 401);
    }
    const { id } = await params;
    const loan = await loansService.findById(id, userId);
    if (!loan) {
      logSecurityEvent({ type: "ownership_violation", userId, resource: `loans/${id}` });
      return err("NOT_FOUND", "Loan not found", 404);
    }
    return ok(loan);
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      logSecurityEvent({ type: "auth_fail", resource: "/api/loans/[id]" });
      return err("UNAUTHORIZED", "Authentication required", 401);
    }
    const { id } = await params;
    const existing = await loansService.findById(id, userId);
    if (!existing) {
      logSecurityEvent({ type: "ownership_violation", userId, resource: `loans/${id}` });
      return err("NOT_FOUND", "Loan not found", 404);
    }
    const data = UpdateLoanSchema.parse(await req.json());
    const loan = await loansService.update(existing.id, data, userId);
    return ok(loan);
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      logSecurityEvent({ type: "auth_fail", resource: "/api/loans/[id]" });
      return err("UNAUTHORIZED", "Authentication required", 401);
    }
    const { id } = await params;
    const loan = await loansService.findById(id, userId);
    if (!loan) {
      logSecurityEvent({ type: "ownership_violation", userId, resource: `loans/${id}` });
      return err("NOT_FOUND", "Loan not found", 404);
    }
    await loansService.deleteByEntryId(loan.entryId, userId);
    return ok({ deleted: true });
  } catch (e) {
    return handleError(e);
  }
}
