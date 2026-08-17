import { auth } from "@clerk/nextjs/server";
import { dividendsService } from "@/services/dividends.service";
import { ok, err, handleError } from "@/lib/api-response";
import { logSecurityEvent } from "@/lib/security-log";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      logSecurityEvent({ type: "auth_fail", resource: "/api/dividends/summary" });
      return err("UNAUTHORIZED", "Authentication required", 401);
    }
    return ok(await dividendsService.summary(userId));
  } catch (e) {
    return handleError(e);
  }
}
