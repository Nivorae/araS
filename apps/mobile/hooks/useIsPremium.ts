import { useEffect, useState } from "react";
import { useApi } from "@/lib/api";

// Source of truth is the backend (EntitlementsService), not RevenueCat's
// client-side CustomerInfo — the client can't self-report premium status.
// Defaults to false and fails closed: an unverified client is treated as free,
// matching the authoritative server-side enforcement.
export function useIsPremium(): boolean {
  const api = useApi();
  const [isPremium, setIsPremium] = useState(false);

  useEffect(() => {
    api
      .get<{ isPremium: boolean }>("/api/entitlements")
      .then((data) => setIsPremium(data.isPremium))
      .catch(() => setIsPremium(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return isPremium;
}
