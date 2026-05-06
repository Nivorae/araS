"use client";

import { Building2, CreditCard } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onAddAsset: () => void;
  onAddLiability: () => void;
}

export function AddItemActionSheet({ open, onClose, onAddAsset, onAddLiability }: Props) {
  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/30 transition-opacity ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
      />
      <div
        className={`fixed right-0 bottom-0 left-0 z-50 transition-transform duration-300 ${
          open ? "translate-y-0" : "pointer-events-none translate-y-full"
        }`}
      >
        <div className="mx-auto max-w-md space-y-2 px-4 pb-16">
          <div className="overflow-hidden rounded-2xl bg-white">
            <button
              onClick={() => {
                onClose();
                onAddAsset();
              }}
              className="flex w-full items-center gap-3 border-b border-[#f2f2f7] px-5 py-4 transition-colors active:bg-[#f2f2f7]"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0e1424]/15">
                <Building2 size={16} className="text-[#0e1424]" />
              </div>
              <div className="text-left">
                <p className="text-[15px] font-medium text-[#1c1c1e]">新增資產</p>
                <p className="text-[12px] text-[#8e8e93]">現金、投資、房產等</p>
              </div>
            </button>
            <button
              onClick={() => {
                onClose();
                onAddLiability();
              }}
              className="flex w-full items-center gap-3 px-5 py-4 transition-colors active:bg-[#f2f2f7]"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#ff3b30]/10">
                <CreditCard size={16} className="text-[#ff3b30]" />
              </div>
              <div className="text-left">
                <p className="text-[15px] font-medium text-[#1c1c1e]">新增負債</p>
                <p className="text-[12px] text-[#8e8e93]">房貸、信用卡、貸款等</p>
              </div>
            </button>
          </div>
          <button
            onClick={onClose}
            className="w-full rounded-2xl bg-white py-4 text-[17px] font-semibold text-[#374254] transition-colors active:bg-[#f2f2f7]"
          >
            取消
          </button>
        </div>
      </div>
    </>
  );
}
