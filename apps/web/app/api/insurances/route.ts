import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { CreateInsuranceSchema } from "@repo/shared";
import { insuranceService, PremiumRequiredError } from "@/services/insurance.service";
import { ok, err, handleError } from "@/lib/api-response";
import { logSecurityEvent } from "@/lib/security-log";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      logSecurityEvent({ type: "auth_fail", resource: "/api/insurances" });
      return err("UNAUTHORIZED", "Authentication required", 401);
    }
    const data = CreateInsuranceSchema.parse(await req.json());
    const result = await insuranceService.create(data, userId);
    return ok(result, 201);
  } catch (e) {
    if (e instanceof PremiumRequiredError) {
      return err("PREMIUM_REQUIRED", "此功能需要 Premium 訂閱", 403);
    }
    return handleError(e);
  }
}
