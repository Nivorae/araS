"use client";

import { useState, useMemo } from "react";
import { ChevronLeft } from "lucide-react";
import type { Insurance, CashValueRow } from "@repo/shared";
import { getLiveValue } from "@repo/shared";
import RetirementProjectionChart from "./RetirementProjectionChart";
import { useExchangeRate } from "../../hooks/useExchangeRate";

interface Props {
  open: boolean;
  insurance: Insurance;
  color: string;
  onClose: () => void;
  onRateUpdated: () => void;
}

function formatDateStr(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

function formatCurrencyValue(value: number): string {
  return `$${Math.round(value).toLocaleString()}`;
}

export function InsuranceDetailSheet({ open, insurance, color, onClose, onRateUpdated }: Props) {
  const [rateInput, setRateInput] = useState(String(insurance.declaredRate));
  const [editingRate, setEditingRate] = useState(false);
  const [savingRate, setSavingRate] = useState(false);
  const [rateError, setRateError] = useState<string | null>(null);

  const today = useMemo(() => new Date(), []);
  const { rate } = useExchangeRate();

  const currentValue = useMemo(
    () => getLiveValue(insurance.cashValueData, insurance.startDate, today),
    [insurance.cashValueData, insurance.startDate, today]
  );

  const policyYear = useMemo(
    () =>
      Math.floor(
        (Date.now() - new Date(insurance.startDate).getTime()) / (365.25 * 24 * 3600 * 1000)
      ) + 1,
    [insurance.startDate]
  );

  const premiumTotal = insurance.premiumTotal ?? 0;
  const growth = currentValue - premiumTotal;
  const growthPct = premiumTotal > 0 ? (growth / premiumTotal) * 100 : 0;

  const sortedCashValues = useMemo(
    () => [...insurance.cashValueData].sort((a, b) => a.policyYear - b.policyYear),
    [insurance.cashValueData]
  );

  const handleSaveRate = async () => {
    const rate = parseFloat(rateInput);
    if (isNaN(rate) || rate < 0 || rate > 20) {
      setRateError("請輸入有效的宣告利率（0 ~ 20%）");
      return;
    }
    setRateError(null);
    setSavingRate(true);
    try {
      const res = await fetch(`/api/insurance/${insurance.id}/rate`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ declaredRate: rate }),
      });
      if (!res.ok) throw new Error("更新失敗");
      setEditingRate(false);
      onRateUpdated();
    } catch {
      // keep editing open on failure
    } finally {
      setSavingRate(false);
    }
  };

  return (
    <div
      className={`fixed inset-0 z-[90] flex flex-col bg-[#f2f2f7] transition-transform duration-300 ease-in-out ${
        open ? "translate-x-0" : "pointer-events-none translate-x-full"
      }`}
    >
      {/* Header */}
      <div className="mx-auto w-full max-w-md shrink-0 px-4 pt-14 pb-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-sm"
          >
            <ChevronLeft size={20} className="text-[#1c1c1e]" />
          </button>
          <div>
            <h1 className="text-[20px] font-bold text-[#1c1c1e]">保險</h1>
            <p className="text-[12px] text-[#8e8e93]">
              {insurance.currency} · {formatDateStr(insurance.startDate)}
            </p>
          </div>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-md space-y-3 px-4 pb-12">
          {/* Status row */}
          <div className="grid grid-cols-3 gap-2">
            {[
              {
                label: `現金價值 (${insurance.currency})`,
                value: formatCurrencyValue(currentValue),
              },
              {
                label: "保費總額",
                value:
                  insurance.premiumTotal != null
                    ? `$${insurance.premiumTotal.toLocaleString()}`
                    : "—",
              },
              {
                label: "保單年度",
                value: `第 ${policyYear} 年`,
              },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-2xl bg-white px-3 py-3 shadow-sm">
                <p className="text-[11px] text-[#8e8e93]">{label}</p>
                <p className="mt-1 text-[14px] font-bold text-[#1c1c1e]">{value}</p>
              </div>
            ))}
          </div>

          {/* Accumulated growth */}
          <div className="rounded-2xl bg-white px-4 py-3 shadow-sm">
            <p className="mb-1 text-[12px] text-[#8e8e93]">累積報酬</p>
            <p
              className="text-[20px] font-bold"
              style={{ color: growth >= 0 ? "#0e1424" : "#ff3b30" }}
            >
              {growth >= 0 ? "+" : ""}
              {formatCurrencyValue(growth)}{" "}
              <span className="text-[15px]">
                ({growth >= 0 ? "+" : ""}
                {growthPct.toFixed(1)}%)
              </span>
            </p>
          </div>

          {/* Declared rate editor */}
          <div className="rounded-2xl bg-white px-4 py-3 shadow-sm">
            <p className="mb-1 text-[12px] text-[#8e8e93]">宣告利率 (%)</p>
            {editingRate ? (
              <div>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    value={rateInput}
                    onChange={(e) => {
                      setRateInput(e.target.value);
                      setRateError(null);
                    }}
                    step="0.01"
                    min={0}
                    max={20}
                    className="flex-1 bg-transparent text-[20px] font-bold text-[#1c1c1e] outline-none"
                    autoFocus
                  />
                  <button
                    onClick={handleSaveRate}
                    disabled={savingRate}
                    className="rounded-xl px-3 py-1.5 text-[13px] font-semibold text-white disabled:opacity-50"
                    style={{ backgroundColor: color }}
                  >
                    {savingRate ? "更新中" : "確認"}
                  </button>
                  <button
                    onClick={() => {
                      setRateInput(String(insurance.declaredRate));
                      setRateError(null);
                      setEditingRate(false);
                    }}
                    className="rounded-xl bg-[#f2f2f7] px-3 py-1.5 text-[13px] font-semibold text-[#8e8e93]"
                  >
                    取消
                  </button>
                </div>
                {rateError && <p className="mt-1 text-[12px] text-[#ff3b30]">{rateError}</p>}
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-[20px] font-bold text-[#1c1c1e]">
                  {insurance.declaredRate.toFixed(2)}%
                </p>
                <button
                  onClick={() => setEditingRate(true)}
                  className="text-[13px] font-medium"
                  style={{ color }}
                >
                  調整
                </button>
              </div>
            )}
          </div>

          {/* Cash value table */}
          <div className="rounded-2xl bg-white px-4 py-4 shadow-sm">
            <p className="mb-2 text-[15px] font-semibold text-[#1c1c1e]">現金價值表</p>
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="pb-2 text-left text-[12px] font-medium text-[#8e8e93]">
                    保單年度
                  </th>
                  <th className="pb-2 text-right text-[12px] font-medium text-[#8e8e93]">
                    現金價值 ({insurance.currency})
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedCashValues.map((row: CashValueRow) => {
                  const isCurrentYear = row.policyYear === policyYear;
                  return (
                    <tr key={row.policyYear} className={isCurrentYear ? "bg-[#f0fff4]" : ""}>
                      <td className="py-1.5 text-[12px] text-[#1c1c1e]">
                        第 {row.policyYear} 年
                        {isCurrentYear && (
                          <span className="ml-1 text-[10px] text-[#0e1424]">▶</span>
                        )}
                      </td>
                      <td className="py-1.5 text-right text-[12px] text-[#1c1c1e]">
                        {formatCurrencyValue(row.cashValue)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Retirement projection chart */}
          <RetirementProjectionChart insurance={insurance} exchangeRate={rate} />
        </div>
      </div>
    </div>
  );
}
