import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { UpdateEntrySchema } from "@repo/shared";
import { entriesService } from "@/services/entries.service";
import { ok, err, handleError } from "@/lib/api-response";
import { logSecurityEvent } from "@/lib/security-log";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      logSecurityEvent({ type: "auth_fail", resource: "/api/entries/[id]" });
      return err("UNAUTHORIZED", "Unauthorized", 401);
    }
    const { id } = await params;
    const existing = await entriesService.findById(id, userId);
    if (!existing) {
      logSecurityEvent({ type: "ownership_violation", userId, resource: `entries/${id}` });
      return err("NOT_FOUND", "Entry not found", 404);
    }
    const data = UpdateEntrySchema.parse(await req.json());
    const entry = await entriesService.update(id, data, userId);
    return ok(entry);
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      logSecurityEvent({ type: "auth_fail", resource: "/api/entries/[id]" });
      return err("UNAUTHORIZED", "Unauthorized", 401);
    }
    const { id } = await params;
    const existing = await entriesService.findById(id, userId);
    if (!existing) {
      logSecurityEvent({ type: "ownership_violation", userId, resource: `entries/${id}` });
      return err("NOT_FOUND", "Entry not found", 404);
    }
    await entriesService.delete(id, userId);
    return ok({ deleted: true });
  } catch (e) {
    return handleError(e);
  }
}
