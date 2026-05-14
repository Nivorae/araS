import { NextResponse } from "next/server";

const COINGECKO_MARKETS_URL =
  "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=";

let cachedAt = 0;
let cachedResult: { code: string; name: string; id: string }[] | null = null;
const CACHE_MS = 24 * 60 * 60 * 1000;

export async function GET() {
  try {
    if (cachedResult && Date.now() - cachedAt < CACHE_MS) {
      return NextResponse.json(cachedResult);
    }

    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 5000);
    let page1: Response, page2: Response;
    try {
      [page1, page2] = await Promise.all([
        fetch(COINGECKO_MARKETS_URL + "1", { signal: ctl.signal, cache: "no-store" }),
        fetch(COINGECKO_MARKETS_URL + "2", { signal: ctl.signal, cache: "no-store" }),
      ]);
    } finally {
      clearTimeout(timer);
    }

    if (!page1.ok || !page2.ok) {
      return NextResponse.json({ error: "Failed to fetch" }, { status: 502 });
    }

    const raw: { id: string; symbol: string; name: string }[] = [
      ...(await page1.json()),
      ...(await page2.json()),
    ];

    const result = raw
      .map((item) => ({
        code: item.symbol?.toUpperCase() ?? "",
        name: item.name ?? "",
        id: item.id ?? "",
      }))
      .filter((s) => s.code && s.name)
      .sort((a, b) => a.code.localeCompare(b.code));

    cachedAt = Date.now();
    cachedResult = result;

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Failed to fetch" }, { status: 502 });
  }
}
