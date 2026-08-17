import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { CreateEntrySchema } from "@repo/shared";
import { entriesService, EntryLimitError } from "@/services/entries.service";
import { ok, err, handleError } from "@/lib/api-response";
import { logSecurityEvent } from "@/lib/security-log";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      logSecurityEvent({ type: "auth_fail", resource: "/api/entries" });
      return err("UNAUTHORIZED", "Unauthorized", 401);
    }
    const entries = await entriesService.list(userId);
    return ok(entries);
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      logSecurityEvent({ type: "auth_fail", resource: "/api/entries" });
      return err("UNAUTHORIZED", "Unauthorized", 401);
    }
    const data = CreateEntrySchema.parse(await req.json());
    const entry = await entriesService.create(data, userId);
    return ok(entry, 201);
  } catch (e) {
    if (e instanceof EntryLimitError) {
      return err("ENTRY_LIMIT_REACHED", "已達免費方案的資產筆數上限", 403);
    }
    return handleError(e);
  }
}
