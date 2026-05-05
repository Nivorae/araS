"use client";

import { useMemo, useState, useCallback } from "react";
import { ChevronLeft, RefreshCw } from "lucide-react";
import type { Insurance } from "@repo/shared";
import { getMilestoneProjections } from "@repo/shared";
import { useExchangeRate } from "@/hooks/useExchangeRate";

interface CathayRate {
  prod_id: string;
  prod_name: string;
  rate_m: string;
  declare_year: string;
  declare_month: string;
}

interface Props {
  open: boolean;
  insurance: Insurance;
  onClose: () => void;
  onRateUpdated?: () => void;
}

function usd(v: number) {
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function twd(v: number, rate: number) {
  return `NT$${Math.round(v * rate).toLocaleString("zh-TW")}`;
}

function milestoneNote(years: number, gainRatio: number): string {
  if (years === 0) return "保本點，資產開始純成長";
  const pct = ((gainRatio - 1) * 100).toFixed(0);
  const mult = gainRatio.toFixed(1);
  if (years === 10) return `增值約 ${pct}%，複利效果顯現`;
  if (years === 20) return `約本金 ${mult}x，可支應重大支出`;
  return `約本金 ${mult}x，適合作為退休金`;
}

export function PolicyDetailSheet({ open, insurance, onClose, onRateUpdated }: Props) {
  const { rate, isManual } = useExchangeRate();

  const [showRatePicker, setShowRatePicker] = useState(false);
  const [cathayRates, setCathayRates] = useState<CathayRate[]>([]);
  const [rateMonth, setRateMonth] = useState("");
  const [fetchingRates, setFetchingRates] = useState(false);
  const [applyingRate, setApplyingRate] = useState<string | null>(null);

  const policyYear = useMemo(
    () =>
      Math.floor(
        (Date.now() - new Date(insurance.startDate).getTime()) / (365.25 * 24 * 3600 * 1000)
      ) + 1,
    [insurance.startDate]
  );

  const milestones = useMemo(
    () =>
      getMilestoneProjections(
        insurance.surrenderValue,
        insurance.declaredRate,
        insurance.currentAge
      ),
    [insurance.surrenderValue, insurance.declaredRate, insurance.currentAge]
  );

  const [startYear, startMonth, startDay] = insurance.startDate.slice(0, 10).split("-");
  const isPremiumPaid = insurance.premiumTotal != null;

  const openRatePicker = useCallback(async () => {
    setShowRatePicker(true);
    if (cathayRates.length > 0) return;
    setFetchingRates(true);
    try {
      const res = await fetch("/api/cathaylife-rates");
      if (!res.ok) throw new Error("fetch failed");
      const json = await res.json();
      setCathayRates(json.data ?? []);
      setRateMonth(json.month ?? "");
    } catch {
      setCathayRates([]);
    } finally {
      setFetchingRates(false);
    }
  }, [cathayRates.length]);

  const applyRate = useCallback(
    async (rateStr: string) => {
      const declaredRate = parseFloat(rateStr);
      if (isNaN(declaredRate)) return;
      setApplyingRate(rateStr);
      try {
        const res = await fetch(`/api/insurance/${insurance.id}/rate`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ declaredRate }),
        });
        if (!res.ok) throw new Error("更新失敗");
        setShowRatePicker(false);
        onRateUpdated?.();
      } catch {
        // keep picker open on failure
      } finally {
        setApplyingRate(null);
      }
    },
    [insurance.id, onRateUpdated]
  );

  return (
    <>
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
              <h1 className="text-[20px] font-bold text-[#1c1c1e]">保單明細</h1>
              <p className="text-[12px] text-[#8e8e93]">
                {insurance.insurer ?? "Cathay Life"} · 第 {policyYear} 年
              </p>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-md space-y-3 px-4 pb-12">
            {/* Section 1: 如果現在解約可以領多少錢？ */}
            <div className="rounded-2xl bg-white px-4 py-4 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[12px] font-medium text-[#8e8e93]">如果現在解約可以領多少錢？</p>
                {isManual && (
                  <span className="rounded-full bg-[#fff3cd] px-2 py-0.5 text-[10px] text-[#856404]">
                    匯率手動
                  </span>
                )}
              </div>
              <p className="text-[30px] font-bold tracking-tight text-[#1c1c1e]">
                {usd(insurance.surrenderValue)}
              </p>
              <p className="mt-0.5 text-[13px] text-[#8e8e93]">
                ≈ {twd(insurance.surrenderValue, rate)}
              </p>
              {insurance.accumulatedBonus > 0 && (
                <p className="mt-1.5 text-[11px] text-[#0e1424]">
                  含增值回饋金 +{usd(insurance.accumulatedBonus)}
                </p>
              )}
              {isPremiumPaid && (
                <p className="mt-2 text-[11px] leading-relaxed text-[#aeaeb2]">
                  已完成繳費，解約費用率已降為
                  0。現在領回相當於拿回全額本金；從此時起每年因複利正成長。
                </p>
              )}
            </div>

            {/* Section 2: 未來價值預估 */}
            <div className="rounded-2xl bg-white px-4 py-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[15px] font-semibold text-[#1c1c1e]">未來價值預估</p>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-[#f2f2f7] px-2 py-0.5 text-[11px] text-[#8e8e93]">
                    年化 {insurance.declaredRate.toFixed(1)}%
                  </span>
                  <button
                    onClick={openRatePicker}
                    className="flex items-center gap-1 rounded-full bg-[#374254] px-2.5 py-1 text-[11px] font-semibold text-white active:opacity-80"
                  >
                    <RefreshCw size={11} />
                    同步利率
                  </button>
                </div>
              </div>
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="pb-2 text-left text-[11px] font-medium text-[#8e8e93]">
                      時間點
                    </th>
                    <th className="pb-2 text-center text-[11px] font-medium text-[#8e8e93]">
                      年齡
                    </th>
                    <th className="pb-2 text-right text-[11px] font-medium text-[#8e8e93]">
                      預估解約金 (USD)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f2f2f7]">
                  {milestones.map(({ years, label, age, value, gainRatio }) => (
                    <tr key={label} className={years === 0 ? "bg-[#f9f9fb]" : ""}>
                      <td className="py-2.5 pr-2 text-[12px] font-semibold text-[#1c1c1e]">
                        {label}
                      </td>
                      <td className="py-2.5 text-center text-[12px] text-[#8e8e93]">{age} 歲</td>
                      <td className="py-2.5 text-right">
                        <p className="text-[13px] font-bold text-[#1c1c1e]">{usd(value)}</p>
                        <p className="text-[10px] text-[#aeaeb2]">
                          {milestoneNote(years, gainRatio)}
                        </p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-3 text-[10px] text-[#c7c7cc]">
                公式：FV = 解約金 × (1 + {insurance.declaredRate}%)ⁿ
              </p>
            </div>

            {/* Policy info grid */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "保單號碼", value: insurance.policyNumber ?? "—" },
                { label: "起保日期", value: `${startYear}/${startMonth}/${startDay}` },
                { label: "幣別", value: insurance.currency },
                { label: "投保年齡", value: `${insurance.currentAge} 歲` },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-2xl bg-white px-3 py-3 shadow-sm">
                  <p className="text-[11px] text-[#8e8e93]">{label}</p>
                  <p className="mt-1 text-[14px] font-bold text-[#1c1c1e]">{value}</p>
                </div>
              ))}
            </div>

            {/* Cost basis */}
            {insurance.premiumTotal != null && (
              <div className="rounded-2xl bg-white px-4 py-4 shadow-sm">
                <p className="mb-3 text-[15px] font-semibold text-[#1c1c1e]">成本與損益</p>
                <div className="space-y-2">
                  {[
                    { label: "保費成本（已繳完）", usdVal: insurance.premiumTotal, colored: false },
                    {
                      label: "未實現損益",
                      usdVal: insurance.surrenderValue - insurance.premiumTotal,
                      colored: true,
                    },
                  ].map(({ label, usdVal, colored }) => (
                    <div key={label} className="flex items-center justify-between">
                      <p className="text-[13px] text-[#8e8e93]">{label}</p>
                      <p
                        className="text-[13px] font-semibold"
                        style={
                          colored
                            ? { color: usdVal >= 0 ? "#0e1424" : "#ff3b30" }
                            : { color: "#1c1c1e" }
                        }
                      >
                        {usdVal >= 0 && colored ? "+" : ""}
                        {usd(usdVal)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Remark */}
            <div className="rounded-2xl bg-[#f0f4ff] px-4 py-3">
              <p className="text-[11px] leading-relaxed text-[#6e6e73]">
                本資產為美元計價，最終台幣價值受匯率波動影響。保證利率 2.2%，預估成長率 3%～3.8%。
              </p>
            </div>

            {/* Exchange rate footer */}
            <p className="text-center text-[11px] text-[#c7c7cc]">
              匯率：1 USD = {rate.toFixed(2)} TWD {isManual ? "(手動)" : "(即時)"}
            </p>
          </div>
        </div>
      </div>

      {/* Rate picker sheet */}
      <div
        className={`fixed inset-0 z-[100] flex flex-col bg-[#f2f2f7] transition-transform duration-300 ease-in-out ${
          showRatePicker ? "translate-x-0" : "pointer-events-none translate-x-full"
        }`}
      >
        <div className="mx-auto w-full max-w-md shrink-0 px-4 pt-14 pb-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowRatePicker(false)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-sm"
            >
              <ChevronLeft size={20} className="text-[#1c1c1e]" />
            </button>
            <div>
              <h1 className="text-[20px] font-bold text-[#1c1c1e]">同步宣告利率</h1>
              <p className="text-[12px] text-[#8e8e93]">
                國泰人壽 · 美元商品{rateMonth ? ` · ${rateMonth}` : ""}
              </p>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-md space-y-2 px-4 pb-12">
            {fetchingRates ? (
              <div className="py-20 text-center text-[14px] text-[#8e8e93]">載入中...</div>
            ) : cathayRates.length === 0 ? (
              <div className="rounded-2xl bg-white px-4 py-8 text-center text-[13px] text-[#c7c7cc] shadow-sm">
                暫無資料，請稍後再試
              </div>
            ) : (
              <>
                <p className="px-1 text-[12px] text-[#8e8e93]">
                  選擇你的保單商品，系統將自動套用該利率
                </p>
                <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
                  {cathayRates.map((r, i) => (
                    <button
                      key={r.prod_id}
                      onClick={() => applyRate(r.rate_m)}
                      disabled={applyingRate !== null}
                      className={`w-full px-4 py-3.5 text-left active:bg-[#f2f2f7] disabled:opacity-60 ${
                        i < cathayRates.length - 1 ? "border-b border-[#f2f2f7]" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1 pr-3">
                          <p className="text-[13px] leading-snug font-semibold text-[#1c1c1e]">
                            {r.prod_name}
                          </p>
                          <p className="mt-0.5 text-[11px] text-[#8e8e93]">{r.prod_id}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-[18px] font-bold text-[#374254]">{r.rate_m}%</p>
                          {applyingRate === r.rate_m && (
                            <p className="text-[10px] text-[#8e8e93]">套用中...</p>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
                <p className="px-1 text-center text-[10px] text-[#c7c7cc]">
                  資料來源：國泰人壽官網 · 每月第一個營業日更新
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
