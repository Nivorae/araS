import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { CreateTransactionSchema } from "@repo/shared";
import { transactionsService } from "@/services/transactions.service";
import { ok, err, handleError } from "@/lib/api-response";
import { logSecurityEvent } from "@/lib/security-log";

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      logSecurityEvent({ type: "auth_fail", resource: "/api/transactions" });
      return err("UNAUTHORIZED", "Authentication required", 401);
    }
    const month = req.nextUrl.searchParams.get("month") ?? undefined;
    const items = await transactionsService.list(userId, month);
    return ok(items);
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      logSecurityEvent({ type: "auth_fail", resource: "/api/transactions" });
      return err("UNAUTHORIZED", "Authentication required", 401);
    }
    const data = CreateTransactionSchema.parse(await req.json());
    const item = await transactionsService.create(data, userId);
    return ok(item, 201);
  } catch (e) {
    return handleError(e);
  }
}
