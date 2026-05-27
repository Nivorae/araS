import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { CreateRecurrenceSchema } from "@repo/shared";
import { recurrencesService } from "@/services/recurrences.service";
import { ok, err, handleError } from "@/lib/api-response";
import { logSecurityEvent } from "@/lib/security-log";

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      logSecurityEvent({ type: "auth_fail", resource: "/api/recurrences" });
      return err("UNAUTHORIZED", "Authentication required", 401);
    }
    const entryId = req.nextUrl.searchParams.get("entryId") ?? undefined;
    const items = await recurrencesService.list(userId, entryId);
    return ok(items);
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      logSecurityEvent({ type: "auth_fail", resource: "/api/recurrences" });
      return err("UNAUTHORIZED", "Authentication required", 401);
    }
    const data = CreateRecurrenceSchema.parse(await req.json());
    const item = await recurrencesService.create(data, userId);
    return ok(item, 201);
  } catch (e) {
    return handleError(e);
  }
}
