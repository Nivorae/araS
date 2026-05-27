import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { UpdateRecurrenceSchema } from "@repo/shared";
import { recurrencesService } from "@/services/recurrences.service";
import { ok, err, handleError } from "@/lib/api-response";
import { logSecurityEvent } from "@/lib/security-log";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      logSecurityEvent({ type: "auth_fail", resource: "/api/recurrences/[id]" });
      return err("UNAUTHORIZED", "Authentication required", 401);
    }
    const { id } = await params;
    const existing = await recurrencesService.findById(id, userId);
    if (!existing) return err("NOT_FOUND", "Recurrence not found", 404);
    const data = UpdateRecurrenceSchema.parse(await req.json());
    const item = await recurrencesService.update(id, data, userId);
    return ok(item);
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      logSecurityEvent({ type: "auth_fail", resource: "/api/recurrences/[id]" });
      return err("UNAUTHORIZED", "Authentication required", 401);
    }
    const { id } = await params;
    const existing = await recurrencesService.findById(id, userId);
    if (!existing) return err("NOT_FOUND", "Recurrence not found", 404);
    await recurrencesService.delete(id, userId);
    return ok({ deleted: true });
  } catch (e) {
    return handleError(e);
  }
}
