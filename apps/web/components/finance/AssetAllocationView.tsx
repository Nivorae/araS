"use client";

import { useEffect, useState } from "react";
import type { AssetAllocation } from "@repo/shared";
import { api } from "../../lib/api-client";
import { formatCurrency } from "../../lib/format";
import { getTopCategory } from "./categoryConfig";

const LIABILITY_COLOR = getTopCategory("負債")?.color ?? "#C7C7D4";

export function AssetAllocationView() {
  const [data, setData] = useState<AssetAllocation | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api
      .get<AssetAllocation>("/entries/allocation")
      .then((res) => {
        if (!active) return;
        if (res.success) {
          setData(res.data);
          setError(null);
        } else {
          setError(res.error?.message ?? "載入失敗");
        }
      })
      .catch(() => {
        if (active) setError("載入失敗，請重試");
      });
    return () => {
      active = false;
    };
  }, []);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-[13px] text-[#8e8e93]">載入失敗，請重試</p>
      </div>
    );
  }

  if (!data) {
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
    </div>
  );
}
