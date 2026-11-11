"use client";

import { ChevronLeft } from "lucide-react";
import { BankLogo } from "../ui/BankLogo";

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
  { code: "line", name: "Line Bank" },
  { code: "ubot", name: "聯邦銀行" },
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
      <div className="mx-auto flex h-full max-w-md flex-col px-4 pt-12 md:max-w-xl lg:max-w-2xl">
        <div className="mb-5 flex items-center">
          <button
            onClick={onClose}
            aria-label="返回"
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-white shadow-sm"
          >
            <ChevronLeft size={20} className="text-[#1c1c1e]" />
          </button>
          <h1 className="ml-4 text-[20px] font-bold text-[#1c1c1e]">選擇銀行</h1>
        </div>

        {/* Each bank is its own white card (mobile BankPickerModal). */}
        <div className="min-h-0 flex-1 overflow-y-auto pb-10">
          <div className="grid grid-cols-4 gap-2.5 md:grid-cols-6">
            {BANKS.map((bank) => (
              <button
                key={bank.code}
                onClick={() => handleSelect(bank)}
                aria-pressed={selectedCode === bank.code}
                className={`flex cursor-pointer flex-col items-center gap-2 rounded-[14px] border-2 bg-white px-1 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.06)] active:opacity-70 ${
                  selectedCode === bank.code ? "border-[#374254]" : "border-transparent"
                }`}
              >
                <BankLogo code={bank.code} name={bank.name} size={40} />
                <span className="max-w-full truncate text-center text-[11px] leading-tight font-medium text-[#1c1c1e]">
                  {bank.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
