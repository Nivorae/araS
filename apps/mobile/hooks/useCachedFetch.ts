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

/**
 * `revalidateKey` 一變就在背景重抓（照樣先顯示快取值）。呼叫端的畫面常常掛載後
 * 就不再卸載（例如資產損益頁的分頁用 display:none 保活），只靠掛載時抓一次的話，
 * 資料改了之後會一直停在舊值。
 */
export function useCachedFetch<T>(endpoint: string, revalidateKey?: unknown): CachedFetchState<T> {
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
  }, [api, endpoint, revalidateKey]);

  return { data, loading, error };
}
