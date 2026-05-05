"use client";

import { useMemo, useState } from "react";
import { useFinanceStore } from "../../../store/useFinanceStore";
import { PnlChart } from "../../../components/finance/PnlChart";
import { InvestmentChart } from "../../../components/finance/InvestmentChart";
import {
  aggregateTransactions,
  aggregateSnapshots,
  getRangeDisplayLabel,
  type Range,
} from "../../../lib/chartAggregation";
import { formatCurrency } from "../../../lib/format";

type Tab = "investment" | "liquidity";

const RANGES: Range[] = ["5w", "6m", "1y", "4y"];

export default function TransactionsPage() {
  const { transactions, valueSnapshots } = useFinanceStore();
  const [tab, setTab] = useState<Tab>("investment");
  const [range, setRange] = useState<Range>("6m");

  const liquidityData = useMemo(
    () => aggregateTransactions(transactions, range),
    [transactions, range]
  );

  const investmentData = useMemo(
    () => aggregateSnapshots(valueSnapshots, range),
    [valueSnapshots, range]
  );

  const rangeLabel = useMemo(() => getRangeDisplayLabel(range), [range]);

  const summaryLines = useMemo(() => {
    if (tab === "liquidity") {
      const totalIncome = liquidityData.reduce((s, d) => s + d.income, 0);
      const totalExpense = liquidityData.reduce((s, d) => s + d.expense, 0);
      return [`總收入 ${formatCurrency(totalIncome)}`, `總支出 ${formatCurrency(totalExpense)}`];
    }
    const firstWithData = investmentData.find((d) => d.totalAssets > 0);
    const last = investmentData.at(-1);
    const change = (last?.totalAssets ?? 0) - (firstWithData?.totalAssets ?? 0);
    return [
      `資產總變化 ${formatCurrency(change)}`,
      `帳面淨值 ${formatCurrency(last?.netWorth ?? 0)}`,
    ];
  }, [tab, liquidityData, investmentData]);

  const activeTabColor = tab === "investment" ? "#66788E" : "#0e1424";

  return (
    <div className="px-4 pt-6">
      <h1 className="mb-6 text-xl font-bold text-[#1c1c1e]">損益統計</h1>

      {/* Tab switcher */}
      <div className="mb-6 flex rounded-full bg-[#f2f2f7] p-1">
        {(["investment", "liquidity"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-1 rounded-full py-2 text-[14px] font-semibold"
            style={{
              backgroundColor: tab === t ? activeTabColor : "transparent",
              color: tab === t ? "white" : "#8e8e93",
            }}
          >
            {t === "investment" ? "投資損益" : "收支"}
          </button>
        ))}
      </div>

      {/* Date range + summary */}
      <p className="mb-1 text-[13px] text-[#8e8e93]">{rangeLabel}</p>
      {summaryLines.map((line, i) => (
        <p key={i} className="text-[15px] font-medium text-[#1c1c1e]">
          {line}
        </p>
      ))}

      {/* Chart */}
      <div className="mt-5">
        {tab === "investment" ? (
          <InvestmentChart data={investmentData} />
        ) : (
          <PnlChart data={liquidityData} />
        )}
      </div>

      {/* Range selector */}
      <div className="mt-5 flex rounded-full bg-[#f2f2f7] p-1">
        {RANGES.map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className="flex-1 rounded-full py-2 text-[13px] font-semibold"
            style={{
              backgroundColor: range === r ? "white" : "transparent",
              color: range === r ? "#1c1c1e" : "#8e8e93",
              boxShadow: range === r ? "0 1px 3px rgba(0,0,0,0.12)" : "none",
            }}
          >
            {r}
          </button>
        ))}
      </div>
    </div>
  );
}
