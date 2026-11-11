"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { BottomSheet } from "../ui/BottomSheet";
import { Spinner } from "../ui/Spinner";
import { calculatorCurrencies, fetchTwdRate } from "../../lib/twdQuote";

// Web port of apps/mobile/components/FxCalculatorSheet.tsx. The app records
// TWD cost only; someone who paid in USD or a local currency converts here and
// the TWD amount is filled into 投入金額. Nothing typed here is saved.

interface Props {
  open: boolean;
  onClose: () => void;
  /** The stock's quote currency, e.g. "GBP". */
  quoteCurrency: string;
  /** The rate the form already fetched for the quote currency, or null. */
  quoteFxRate: number | null;
  onApply: (twdAmount: number) => void;
}

export function FxCalculatorSheet({ open, onClose, quoteCurrency, quoteFxRate, onApply }: Props) {
  const [currency, setCurrency] = useState(quoteCurrency);
  const [amountStr, setAmountStr] = useState("");
  const [rateStr, setRateStr] = useState("");
  const [rateLoading, setRateLoading] = useState(false);
  const [rateFailed, setRateFailed] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const options = calculatorCurrencies(quoteCurrency);
  const selected = options.find((c) => c.code === currency) ?? options[0]!;

  // 每次打開都從報價幣別、空白金額開始。
  useEffect(() => {
    if (!open) return;
    setCurrency(quoteCurrency);
    setAmountStr("");
    setPickerOpen(false);
  }, [open, quoteCurrency]);

  // 帶入所選幣別的即時匯率。切換幣別會蓋掉手動改過的匯率；抓不到就留空讓使用者
  // 自己填，絕不退回 1。
  useEffect(() => {
    if (!open) return;
    if (currency === quoteCurrency && quoteFxRate != null && quoteFxRate > 0) {
      setRateStr(String(quoteFxRate));
      setRateFailed(false);
      setRateLoading(false);
      return;
    }
    let active = true;
    setRateStr("");
    setRateFailed(false);
    setRateLoading(true);
    void fetchTwdRate(currency).then((rate) => {
      if (!active) return;
      setRateLoading(false);
      if (rate == null) setRateFailed(true);
      else setRateStr(String(rate));
    });
    return () => {
      active = false;
    };
  }, [open, currency, quoteCurrency, quoteFxRate]);

  const amount = parseFloat(amountStr);
  const rate = parseFloat(rateStr);
  const valid = amount > 0 && rate > 0;
  const twd = valid ? Math.round(amount * rate) : null;

  const handleApply = () => {
    if (twd == null) return;
    onApply(twd);
    onClose();
  };

  return (
    <BottomSheet open={open} onClose={onClose} label="換算成台幣">
      <div className="mx-auto mt-2.5 h-1 w-9 rounded-full bg-[#d1d1d6]" />
      <p className="my-3.5 text-center text-[16px] font-semibold text-[#1c1c1e]">換算成台幣</p>

      <div className="px-5">
        <p className="mb-1.5 text-[13px] text-[#8e8e93]">外幣金額</p>
        <div className="flex items-center gap-2.5">
          <input
            type="text"
            inputMode="decimal"
            autoFocus
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value.replace(/[^\d.]/g, ""))}
            onFocus={() => setPickerOpen(false)}
            placeholder="0"
            aria-label="外幣金額"
            className="min-w-0 flex-1 rounded-[10px] border border-[#e5e5ea] px-3 py-2.5 text-[15px] text-[#1c1c1e] outline-none placeholder:text-[#c7c7cc]"
          />
          <button
            type="button"
            onClick={() => setPickerOpen((o) => !o)}
            aria-label={`付款幣別：${selected.name}，點擊更換`}
            className={`flex cursor-pointer items-center gap-1 rounded-[10px] px-3 py-2.5 ${
              pickerOpen ? "bg-[#e5e5ea]" : "bg-[#f2f2f7]"
            }`}
          >
            <span className="text-[15px] font-semibold text-[#1c1c1e]">{selected.code}</span>
            {selected.name !== selected.code && (
              <span className="text-[13px] text-[#8e8e93]">{selected.name}</span>
            )}
            {pickerOpen ? (
              <ChevronUp size={14} className="text-[#8e8e93]" />
            ) : (
              <ChevronDown size={14} className="text-[#8e8e93]" />
            )}
          </button>
        </div>

        {pickerOpen && (
          <div className="mt-2.5 grid grid-cols-4 gap-2">
            {options.map((c) => {
              const active = c.code === currency;
              return (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => {
                    setCurrency(c.code);
                    setPickerOpen(false);
                  }}
                  className={`flex cursor-pointer flex-col items-center rounded-[10px] py-2 ${
                    active ? "bg-[#66788E] text-white" : "bg-[#f2f2f7]"
                  }`}
                >
                  <span className={`text-[14px] font-semibold ${active ? "" : "text-[#1c1c1e]"}`}>
                    {c.code}
                  </span>
                  <span
                    className={`mt-0.5 w-full truncate text-center text-[11px] ${
                      active ? "" : "text-[#8e8e93]"
                    }`}
                  >
                    {c.name}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <p className="mt-3.5 mb-1.5 text-[13px] text-[#8e8e93]">匯率（1 {currency} = ? TWD）</p>
        <div className="flex items-center gap-2.5">
          <input
            type="text"
            inputMode="decimal"
            value={rateStr}
            onChange={(e) => {
              setRateStr(e.target.value.replace(/[^\d.]/g, ""));
              setRateFailed(false);
            }}
            disabled={rateLoading}
            placeholder="請輸入匯率"
            aria-label="匯率"
            className="min-w-0 flex-1 rounded-[10px] border border-[#e5e5ea] px-3 py-2.5 text-[15px] text-[#1c1c1e] outline-none placeholder:text-[#c7c7cc] disabled:bg-[#fafafa]"
          />
          {rateLoading && (
            <span className="text-[#8e8e93]">
              <Spinner size={16} />
            </span>
          )}
        </div>
        <p className="mt-1 text-[12px] text-[#8e8e93]">
          {rateFailed ? "抓不到即時匯率，請手動輸入" : "即時匯率，可改成實際成交匯率"}
        </p>

        <div className="mt-[18px] rounded-xl bg-[#f2f2f7] p-3.5">
          <p className="text-right text-[20px] font-bold text-[#1c1c1e]" data-testid="fx-result">
            = NT$ {twd != null ? twd.toLocaleString() : "--"}
          </p>
        </div>
      </div>

      <div className="flex gap-3 p-5">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 cursor-pointer rounded-xl bg-[#f2f2f7] py-3.5 text-[15px] text-[#1c1c1e]"
        >
          取消
        </button>
        <button
          type="button"
          onClick={handleApply}
          disabled={!valid}
          className="flex-1 cursor-pointer rounded-xl bg-[#66788E] py-3.5 text-[15px] font-semibold text-white disabled:opacity-50"
        >
          帶入
        </button>
      </div>
    </BottomSheet>
  );
}
