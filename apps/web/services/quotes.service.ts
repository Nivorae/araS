import type { Quote } from "@repo/shared";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { fetchCryptoList } from "./crypto-list.service";

interface YahooChartMeta {
  regularMarketPrice: number;
  currency: string;
  symbol: string;
}

interface YahooChartResponse {
  chart: {
    result: Array<{ meta: YahooChartMeta }> | null;
    error: unknown;
  };
}

// Cached via Next.js Data Cache (shared across serverless instances) so that
// many users requesting the same symbol within the window collapse into one
// upstream request.
const QUOTE_CACHE_SECONDS = 30;

// Yahoo's chart API is undocumented/unofficial (no key, no SLA) — a fallback
// below covers plain US tickers and crypto. TW stocks (".TW"), FX pairs ("=X"),
// and commodity futures ("=F") have no free equivalent and stay Yahoo-only.
function isTaiwanStock(symbol: string): boolean {
  return symbol.endsWith(".TW");
}
function isCrypto(symbol: string): boolean {
  return symbol.endsWith("-USD");
}
function isFxOrFuture(symbol: string): boolean {
  return symbol.endsWith("=X") || symbol.endsWith("=F");
}

export class QuotesService {
  async fetchQuote(symbol: string): Promise<Quote> {
    try {
      return await this.fetchFromYahoo(symbol);
    } catch (yahooError) {
      const fallback = await this.fetchFallback(symbol);
      if (fallback) return fallback;
      throw yahooError;
    }
  }

  private async fetchFromYahoo(symbol: string): Promise<Quote> {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;

    const response = await fetchWithTimeout(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: QUOTE_CACHE_SECONDS },
    });

    if (!response.ok) {
      throw new Error(`Yahoo Finance returned ${response.status} for ${symbol}`);
    }

    const data = (await response.json()) as YahooChartResponse;
    const result = data?.chart?.result?.[0];

    if (!result?.meta) {
      throw new Error(`No data found for symbol ${symbol}`);
    }

    return {
      symbol,
      price: result.meta.regularMarketPrice,
      currency: result.meta.currency,
    };
  }

  private async fetchFallback(symbol: string): Promise<Quote | null> {
    if (isTaiwanStock(symbol) || isFxOrFuture(symbol)) return null;
    if (isCrypto(symbol)) return this.fetchFromCoinGecko(symbol);
    return this.fetchFromFinnhub(symbol);
  }

  private async fetchFromFinnhub(symbol: string): Promise<Quote | null> {
    const apiKey = process.env.FINNHUB_API_KEY;
    if (!apiKey) return null;

    try {
      const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`;
      const response = await fetchWithTimeout(url, { next: { revalidate: QUOTE_CACHE_SECONDS } });
      if (!response.ok) return null;

      const data = (await response.json()) as { c?: number };
      if (!data.c || data.c <= 0) return null;

      return { symbol, price: data.c, currency: "USD" };
    } catch {
      return null;
    }
  }

  private async fetchFromCoinGecko(symbol: string): Promise<Quote | null> {
    const code = symbol.slice(0, -"-USD".length).toLowerCase();
    const list = await fetchCryptoList();
    const match = list.find((c) => c.code.toLowerCase() === code);
    if (!match) return null;

    try {
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(match.id)}&vs_currencies=usd`;
      const response = await fetchWithTimeout(url, { next: { revalidate: QUOTE_CACHE_SECONDS } });
      if (!response.ok) return null;

      const data = (await response.json()) as Record<string, { usd?: number }>;
      const price = data[match.id]?.usd;
      if (!price) return null;

      return { symbol, price, currency: "USD" };
    } catch {
      return null;
    }
  }
}

export const quotesService = new QuotesService();
