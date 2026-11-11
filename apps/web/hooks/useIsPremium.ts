"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { api } from "../lib/api-client";

/**
 * Fetched once per mount. Web has no in-app purchase path, so this only gates
 * the fast-path UX — non-premium users get promptMobileApp() instead of a
 * paywall (see CLAUDE.md "No web premium/paywall UI"). Server routes enforce
 * premium independently where there is a write. Signed-out guests are never
 * premium and make no request (the route would only answer 401).
 */
export function useIsPremium() {
  const { isLoaded, isSignedIn } = useAuth();
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setIsPremium(false);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    api
      .get<{ isPremium: boolean }>("/entitlements")
      .then((res) => {
        if (active && res.success) setIsPremium(res.data.isPremium);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isLoaded, isSignedIn]);

  return { isPremium, loading };
}
