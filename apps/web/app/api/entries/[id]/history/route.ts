import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { entriesService } from "@/services/entries.service";
import { ok, err, handleError } from "@/lib/api-response";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) return err("UNAUTHORIZED", "Unauthorized", 401);
    const { id } = await params;
    const existing = await entriesService.findById(id, userId);
    if (!existing) return err("NOT_FOUND", "Entry not found", 404);

    let history = await entriesService.listHistory(id);

    // Backfill: if entry has a value but no history, create an initial record
    if (history.length === 0 && existing.value !== 0) {
      await entriesService.createHistory(id, {
        delta: existing.value,
        balance: existing.value,
        note: "初始建立",
        createdAt: existing.createdAt,
      });
      history = await entriesService.listHistory(id);
    }

    return ok(history);
  } catch (e) {
    return handleError(e);
  }
}
