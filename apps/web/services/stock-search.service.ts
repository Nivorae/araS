import { fetchWithRetry } from "@/lib/fetch-with-timeout";
import { getYahooCrumb } from "@/lib/yahoo-crumb";
import { normalizeSymbol } from "./quotes.service";

export interface OverseasSearchItem {
  code: string;
  name: string;
  exchange: string;
}

interface YahooSearchQuote {
  symbol?: string;
  quoteType?: string;
  longname?: string;
  shortname?: string;
  exchDisp?: string;
  exchange?: string;
}

const SEARCH_CACHE_SECONDS = 60 * 60;
const ACCEPTED_TYPES = new Set(["EQUITY", "ETF"]);
// 台股、美股各有自己的分類（清單與後綴邏輯不同），不從「海外股票」搜尋結果出現。
const EXCLUDED_SUFFIXES = new Set(["TW", "TWO"]);

function searchUrl(query: string, crumb?: string): string {
  const params = new URLSearchParams({
    q: query,
    quotesCount: "20",
    newsCount: "0",
    listsCount: "0",
  });
  if (crumb) params.set("crumb", crumb);
  return `https://query2.finance.yahoo.com/v1/finance/search?${params.toString()}`;
}

/**
 * 海外（非台、非美）掛牌的個股與 ETF。Yahoo 美股代號沒有後綴，所以「沒有 `.`」
 * 就是美股 —— 擋掉，讓使用者去「美股」分類用那邊的完整清單。
 */
export function toOverseasItems(quotes: YahooSearchQuote[]): OverseasSearchItem[] {
  const items: OverseasSearchItem[] = [];
  const seen = new Set<string>();
  for (const q of quotes) {
    if (!q.quoteType || !ACCEPTED_TYPES.has(q.quoteType)) continue;
    const code = normalizeSymbol(q.symbol);
    if (!code) continue;
    const dot = code.lastIndexOf(".");
    if (dot <= 0) continue;
    if (EXCLUDED_SUFFIXES.has(code.slice(dot + 1))) continue;
    if (seen.has(code)) continue;
    seen.add(code);
    items.push({
      code,
      name: q.longname || q.shortname || code,
      exchange: q.exchDisp || q.exchange || "",
    });
  }
  return items;
}

export async function searchOverseasStocks(query: string): Promise<OverseasSearchItem[]> {
  let res = await fetchWithRetry(searchUrl(query), {
    headers: { "User-Agent": "Mozilla/5.0" },
    next: { revalidate: SEARCH_CACHE_SECONDS },
  });

  // 搜尋端點平常不需要 crumb；Yahoo 收緊時才會回 401，那時改走 quoteSummary 那套。
  if (res.status === 401) {
    const auth = await getYahooCrumb();
    if (!auth) throw new Error("Yahoo search unauthorized");
    res = await fetchWithRetry(searchUrl(query, auth.crumb), {
      headers: { "User-Agent": "Mozilla/5.0", Cookie: auth.cookie },
      next: { revalidate: SEARCH_CACHE_SECONDS },
    });
  }

  if (!res.ok) throw new Error(`Yahoo search returned ${res.status}`);

  const data = (await res.json()) as { quotes?: YahooSearchQuote[] };
  return toOverseasItems(Array.isArray(data?.quotes) ? data.quotes : []);
}
