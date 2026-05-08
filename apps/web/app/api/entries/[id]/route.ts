import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { UpdateEntrySchema } from "@repo/shared";
import { entriesService } from "@/services/entries.service";
import { ok, err, handleError } from "@/lib/api-response";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) return err("UNAUTHORIZED", "Unauthorized", 401);
    const { id } = await params;
    const existing = await entriesService.findById(id, userId);
    if (!existing) return err("NOT_FOUND", "Entry not found", 404);
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
    if (!userId) return err("UNAUTHORIZED", "Unauthorized", 401);
    const { id } = await params;
    const existing = await entriesService.findById(id, userId);
    if (!existing) return err("NOT_FOUND", "Entry not found", 404);
    await entriesService.delete(id, userId);
    return ok({ deleted: true });
  } catch (e) {
    return handleError(e);
  }
}
