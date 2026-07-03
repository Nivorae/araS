import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/services/crypto-list.service", () => ({
  fetchCryptoList: vi.fn(),
}));

import { fetchCryptoList } from "@/services/crypto-list.service";
import { QuotesService } from "../../services/quotes.service";

function yahooResponse(ok: boolean, body?: unknown) {
  return { ok, status: ok ? 200 : 500, json: async () => body } as Response;
}

describe("QuotesService.fetchQuote", () => {
  const originalFetch = global.fetch;
  const originalFinnhubKey = process.env.FINNHUB_API_KEY;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    vi.mocked(fetchCryptoList).mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.FINNHUB_API_KEY = originalFinnhubKey;
  });

  it("returns the Yahoo quote when Yahoo succeeds", async () => {
    fetchMock.mockResolvedValue(
      yahooResponse(true, {
        chart: { result: [{ meta: { regularMarketPrice: 100, currency: "USD" } }] },
      })
    );

    const quote = await new QuotesService().fetchQuote("AAPL");

    expect(quote).toEqual({ symbol: "AAPL", price: 100, currency: "USD" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rethrows the Yahoo error for a TW symbol without attempting a fallback", async () => {
    // 500 is retryable, so Yahoo is called twice (attempt + 1 retry) before giving up.
    fetchMock.mockResolvedValue(yahooResponse(false));

    await expect(new QuotesService().fetchQuote("2330.TW")).rejects.toThrow(
      "Yahoo Finance returned 500 for 2330.TW"
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rethrows the Yahoo error for a US ticker when FINNHUB_API_KEY is unset", async () => {
    delete process.env.FINNHUB_API_KEY;
    fetchMock.mockResolvedValue(yahooResponse(false));

    await expect(new QuotesService().fetchQuote("AAPL")).rejects.toThrow(
      "Yahoo Finance returned 500 for AAPL"
    );
    // Yahoo retried once; Finnhub short-circuits without a fetch call since no key is set.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("falls back to Finnhub for a US ticker when Yahoo fails", async () => {
    process.env.FINNHUB_API_KEY = "test-key";
    fetchMock
      .mockResolvedValueOnce(yahooResponse(false)) // Yahoo attempt
      .mockResolvedValueOnce(yahooResponse(false)) // Yahoo retry
      .mockResolvedValueOnce({ ok: true, json: async () => ({ c: 250 }) } as Response);

    const quote = await new QuotesService().fetchQuote("AAPL");

    expect(quote).toEqual({ symbol: "AAPL", price: 250, currency: "USD" });
    const [finnhubUrl] = fetchMock.mock.calls[2] as [string];
    expect(finnhubUrl).toContain("finnhub.io");
  });

  it("falls back to CoinGecko for a crypto symbol when Yahoo fails", async () => {
    vi.mocked(fetchCryptoList).mockResolvedValue([{ code: "BTC", name: "Bitcoin", id: "bitcoin" }]);
    fetchMock
      .mockResolvedValueOnce(yahooResponse(false)) // Yahoo attempt
      .mockResolvedValueOnce(yahooResponse(false)) // Yahoo retry
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ bitcoin: { usd: 60000 } }),
      } as Response);

    const quote = await new QuotesService().fetchQuote("BTC-USD");

    expect(quote).toEqual({ symbol: "BTC-USD", price: 60000, currency: "USD" });
    const [coinGeckoUrl] = fetchMock.mock.calls[2] as [string];
    expect(coinGeckoUrl).toContain("coingecko.com");
  });

  it("rethrows the Yahoo error for a crypto symbol with no CoinGecko match", async () => {
    vi.mocked(fetchCryptoList).mockResolvedValue([]);
    fetchMock.mockResolvedValue(yahooResponse(false));

    await expect(new QuotesService().fetchQuote("ZZZZ-USD")).rejects.toThrow(
      "Yahoo Finance returned 500 for ZZZZ-USD"
    );
  });

  it("rethrows the Yahoo error when the result is missing meta", async () => {
    fetchMock.mockResolvedValue(yahooResponse(true, { chart: { result: [{}] } }));

    await expect(new QuotesService().fetchQuote("AAPL")).rejects.toThrow(
      "No data found for symbol AAPL"
    );
  });
});
