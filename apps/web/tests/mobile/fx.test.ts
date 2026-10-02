import { describe, it, expect, vi } from "vitest";
import {
  POPULAR_CURRENCIES,
  calculatorCurrencies,
  createTwdRateLookup,
  fetchTwdRate,
} from "../../../mobile/lib/fx";

// A missing FX rate used to fall back to 1, which silently valued a foreign
// amount as if it were TWD. These pin the "unknown rate is null" contract.
describe("fetchTwdRate", () => {
  it("returns 1 for TWD without a request", async () => {
    const rawGet = vi.fn();

    await expect(fetchTwdRate(rawGet, "TWD")).resolves.toBe(1);
    expect(rawGet).not.toHaveBeenCalled();
  });

  it("queries <currency>TWD=X and returns the price", async () => {
    const rawGet = vi.fn().mockResolvedValue({ price: 41.2 });

    await expect(fetchTwdRate(rawGet, "GBP")).resolves.toBe(41.2);
    expect(rawGet).toHaveBeenCalledWith("/api/stocks/price?symbol=GBPTWD%3DX");
  });

  it("returns null when the request fails", async () => {
    const rawGet = vi.fn().mockRejectedValue(new Error("network"));

    await expect(fetchTwdRate(rawGet, "GBP")).resolves.toBeNull();
  });

  it.each([{}, { price: "41" }, { price: 0 }, { price: -1 }, null])(
    "returns null for an unusable response %j",
    async (body) => {
      const rawGet = vi.fn().mockResolvedValue(body);

      await expect(fetchTwdRate(rawGet, "GBP")).resolves.toBeNull();
    }
  );
});

describe("calculatorCurrencies", () => {
  it("puts the quote currency first and lists it only once", () => {
    const codes = calculatorCurrencies("GBP").map((c) => c.code);

    expect(codes[0]).toBe("GBP");
    expect(codes.filter((c) => c === "GBP")).toHaveLength(1);
    expect(codes).toEqual(expect.arrayContaining(["USD", "JPY", "EUR", "KRW"]));
  });

  it("keeps the popular order when the quote currency is USD", () => {
    expect(calculatorCurrencies("USD")).toEqual(POPULAR_CURRENCIES);
  });

  it("adds an unlisted quote currency up front, named by its code", () => {
    const options = calculatorCurrencies("SEK");

    expect(options[0]).toEqual({ code: "SEK", name: "SEK" });
    expect(options).toHaveLength(POPULAR_CURRENCIES.length + 1);
  });
});

describe("createTwdRateLookup", () => {
  it("fetches each currency once", async () => {
    const rawGet = vi.fn().mockResolvedValue({ price: 32 });
    const lookup = createTwdRateLookup(rawGet);

    await Promise.all([lookup("USD"), lookup("USD"), lookup("USD")]);

    expect(rawGet).toHaveBeenCalledTimes(1);
  });

  it("remembers a failure instead of retrying within the same refresh", async () => {
    const rawGet = vi.fn().mockRejectedValue(new Error("network"));
    const lookup = createTwdRateLookup(rawGet);

    await expect(lookup("HKD")).resolves.toBeNull();
    await expect(lookup("HKD")).resolves.toBeNull();
    expect(rawGet).toHaveBeenCalledTimes(1);
  });
});
