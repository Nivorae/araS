"use client";

import { useState } from "react";
import type { ScheduleRow } from "@repo/shared";

interface Props {
  rows: ScheduleRow[];
  color: string;
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

function fmt(n: number): string {
  return n.toLocaleString("zh-TW", { maximumFractionDigits: 0 });
}

export function AmortizationTable({ rows, color }: Props) {
  const [showPast, setShowPast] = useState(false);

  const pastRows = rows.filter((r) => r.isPast);
  const futureRows = rows.filter((r) => !r.isPast);

  const today = new Date();
  const currentMonthKey = `${today.getFullYear()}-${today.getMonth()}`;

  const displayedRows = showPast ? [...pastRows, ...futureRows] : futureRows;

  return (
    <div className="mt-4">
      {pastRows.length > 0 && (
        <button
          onClick={() => setShowPast((v) => !v)}
          className="mb-3 w-full rounded-xl bg-[#f2f2f7] py-2 text-[13px] font-medium text-[#8e8e93]"
        >
          {showPast ? "隱藏已繳期數" : `顯示已繳期數（${pastRows.length} 期）`}
        </button>
      )}

      {/* Sticky header */}
      <div className="sticky top-0 z-10 grid grid-cols-7 gap-1 rounded-xl bg-[#f2f2f7] px-2 py-2 text-[10px] font-semibold text-[#8e8e93] md:gap-2 md:px-3 md:text-[12px]">
        <span className="text-center">期</span>
        <span className="col-span-2">繳款日</span>
        <span className="text-right">期初餘額</span>
        <span className="text-right">還本</span>
        <span className="text-right">利息</span>
        <span className="text-right">本期應繳</span>
      </div>

      <div className="mt-1 space-y-px">
        {displayedRows.map((row) => {
          const rowKey = `${row.paymentDate.getFullYear()}-${row.paymentDate.getMonth()}`;
          const isCurrent = rowKey === currentMonthKey;

          return (
            <div
              key={row.month}
              className="grid grid-cols-7 gap-1 rounded-lg px-2 py-2 text-[11px] md:gap-2 md:px-3 md:text-[13px]"
              style={{
                backgroundColor: row.isPast ? "transparent" : "white",
                color: row.isPast ? "#8e8e93" : "#1c1c1e",
                borderLeft: isCurrent ? `3px solid ${color}` : "3px solid transparent",
              }}
            >
              <span className="text-center font-semibold">{row.month}</span>
              <span className="col-span-2">{formatDate(row.paymentDate)}</span>
              <span className="text-right">{fmt(row.beginBalance)}</span>
              <span className="text-right">{fmt(row.principalPaid)}</span>
              <span className="text-right">{fmt(row.interestPaid)}</span>
              <span className="text-right font-semibold">{fmt(row.totalPayment)}</span>
            </div>
          );
        })}
      </div>

      {displayedRows.length === 0 && (
        <p className="py-8 text-center text-[13px] text-[#8e8e93]">貸款已全數還清</p>
      )}
    </div>
  );
}
