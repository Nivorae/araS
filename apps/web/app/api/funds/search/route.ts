import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { FundSearchQuerySchema } from "@repo/shared";
import { fundsService } from "@/services/funds.service";
import { ok, err, handleError } from "@/lib/api-response";
import { logSecurityEvent } from "@/lib/security-log";

/** 依名稱搜尋基金，用來把使用者自己打的名字綁到官方代碼上。 */
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      logSecurityEvent({ type: "auth_fail", resource: "/api/funds/search" });
      return err("UNAUTHORIZED", "Unauthorized", 401);
    }

    const { searchParams } = new URL(req.url);
    const parsed = FundSearchQuerySchema.parse({
      q: searchParams.get("q") ?? "",
      ...(searchParams.get("limit") ? { limit: searchParams.get("limit") } : {}),
    });

    return ok(await fundsService.search(parsed.q, parsed.limit));
  } catch (e) {
    return handleError(e);
  }
}
