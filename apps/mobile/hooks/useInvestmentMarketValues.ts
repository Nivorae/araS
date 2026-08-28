import { useEffect, useMemo, useRef, useState } from "react";
import { useApi } from "@/lib/api";
import { useFinanceStore } from "@/store/financeStore";
import { STOCK_CATS, FUND_SUBCATEGORY, buildYfSymbol } from "@/lib/stockConstants";
import { fetchFundQuote } from "@/lib/funds";

const STOCK_SET: readonly string[] = STOCK_CATS;

/**
 * 基金跟股票一樣有「單價 × 單位數」的市值，只是單價來自官方每日淨值
 * (`/api/funds/quote`) 而不是 Yahoo，而且必須先綁過官方代碼（`stockCode`）——
 * 沒綁的基金就沿用成本，跟抓不到報價的股票同樣處理。
 */
function isPriceable(subCategory: string): boolean {
  return STOCK_SET.includes(subCategory) || subCategory === FUND_SUBCATEGORY;
}

/**
 * Returns a map of `entryId -> current market value (TWD)` for priced
 * investment entries: 台股/美股/加密貨幣/貴金屬 (Yahoo quotes) and 投資基金
 * (official daily NAV), each needing a bound code + units.
 *
 * Prices are fetched once per unique symbol (with FX conversion for non-TWD
 * quotes) and only re-fetched when the set of holdings changes or `refreshKey`
 * changes — so it does NOT hit the API on every render. Entries whose price
 * can't be fetched are simply omitted, letting callers fall back to the stored
 * cost value.
 *
 * `loading` is true whenever the current holdings haven't been priced yet. It is
 * derived synchronously (by comparing the holdings signature to the one the
 * cached values were computed for), so a caller can show a placeholder on the
 * FIRST render instead of briefly flashing the cost-basis total before the live
 * market value arrives. A manual refresh (`refreshKey` change with unchanged
 * holdings) keeps `loading` false so the existing total stays on screen.
 */
export function useInvestmentMarketValues(refreshKey?: unknown): {
  values: Record<string, number>;
  loading: boolean;
} {
  const api = useApi();
  const apiRef = useRef(api);
  apiRef.current = api;
  const entries = useFinanceStore((s) => s.entries);
  // `sig` = the holdings signature the cached `values` correspond to.
  const [state, setState] = useState<{ values: Record<string, number>; sig: string }>({
    values: {},
    sig: "",
  });

  const targets = useMemo(
    () =>
      entries.filter(
        (e) => isPriceable(e.subCategory) && e.stockCode && e.units != null && e.units > 0
      ),
    [entries]
  );

  // Stable signature — the effect only re-runs when a holding's identity/size
  // actually changes (not on unrelated store updates).
  const sig = useMemo(
    () => targets.map((e) => `${e.id}:${e.subCategory}:${e.stockCode}:${e.units}`).join("|"),
    [targets]
  );

  useEffect(() => {
    if (targets.length === 0) {
      setState({ values: {}, sig: "" });
      return;
    }
    let active = true;
    (async () => {
      const priceCache = new Map<string, number>(); // symbol -> TWD unit price
      const fxCache = new Map<string, number>(); // currency -> TWD rate
      const result: Record<string, number> = {};

      // 幣別 -> 台幣匯率，兩種資產共用（同一次刷新裡 USD 只查一次）。
      async function toTwdRate(currency: string): Promise<number> {
        if (currency === "TWD") return 1;
        const cached = fxCache.get(currency);
        if (cached) return cached;
        const fx = await apiRef.current
          .rawGet<{
            price: number;
          }>(`/api/stocks/price?symbol=${encodeURIComponent(currency + "TWD=X")}`)
          .catch(() => null);
        const rate = fx && typeof fx.price === "number" ? fx.price : 1;
        fxCache.set(currency, rate);
        return rate;
      }

      for (const e of targets) {
        const isFund = e.subCategory === FUND_SUBCATEGORY;
        // 基金用官方代碼當快取鍵，不會跟 Yahoo symbol 撞在一起。
        const key = isFund ? `fund:${e.stockCode}` : buildYfSymbol(e.subCategory, e.stockCode!);
        if (!key) continue;

        let twdPrice = priceCache.get(key);
        if (twdPrice == null) {
          try {
            if (isFund) {
              const quote = await fetchFundQuote(apiRef.current, e.stockCode!);
              twdPrice = quote.nav * (await toTwdRate(quote.currency));
            } else {
              const data = await apiRef.current.rawGet<{ price: number; currency: string }>(
                `/api/stocks/price?symbol=${encodeURIComponent(key)}`
              );
              if (typeof data.price !== "number") continue;
              twdPrice = data.price * (await toTwdRate(data.currency ?? "TWD"));
            }
            priceCache.set(key, twdPrice);
          } catch {
            continue;
          }
        }
        result[e.id] = (e.units ?? 0) * twdPrice;
      }

      if (active) setState({ values: result, sig });
    })();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, refreshKey]);

  // Loading while the cached values were computed for a different holdings set
  // than the current one (i.e. initial load or after holdings change).
  return { values: state.values, loading: state.sig !== sig };
}
