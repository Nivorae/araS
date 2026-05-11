import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { UpdateEntryHistorySchema } from "@repo/shared";
import { entriesService } from "@/services/entries.service";
import { ok, err, handleError } from "@/lib/api-response";
import { logSecurityEvent } from "@/lib/security-log";

type Params = { params: Promise<{ id: string; historyId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth();
    if (!userId) {
      logSecurityEvent({ type: "auth_fail", resource: "/api/entries/[id]/history/[historyId]" });
      return err("UNAUTHORIZED", "Authentication required", 401);
    }
    const { historyId } = await params;
    const owned = await entriesService.verifyHistoryOwnership(historyId, userId);
    if (!owned) {
      logSecurityEvent({ type: "ownership_violation", userId, resource: `history/${historyId}` });
      return err("NOT_FOUND", "History record not found", 404);
    }
    const data = UpdateEntryHistorySchema.parse(await req.json());
    const history = await entriesService.updateHistory(historyId, data);
    return ok(history);
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth();
    if (!userId) {
      logSecurityEvent({ type: "auth_fail", resource: "/api/entries/[id]/history/[historyId]" });
      return err("UNAUTHORIZED", "Authentication required", 401);
    }
    const { historyId } = await params;
    const owned = await entriesService.verifyHistoryOwnership(historyId, userId);
    if (!owned) {
      logSecurityEvent({ type: "ownership_violation", userId, resource: `history/${historyId}` });
      return err("NOT_FOUND", "History record not found", 404);
    }
    await entriesService.deleteHistory(historyId);
    return ok(null);
  } catch (e) {
    return handleError(e);
  }
}
