import { describe, it, expect } from "vitest";
import { normalizeSymbol } from "../../services/quotes.service";

// Each distinct symbol string is its own upstream fetch and cache entry, so
// arbitrary strings let one caller burn the shared Yahoo/Finnhub quota.
describe("normalizeSymbol", () => {
  it.each([
    ["2330.TW", "2330.TW"],
    ["00933B.TWO", "00933B.TWO"],
    ["aapl", "AAPL"],
    ["BRK-B", "BRK-B"],
    ["BTC-USD", "BTC-USD"],
    ["USDTWD=X", "USDTWD=X"],
    ["GC=F", "GC=F"],
    ["^TWII", "^TWII"],
    [" AAPL ", "AAPL"],
  ])("accepts %s as %s", (raw, expected) => {
    expect(normalizeSymbol(raw)).toBe(expected);
  });

  it.each(["", "A".repeat(21), "AAPL/../x", "AA PL", "<script>", "AAPL?x=1", null])(
    "rejects %s",
    (raw) => {
      expect(normalizeSymbol(raw)).toBeNull();
    }
  );
});
