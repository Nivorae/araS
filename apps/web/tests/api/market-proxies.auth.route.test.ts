import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));
vi.mock("@/lib/security-log", () => ({ logSecurityEvent: vi.fn() }));
vi.mock("@/lib/fetch-with-timeout", () => ({ fetchWithRetry: vi.fn() }));
vi.mock("@/lib/yahoo-crumb", () => ({ getYahooCrumb: vi.fn() }));
vi.mock("@/services/crypto-list.service", () => ({ fetchCryptoList: vi.fn() }));
vi.mock("@/services/quotes.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/quotes.service")>()),
  quotesService: { fetchQuote: vi.fn() },
}));

import { auth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { logSecurityEvent } from "@/lib/security-log";
import { fetchWithRetry } from "@/lib/fetch-with-timeout";
import { getYahooCrumb } from "@/lib/yahoo-crumb";
import { fetchCryptoList } from "@/services/crypto-list.service";
import { quotesService } from "@/services/quotes.service";
import { GET as cathayGET } from "../../app/api/cathaylife-rates/route";
import { GET as exchangeRateGET } from "../../app/api/exchange-rate/route";
import { GET as quoteGET } from "../../app/api/quotes/[symbol]/route";
import { GET as cryptoGET } from "../../app/api/stocks/crypto/route";
import { GET as dividendGET } from "../../app/api/stocks/dividend/route";
import { GET as priceGET } from "../../app/api/stocks/price/route";
import { GET as twGET } from "../../app/api/stocks/tw/route";
import { GET as usGET } from "../../app/api/stocks/us/route";

const req = (path: string) => new NextRequest(`http://localhost${path}`);
const symbolParams = { params: Promise.resolve({ symbol: "AAPL" }) };

// Each proxy self-protects so a middleware regression can't expose the
// upstream quota (Finnhub key, Yahoo egress) to anonymous callers.
const routes: [string, () => Promise<Response>][] = [
  ["/api/cathaylife-rates", () => cathayGET()],
  ["/api/exchange-rate", () => exchangeRateGET()],
  ["/api/quotes/[symbol]", () => quoteGET(req("/api/quotes/AAPL"), symbolParams)],
  ["/api/stocks/crypto", () => cryptoGET()],
  ["/api/stocks/dividend", () => dividendGET(req("/api/stocks/dividend?symbol=AAPL"))],
  ["/api/stocks/price", () => priceGET(req("/api/stocks/price?symbol=AAPL"))],
  ["/api/stocks/tw", () => twGET()],
  ["/api/stocks/us", () => usGET()],
];

describe("market-data proxies auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(routes)("%s returns 401 without calling upstream when signed out", async (path, call) => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as never);

    const res = await call();

    expect(res.status).toBe(401);
    expect(logSecurityEvent).toHaveBeenCalledWith({ type: "auth_fail", resource: path });
    expect(fetchWithRetry).not.toHaveBeenCalled();
    expect(getYahooCrumb).not.toHaveBeenCalled();
    expect(fetchCryptoList).not.toHaveBeenCalled();
    expect(quotesService.fetchQuote).not.toHaveBeenCalled();
  });

  it("serves a quote to a signed-in user", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "user_test123" } as never);
    vi.mocked(quotesService.fetchQuote).mockResolvedValue({ price: 1 } as never);

    const res = await priceGET(req("/api/stocks/price?symbol=AAPL"));

    expect(res.status).toBe(200);
    expect(quotesService.fetchQuote).toHaveBeenCalledWith("AAPL");
  });
});

describe("market-data proxies symbol validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ userId: "user_test123" } as never);
  });

  it.each([
    ["/api/stocks/price", () => priceGET(req("/api/stocks/price?symbol=%3Cscript%3E"))],
    [
      "/api/stocks/dividend",
      () => dividendGET(req(`/api/stocks/dividend?symbol=${"A".repeat(40)}`)),
    ],
    [
      "/api/quotes/[symbol]",
      () => quoteGET(req("/api/quotes/x"), { params: Promise.resolve({ symbol: "a b" }) }),
    ],
  ])("%s rejects a malformed symbol without calling upstream", async (_path, call) => {
    const res = await call();

    expect(res.status).toBe(400);
    expect(quotesService.fetchQuote).not.toHaveBeenCalled();
    expect(fetchWithRetry).not.toHaveBeenCalled();
    expect(getYahooCrumb).not.toHaveBeenCalled();
  });

  it("canonicalises the symbol before fetching", async () => {
    vi.mocked(quotesService.fetchQuote).mockResolvedValue({ price: 1 } as never);

    await priceGET(req("/api/stocks/price?symbol=aapl"));

    expect(quotesService.fetchQuote).toHaveBeenCalledWith("AAPL");
  });
});
