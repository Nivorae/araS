import { fetchWithRetry } from "@/lib/fetch-with-timeout";

export interface CryptoListItem {
  code: string;
  name: string;
  id: string;
}

const COINGECKO_MARKETS_URL =
  "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=";

// List changes rarely — cached via Next.js Data Cache (shared across all
// serverless instances, unlike a module-level variable).
const CACHE_SECONDS = 24 * 60 * 60;

export async function fetchCryptoList(): Promise<CryptoListItem[]> {
  try {
    const [page1, page2] = await Promise.all([
      fetchWithRetry(COINGECKO_MARKETS_URL + "1", { next: { revalidate: CACHE_SECONDS } }),
      fetchWithRetry(COINGECKO_MARKETS_URL + "2", { next: { revalidate: CACHE_SECONDS } }),
    ]);

    if (!page1.ok || !page2.ok) return [];

    const raw: { id: string; symbol: string; name: string }[] = [
      ...(await page1.json()),
      ...(await page2.json()),
    ];

    return raw
      .map((item) => ({
        code: item.symbol?.toUpperCase() ?? "",
        name: item.name ?? "",
        id: item.id ?? "",
      }))
      .filter((s) => s.code && s.name)
      .sort((a, b) => a.code.localeCompare(b.code));
  } catch {
    return [];
  }
}
