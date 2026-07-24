import { auth } from "@clerk/nextjs/server";
import { entriesService } from "@/services/entries.service";
import { entitlementsService } from "@/services/entitlements.service";
import { ok, err, handleError } from "@/lib/api-response";
import { logSecurityEvent } from "@/lib/security-log";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      logSecurityEvent({ type: "auth_fail", resource: "/api/entries/allocation" });
      return err("UNAUTHORIZED", "Unauthorized", 401);
    }
    const premium = await entitlementsService.isPremium(userId);
    if (!premium) {
      return err("PREMIUM_REQUIRED", "資產配置分析為 Premium 功能", 403);
    }
    const allocation = await entriesService.getAssetAllocation(userId);
    return ok(allocation);
  } catch (e) {
    return handleError(e);
  }
}
