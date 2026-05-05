"use client";

import type { Entry } from "@repo/shared";
import { getLiveValue, calculateIRR } from "@repo/shared";
import { useExchangeRate } from "@/hooks/useExchangeRate";

interface Props {
  insuranceEntries: Entry[];
}

export function InsuranceSummaryCard({ insuranceEntries }: Props) {
  const { convertToTWD, isManual } = useExchangeRate();

  const entries = insuranceEntries.filter((e) => e.insurance != null);
  if (entries.length === 0) return null;

  const today = new Date();

  const policies = entries.map((e) => {
    const ins = e.insurance!;
    const currentValue = getLiveValue(ins.cashValueData, ins.startDate, today);
    const yearsElapsed =
      (Date.now() - new Date(ins.startDate).getTime()) / (365.25 * 24 * 3600 * 1000);
    const irr = calculateIRR(ins.premiumTotal ?? 0, currentValue, yearsElapsed);
    return { ins, currentValue, irr };
  });

  const totalCurrentValue = policies.reduce((s, p) => s + p.currentValue, 0);
  const totalPremium = policies.reduce((s, p) => s + (p.ins.premiumTotal ?? 0), 0);
  const averageIRR =
    policies.length > 0 ? policies.reduce((s, p) => s + p.irr, 0) / policies.length : 0;

  const gainRatio = totalPremium > 0 ? totalCurrentValue / totalPremium : 0;
  // Cap display at 200%
  const progressWidth = Math.min(100, (gainRatio / 2) * 100);
  const gainPercent = (gainRatio - 1) * 100;

  return (
    <div className="mb-3 rounded-2xl bg-white px-4 py-4 shadow-sm">
      {/* Title row */}
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[14px] font-semibold text-[#1c1c1e]">保險總覽</p>
        <div className="flex items-center gap-2">
          {isManual && (
            <span className="rounded-full bg-[#fff3cd] px-2 py-0.5 text-[10px] text-[#856404]">
              匯率手動
            </span>
          )}
          <span className="rounded-full bg-[#f2f2f7] px-2.5 py-0.5 text-[11px] text-[#8e8e93]">
            {policies.length} 筆保單
          </span>
        </div>
      </div>

      {/* Current value */}
      <p className="text-[28px] font-bold" style={{ color: "#0e1424" }}>
        ${totalCurrentValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}
      </p>
      <p className="mt-0.5 text-[12px] text-[#8e8e93]">
        ≈ TWD{" "}
        {convertToTWD(totalCurrentValue).toLocaleString("zh-TW", { maximumFractionDigits: 0 })}
      </p>

      {/* Progress bar */}
      <div className="mt-3">
        <div className="mb-1 flex justify-between text-[11px] text-[#8e8e93]">
          <span>
            {gainPercent >= 0 ? "+" : ""}
            {gainPercent.toFixed(1)}% 相對保費
          </span>
          <span>保費 ${totalPremium.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[#f2f2f7]">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${progressWidth}%`, backgroundColor: "#0e1424" }}
          />
        </div>
      </div>

      {/* IRR row */}
      <div className="mt-3 flex items-center justify-between">
        <p className="text-[12px] text-[#8e8e93]">IRR</p>
        <p className="text-[13px] font-semibold text-[#1c1c1e]">{averageIRR.toFixed(2)}%</p>
      </div>
    </div>
  );
}
