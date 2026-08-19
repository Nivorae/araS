"use client";

import { useEffect, useMemo, useState } from "react";
import { Spinner } from "../ui/Spinner";
import { useFinanceStore } from "../../store/useFinanceStore";
import { buildYfSymbol } from "../../lib/stockSymbol";
import { promptMobileApp } from "../../lib/mobileAppPrompt";

interface ReinvestSheetProps {
  open: boolean;
  dividendId: string;
  dividendAmount: number;
  entryName: string;
  subCategory: string;
  stockCode: string;
  bankName: string | null;
  onClose: () => void;
  onDone: () => void;
}

export function ReinvestSheet({
  open,
  dividendId,
  dividendAmount,
  entryName,
  subCategory,
  stockCode,
  bankName,
  onClose,
  onDone,
}: ReinvestSheetProps) {
  const refreshEntries = useFinanceStore((s) => s.refreshEntries);

  const [amountStr, setAmountStr] = useState(String(dividendAmount));
  const [priceStr, setPriceStr] = useState("");
  const [priceLoading, setPriceLoading] = useState(false);
  const [currency, setCurrency] = useState("TWD");
  const [fxLoading, setFxLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isTWD = subCategory === "台股";

  useEffect(() => {
    if (!open) return;
    setAmountStr(String(dividendAmount));
    setPriceStr("");
    setCurrency("TWD");
    setError(null);
  }, [open, dividendAmount, stockCode]);

  // 現價只是預填 — backend 用 units = amount / price（amount 一律 TWD），非台股
  // 的報價要先換算成 TWD 再填入，否則買入股數會被高估。
  useEffect(() => {
    if (!open) return;
    let active = true;
    setPriceLoading(true);
    if (!isTWD) setFxLoading(true);
    (async () => {
      try {
        const symbol = buildYfSymbol(subCategory, stockCode);
        if (!symbol) return;
        const res = await fetch(`/api/stocks/price?symbol=${encodeURIComponent(symbol)}`);
        const r = await res.json();
        if (!active || typeof r?.price !== "number") return;
        const cur = r.currency ?? "TWD";
        if (active) setCurrency(cur);
        if (isTWD || cur === "TWD") {
          setPriceStr(String(r.price));
          return;
        }
        const fxRes = await fetch(`/api/stocks/price?symbol=${encodeURIComponent(`${cur}TWD=X`)}`);
        const fx = await fxRes.json();
        if (active && typeof fx?.price === "number" && fx.price > 0) {
          setPriceStr(String(r.price * fx.price));
        }
      } catch {
        // 留空，使用者手填。
      } finally {
        if (active) {
          setPriceLoading(false);
          setFxLoading(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [open, subCategory, stockCode, isTWD]);

  const amount = parseFloat(amountStr) || 0;
  const price = parseFloat(priceStr) || 0;
  const units = useMemo(() => (price > 0 ? amount / price : 0), [amount, price]);

  async function handleSubmit() {
    if (fxLoading) return setError("匯率讀取中，請稍候");
    if (amount <= 0) return setError("請輸入大於 0 的再投資金額");
    if (amount > dividendAmount) return setError("再投資金額不可超過股利金額");
    if (price <= 0) return setError("請輸入價格（抓不到現價時可手動填入）");

    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/dividends/${dividendId}/reinvest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, price }),
      });
      const json = await res.json();
      if (!json.success) {
        if (json.error?.code === "PREMIUM_REQUIRED") {
          promptMobileApp("股息紀錄是 Premium 功能，如果要使用該功能，請下載手機版本。");
          onClose();
          return;
        }
        throw new Error(json.error?.message ?? "再投資失敗，請稍後再試");
      }
      await refreshEntries();
      onDone();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "再投資失敗，請稍後再試");
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    if (submitting) return;
    onClose();
  }

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-[80] bg-black/40" onClick={handleClose} />
      <div className="fixed inset-x-0 bottom-0 z-[81] mx-auto max-w-md rounded-t-2xl bg-white px-5 pt-4 pb-10 md:max-w-xl lg:max-w-2xl">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#e5e5ea]" />
        <p className="mb-5 text-center text-[16px] font-semibold text-[#1c1c1e]">
          再投資 · {entryName}
        </p>

        <label className="mb-1.5 block text-[13px] text-[#8e8e93]">再投資金額（TWD）</label>
        <input
          type="number"
          value={amountStr}
          onChange={(e) => {
            setAmountStr(e.target.value);
            setError(null);
          }}
          className="w-full rounded-[10px] border border-[#e5e5ea] px-3 py-2.5 text-[15px] text-[#1c1c1e] outline-none"
        />

        <label className="mt-3 mb-1.5 block text-[13px] text-[#8e8e93]">
          買入價格{!isTWD ? `（${currency}）` : ""}
          {priceLoading ? "（讀取現價中…）" : ""}
        </label>
        <input
          type="number"
          value={priceStr}
          onChange={(e) => {
            setPriceStr(e.target.value);
            setError(null);
          }}
          placeholder="抓不到現價時請手動填入"
          className="w-full rounded-[10px] border border-[#e5e5ea] px-3 py-2.5 text-[15px] text-[#1c1c1e] outline-none"
        />
        {!isTWD && fxLoading && <p className="mt-1 text-[12px] text-[#8e8e93]">正在讀取匯率…</p>}

        <div className="mt-4 flex flex-col gap-1.5 rounded-xl bg-[#f2f2f7] p-3.5">
          {bankName ? (
            <p className="text-[14px] text-[#1c1c1e]">
              {bankName}
              {"　"}−NT$ {amount.toLocaleString()}
            </p>
          ) : (
            <p className="text-[13px] text-[#8e8e93]">這筆股利未記錄入帳帳戶，不會扣款</p>
          )}
          <p className="text-[14px] text-[#1c1c1e]">
            {entryName}
            {"　"}+NT$ {amount.toLocaleString()}
          </p>
          <p className="text-[14px] text-[#1c1c1e]">
            增加{"　"}
            {units > 0 ? units.toFixed(2) : "—"} 股
          </p>
        </div>

        {error && <p className="mt-3 text-[13px] text-[#ff3b30]">{error}</p>}

        <div className="mt-4 flex gap-3">
          <button
            onClick={handleClose}
            disabled={submitting}
            className="flex-1 rounded-full border border-[#e5e5ea] py-3 text-[15px] font-semibold text-[#1c1c1e] active:bg-[#f2f2f7] disabled:opacity-40"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || fxLoading}
            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[#66788E] py-3 text-[15px] font-semibold text-white active:opacity-80 disabled:opacity-40"
          >
            {submitting && <Spinner size={14} />}
            {submitting ? "處理中…" : fxLoading ? "匯率讀取中…" : "確認再投資"}
          </button>
        </div>
      </div>
    </>
  );
}
