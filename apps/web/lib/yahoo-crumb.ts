import { fetchWithTimeout } from "./fetch-with-timeout";

interface YahooAuth {
  cookie: string;
  crumb: string;
}

// Yahoo's crumb/cookie pair is long-lived but not permanent — refresh
// hourly, and again on demand if a request comes back 401 with it.
const CRUMB_TTL_MS = 60 * 60 * 1000;

let cached: (YahooAuth & { fetchedAt: number }) | null = null;

async function fetchYahooAuth(): Promise<YahooAuth | null> {
  try {
    const cookieRes = await fetchWithTimeout("https://fc.yahoo.com", {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    const cookie = cookieRes.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ");
    if (!cookie) return null;

    const crumbRes = await fetchWithTimeout("https://query1.finance.yahoo.com/v1/test/getcrumb", {
      headers: { "User-Agent": "Mozilla/5.0", Cookie: cookie },
    });
    if (!crumbRes.ok) return null;

    const crumb = (await crumbRes.text()).trim();
    if (!crumb) return null;

    return { cookie, crumb };
  } catch {
    return null;
  }
}

// Yahoo's quoteSummary endpoint (unlike the plain chart endpoint the quote
// routes use) requires this session cookie + matching crumb since mid-2026.
export async function getYahooCrumb(options?: {
  forceRefresh?: boolean;
}): Promise<YahooAuth | null> {
  if (!options?.forceRefresh && cached && Date.now() - cached.fetchedAt < CRUMB_TTL_MS) {
    return cached;
  }

  const fresh = await fetchYahooAuth();
  if (!fresh) return null;

  cached = { ...fresh, fetchedAt: Date.now() };
  return cached;
}
