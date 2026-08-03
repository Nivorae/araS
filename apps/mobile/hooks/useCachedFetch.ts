import { useEffect, useState } from "react";
import { useApi } from "@/lib/api";

export interface CachedFetchState<T> {
  data: T | null;
  /** True only on the very first fetch, when we have no cached value to show. */
  loading: boolean;
  /** True only when there's no cached value to fall back on. */
  error: boolean;
}

// Module-level cache keyed by endpoint, shared across every mount for the
// app's lifetime. First fetch shows a spinner; later mounts of the same
// endpoint show the cached value immediately while a background revalidate
// keeps it fresh — no flash, no refetch-on-every-tab-switch.
const caches = new Map<string, unknown>();

export function useCachedFetch<T>(endpoint: string): CachedFetchState<T> {
  const api = useApi();
  const cached = caches.has(endpoint) ? (caches.get(endpoint) as T) : null;
  const [data, setData] = useState<T | null>(cached);
  const [loading, setLoading] = useState(cached === null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    api
      .get<T>(endpoint)
      .then((d) => {
        caches.set(endpoint, d);
        if (active) {
          setData(d);
          setError(false);
        }
      })
      .catch(() => {
        // Keep whatever we last knew; only surface an error if we never had it.
        if (active && !caches.has(endpoint)) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [api, endpoint]);

  return { data, loading, error };
}
