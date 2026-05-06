"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Plus } from "lucide-react";
import type { PortfolioItem } from "@repo/shared";
import { useQuoteStore } from "../../store/useQuoteStore";
import { formatCurrency, formatPercent } from "../../lib/format";
import { AddPortfolioItemModal } from "./AddPortfolioItemModal";

interface Props {
  portfolio: PortfolioItem[];
}

export function PortfolioSection({ portfolio }: Props) {
  const { quotes, loading, refreshQuotes } = useQuoteStore();
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    if (portfolio.length > 0) refreshQuotes(portfolio.map((p) => p.symbol));
  }, [portfolio, refreshQuotes]);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[13px] text-[#8e8e93]">投資組合</p>
        <div className="flex gap-1">
          <button
            onClick={() => portfolio.length > 0 && refreshQuotes(portfolio.map((p) => p.symbol))}
            disabled={loading}
            className="rounded-lg p-1.5 transition-colors active:bg-[#f2f2f7]"
          >
            <RefreshCw size={14} className={`text-[#8e8e93] ${loading ? "animate-spin" : ""}`} />
          </button>
          <button onClick={() => setShowAdd(true)} className="rounded-lg p-1.5 active:bg-[#f2f2f7]">
            <Plus size={14} className="text-[#8e8e93]" />
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
        {portfolio.length === 0 ? (
          <div className="py-10 text-center text-sm text-[#c7c7cc]">
            <p>尚無投資項目</p>
            <button
              onClick={() => setShowAdd(true)}
              className="mt-2 text-sm font-medium text-[#374254]"
            >
              新增第一筆
            </button>
          </div>
        ) : (
          <ul>
            {portfolio.map((item, i) => {
              const quote = quotes[item.symbol];
              const cost = item.avgCost * item.shares;
              const marketValue = quote ? quote.price * item.shares : null;
              const unrealizedPL = marketValue !== null ? marketValue - cost : null;
              const returnRate = unrealizedPL !== null ? (unrealizedPL / cost) * 100 : null;
              const isGain = returnRate !== null && returnRate >= 0;

              return (
                <li
                  key={item.id}
                  className={`flex items-center justify-between px-4 py-3.5 ${
                    i !== portfolio.length - 1 ? "border-b border-[#f2f2f7]" : ""
                  }`}
                >
                  <div>
                    <p className="text-[15px] font-medium text-[#1c1c1e]">{item.name}</p>
                    <p className="mt-0.5 text-[12px] text-[#8e8e93]">{item.symbol}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[15px] font-medium text-[#1c1c1e]">
                      {quote ? formatCurrency(quote.price, quote.currency) : "—"}
                    </p>
                    {unrealizedPL !== null && returnRate !== null ? (
                      <span
                        className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${
                          isGain
                            ? "bg-[#0e1424]/15 text-[#0e1424]"
                            : "bg-[#ff3b30]/10 text-[#ff3b30]"
                        }`}
                      >
                        {formatPercent(returnRate)}
                      </span>
                    ) : (
                      <span className="text-[11px] text-[#c7c7cc]">載入中</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <AddPortfolioItemModal open={showAdd} onClose={() => setShowAdd(false)} />
    </div>
  );
}
