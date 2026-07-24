import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { createElement } from "react";
import { useApi } from "@/lib/api";

export interface PremiumState {
  isPremium: boolean;
  /** True only on the very first fetch, before we have any value to show. */
  loading: boolean;
  /**
   * Force a re-fetch of entitlement status. Call it at the two moments the
   * value legitimately changes within a session: after a purchase completes,
   * and when the dev-only toggle flips the simulated subscription.
   */
  refresh: () => Promise<void>;
}

const PremiumContext = createContext<PremiumState | null>(null);

// Source of truth is the backend (EntitlementsService), never RevenueCat's
// client-side CustomerInfo — the client can't self-report premium status.
// Fails closed: an unverified client is treated as free, matching the
// authoritative server-side enforcement.
//
// Mounted once at the authenticated layout (app/(app)/_layout.tsx), so the
// entitlement is fetched a single time when the app is entered — before any
// tab or the entry flow — and then cached in this provider for the whole
// session. Screens read the ready value via useIsPremium() without each one
// re-confirming on its own mount.
export function PremiumProvider({ children }: { children: ReactNode }) {
  const api = useApi();
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api.get<{ isPremium: boolean }>("/api/entitlements");
      setIsPremium(data.isPremium);
    } catch {
      // Keep the last known value; fail-closed means the initial false stands
      // if the very first fetch fails.
    } finally {
      setLoading(false);
    }
  }, [api]);

  // `api` is referentially stable across renders (see useApi), so this runs
  // exactly once for the lifetime of the authenticated session.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  return createElement(
    PremiumContext.Provider,
    { value: { isPremium, loading, refresh } },
    children
  );
}

export function useIsPremium(): PremiumState {
  const ctx = useContext(PremiumContext);
  if (!ctx) {
    throw new Error("useIsPremium must be used within a PremiumProvider");
  }
  return ctx;
}
