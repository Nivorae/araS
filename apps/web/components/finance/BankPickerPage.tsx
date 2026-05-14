"use client";

import { ChevronLeft } from "lucide-react";

export interface BankItem {
  code: string;
  name: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (bank: BankItem) => void;
  selectedCode?: string | null;
}

export const BANKS: BankItem[] = [
  { code: "bot", name: "台灣銀行" },
  { code: "ctbc", name: "中國信託" },
  { code: "cathay", name: "國泰世華" },
  { code: "esun", name: "玉山銀行" },
  { code: "fubon", name: "台北富邦" },
  { code: "mega", name: "兆豐銀行" },
  { code: "tcb", name: "合作金庫" },
  { code: "firstbank", name: "第一銀行" },
  { code: "hana", name: "華南銀行" },
  { code: "chb", name: "彰化銀行" },
  { code: "landbank", name: "台灣土地銀行" },
  { code: "sinopac", name: "永豐銀行" },
  { code: "taishin", name: "台新銀行" },
  { code: "post", name: "中華郵政" },
  { code: "hsbc", name: "匯豐銀行" },
  { code: "dbs", name: "星展銀行" },
];

export function BankPickerPage({ open, onClose, onSelect, selectedCode }: Props) {
  const handleSelect = (bank: BankItem) => {
    onSelect(bank);
    onClose();
  };

  return (
    <div
      className={`fixed inset-0 z-[80] bg-[#f2f2f7] transition-transform duration-300 ease-in-out ${
        open ? "translate-x-0" : "pointer-events-none translate-x-full"
      }`}
    >
      <div className="mx-auto max-w-md px-4 pt-14">
        <div className="mb-6 flex items-center">
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm"
          >
            <ChevronLeft size={20} className="text-[#1c1c1e]" />
          </button>
          <h1 className="ml-4 text-[20px] font-bold text-[#1c1c1e]">選擇 Icon</h1>
        </div>

        <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
          <div className="grid grid-cols-5 gap-3 p-4">
            {BANKS.map((bank) => (
              <button
                key={bank.code}
                onClick={() => handleSelect(bank)}
                className={`flex items-center justify-center rounded-xl p-1.5 transition-all active:bg-[#f2f2f7] ${
                  selectedCode === bank.code
                    ? "outline outline-2 outline-offset-1 outline-[#374254]"
                    : ""
                }`}
              >
                <div className="relative h-11 w-11">
                  <img
                    src={`/banks/${bank.code}.svg`}
                    alt={bank.name}
                    className="h-full w-full rounded-xl object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                      const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
                      if (fallback) fallback.style.display = "flex";
                    }}
                  />
                  <div
                    className="absolute inset-0 flex items-center justify-center rounded-xl bg-[#e5e5ea] text-[11px] font-bold text-[#636366]"
                    style={{ display: "none" }}
                  >
                    {bank.name[0]}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
