"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, Check } from "lucide-react";
import { Spinner } from "../ui/Spinner";
import { useFinanceStore } from "../../store/useFinanceStore";
import type { Recurrence } from "@repo/shared";

type RecurrenceFreq = "MONTHLY" | "WEEKLY" | "BIWEEKLY" | "YEARLY";
type TxType = "income" | "expense";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  entryId: string;
  color: string;
  subCategoryName: string;
  editItem?: Recurrence | null;
}

const FREQ_OPTIONS: { value: RecurrenceFreq; label: string }[] = [
  { value: "MONTHLY", label: "每月" },
  { value: "WEEKLY", label: "每週" },
  { value: "BIWEEKLY", label: "每兩週" },
  { value: "YEARLY", label: "每年" },
];

const DAY_OF_WEEK_OPTIONS = ["日", "一", "二", "三", "四", "五", "六"];

const MONTH_OPTIONS = [
  "1月",
  "2月",
  "3月",
  "4月",
  "5月",
  "6月",
  "7月",
  "8月",
  "9月",
  "10月",
  "11月",
  "12月",
];

// Returns a visually safe selected-button bg: falls back to dark if the color is too light
function resolvedSelectedBg(hex: string): string {
  if (!hex.startsWith("#") || hex.length < 7) return "#374254";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? "#374254" : hex;
}

