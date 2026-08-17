import { auth } from "@clerk/nextjs/server";
import { recurrencesService } from "@/services/recurrences.service";
import { ok, err, handleError } from "@/lib/api-response";
import { logSecurityEvent } from "@/lib/security-log";

export async function POST() {
  try {
    const { userId } = await auth();
    if (!userId) {
      logSecurityEvent({ type: "auth_fail", resource: "/api/recurrences/process" });
      return err("UNAUTHORIZED", "Authentication required", 401);
    }
    const created = await recurrencesService.process(userId);
    return ok({ created });
  } catch (e) {
    return handleError(e);
  }
}
