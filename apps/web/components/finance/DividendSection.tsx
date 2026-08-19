"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import type { Dividend } from "@repo/shared";
import { useFinanceStore } from "../../store/useFinanceStore";
import { DividendForm } from "./DividendForm";
import { ReinvestSheet } from "./ReinvestSheet";

interface DividendSectionProps {
  entryId: string;
  entryName: string;
  subCategory: string;
  stockCode: string;
  currentShares: number | null;
  costBasis: number;
}

export function DividendSection({
  entryId,
  entryName,
  subCategory,
  stockCode,
  currentShares,
  costBasis,
}: DividendSectionProps) {
  const entries = useFinanceStore((s) => s.entries);

  const [rows, setRows] = useState<Dividend[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [reinvestTarget, setReinvestTarget] = useState<Dividend | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/dividends?entryId=${encodeURIComponent(entryId)}`);
      const json = await res.json();
      if (json.success) setRows(json.data);
    } catch {
      // 讀取失敗就維持現有列表 —— 這是輔助資訊，不該讓詳情頁整頁失敗。
    }
  }, [entryId]);

  useEffect(() => {
    void load();
  }, [load]);

  const total = useMemo(() => rows.reduce((s, r) => s + r.amount, 0), [rows]);
  const thisYearTotal = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return rows
      .filter((r) => new Date(r.payDate).getFullYear() === currentYear)
      .reduce((s, r) => s + r.amount, 0);
  }, [rows]);
  const yieldOnCost = costBasis > 0 ? (thisYearTotal / costBasis) * 100 : null;

  const bankNameOf = (d: Dividend) =>
    d.bankEntryId ? (entries.find((e) => e.id === d.bankEntryId)?.name ?? null) : null;

  async function handleDelete(d: Dividend) {
    if (deletingId) return;
    if (!window.confirm("刪除這筆股利？入帳與再投資的紀錄會一併沖銷，帳戶餘額回到原本的金額。")) {
      return;
    }
    setDeletingId(d.id);
    try {
      const res = await fetch(`/api/dividends/${d.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "刪除失敗");
      await load();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "刪除失敗，請稍後再試");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="px-5 pt-6">
      <div className="mb-2.5 flex items-center justify-between">
        <p className="text-[13px] font-semibold text-[#1c1c1e]">股息</p>
        <button
          onClick={() => setFormOpen(true)}
          className="text-[13px] font-semibold text-[#66788E]"
        >
          + 新增
        </button>
      </div>

      <div className="flex items-center justify-between py-1">
        <p className="text-[13px] text-[#8e8e93]">累計股利</p>
        <p className="text-[13px] font-semibold text-[#1c1c1e]">NT$ {total.toLocaleString()}</p>
      </div>
      {yieldOnCost != null && (
        <div className="flex items-center justify-between py-1">
          <p className="text-[13px] text-[#8e8e93]">本年度對成本殖利率</p>
          <p className="text-[13px] font-semibold text-[#1c1c1e]">{yieldOnCost.toFixed(2)}%</p>
        </div>
      )}

      <div className="mt-2.5 overflow-hidden rounded-2xl bg-white px-3.5 shadow-sm">
        {rows.length === 0 ? (
          <p className="py-[18px] text-center text-[13px] text-[#8e8e93]">還沒有股利紀錄</p>
        ) : (
          rows.map((d, i) => {
            const isDeleting = deletingId === d.id;
            return (
              <div key={d.id}>
                {i > 0 && <div className="h-px bg-[#f2f2f7]" />}
                <div
                  className={`flex items-center justify-between py-3 ${isDeleting ? "opacity-50" : ""}`}
                >
                  <div>
                    <p className="text-[14px] text-[#1c1c1e]">{d.payDate.slice(0, 10)}</p>
                    {d.perShare != null && (
                      <p className="mt-0.5 text-[12px] text-[#8e8e93]">
                        每股 {d.perShare} × {d.shares ?? "—"} 股
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-[14px] font-semibold text-[#1c1c1e]">
                        +NT$ {d.amount.toLocaleString()}
                      </p>
                      {d.reinvestedAt ? (
                        <p className="mt-0.5 text-[12px] text-[#8e8e93]">
                          已再投資{" "}
                          {d.reinvestUnits != null ? `${d.reinvestUnits.toFixed(2)} 股` : ""}
                        </p>
                      ) : (
                        <button
                          onClick={() => setReinvestTarget(d)}
                          className="mt-0.5 text-[12px] font-semibold text-[#66788E]"
                        >
                          再投資
                        </button>
                      )}
                    </div>
                    <button
                      onClick={() => handleDelete(d)}
                      disabled={isDeleting}
                      className="shrink-0 text-[#c7c7cc] hover:text-[#ff3b30] disabled:opacity-40"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <DividendForm
        open={formOpen}
        entryId={entryId}
        entryName={entryName}
        subCategory={subCategory}
        stockCode={stockCode}
        currentShares={currentShares}
        onClose={() => setFormOpen(false)}
        onSaved={load}
      />

      {reinvestTarget && (
        <ReinvestSheet
          open
          dividendId={reinvestTarget.id}
          dividendAmount={reinvestTarget.amount}
          entryName={entryName}
          subCategory={subCategory}
          stockCode={stockCode}
          bankName={bankNameOf(reinvestTarget)}
          onClose={() => setReinvestTarget(null)}
          onDone={load}
        />
      )}
    </div>
  );
}
