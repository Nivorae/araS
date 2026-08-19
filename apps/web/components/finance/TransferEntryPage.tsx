"use client";

import { useMemo, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { Spinner } from "../ui/Spinner";
import type { Entry } from "@repo/shared";
import { TRANSFER_TOP_CATEGORIES } from "@repo/shared";
import { useFinanceStore } from "../../store/useFinanceStore";
import { formatCurrency, formatThousands, toIntegerDigits } from "../../lib/format";

interface Props {
  open: boolean;
  entry: Entry | null;
  onClose: () => void;
  onDone: () => void;
}

export function TransferEntryPage({ open, entry, onClose, onDone }: Props) {
  const { entries, transferEntry } = useFinanceStore();

  const candidateGroups = useMemo(() => {
    if (!entry) return [];
    const map = new Map<string, Entry[]>();
    for (const e of entries) {
      if (e.id === entry.id || !TRANSFER_TOP_CATEGORIES.includes(e.topCategory)) continue;
      const list = map.get(e.topCategory);
      if (list) list.push(e);
      else map.set(e.topCategory, [e]);
    }
    return TRANSFER_TOP_CATEGORIES.map((topCategory) => ({
      topCategory,
      items: map.get(topCategory) ?? [],
    })).filter((g) => g.items.length > 0);
  }, [entries, entry]);

  const [toEntryId, setToEntryId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [fee, setFee] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0] ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toEntry = useMemo(
    () => candidateGroups.flatMap((g) => g.items).find((e) => e.id === toEntryId) ?? null,
    [candidateGroups, toEntryId]
  );
  const amountValue = parseInt(amount, 10);
  const canSubmit = !!toEntryId && !isNaN(amountValue) && amountValue > 0 && !submitting;

  function reset() {
    setToEntryId(null);
    setAmount("");
    setFee("");
    setNote("");
    setDate(new Date().toISOString().split("T")[0] ?? "");
    setError(null);
  }

  async function handleSubmit() {
    if (!entry || !toEntryId || !canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await transferEntry({
        fromEntryId: entry.id,
        toEntryId,
        amount: amountValue,
        ...(fee ? { fee: parseInt(fee, 10) } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
        createdAt: date,
      });
      reset();
      onDone();
    } catch (e) {
      const code = e instanceof Error ? (e as Error & { code?: string }).code : undefined;
      if (code === "INSUFFICIENT_BALANCE") {
        window.alert("餘額不足：來源項目的餘額不夠支付這筆轉帳（含手續費）。");
      } else {
        window.alert("轉帳失敗，請重試");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (!entry) return null;

  return (
    <div
      className={`fixed inset-0 z-[70] bg-[#f2f2f7] transition-transform duration-300 ease-in-out ${
        open ? "translate-x-0" : "pointer-events-none translate-x-full"
      }`}
    >
      <div className="mx-auto flex h-full max-w-md flex-col md:max-w-xl lg:max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-14 pb-4">
          <button
            onClick={() => {
              reset();
              onClose();
            }}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm"
          >
            <ChevronLeft size={20} className="text-[#1c1c1e]" />
          </button>
          <p className="text-[16px] font-semibold text-[#1c1c1e]">轉帳</p>
          <div className="h-10 w-10" />
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-8">
          <p className="mt-1 mb-2 ml-1 text-[13px] font-semibold text-[#8e8e93]">來源</p>
          <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
            <div className="flex items-center justify-between px-4 py-3.5">
              <p className="text-[15px] text-[#1c1c1e]">{entry.name}</p>
              <p className="text-[15px] font-semibold text-[#1c1c1e]">
                {formatCurrency(entry.value)}
              </p>
            </div>
          </div>

          <p className="mt-5 mb-2 ml-1 text-[13px] font-semibold text-[#8e8e93]">金額</p>
          <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
            <div className="flex items-center justify-between px-4 py-3.5">
              <p className="text-[15px] text-[#1c1c1e]">轉帳金額</p>
              <input
                type="text"
                inputMode="numeric"
                value={formatThousands(amount)}
                onChange={(e) => setAmount(toIntegerDigits(e.target.value))}
                placeholder="0"
                className="ml-4 min-w-0 flex-1 bg-transparent text-right text-[15px] text-[#1c1c1e] outline-none placeholder:text-[#c7c7cc]"
              />
            </div>
            <div className="mx-4 h-px bg-[#f2f2f7]" />
            <div className="flex items-center justify-between px-4 py-3.5">
              <p className="text-[15px] text-[#1c1c1e]">手續費（選填）</p>
              <input
                type="text"
                inputMode="numeric"
                value={formatThousands(fee)}
                onChange={(e) => setFee(toIntegerDigits(e.target.value))}
                placeholder="0"
                className="ml-4 min-w-0 flex-1 bg-transparent text-right text-[15px] text-[#1c1c1e] outline-none placeholder:text-[#c7c7cc]"
              />
            </div>
            <div className="mx-4 h-px bg-[#f2f2f7]" />
            <div className="flex items-center justify-between px-4 py-3.5">
              <p className="text-[15px] text-[#1c1c1e]">日期</p>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="bg-transparent text-right text-[15px] text-[#1c1c1e] outline-none"
              />
            </div>
            <div className="mx-4 h-px bg-[#f2f2f7]" />
            <div className="flex items-center justify-between px-4 py-3.5">
              <p className="text-[15px] text-[#1c1c1e]">備註</p>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, 200))}
                placeholder="選填"
                maxLength={200}
                className="ml-4 min-w-0 flex-1 bg-transparent text-right text-[15px] text-[#1c1c1e] outline-none placeholder:text-[#c7c7cc]"
              />
            </div>
          </div>

          <p className="mt-5 mb-2 ml-1 text-[13px] font-semibold text-[#8e8e93]">轉入項目</p>
          {candidateGroups.length === 0 ? (
            <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
              <p className="py-8 text-center text-sm text-[#c7c7cc]">沒有可轉入的項目</p>
            </div>
          ) : (
            candidateGroups.map((group) => (
              <div key={group.topCategory} className="mb-4">
                <p className="mb-1.5 ml-1 text-[12px] font-semibold text-[#8e8e93]">
                  {group.topCategory}
                </p>
                <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
                  {group.items.map((c, i) => {
                    const selected = toEntryId === c.id;
                    return (
                      <div key={c.id}>
                        {i > 0 && (
                          <div
                            className={`mx-4 h-px ${selected ? "bg-[#3a3a3c]" : "bg-[#f2f2f7]"}`}
                          />
                        )}
                        <button
                          onClick={() => setToEntryId(c.id)}
                          className={`flex w-full items-center justify-between px-4 py-3.5 text-left ${
                            selected ? "bg-[#1c1c1e]" : ""
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <p
                              className={`truncate text-[15px] ${selected ? "text-white" : "text-[#1c1c1e]"}`}
                            >
                              {c.name}
                            </p>
                            <p
                              className={`mt-0.5 text-[12px] ${selected ? "text-[#c7c7cc]" : "text-[#8e8e93]"}`}
                            >
                              {c.subCategory}
                            </p>
                          </div>
                          <p
                            className={`ml-3 shrink-0 text-[15px] font-semibold ${
                              selected ? "text-white" : "text-[#1c1c1e]"
                            }`}
                          >
                            {formatCurrency(c.value)}
                          </p>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}

          {toEntry && !isNaN(amountValue) && amountValue > 0 && (
            <p className="mt-4 text-center text-[13px] text-[#8e8e93]">
              {entry.name} 轉出 {formatCurrency(amountValue + (parseInt(fee, 10) || 0))}
              {"　→　"}
              {toEntry.name} 收到 {formatCurrency(amountValue)}
            </p>
          )}

          {error && <p className="mt-3 text-center text-[13px] text-[#ff3b30]">{error}</p>}
        </div>

        <div className="px-4 pt-3 pb-8">
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-[#1c1c1e] py-3.5 text-[15px] font-semibold text-white active:opacity-80 disabled:opacity-40"
          >
            {submitting && <Spinner size={14} />}
            {submitting ? "處理中..." : "確認轉帳"}
          </button>
        </div>
      </div>
    </div>
  );
}
