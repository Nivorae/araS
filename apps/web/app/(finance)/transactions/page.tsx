"use client";

import { useEffect, useMemo, useState } from "react";
import { useFinanceStore } from "../../../store/useFinanceStore";
import { PnlChart } from "../../../components/finance/PnlChart";
import { InvestmentChart } from "../../../components/finance/InvestmentChart";
import {
  aggregateTransactions,
  aggregateSnapshots,
  getRangeDisplayLabel,
} from "../../../lib/chartAggregation";
import { formatCurrency } from "../../../lib/format";

type Tab = "investment" | "liquidity";

function BalanceScale({ assets, liabilities }: { assets: number; liabilities: number }) {
  const total = assets + liabilities;
  const assetRatio = total > 0 ? assets / total : 0.5;
  // Negative rotation = left (assets) pan goes down
  const rotation = (0.5 - assetRatio) * 28;
  const dur = "1.3s cubic-bezier(0.34, 1.56, 0.64, 1)";

  return (
    <div style={{ position: "relative", width: 220, height: 108 }}>
      {/* Stand */}
      <div
        style={{
          position: "absolute",
          top: 11,
          left: "50%",
          transform: "translateX(-50%)",
          width: 6,
          height: 44,
          background: "#1c1c1e",
          borderRadius: 2,
        }}
      />
      {/* Pivot dot */}
      <div
        style={{
          position: "absolute",
          top: 50,
          left: "50%",
          transform: "translateX(-50%)",
          width: 16,
          height: 16,
          borderRadius: "50%",
          background: "#374254",
          zIndex: 1,
        }}
      />
      {/* Beam */}
      <div
        style={{
          position: "absolute",
          top: 55,
          left: 10,
          right: 10,
          height: 6,
          background: "#1c1c1e",
          borderRadius: 2,
          transformOrigin: "center center",
          transform: `rotate(${rotation}deg)`,
          transition: `transform ${dur}`,
        }}
      >
        {/* Left (assets) — string + pan */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 3,
            width: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            transformOrigin: "top center",
            transform: `rotate(${-rotation}deg)`,
            transition: `transform ${dur}`,
          }}
        >
          <div style={{ width: 3, height: 30, background: "#8e8e93" }} />
          <div
            style={{
              width: 52,
              height: 12,
              background: "#374254",
              borderRadius: "0 0 8px 8px",
            }}
          />
        </div>

        {/* Right (liabilities) — string + pan */}
        <div
          style={{
            position: "absolute",
            right: 0,
            top: 3,
            width: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            transformOrigin: "top center",
            transform: `rotate(${-rotation}deg)`,
            transition: `transform ${dur}`,
          }}
        >
          <div style={{ width: 3, height: 30, background: "#8e8e93" }} />
          <div
            style={{
              width: 52,
              height: 12,
              background: "#C7C7D4",
              borderRadius: "0 0 8px 8px",
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default function TransactionsPage() {
  const { transactions, valueSnapshots, entries, fetchAll } = useFinanceStore();
  const [tab, setTab] = useState<Tab>("investment");

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const totalAssets = useMemo(
    () => entries.filter((e) => e.topCategory !== "負債").reduce((s, e) => s + e.value, 0),
    [entries]
  );
  const totalLiabilities = useMemo(
    () => entries.filter((e) => e.topCategory === "負債").reduce((s, e) => s + e.value, 0),
    [entries]
  );

  const liquidityData = useMemo(() => aggregateTransactions(transactions, "5m"), [transactions]);
  const investmentData = useMemo(() => aggregateSnapshots(valueSnapshots, "5m"), [valueSnapshots]);
  const periodLabel = useMemo(() => getRangeDisplayLabel("5m"), []);

  const activeColor = tab === "investment" ? "#374254" : "#0e1424";

  return (
    <div
      className="relative flex flex-col overflow-hidden"
      style={{ height: "calc(100dvh - 64px)" }}
    >
      {/* Header: balance scale */}
      <div
        className="flex flex-shrink-0 flex-col items-center justify-center gap-4"
        style={{ height: "calc((100dvh - 64px) * 0.5)" }}
      >
        <div className="text-center">
          <h1 className="text-[22px] font-bold text-[#1c1c1e]">損益統計</h1>
        </div>
        <BalanceScale assets={totalAssets} liabilities={totalLiabilities} />

        {/* Asset / Liability values aligned below the pans */}
        <div className="flex w-[220px] items-start justify-between px-2">
          <div className="text-center">
            <p className="text-[15px] font-bold" style={{ color: "#374254" }}>
              {formatCurrency(totalAssets)}
            </p>
            <p className="text-[11px] text-[#8e8e93]">資產</p>
          </div>
          <div className="text-center">
            <p className="text-[15px] font-bold" style={{ color: "#C7C7D4" }}>
              {formatCurrency(totalLiabilities)}
            </p>
            <p className="text-[11px] text-[#8e8e93]">負債</p>
          </div>
        </div>

        <p className="text-[11px] text-[#c7c7cc]">{periodLabel}</p>
      </div>

      {/* Tab switcher */}
      <div className="mx-4 mb-3 flex flex-shrink-0 rounded-full bg-[#f2f2f7] p-1">
        {(["investment", "liquidity"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-1 rounded-full py-2 text-[13px] font-semibold transition-colors"
            style={{
              backgroundColor: tab === t ? activeColor : "transparent",
              color: tab === t ? "white" : "#8e8e93",
            }}
          >
            {t === "investment" ? "投資損益" : "收支"}
          </button>
        ))}
      </div>

      {/* Chart zone — fills remaining height */}
      <div className="min-h-0 flex-1 px-4 pb-4">
        {tab === "investment" ? (
          <InvestmentChart data={investmentData} height="100%" />
        ) : (
          <PnlChart data={liquidityData} height="100%" />
        )}
      </div>
    </div>
  );
}
