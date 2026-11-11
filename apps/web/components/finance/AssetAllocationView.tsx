"use client";

import { useMemo } from "react";
import type { AssetAllocation } from "@repo/shared";
import { useCachedFetch } from "../../hooks/useCachedFetch";
import { useFinanceStore } from "../../store/useFinanceStore";
import { chartedEntries } from "../../lib/chartedEntries";
import { OVERSEAS_SUBCATEGORY } from "../../lib/stockSymbol";
import { formatCurrency } from "../../lib/format";
import { getTopCategory } from "./categoryConfig";

const LIABILITY_COLOR = getTopCategory("負債")?.color ?? "#C7C7D4";

export function AssetAllocationView() {
  // Every entry mutation bumps the epoch, so this pane revalidates even while
  // it's kept mounted (hidden) behind the other views.
  const epoch = useFinanceStore((s) => s.netWorthHistoryEpoch);
  const { data, loading, error } = useCachedFetch<AssetAllocation>("/entries/allocation", epoch);
  // 台股／美股不在 allocation 的 topCategory breakdown 裡（只到「投資」這層），
  // 自己從 entries 篩，維持跟折線圖同一組「納入圖表」項目。
  const entries = useFinanceStore((s) => s.entries);
  const { twValue, usValue, overseasValue } = useMemo(
    () =>
      chartedEntries(entries).reduce(
        (acc, e) => {
          if (e.subCategory === "台股") acc.twValue += e.value;
          else if (e.subCategory === "美股") acc.usValue += e.value;
          else if (e.subCategory === OVERSEAS_SUBCATEGORY) acc.overseasValue += e.value;
          return acc;
        },
        { twValue: 0, usValue: 0, overseasValue: 0 }
      ),
    [entries]
  );
  const stockTotal = twValue + usValue + overseasValue;
  const pct = (v: number) => `${((v / stockTotal) * 100).toFixed(1)}%`;
  // 沒有海外持股時維持原本的「台股 x% / 美股 y%」；有的話只列有金額的市場。
  const marketRatio =
    overseasValue > 0
      ? (
          [
            ["台股", twValue],
            ["美股", usValue],
            ["海外", overseasValue],
          ] as const
        )
          .filter(([, v]) => v > 0)
          .map(([label, v]) => `${label} ${pct(v)}`)
          .join(" / ")
      : `台股 ${pct(twValue)} / 美股 ${pct(usValue)}`;

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-[13px] text-[#8e8e93]">載入失敗，請重試</p>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#e5e5ea] border-t-[#8e8e93]" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5 overflow-y-auto">
      {data.breakdown.length === 0 ? (
        <p className="mt-3 text-center text-[13px] text-[#8e8e93]">尚無資產資料</p>
      ) : (
        data.breakdown.map((item) => (
          <div key={item.topCategory} className="flex items-center gap-2">
            <span
              className="h-2 w-2 shrink-0 rounded-full border"
              style={{
                backgroundColor: getTopCategory(item.topCategory)?.color ?? "#8e8e93",
                borderColor: "rgba(28,28,30,0.12)",
              }}
            />
            <p className="flex-1 text-[13px] font-semibold text-[#1c1c1e]">{item.topCategory}</p>
            <p className="w-12 text-right text-[13px] text-[#8e8e93]">
              {item.percentage.toFixed(1)}%
            </p>
            <p className="w-[130px] text-right text-[13px] text-[#1c1c1e]">
              {formatCurrency(item.value)}
            </p>
          </div>
        ))
      )}

      {data.concentrationWarnings.length > 0 && (
        <div className="mt-1.5 flex flex-col gap-1 rounded-[10px] bg-[#fdf1e8] p-2.5">
          {data.concentrationWarnings.map((w) => (
            <p key={w.entryId} className="text-[12px] font-semibold text-[#B8865E]">
              {`⚠ ${w.name} 佔總資產 ${w.percentage.toFixed(1)}%，集中度偏高`}
            </p>
          ))}
        </div>
      )}

      <div className="mt-2 flex items-center justify-between border-t border-[#e5e5ea] pt-2.5">
        <div className="flex items-center gap-2">
          <span
            className="h-2 w-2 shrink-0 rounded-full border"
            style={{ backgroundColor: LIABILITY_COLOR, borderColor: "rgba(28,28,30,0.12)" }}
          />
          <p className="text-[13px] text-[#8e8e93]">負債佔總資產</p>
        </div>
        <p className="text-[13px] font-bold text-[#1c1c1e]">
          {data.debtToAssetRatio === null ? "尚無資料" : `${data.debtToAssetRatio.toFixed(1)}%`}
        </p>
      </div>

      <div className="mt-2 flex items-center justify-between border-t border-[#e5e5ea] pt-2.5">
        <p className="text-[13px] text-[#8e8e93]">
          {overseasValue > 0 ? "股票市場比例" : "台股／美股比例"}
        </p>
        <p className="text-[13px] font-bold text-[#1c1c1e]">
          {stockTotal === 0 ? "尚無資料" : marketRatio}
        </p>
      </div>
    </div>
  );
}
