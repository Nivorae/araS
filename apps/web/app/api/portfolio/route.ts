import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { CreatePortfolioItemSchema } from "@repo/shared";
import { portfolioService } from "@/services/portfolio.service";
import { ok, err, handleError } from "@/lib/api-response";
import { logSecurityEvent } from "@/lib/security-log";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      logSecurityEvent({ type: "auth_fail", resource: "/api/portfolio" });
      return err("UNAUTHORIZED", "Authentication required", 401);
    }
    const items = await portfolioService.list(userId);
    return ok(items);
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      logSecurityEvent({ type: "auth_fail", resource: "/api/portfolio" });
      return err("UNAUTHORIZED", "Authentication required", 401);
    }
    const data = CreatePortfolioItemSchema.parse(await req.json());
    const item = await portfolioService.create(data, userId);
    return ok(item, 201);
  } catch (e) {
    return handleError(e);
  }
}
