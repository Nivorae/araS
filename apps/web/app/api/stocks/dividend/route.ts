import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { fetchWithRetry } from "@/lib/fetch-with-timeout";
import { getYahooCrumb } from "@/lib/yahoo-crumb";

const CACHE_SECONDS = 30;
const EMPTY_RESULT = { dividendRate: null, dividendYield: null };

async function fetchSummaryDetail(symbol: string, auth: { cookie: string; crumb: string }) {
  const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=summaryDetail&crumb=${encodeURIComponent(auth.crumb)}`;
  return fetchWithRetry(url, {
    next: { revalidate: CACHE_SECONDS },
    headers: { "User-Agent": "Mozilla/5.0", Cookie: auth.cookie },
  });
}

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol");
  if (!symbol) {
    return NextResponse.json(EMPTY_RESULT);
  }

  try {
    let auth = await getYahooCrumb();
    if (!auth) return NextResponse.json(EMPTY_RESULT);

    let res = await fetchSummaryDetail(symbol, auth);
    if (res.status === 401) {
      auth = await getYahooCrumb({ forceRefresh: true });
      if (!auth) return NextResponse.json(EMPTY_RESULT);
      res = await fetchSummaryDetail(symbol, auth);
    }

    if (!res.ok) {
      return NextResponse.json(EMPTY_RESULT);
    }

    const data = await res.json();
    const detail = data?.quoteSummary?.result?.[0]?.summaryDetail;

    const dividendRate =
      typeof detail?.dividendRate?.raw === "number" ? (detail.dividendRate.raw as number) : null;
    const dividendYield =
      typeof detail?.dividendYield?.raw === "number" ? (detail.dividendYield.raw as number) : null;

    return NextResponse.json({ dividendRate, dividendYield });
  } catch {
    return NextResponse.json(EMPTY_RESULT);
  }
}
