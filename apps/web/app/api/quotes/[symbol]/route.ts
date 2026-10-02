import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { normalizeSymbol, quotesService } from "@/services/quotes.service";
import { ok, err, handleError } from "@/lib/api-response";
import { logSecurityEvent } from "@/lib/security-log";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ symbol: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      logSecurityEvent({ type: "auth_fail", resource: "/api/quotes/[symbol]" });
      return err("UNAUTHORIZED", "Unauthorized", 401);
    }

    const symbol = normalizeSymbol((await params).symbol);
    if (!symbol) return err("VALIDATION_ERROR", "Invalid symbol", 400);
    const quote = await quotesService.fetchQuote(symbol);
    return ok(quote);
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("No data found")) {
      return err("SYMBOL_NOT_FOUND", e.message, 404);
    }
    return handleError(e);
  }
}
