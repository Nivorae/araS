import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/fetch-with-timeout", () => ({ fetchWithRetry: vi.fn() }));
vi.mock("@/lib/yahoo-crumb", () => ({ getYahooCrumb: vi.fn() }));

import { fetchWithRetry } from "@/lib/fetch-with-timeout";
import { getYahooCrumb } from "@/lib/yahoo-crumb";
import { searchOverseasStocks, toOverseasItems } from "@/services/stock-search.service";

function res(status: number, body?: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

describe("toOverseasItems", () => {
  it("keeps only suffixed, non-Taiwan equities and ETFs", () => {
    const items = toOverseasItems([
      {
        symbol: "VWRA.L",
        quoteType: "ETF",
        longname: "Vanguard FTSE All-World",
        exchDisp: "London",
      },
      { symbol: "0700.HK", quoteType: "EQUITY", shortname: "TENCENT", exchDisp: "Hong Kong" },
      { symbol: "VT", quoteType: "ETF", longname: "Vanguard Total World" },
      { symbol: "2330.TW", quoteType: "EQUITY", longname: "TSMC" },
      { symbol: "00933B.TWO", quoteType: "ETF", longname: "Bond ETF" },
      { symbol: "0P0000XYZ.L", quoteType: "MUTUALFUND", longname: "Fund" },
      { symbol: "^FTSE", quoteType: "INDEX", longname: "FTSE 100" },
      { symbol: "BAD SYMBOL.L", quoteType: "EQUITY", longname: "Bad" },
    ]);

    expect(items).toEqual([
      { code: "VWRA.L", name: "Vanguard FTSE All-World", exchange: "London" },
      { code: "0700.HK", name: "TENCENT", exchange: "Hong Kong" },
    ]);
  });

  it("falls back longname → shortname → symbol, and exchDisp → exchange", () => {
    const items = toOverseasItems([
      { symbol: "A.L", quoteType: "EQUITY", shortname: "Short A", exchange: "LSE" },
      { symbol: "B.L", quoteType: "EQUITY" },
    ]);

    expect(items).toEqual([
      { code: "A.L", name: "Short A", exchange: "LSE" },
      { code: "B.L", name: "B.L", exchange: "" },
    ]);
  });

  it("drops duplicate symbols", () => {
    const items = toOverseasItems([
      { symbol: "vwra.l", quoteType: "ETF", longname: "first" },
      { symbol: "VWRA.L", quoteType: "ETF", longname: "second" },
    ]);
    expect(items.map((i) => i.name)).toEqual(["first"]);
  });
});

describe("searchOverseasStocks", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns filtered results without a crumb when Yahoo answers directly", async () => {
    vi.mocked(fetchWithRetry).mockResolvedValue(
      res(200, {
        quotes: [{ symbol: "VWRA.L", quoteType: "ETF", longname: "V", exchDisp: "London" }],
      })
    );

    await expect(searchOverseasStocks("VWRA")).resolves.toEqual([
      { code: "VWRA.L", name: "V", exchange: "London" },
    ]);
    expect(getYahooCrumb).not.toHaveBeenCalled();
    expect(vi.mocked(fetchWithRetry).mock.calls[0]![0]).toContain("q=VWRA");
  });

  it("retries with a crumb after a 401", async () => {
    vi.mocked(getYahooCrumb).mockResolvedValue({ cookie: "c=1", crumb: "abc" } as never);
    vi.mocked(fetchWithRetry)
      .mockResolvedValueOnce(res(401))
      .mockResolvedValueOnce(res(200, { quotes: [] }));

    await expect(searchOverseasStocks("VWRA")).resolves.toEqual([]);
    expect(vi.mocked(fetchWithRetry).mock.calls[1]![0]).toContain("crumb=abc");
  });

  it("throws when the crumb retry also fails", async () => {
    vi.mocked(getYahooCrumb).mockResolvedValue({ cookie: "c=1", crumb: "abc" } as never);
    vi.mocked(fetchWithRetry).mockResolvedValue(res(401));

    await expect(searchOverseasStocks("VWRA")).rejects.toThrow();
  });

  it("throws when no crumb can be obtained", async () => {
    vi.mocked(getYahooCrumb).mockResolvedValue(null);
    vi.mocked(fetchWithRetry).mockResolvedValue(res(401));

    await expect(searchOverseasStocks("VWRA")).rejects.toThrow();
  });

  it("returns an empty list when Yahoo sends no quotes field", async () => {
    vi.mocked(fetchWithRetry).mockResolvedValue(res(200, {}));
    await expect(searchOverseasStocks("zzz")).resolves.toEqual([]);
  });
});
