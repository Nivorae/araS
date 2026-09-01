import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { FundQuoteQuerySchema } from "@repo/shared";
import { fundsService } from "@/services/funds.service";
import { ok, err, handleError } from "@/lib/api-response";
import { logSecurityEvent } from "@/lib/security-log";

/** 用官方代碼取最新淨值。 */
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      logSecurityEvent({ type: "auth_fail", resource: "/api/funds/quote" });
      return err("UNAUTHORIZED", "Unauthorized", 401);
    }

    const { searchParams } = new URL(req.url);
    const { code } = FundQuoteQuerySchema.parse({ code: searchParams.get("code") ?? "" });

    const quote = await fundsService.getQuote(code);
    if (!quote) return err("FUND_NOT_FOUND", `No fund found for code ${code}`, 404);
    return ok(quote);
  } catch (e) {
    return handleError(e);
  }
}
