import { useEffect, useMemo, useRef, useState } from "react";
import { useApi } from "@/lib/api";
import { useFinanceStore } from "@/store/financeStore";
import { STOCK_CATS, buildYfSymbol } from "@/lib/stockConstants";

const STOCK_SET: readonly string[] = STOCK_CATS;

/**
 * Returns a map of `entryId -> current market value (TWD)` for stock-backed
 * investment entries (台股/美股/加密貨幣/貴金屬 with a code + units).
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
        (e) => STOCK_SET.includes(e.subCategory) && e.stockCode && e.units != null && e.units > 0
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

      for (const e of targets) {
        const symbol = buildYfSymbol(e.subCategory, e.stockCode!);
        if (!symbol) continue;

        let twdPrice = priceCache.get(symbol);
        if (twdPrice == null) {
          try {
            const data = await apiRef.current.rawGet<{ price: number; currency: string }>(
              `/api/stocks/price?symbol=${encodeURIComponent(symbol)}`
            );
            if (typeof data.price !== "number") continue;
            const c = data.currency ?? "TWD";
            let rate = 1;
            if (c !== "TWD") {
              rate = fxCache.get(c) ?? 0;
              if (!rate) {
                const fx = await apiRef.current
                  .rawGet<{
                    price: number;
                  }>(`/api/stocks/price?symbol=${encodeURIComponent(c + "TWD=X")}`)
                  .catch(() => null);
                rate = fx && typeof fx.price === "number" ? fx.price : 1;
                fxCache.set(c, rate);
              }
            }
            twdPrice = data.price * rate;
            priceCache.set(symbol, twdPrice);
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