export function RecurrenceFormPage({
  open,
  onClose,
  onSaved,
  entryId,
  color,
  subCategoryName,
  editItem,
}: Props) {
  const { addRecurrence, updateRecurrence } = useFinanceStore();

  const [type, setType] = useState<TxType>("expense");
  const [amountStr, setAmountStr] = useState("");
  const [category, setCategory] = useState(subCategoryName);
  const [frequency, setFrequency] = useState<RecurrenceFreq>("MONTHLY");
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [monthOfYear, setMonthOfYear] = useState(1);
  const [yearDay, setYearDay] = useState(1);
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split("T")[0] ?? "");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (editItem) {
      setType(editItem.type as TxType);
      setAmountStr(String(editItem.amount));
      setCategory(editItem.category);
      setFrequency(editItem.frequency as RecurrenceFreq);
      setDayOfMonth(editItem.dayOfMonth ?? 1);
      setDayOfWeek(editItem.dayOfWeek ?? 1);
      setMonthOfYear(editItem.monthOfYear ?? 1);
      setYearDay(editItem.dayOfMonth ?? 1);
      setStartDate(editItem.startDate.split("T")[0] ?? "");
      setNote(editItem.note ?? "");
    } else {
      setType("expense");
      setAmountStr("");
      setCategory(subCategoryName);
      setFrequency("MONTHLY");
      setDayOfMonth(1);
      setDayOfWeek(1);
      setMonthOfYear(1);
      setYearDay(1);
      setStartDate(new Date().toISOString().split("T")[0] ?? "");
      setNote("");
    }
    setError(null);
  }, [open, editItem, subCategoryName]);

  const handleSubmit = async () => {
    const amount = parseFloat(amountStr);
    if (!amountStr || isNaN(amount) || amount <= 0) {
      setError("請輸入有效金額");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const payload = {
        entryId,
        type,
        amount,
        category: category.trim() || subCategoryName,
        source: "daily" as const,
        note: note.trim() || undefined,
        frequency,
        dayOfMonth:
          frequency === "MONTHLY" ? dayOfMonth : frequency === "YEARLY" ? yearDay : undefined,
        dayOfWeek: frequency === "WEEKLY" || frequency === "BIWEEKLY" ? dayOfWeek : undefined,
        monthOfYear: frequency === "YEARLY" ? monthOfYear : undefined,
        startDate,
      };
      if (editItem) {
        await updateRecurrence(editItem.id, {
          type: payload.type,
          amount: payload.amount,
          category: payload.category,
          source: payload.source,
          note: payload.note,
          frequency: payload.frequency,
          dayOfMonth: payload.dayOfMonth,
          dayOfWeek: payload.dayOfWeek,
          monthOfYear: payload.monthOfYear,
          startDate: payload.startDate,
        });
      } else {
        await addRecurrence(payload);
      }
      onSaved();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "";
      if (e instanceof TypeError) {
        setError("無法連線，請檢查網路連線後再試");
      } else if (msg === "Authentication required") {
        setError("登入逾時，請重新登入後再試");
      } else if (msg === "Recurrence not found") {
        setError("找不到此定期項目，可能已被刪除");
      } else if (msg === "Invalid request data") {
        setError("資料格式有誤，請確認輸入內容");
      } else if (msg === "Internal server error") {
        setError("伺服器發生錯誤，請稍後再試");
      } else {
        setError("儲存失敗，請再試一次");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className={`fixed inset-0 z-[90] flex flex-col bg-[#f2f2f7] transition-transform duration-300 ease-in-out ${
        open ? "translate-x-0" : "pointer-events-none translate-x-full"
      }`}
    >
      <div className="mx-auto w-full max-w-md px-4 pt-14">
        {/* Nav */}
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm"
          >
            <ChevronLeft size={20} className="text-[#1c1c1e]" />
          </button>
          <p className="text-[18px] font-bold text-[#1c1c1e]">
            {editItem ? "編輯定期項目" : "新增定期項目"}
          </p>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm disabled:opacity-40"
          >
            {submitting ? (
              <span style={{ color }}>
                <Spinner size={20} />
              </span>
            ) : (
              <Check size={20} className="text-[#1c1c1e]" strokeWidth={2.5} />
            )}
          </button>
        </div>

        <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
          {/* Type */}
          <div className="px-4 py-3">
            <div className="flex rounded-full bg-[#f2f2f7] p-1">
              {(["expense", "income"] as TxType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className="flex-1 rounded-full py-2 text-[14px] font-semibold transition-colors"
                  style={{
                    backgroundColor: type === t ? resolvedSelectedBg(color) : "transparent",
                    color: type === t ? "white" : "#8e8e93",
                  }}
                >
                  {t === "expense" ? "支出" : "收入"}
                </button>
              ))}
            </div>
          </div>

          <div className="mx-5 h-px bg-[#f2f2f7]" />

          {/* Amount */}
          <div className="flex items-center justify-between px-5 py-4">
            <p className="text-[16px] font-medium text-[#1c1c1e]">金額</p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={amountStr}
                onChange={(e) => {
                  setAmountStr(e.target.value);
                  setError(null);
                }}
                placeholder="0"
                className="w-28 bg-transparent text-right text-[20px] font-semibold text-[#1c1c1e] outline-none placeholder:text-[#c7c7cc]"
              />
              <span className="rounded-full bg-[#1c1c1e] px-2.5 py-1 text-[11px] font-bold text-white">
                TWD
              </span>
            </div>
          </div>

          <div className="mx-5 h-px bg-[#f2f2f7]" />

          {/* Category */}
          <div className="flex items-center justify-between px-5 py-4">
            <p className="shrink-0 text-[16px] font-medium text-[#1c1c1e]">類別</p>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder={subCategoryName}
              className="ml-4 min-w-0 flex-1 bg-transparent text-right text-[14px] text-[#8e8e93] outline-none placeholder:text-[#c7c7cc]"
            />
          </div>

          <div className="mx-5 h-px bg-[#f2f2f7]" />

          {/* Frequency */}
          <div className="px-5 py-4">
            <p className="mb-3 text-[16px] font-medium text-[#1c1c1e]">頻率</p>
            <div className="flex gap-2">
              {FREQ_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setFrequency(opt.value)}
                  className="flex-1 rounded-full py-2 text-[13px] font-semibold transition-colors"
                  style={{
                    backgroundColor:
                      frequency === opt.value ? resolvedSelectedBg(color) : "#f2f2f7",
                    color: frequency === opt.value ? "white" : "#8e8e93",
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mx-5 h-px bg-[#f2f2f7]" />

          {/* Timing — MONTHLY */}
          {frequency === "MONTHLY" && (
            <div className="flex items-center justify-between px-5 py-4">
              <p className="text-[16px] font-medium text-[#1c1c1e]">每月第幾號</p>
              <select
                value={dayOfMonth}
                onChange={(e) => setDayOfMonth(Number(e.target.value))}
                className="bg-transparent text-[15px] font-semibold text-[#1c1c1e] outline-none"
              >
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    {d} 號
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Timing — WEEKLY / BIWEEKLY */}
          {(frequency === "WEEKLY" || frequency === "BIWEEKLY") && (
            <div className="px-5 py-4">
              <p className="mb-3 text-[16px] font-medium text-[#1c1c1e]">星期幾</p>
              <div className="flex gap-1.5">
                {DAY_OF_WEEK_OPTIONS.map((label, idx) => (
                  <button
                    key={idx}
                    onClick={() => setDayOfWeek(idx)}
                    className="flex-1 rounded-full py-2 text-[13px] font-semibold transition-colors"
                    style={{
                      backgroundColor: dayOfWeek === idx ? resolvedSelectedBg(color) : "#f2f2f7",
                      color: dayOfWeek === idx ? "white" : "#8e8e93",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Timing — YEARLY */}
          {frequency === "YEARLY" && (
            <div className="flex items-center justify-between px-5 py-4">
              <p className="text-[16px] font-medium text-[#1c1c1e]">每年幾月幾號</p>
              <div className="flex items-center gap-2">
                <select
                  value={monthOfYear}
                  onChange={(e) => setMonthOfYear(Number(e.target.value))}
                  className="bg-transparent text-[15px] font-semibold text-[#1c1c1e] outline-none"
                >
                  {MONTH_OPTIONS.map((label, idx) => (
                    <option key={idx + 1} value={idx + 1}>
                      {label}
                    </option>
                  ))}
                </select>
                <select
                  value={yearDay}
                  onChange={(e) => setYearDay(Number(e.target.value))}
                  className="bg-transparent text-[15px] font-semibold text-[#1c1c1e] outline-none"
                >
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>
                      {d} 號
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="mx-5 h-px bg-[#f2f2f7]" />

          {/* Start date */}
          <div className="flex items-center justify-between px-5 py-4">
            <p className="shrink-0 text-[16px] font-medium text-[#1c1c1e]">開始日期</p>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent text-right text-[14px] text-[#8e8e93] outline-none"
            />
          </div>

          <div className="mx-5 h-px bg-[#f2f2f7]" />

          {/* Note */}
          <div className="px-5 py-4">
            <p className="mb-2 text-[16px] font-medium text-[#1c1c1e]">備註</p>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="選填"
              className="w-full bg-transparent text-[14px] text-[#8e8e93] outline-none placeholder:text-[#c7c7cc]"
            />
          </div>
        </div>

        {error && <p className="mt-3 text-center text-[13px] text-[#ff3b30]">{error}</p>}
      </div>
    </div>
  );
}
