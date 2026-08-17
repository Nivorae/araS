import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { entriesService } from "@/services/entries.service";
import { ok, err, handleError } from "@/lib/api-response";
import { logSecurityEvent } from "@/lib/security-log";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      logSecurityEvent({ type: "auth_fail", resource: "/api/entries/[id]/history" });
      return err("UNAUTHORIZED", "Unauthorized", 401);
    }
    const { id } = await params;
    const found = await entriesService.findByIdWithHistory(id, userId);
    if (!found) {
      logSecurityEvent({ type: "ownership_violation", userId, resource: `entries/${id}/history` });
      return err("NOT_FOUND", "Entry not found", 404);
    }

    const { entry: existing } = found;
    let { history } = found;

    if (history.length === 0 && existing.value !== 0) {
      // This branch only runs when there are no rows, so the row we just created
      // is the entire history — no need to re-read it.
      const created = await entriesService.createHistory(id, {
        delta: existing.value,
        balance: existing.value,
        note: "初始建立",
        createdAt: existing.createdAt,
      });
      history = [created];
    }

    return ok(history);
  } catch (e) {
    return handleError(e);
  }
}
