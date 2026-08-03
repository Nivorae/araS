import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { UpdateInsuranceSchema } from "@repo/shared";
import { insuranceService, PremiumRequiredError } from "@/services/insurance.service";
import { ok, err, handleError } from "@/lib/api-response";
import { logSecurityEvent } from "@/lib/security-log";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      logSecurityEvent({ type: "auth_fail", resource: "/api/insurances/[id]" });
      return err("UNAUTHORIZED", "Authentication required", 401);
    }
    const { id } = await params;
    const insurance = await insuranceService.findById(id, userId);
    if (!insurance) {
      logSecurityEvent({ type: "ownership_violation", userId, resource: `insurances/${id}` });
      return err("NOT_FOUND", "Insurance not found", 404);
    }
    return ok(insurance);
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      logSecurityEvent({ type: "auth_fail", resource: "/api/insurances/[id]" });
      return err("UNAUTHORIZED", "Authentication required", 401);
    }
    const { id } = await params;
    const existing = await insuranceService.findById(id, userId);
    if (!existing) {
      logSecurityEvent({ type: "ownership_violation", userId, resource: `insurances/${id}` });
      return err("NOT_FOUND", "Insurance not found", 404);
    }
    const data = UpdateInsuranceSchema.parse(await req.json());
    const insurance = await insuranceService.update(id, data, userId);
    return ok(insurance);
  } catch (e) {
    if (e instanceof PremiumRequiredError) {
      return err("PREMIUM_REQUIRED", "此功能需要 Premium 訂閱", 403);
    }
    return handleError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      logSecurityEvent({ type: "auth_fail", resource: "/api/insurances/[id]" });
      return err("UNAUTHORIZED", "Authentication required", 401);
    }
    const { id } = await params;
    const insurance = await insuranceService.findById(id, userId);
    if (!insurance) {
      logSecurityEvent({ type: "ownership_violation", userId, resource: `insurances/${id}` });
      return err("NOT_FOUND", "Insurance not found", 404);
    }
    await insuranceService.deleteByEntryId(insurance.entryId, userId);
    return ok({ deleted: true });
  } catch (e) {
    return handleError(e);
  }
}
