"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Calendar } from "lucide-react";
import { BottomSheet } from "./BottomSheet";
import { formatDisplayDate, parseISODate, toISODate } from "../../lib/date";

// Web port of apps/mobile/components/DatePickerModal.tsx: three scrolling
// columns (年 / 月 / 日), 44px rows, five visible, the selected value centred.

const YEAR_NOW = new Date().getFullYear();
const YEAR_MIN = 1950;
const YEARS = Array.from({ length: YEAR_NOW + 1 - YEAR_MIN + 1 }, (_, i) => YEAR_MIN + i);
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const ROW_H = 44;
const VISIBLE = 5;

function Column({
  items,
  value,
  onPick,
  label,
  open,
}: {
  items: number[];
  value: number;
  onPick: (v: number) => void;
  label: (v: number) => string;
  open: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Centre the selected row whenever the sheet opens.
  useLayoutEffect(() => {
    if (!open || !ref.current) return;
    const idx = Math.max(0, items.indexOf(value));
    ref.current.scrollTop = Math.max(0, (idx - Math.floor(VISIBLE / 2)) * ROW_H);
    // Only on open — re-centring on every pick would yank the list away.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  return (
    <div
      ref={ref}
      className="flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{ height: ROW_H * VISIBLE }}
    >
      {items.map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onPick(n)}
          className="flex w-full cursor-pointer items-center justify-center"
          style={{ height: ROW_H }}
        >
          <span
            className={
              n === value ? "text-[18px] font-bold text-[#1c1c1e]" : "text-[16px] text-[#8e8e93]"
            }
          >
            {label(n)}
          </span>
        </button>
      ))}
    </div>
  );
}

export function DatePickerSheet({
  open,
  value,
  onConfirm,
  onClose,
}: {
  open: boolean;
  /** "YYYY-MM-DD" (local). */
  value: string;
  onConfirm: (iso: string) => void;
  onClose: () => void;
}) {
  const initial = parseISODate(value);
  const [y, setY] = useState(initial.getFullYear());
  const [m, setM] = useState(initial.getMonth() + 1);
  const [d, setD] = useState(initial.getDate());

  useEffect(() => {
    if (!open) return;
    const date = parseISODate(value);
    setY(date.getFullYear());
    setM(date.getMonth() + 1);
    setD(date.getDate());
  }, [open, value]);

  const daysInMonth = new Date(y, m, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const clampedDay = Math.min(d, daysInMonth);

  return (
    <BottomSheet open={open} onClose={onClose} label="選擇日期" panelClassName="pb-6">
      <div className="flex items-center justify-between border-b border-[#e5e5ea] px-4 py-3">
        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer text-[16px] text-[#8e8e93]"
        >
          取消
        </button>
        <p className="text-[15px] font-semibold text-[#1c1c1e]">選擇日期</p>
        <button
          type="button"
          onClick={() => {
            onConfirm(toISODate(new Date(y, m - 1, clampedDay)));
            onClose();
          }}
          className="cursor-pointer text-[16px] font-semibold text-[#374254]"
        >
          完成
        </button>
      </div>
      <div className="flex">
        <Column items={YEARS} value={y} onPick={setY} label={(n) => `${n}年`} open={open} />
        <Column
          items={MONTHS}
          value={m}
          onPick={setM}
          label={(n) => `${String(n).padStart(2, "0")}月`}
          open={open}
        />
        <Column
          items={days}
          value={clampedDay}
          onPick={setD}
          label={(n) => `${String(n).padStart(2, "0")}日`}
          open={open}
        />
      </div>
    </BottomSheet>
  );
}

/**
 * A form row value that shows "YYYY/MM/DD" + calendar icon and opens the
 * picker sheet — what every mobile date field looks like.
 */
export function DateField({
  value,
  onChange,
  className = "",
  color = "#1c1c1e",
  disabled = false,
  ariaLabel = "選擇日期",
}: {
  value: string;
  onChange: (iso: string) => void;
  className?: string;
  color?: string;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        onClick={() => setOpen(true)}
        className={`flex cursor-pointer items-center gap-1.5 text-[15px] disabled:cursor-default disabled:opacity-60 ${className}`}
        style={{ color: value ? color : "#c7c7cc" }}
      >
        {formatDisplayDate(value)}
        <Calendar size={16} className="text-[#8e8e93]" />
      </button>
      <DatePickerSheet
        open={open}
        value={value}
        onConfirm={onChange}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
