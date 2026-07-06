import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { fetchWithRetry } from "@/lib/fetch-with-timeout";

const CACHE_SECONDS = 30;

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol");
  if (!symbol) {
    return NextResponse.json({ dividendRate: null, dividendYield: null });
  }

  try {
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=summaryDetail`;
    const res = await fetchWithRetry(url, {
      next: { revalidate: CACHE_SECONDS },
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    if (!res.ok) {
      return NextResponse.json({ dividendRate: null, dividendYield: null });
    }

    const data = await res.json();
    const detail = data?.quoteSummary?.result?.[0]?.summaryDetail;

    const dividendRate =
      typeof detail?.dividendRate?.raw === "number" ? (detail.dividendRate.raw as number) : null;
    const dividendYield =
      typeof detail?.dividendYield?.raw === "number" ? (detail.dividendYield.raw as number) : null;

    return NextResponse.json({ dividendRate, dividendYield });
  } catch {
    return NextResponse.json({ dividendRate: null, dividendYield: null });
  }
}
