import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { quotesService } from "@/services/quotes.service";

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol");
  if (!symbol) {
    return NextResponse.json({ error: "symbol is required" }, { status: 400 });
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
