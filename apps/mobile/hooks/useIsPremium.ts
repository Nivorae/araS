import { useEffect, useState } from "react";
import { useApi } from "@/lib/api";

// Source of truth is the backend (EntitlementsService), not RevenueCat's
// client-side CustomerInfo — the client can't be trusted to self-report
// premium status. Currently always resolves to true (v1 is fully free; no
// feature is actually locked yet).
export function useIsPremium(): boolean {
  const api = useApi();
  const [isPremium, setIsPremium] = useState(true);

  useEffect(() => {
    api
      .get<{ isPremium: boolean }>("/api/entitlements")
      .then((data) => setIsPremium(data.isPremium))
      .catch(() => setIsPremium(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return isPremium;
}
