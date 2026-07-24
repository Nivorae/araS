import type { AssetAllocation } from "@repo/shared";
import { useCachedFetch, type CachedFetchState } from "@/hooks/useCachedFetch";

export function useAssetAllocation(): CachedFetchState<AssetAllocation> {
  return useCachedFetch<AssetAllocation>("/api/entries/allocation");
}
