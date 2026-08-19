"use client";

import { useEffect, useState } from "react";
import type { DividendSummary } from "@repo/shared";
import { api } from "../../lib/api-client";

// Embedded as the 股息 tab on 投資損益 (apps/web/app/(finance)/transactions/page.tsx),
// alongside 走勢/配置 — mirrors apps/mobile/components/DividendOverview.tsx.
export function DividendOverview({ onSelectEntry }: { onSelectEntry?: (entryId: string) => void }) {
  const [summary, setSummary] = useState<DividendSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = () => {
    setLoading(true);
    api
      .get<DividendSummary>("/dividends/summary")
      .then((res) => {
        if (res.success) {
          setSummary(res.data);
          setError(null);
        } else {
          setError(res.error?.message ?? "讀取失敗");
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : "讀取失敗"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const firstLoadPending = summary === null && error === null;
  const failedWithNoData = summary === null && error !== null;

  if (firstLoadPending) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#e5e5ea] border-t-[#8e8e93]" />
      </div>
    );
  }

  if (failedWithNoData) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <p className="text-[15px] font-semibold text-[#1c1c1e]">無法載入股息資料</p>
        <p className="text-center text-[13px] text-[#8e8e93]">{error}</p>
        <button
          onClick={load}
          disabled={loading}
          className="mt-2 rounded-[10px] bg-[#1c1c1e] px-5 py-2.5 text-[14px] font-semibold text-white disabled:opacity-60"
        >
          {loading ? "重試中…" : "重試"}
        </button>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto pb-10">
      {error && (
        <p className="mb-3 text-[13px] text-[#d93025]">
          更新失敗，目前顯示上次讀取的資料（{error}）
        </p>
      )}

      <div className="flex gap-3">
        <div className="flex-1 rounded-[14px] bg-white p-4 shadow-sm">
          <p className="text-[12px] text-[#8e8e93]">本年度股利</p>
          <p className="mt-1.5 text-[18px] font-bold text-[#1c1c1e]">
            NT$ {(summary?.totalThisYear ?? 0).toLocaleString()}
          </p>
        </div>
        <div className="flex-1 rounded-[14px] bg-white p-4 shadow-sm">
          <p className="text-[12px] text-[#8e8e93]">全期累計</p>
          <p className="mt-1.5 text-[18px] font-bold text-[#1c1c1e]">
            NT$ {(summary?.totalAllTime ?? 0).toLocaleString()}
          </p>
        </div>
      </div>

      <p className="mt-6 mb-2.5 text-[13px] font-semibold text-[#1c1c1e]">各檔明細</p>
      <div className="overflow-hidden rounded-[14px] bg-white px-3.5 shadow-sm">
        {!summary || summary.byEntry.length === 0 ? (
          <p className="py-5 text-center text-[13px] text-[#8e8e93]">還沒有股利紀錄</p>
        ) : (
          summary.byEntry.map((row, i) => (
            <div key={row.entryId}>
              {i > 0 && <div className="h-px bg-[#f2f2f7]" />}
              <button
                onClick={() => onSelectEntry?.(row.entryId)}
                className="flex w-full items-center justify-between py-3.5 text-left"
              >
                <div>
                  <p className="text-[15px] text-[#1c1c1e]">{row.name}</p>
                  <p className="mt-0.5 text-[12px] text-[#8e8e93]">
                    {row.stockCode ?? "—"} · {row.subCategory}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[15px] font-semibold text-[#1c1c1e]">
                    NT$ {row.totalAllTime.toLocaleString()}
                  </p>
                  <p className="mt-0.5 text-[12px] text-[#8e8e93]">
                    {row.yieldOnCost != null
                      ? `殖利率 ${(row.yieldOnCost * 100).toFixed(2)}%`
                      : "殖利率 —"}
                  </p>
                </div>
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
