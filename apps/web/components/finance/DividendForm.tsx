"use client";

import { useEffect, useMemo, useState } from "react";
import { Spinner } from "../ui/Spinner";
import { useFinanceStore } from "../../store/useFinanceStore";
import { buildYfSymbol } from "../../lib/stockSymbol";
import { promptMobileApp } from "../../lib/mobileAppPrompt";

interface DividendFormProps {
  open: boolean;
  entryId: string;
  entryName: string;
  subCategory: string;
  stockCode: string;
  currentShares: number | null;
  onClose: () => void;
  onSaved: () => void;
}

export function DividendForm({
  open,
  entryId,
  entryName,
  subCategory,
  stockCode,
  currentShares,
  onClose,
  onSaved,
}: DividendFormProps) {
  const entries = useFinanceStore((s) => s.entries);
  const refreshEntries = useFinanceStore((s) => s.refreshEntries);
  const cashEntries = useMemo(() => entries.filter((e) => e.topCategory === "流動資金"), [entries]);

  const [mode, setMode] = useState<"amount" | "perShare">("amount");
  const [payDate, setPayDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [perShareStr, setPerShareStr] = useState("");
  const [sharesStr, setSharesStr] = useState(currentShares != null ? String(currentShares) : "");
  const [amountStr, setAmountStr] = useState("");
  const [bankEntryId, setBankEntryId] = useState<string | null>(null);
  const [recordIncome, setRecordIncome] = useState(true);
  const [note, setNote] = useState("");
  const [fxRate, setFxRate] = useState(1);
  const [fxLoading, setFxLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isTWD = subCategory === "台股";

  // Reset every time the sheet opens for a (possibly different) entry — this
  // component stays mounted between opens, only `open` toggles visibility.
  useEffect(() => {
    if (!open) return;
    setMode("amount");
    setPayDate(new Date().toISOString().slice(0, 10));
    setPerShareStr("");
    setSharesStr(currentShares != null ? String(currentShares) : "");
    setAmountStr("");
    setBankEntryId(null);
    setRecordIncome(true);
    setNote("");
    setError(null);
  }, [open, entryId, currentShares]);

  // Non-TWD holdings quote perShare in the stock's own currency; convert to
  // TWD before submitting (amount is always TWD server-side).
  useEffect(() => {
    if (!open || isTWD) {
      setFxRate(1);
      setFxLoading(false);
      return;
    }
    let active = true;
    setFxLoading(true);
    (async () => {
      try {
        const symbol = buildYfSymbol(subCategory, stockCode);
        if (!symbol) return;
        const quoteRes = await fetch(`/api/stocks/price?symbol=${encodeURIComponent(symbol)}`);
        const quote = await quoteRes.json();
        const currency = quote?.currency ?? "TWD";
        if (currency === "TWD") {
          if (active) setFxRate(1);
          return;
        }
        const fxRes = await fetch(
          `/api/stocks/price?symbol=${encodeURIComponent(`${currency}TWD=X`)}`
        );
        const fx = await fxRes.json();
        if (active && typeof fx?.price === "number" && fx.price > 0) setFxRate(fx.price);
      } catch {
        // 抓不到匯率就維持 1，並在畫面上提示使用者改用「依總金額」輸入 TWD。
      } finally {
        if (active) setFxLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [open, isTWD, subCategory, stockCode]);

  // 每股股利預填，抓不到就留空。
  useEffect(() => {
    if (!open || perShareStr !== "") return;
    let active = true;
    (async () => {
      try {
        const symbol = buildYfSymbol(subCategory, stockCode);
        if (!symbol) return;
        const res = await fetch(`/api/stocks/dividend?symbol=${encodeURIComponent(symbol)}`);
        const r = await res.json();
        if (active && typeof r?.dividendRate === "number") setPerShareStr(String(r.dividendRate));
      } catch {
        // 預填只是方便，失敗不影響手動輸入。
      }
    })();
    return () => {
      active = false;
    };
  }, [open, subCategory, stockCode, perShareStr]);

  const amountTWD = useMemo(() => {
    if (mode === "amount") return parseFloat(amountStr) || 0;
    const perShare = parseFloat(perShareStr) || 0;
    const shares = parseFloat(sharesStr) || 0;
    return perShare * shares * fxRate;
  }, [mode, amountStr, perShareStr, sharesStr, fxRate]);

  async function handleSubmit() {
    if (fxLoading) {
      setError("匯率讀取中，請稍候");
      return;
    }
    const roundedAmount = Math.round(amountTWD * 100) / 100;
    if (roundedAmount <= 0) {
      setError("請輸入大於 0 的股利金額");
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        entryId,
        payDate,
        amount: roundedAmount,
        recordIncome,
      };
      if (mode === "perShare" && parseFloat(perShareStr) > 0)
        body.perShare = parseFloat(perShareStr);
      if (mode === "perShare" && parseFloat(sharesStr) > 0) body.shares = parseFloat(sharesStr);
      if (note.trim()) body.note = note.trim();
      if (bankEntryId) body.bankEntryId = bankEntryId;

      const res = await fetch("/api/dividends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) {
        if (json.error?.code === "PREMIUM_REQUIRED") {
          promptMobileApp("股息紀錄是 Premium 功能，如果要使用該功能，請下載手機版本。");
          onClose();
          return;
        }
        throw new Error(json.error?.message ?? "儲存失敗，請重試");
      }
      // 入帳會改動 Entry.value，所以重抓一次讓詳情頁的金額同步。
      await refreshEntries();
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "儲存失敗，請稍後再試");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-[80] bg-black/40" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-[81] mx-auto flex max-h-[88vh] max-w-md flex-col rounded-t-2xl bg-white px-5 pt-4 pb-10 md:max-w-xl lg:max-w-2xl">
        <div className="mx-auto mb-4 h-1 w-10 shrink-0 rounded-full bg-[#e5e5ea]" />
        <p className="mb-5 shrink-0 text-center text-[16px] font-semibold text-[#1c1c1e]">
          新增股利 · {entryName}
        </p>

        <div className="overflow-y-auto">
          <div className="mb-4 flex rounded-[10px] bg-[#f2f2f7] p-[3px]">
            {(
              [
                { m: "amount" as const, label: "依總金額" },
                { m: "perShare" as const, label: "依每股股利" },
              ] as const
            ).map(({ m, label }) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  setError(null);
                }}
                className={`flex-1 rounded-lg py-2 text-[13px] font-semibold ${
                  mode === m ? "bg-white text-[#1c1c1e]" : "text-[#8e8e93]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <label className="mt-3 mb-1.5 block text-[13px] text-[#8e8e93]">發放日</label>
          <input
            type="date"
            value={payDate}
            onChange={(e) => {
              setPayDate(e.target.value);
              setError(null);
            }}
            className="w-full rounded-[10px] border border-[#e5e5ea] px-3 py-2.5 text-[15px] text-[#1c1c1e] outline-none"
          />

          {mode === "perShare" ? (
            <>
              <label className="mt-3 mb-1.5 block text-[13px] text-[#8e8e93]">
                每股股利{isTWD ? "（TWD）" : "（報價幣別）"}
              </label>
              <input
                type="number"
                value={perShareStr}
                onChange={(e) => {
                  setPerShareStr(e.target.value);
                  setError(null);
                }}
                placeholder="例如 4.5"
                className="w-full rounded-[10px] border border-[#e5e5ea] px-3 py-2.5 text-[15px] text-[#1c1c1e] outline-none"
              />
              <label className="mt-3 mb-1.5 block text-[13px] text-[#8e8e93]">股數</label>
              <input
                type="number"
                value={sharesStr}
                onChange={(e) => {
                  setSharesStr(e.target.value);
                  setError(null);
                }}
                placeholder="持股數"
                className="w-full rounded-[10px] border border-[#e5e5ea] px-3 py-2.5 text-[15px] text-[#1c1c1e] outline-none"
              />
            </>
          ) : (
            <>
              <label className="mt-3 mb-1.5 block text-[13px] text-[#8e8e93]">總金額（TWD）</label>
              <input
                type="number"
                value={amountStr}
                onChange={(e) => {
                  setAmountStr(e.target.value);
                  setError(null);
                }}
                placeholder="實收總額"
                className="w-full rounded-[10px] border border-[#e5e5ea] px-3 py-2.5 text-[15px] text-[#1c1c1e] outline-none"
              />
            </>
          )}

          <p className="mt-3.5 text-[14px] font-semibold text-[#66788E]">
            換算後入帳：NT$ {amountTWD.toLocaleString()}
          </p>
          {!isTWD && fxLoading && <p className="mt-1 text-[12px] text-[#8e8e93]">正在讀取匯率…</p>}

          <label className="mt-3 mb-1.5 block text-[13px] text-[#8e8e93]">入帳帳戶</label>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                setBankEntryId(null);
                setError(null);
              }}
              className={`rounded-2xl px-3 py-2 text-[13px] ${
                bankEntryId === null ? "bg-[#66788E] text-white" : "bg-[#f2f2f7] text-[#1c1c1e]"
              }`}
            >
              不記錄
            </button>
            {cashEntries.map((e) => (
              <button
                key={e.id}
                onClick={() => {
                  setBankEntryId(e.id);
                  setError(null);
                }}
                className={`rounded-2xl px-3 py-2 text-[13px] ${
                  bankEntryId === e.id ? "bg-[#66788E] text-white" : "bg-[#f2f2f7] text-[#1c1c1e]"
                }`}
              >
                {e.name}
              </button>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between">
            <p className="text-[13px] text-[#8e8e93]">同步記為收入</p>
            <button
              role="switch"
              aria-checked={recordIncome}
              onClick={() => {
                setRecordIncome((v) => !v);
                setError(null);
              }}
              className={`h-6 w-10 rounded-full transition-colors ${
                recordIncome ? "bg-[#374254]" : "bg-[#e5e5ea]"
              }`}
            >
              <span
                className={`block h-5 w-5 translate-y-0.5 rounded-full bg-white shadow transition-transform ${
                  recordIncome ? "translate-x-[18px]" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>

          <label className="mt-3 mb-1.5 block text-[13px] text-[#8e8e93]">備註</label>
          <input
            type="text"
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              setError(null);
            }}
            placeholder="選填"
            className="w-full rounded-[10px] border border-[#e5e5ea] px-3 py-2.5 text-[15px] text-[#1c1c1e] outline-none"
          />

          {error && <p className="mt-3 text-[13px] text-[#ff3b30]">{error}</p>}
        </div>

        <div className="mt-4 flex shrink-0 gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-full border border-[#e5e5ea] py-3 text-[15px] font-semibold text-[#1c1c1e] active:bg-[#f2f2f7]"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || fxLoading}
            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[#66788E] py-3 text-[15px] font-semibold text-white active:opacity-80 disabled:opacity-40"
          >
            {submitting && <Spinner size={14} />}
            {submitting ? "儲存中..." : fxLoading ? "匯率讀取中…" : "儲存"}
          </button>
        </div>
      </div>
    </>
  );
}
