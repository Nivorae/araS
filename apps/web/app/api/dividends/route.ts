import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { CreateDividendSchema } from "@repo/shared";
import { dividendsService } from "@/services/dividends.service";
import { mapDividendError } from "@/lib/dividend-error";
import { ok, err } from "@/lib/api-response";
import { logSecurityEvent } from "@/lib/security-log";

export async function GET(req: NextRequest) {
  // FIX FOR FINDING 5 — hoisted above the try so the catch block's
  // mapDividendError call can pass it through for the ownership_violation log.
  let userId: string | null = null;
  try {
    ({ userId } = await auth());
    if (!userId) {
      logSecurityEvent({ type: "auth_fail", resource: "/api/dividends" });
      return err("UNAUTHORIZED", "Authentication required", 401);
    }
    const entryId = req.nextUrl.searchParams.get("entryId") ?? undefined;
    return ok(await dividendsService.list(userId, entryId));
  } catch (e) {
    return mapDividendError(e, { userId, resource: "/api/dividends" });
  }
}

export async function POST(req: NextRequest) {
  let userId: string | null = null;
  try {
    ({ userId } = await auth());
    if (!userId) {
      logSecurityEvent({ type: "auth_fail", resource: "/api/dividends" });
      return err("UNAUTHORIZED", "Authentication required", 401);
    }
    const data = CreateDividendSchema.parse(await req.json());
    return ok(await dividendsService.create(data, userId), 201);
  } catch (e) {
    return mapDividendError(e, { userId, resource: "/api/dividends" });
  }
}
