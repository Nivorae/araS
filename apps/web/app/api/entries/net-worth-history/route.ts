import { auth } from "@clerk/nextjs/server";
import { NetWorthRangeSchema } from "@repo/shared";
import { entriesService } from "@/services/entries.service";
import { ok, err, handleError } from "@/lib/api-response";
import { logSecurityEvent } from "@/lib/security-log";

export async function GET(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      logSecurityEvent({ type: "auth_fail", resource: "/api/entries/net-worth-history" });
      return err("UNAUTHORIZED", "Unauthorized", 401);
    }

    const raw = new URL(request.url).searchParams.get("range") ?? "6m";
    const range = NetWorthRangeSchema.safeParse(raw);
    if (!range.success) {
      return err("VALIDATION_ERROR", "range 必須是 6m、1y 或 all", 400);
    }

    return ok(await entriesService.getNetWorthHistory(userId, range.data));
  } catch (e) {
    return handleError(e);
  }
}
