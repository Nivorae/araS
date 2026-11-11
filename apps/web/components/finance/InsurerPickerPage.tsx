"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, Search } from "lucide-react";
import { INSURER_LIST } from "@repo/shared";
import { InsurerLogo } from "../ui/InsurerLogo";

// Web port of apps/mobile/components/InsurerPickerModal.tsx: full-screen list
// with a search box, each insurer with its logo, and a trailing
// 「其他（自行填寫）」 that switches the form to free text.

export function InsurerPickerPage({
  open,
  selected,
  onClose,
  onSelect,
  onOther,
}: {
  open: boolean;
  selected: string;
  onClose: () => void;
  onSelect: (name: string) => void;
  onOther: () => void;
}) {
  const [query, setQuery] = useState("");
  useEffect(() => {
    if (open) setQuery("");
  }, [open]);

  const list = useMemo(() => {
    const q = query.trim();
    return q ? INSURER_LIST.filter((n) => n.includes(q)) : INSURER_LIST;
  }, [query]);

  return (
    <div
      className={`fixed inset-0 z-[90] bg-[#f2f2f7] transition-transform duration-300 ease-in-out ${
        open ? "translate-x-0" : "pointer-events-none translate-x-full"
      }`}
      aria-hidden={!open}
    >
      <div className="mx-auto flex h-full max-w-md flex-col px-4 pt-12 md:max-w-xl lg:max-w-2xl">
        <div className="mb-4 flex items-center gap-3">
          <button
            onClick={onClose}
            aria-label="返回"
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-[#e5e5ea]/70"
          >
            <ChevronLeft size={20} className="text-[#1c1c1e]" />
          </button>
          <p className="text-[18px] font-bold text-[#1c1c1e]">選擇保險公司</p>
        </div>

        <div className="mb-3 flex items-center gap-2 rounded-xl bg-white px-3 py-2.5 shadow-sm">
          <Search size={16} className="text-[#8e8e93]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜尋保險公司"
            aria-label="搜尋保險公司"
            className="min-w-0 flex-1 bg-transparent text-[15px] text-[#1c1c1e] outline-none placeholder:text-[#c7c7cc]"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pb-10">
          {/* Rendered only while open, so a closed picker loads no logos. */}
          {open && (
            <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
              {list.map((name, i) => (
                <button
                  key={name}
                  onClick={() => {
                    onSelect(name);
                    onClose();
                  }}
                  className={`flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left active:bg-[#f2f2f7] ${
                    i > 0 ? "border-t border-[#f2f2f7]" : ""
                  }`}
                >
                  <InsurerLogo name={name} size={28} />
                  <span
                    className={`text-[15px] ${
                      name === selected ? "font-bold text-[#374254]" : "text-[#1c1c1e]"
                    }`}
                  >
                    {name}
                  </span>
                </button>
              ))}
              <button
                onClick={() => {
                  onOther();
                  onClose();
                }}
                className="flex w-full cursor-pointer items-center border-t border-[#f2f2f7] px-4 py-3.5 text-left active:bg-[#f2f2f7]"
              >
                <span className="text-[15px] font-semibold text-[#374254]">其他（自行填寫）</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Full-screen 「選擇保障項目」 list (mobile CoverageItemPicker): tap adds and closes. */
export function CoveragePickerPage({
  open,
  options,
  onClose,
  onPick,
}: {
  open: boolean;
  options: { key: string; label: string }[];
  onClose: () => void;
  onPick: (key: string) => void;
}) {
  return (
    <div
      className={`fixed inset-0 z-[90] bg-[#f2f2f7] transition-transform duration-300 ease-in-out ${
        open ? "translate-x-0" : "pointer-events-none translate-x-full"
      }`}
      aria-hidden={!open}
    >
      <div className="mx-auto flex h-full max-w-md flex-col px-4 pt-12 md:max-w-xl lg:max-w-2xl">
        <div className="mb-4 flex items-center gap-3">
          <button
            onClick={onClose}
            aria-label="返回"
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-[#e5e5ea]/70"
          >
            <ChevronLeft size={20} className="text-[#1c1c1e]" />
          </button>
          <p className="text-[18px] font-bold text-[#1c1c1e]">選擇保障項目</p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pb-10">
          {options.length === 0 ? (
            <p className="py-10 text-center text-[14px] text-[#8e8e93]">已選滿保障項目</p>
          ) : (
            <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
              {options.map((o, i) => (
                <button
                  key={o.key}
                  onClick={() => {
                    onPick(o.key);
                    onClose();
                  }}
                  className={`flex w-full cursor-pointer px-4 py-3.5 text-left text-[15px] text-[#1c1c1e] active:bg-[#f2f2f7] ${
                    i > 0 ? "border-t border-[#f2f2f7]" : ""
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
