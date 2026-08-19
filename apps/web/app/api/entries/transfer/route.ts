import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { TransferEntrySchema } from "@repo/shared";
import {
  entriesService,
  EntryNotFoundError,
  InvalidTransferError,
  InsufficientBalanceError,
} from "@/services/entries.service";
import { ok, err, handleError } from "@/lib/api-response";
import { logSecurityEvent } from "@/lib/security-log";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      logSecurityEvent({ type: "auth_fail", resource: "/api/entries/transfer" });
      return err("UNAUTHORIZED", "Unauthorized", 401);
    }
    const data = TransferEntrySchema.parse(await req.json());
    const result = await entriesService.transfer(data, userId);
    return ok(result);
  } catch (e) {
    if (e instanceof EntryNotFoundError) return err("NOT_FOUND", e.message, 404);
    if (e instanceof InvalidTransferError) return err("INVALID_TRANSFER", e.message, 400);
    if (e instanceof InsufficientBalanceError) {
      return err("INSUFFICIENT_BALANCE", e.message, 400);
    }
    return handleError(e);
  }
}
