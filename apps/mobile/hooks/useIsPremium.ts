import { useCachedFetch } from "@/hooks/useCachedFetch";

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
  const { data, loading } = useCachedFetch<{ isPremium: boolean }>("/api/entitlements");
  return { isPremium: data?.isPremium ?? false, loading };
}
