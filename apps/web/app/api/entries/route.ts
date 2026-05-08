import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { CreateEntrySchema } from "@repo/shared";
import { entriesService } from "@/services/entries.service";
import { ok, err, handleError } from "@/lib/api-response";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return err("UNAUTHORIZED", "Unauthorized", 401);
    const entries = await entriesService.list(userId);
    return ok(entries);
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return err("UNAUTHORIZED", "Unauthorized", 401);
    const data = CreateEntrySchema.parse(await req.json());
    const entry = await entriesService.create(data, userId);
    return ok(entry, 201);
  } catch (e) {
    return handleError(e);
  }
}
