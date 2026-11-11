"use client";

import { useEffect, useState } from "react";
import { api } from "../lib/api-client";

// Web port of apps/mobile/hooks/useCachedFetch.ts.

export interface CachedFetchState<T> {
  data: T | null;
  /** True only on the very first fetch, when we have no cached value to show. */
  loading: boolean;
  /** True only when there's no cached value to fall back on. */
  error: boolean;
}

// Module-level cache keyed by endpoint, shared across every mount. First fetch
// shows a spinner; later mounts show the cached value immediately while a
// background revalidate keeps it fresh.
const caches = new Map<string, unknown>();

/** Called on account change: the cache is keyed by endpoint only. */
export function clearCachedFetch(): void {
  caches.clear();
}

/** `revalidateKey` changing triggers a background refetch (cached value still shown). */
export function useCachedFetch<T>(endpoint: string, revalidateKey?: unknown): CachedFetchState<T> {
  const cached = caches.has(endpoint) ? (caches.get(endpoint) as T) : null;
  const [data, setData] = useState<T | null>(cached);
  const [loading, setLoading] = useState(cached === null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    api
      .get<T>(endpoint)
      .then((res) => {
        if (!res.success) throw new Error(res.error.message);
        caches.set(endpoint, res.data);
        if (active) {
          setData(res.data);
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
  }, [endpoint, revalidateKey]);

  return { data, loading, error };
}
