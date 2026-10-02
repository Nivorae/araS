import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { normalizeSymbol, quotesService } from "@/services/quotes.service";
import { logSecurityEvent } from "@/lib/security-log";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    logSecurityEvent({ type: "auth_fail", resource: "/api/stocks/price" });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const symbol = normalizeSymbol(req.nextUrl.searchParams.get("symbol"));
  if (!symbol) {
    return NextResponse.json({ error: "a valid symbol is required" }, { status: 400 });
  }

  try {
    const quote = await quotesService.fetchQuote(symbol);
    return NextResponse.json(quote);
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("No data found")) {
      return NextResponse.json({ error: "no data" }, { status: 404 });
    }
    return NextResponse.json({ error: "fetch failed" }, { status: 502 });
  }
}
