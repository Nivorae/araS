import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { fetchWithRetry } from "@/lib/fetch-with-timeout";
import { getYahooCrumb } from "@/lib/yahoo-crumb";
import { logSecurityEvent } from "@/lib/security-log";
import { normalizeQuoteCurrency, normalizeSymbol } from "@/services/quotes.service";

const CACHE_SECONDS = 30;
const EMPTY_RESULT = { dividendRate: null, dividendYield: null, currency: null };

async function fetchSummaryDetail(symbol: string, auth: { cookie: string; crumb: string }) {
  const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=summaryDetail&crumb=${encodeURIComponent(auth.crumb)}`;
  return fetchWithRetry(url, {
    next: { revalidate: CACHE_SECONDS },
    headers: { "User-Agent": "Mozilla/5.0", Cookie: auth.cookie },
  });
}

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    logSecurityEvent({ type: "auth_fail", resource: "/api/stocks/dividend" });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = req.nextUrl.searchParams.get("symbol");
  if (!raw) {
    return NextResponse.json(EMPTY_RESULT);
  }
  const symbol = normalizeSymbol(raw);
  if (!symbol) {
    return NextResponse.json({ error: "a valid symbol is required" }, { status: 400 });
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

    const rawRate =
      typeof detail?.dividendRate?.raw === "number" ? (detail.dividendRate.raw as number) : null;
    const dividendYield =
      typeof detail?.dividendYield?.raw === "number" ? (detail.dividendYield.raw as number) : null;
    const rawCurrency = typeof detail?.currency === "string" ? (detail.currency as string) : null;

    // dividendRate is in the same (possibly minor) unit as the quote, so it
    // gets the same pence → pounds treatment. dividendYield is a ratio.
    if (rawRate == null || rawCurrency == null) {
      return NextResponse.json({ dividendRate: rawRate, dividendYield, currency: rawCurrency });
    }
    const { price: dividendRate, currency } = normalizeQuoteCurrency(rawRate, rawCurrency);
    return NextResponse.json({ dividendRate, dividendYield, currency });
  } catch {
    return NextResponse.json(EMPTY_RESULT);
  }
}
