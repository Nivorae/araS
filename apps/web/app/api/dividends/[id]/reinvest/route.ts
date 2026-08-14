import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ReinvestDividendSchema } from "@repo/shared";
import { dividendsService } from "@/services/dividends.service";
import { mapDividendError } from "@/lib/dividend-error";
import { ok, err } from "@/lib/api-response";
import { logSecurityEvent } from "@/lib/security-log";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const { userId } = await auth();
    if (!userId) {
      logSecurityEvent({ type: "auth_fail", resource: "/api/dividends/[id]/reinvest" });
      return err("UNAUTHORIZED", "Authentication required", 401);
    }
    const { id } = await params;
    const data = ReinvestDividendSchema.parse(await req.json());
    return ok(await dividendsService.reinvest(id, data, userId));
  } catch (e) {
    return mapDividendError(e);
  }
}
