import type { AssetAllocation } from "@repo/shared";
import { useCachedFetch, type CachedFetchState } from "@/hooks/useCachedFetch";
import { useFinanceStore } from "@/store/financeStore";

export function useAssetAllocation(): CachedFetchState<AssetAllocation> {
  // 每次項目異動（新增、編輯、刪除、切換「納入圖表」）store 都會遞增這個 epoch，
  // 拿它當 revalidateKey，配置分頁保活不卸載時也會跟著重抓。
  const epoch = useFinanceStore((s) => s.netWorthHistoryEpoch);
  return useCachedFetch<AssetAllocation>("/api/entries/allocation", epoch);
}
