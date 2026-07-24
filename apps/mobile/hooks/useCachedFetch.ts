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
const listeners = new Map<string, Set<() => void>>();

// Drops the cached value for `endpoint` and tells every mounted
// useCachedFetch(endpoint) instance to refetch right away. Used by the
// dev-only premium toggle (apps/mobile/app/(app)/settings.tsx) so flipping
// the simulated subscription shows up without restarting the app.
export function invalidateCachedFetch(endpoint: string): void {
  caches.delete(endpoint);
  listeners.get(endpoint)?.forEach((notify) => notify());
}

export function useCachedFetch<T>(endpoint: string): CachedFetchState<T> {
  const api = useApi();
  const cached = caches.has(endpoint) ? (caches.get(endpoint) as T) : null;
  const [data, setData] = useState<T | null>(cached);
  const [loading, setLoading] = useState(cached === null);
  const [error, setError] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const notify = () => setVersion((v) => v + 1);
    let set = listeners.get(endpoint);
    if (!set) {
      set = new Set();
      listeners.set(endpoint, set);
    }
    set.add(notify);
    return () => {
      set!.delete(notify);
    };
  }, [endpoint]);

  useEffect(() => {
    let active = true;
    if (!caches.has(endpoint)) setLoading(true);
    api
      .get<T>(endpoint)
      .then((d) => {
        // Only the current (active) fetch may write the cache. A stale
        // pre-invalidation GET can resolve after the post-invalidation one;
        // gating the write here stops it from poisoning the cache with an
        // out-of-date value once its effect has been superseded.
        if (active) {
          caches.set(endpoint, d);
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

    // deliberate refetch trigger, not a value the effect reads.
  }, [api, endpoint, version]);

  return { data, loading, error };
}
