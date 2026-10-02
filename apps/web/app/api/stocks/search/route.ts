import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { logSecurityEvent } from "@/lib/security-log";
import { searchOverseasStocks } from "@/services/stock-search.service";

const MAX_QUERY_LENGTH = 40;

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    logSecurityEvent({ type: "auth_fail", resource: "/api/stocks/search" });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q || q.length > MAX_QUERY_LENGTH) {
    return NextResponse.json({ error: "q is required" }, { status: 400 });
  }

  try {
    return NextResponse.json(await searchOverseasStocks(q));
  } catch {
    return NextResponse.json({ error: "search failed" }, { status: 502 });
  }
}
