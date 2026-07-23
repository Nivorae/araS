import { useEffect, useState } from "react";
import { useApi } from "@/lib/api";

// Module-level cache, shared across every mount of the hook for the app's
// lifetime. Once we've learned the user's premium status once, later screens
// read the cached value on their very first render — no spinner, no "升級
// Premium → 已升級" flash — while a background revalidate keeps it fresh.
// `null` means "never fetched yet" (show loading); a boolean is a known result.
let cachedIsPremium: boolean | null = null;

export interface PremiumState {
  isPremium: boolean;
  /** True only on the very first fetch, when we have no cached value to show. */
  loading: boolean;
}

// Source of truth is the backend (EntitlementsService), not RevenueCat's
// client-side CustomerInfo — the client can't self-report premium status.
// Fails closed: an unverified client is treated as free, matching the
// authoritative server-side enforcement.
export function useIsPremium(): PremiumState {
  const api = useApi();
  const [isPremium, setIsPremium] = useState(cachedIsPremium ?? false);
  // Only block with a loading state when there's nothing cached to show yet.
  const [loading, setLoading] = useState(cachedIsPremium === null);

  useEffect(() => {
    let active = true;
    api
      .get<{ isPremium: boolean }>("/api/entitlements")
      .then((data) => {
        cachedIsPremium = data.isPremium;
        if (active) setIsPremium(data.isPremium);
      })
      .catch(() => {
        // Keep whatever we last knew; only fall back to free if we never had it.
        if (active) setIsPremium(cachedIsPremium ?? false);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [api]);

  return { isPremium, loading };
}
