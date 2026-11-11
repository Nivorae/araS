"use client";

import { useEffect, useMemo, useState } from "react";
import { useFinanceStore } from "../store/useFinanceStore";
import { STOCK_CATS, buildYfSymbol } from "../lib/stockSymbol";
import { fetchTwdRate } from "../lib/twdQuote";

// Web port of apps/mobile/hooks/useInvestmentMarketValues.ts (fund NAV is
// behind FUND_NAV_ENABLED=false on mobile, so only Yahoo-priced holdings here).

/**
 * `entryId -> current market value (TWD)` for 台股/美股/海外股票/加密貨幣/貴金屬
 * entries with a bound code and units. Each symbol (and each currency's FX
 * rate) is fetched once per refresh; entries that can't be priced are omitted
 * so callers fall back to the stored cost.
 *
 * `loading` is derived synchronously — true whenever the current holdings
 * haven't been priced yet — so the first render can show a placeholder
 * instead of flashing the cost-basis total. A `refreshKey` change with the
 * same holdings keeps `loading` false so the existing total stays visible.
 */
export function useInvestmentMarketValues(refreshKey?: unknown): {
  values: Record<string, number>;
  loading: boolean;
} {
  const entries = useFinanceStore((s) => s.entries);
  const isGuest = useFinanceStore((s) => s.isGuest);
  const [state, setState] = useState<{ values: Record<string, number>; sig: string }>({
    values: {},
    sig: "",
  });

  const targets = useMemo(
    () =>
      isGuest
        ? []
        : entries.filter(
            (e) =>
              STOCK_CATS.includes(e.subCategory) && e.stockCode && e.units != null && e.units > 0
          ),
    [entries, isGuest]
  );

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
      const rateCache = new Map<string, Promise<number | null>>();
      const toTwdRate = (c: string) => {
        let r = rateCache.get(c);
        if (!r) {
          r = fetchTwdRate(c);
          rateCache.set(c, r);
        }
        return r;
      };
      const result: Record<string, number> = {};

      for (const e of targets) {
        const key = buildYfSymbol(e.subCategory, e.stockCode!);
        if (!key) continue;
        let twdPrice = priceCache.get(key);
        if (twdPrice == null) {
          try {
            const res = await fetch(`/api/stocks/price?symbol=${encodeURIComponent(key)}`);
            const data = await res.json();
            if (typeof data?.price !== "number") continue;
            const rate = await toTwdRate(typeof data.currency === "string" ? data.currency : "TWD");
            // Unknown FX → leave this entry at cost, never multiply by 1.
            if (rate == null) continue;
            twdPrice = data.price * rate;
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

  return { values: state.values, loading: state.sig !== sig };
}
