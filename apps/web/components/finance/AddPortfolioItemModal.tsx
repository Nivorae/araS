"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Spinner } from "../ui/Spinner";
import { useFinanceStore } from "../../store/useFinanceStore";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function AddPortfolioItemModal({ open, onClose }: Props) {
  const { addPortfolioItem } = useFinanceStore();
  const [symbol, setSymbol] = useState("");
  const [name, setName] = useState("");
  const [avgCost, setAvgCost] = useState("");
  const [shares, setShares] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!symbol || !name || !avgCost || !shares) return;
    setSubmitting(true);
    await addPortfolioItem({
      symbol: symbol.toUpperCase(),
      name,
      avgCost: parseFloat(avgCost),
      shares: parseFloat(shares),
    });
    setSubmitting(false);
    setSymbol("");
    setName("");
    setAvgCost("");
    setShares("");
    onClose();
  };

  const fields: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    placeholder: string;
    type?: string;
    upper?: boolean;
  }[] = [
    {
      label: "股票/ETF 代號",
      value: symbol,
      onChange: setSymbol,
      placeholder: "例：0050.TW",
      upper: true,
    },
    { label: "名稱", value: name, onChange: setName, placeholder: "例：元大台灣50" },
    {
      label: "平均成本（每股）",
      value: avgCost,
      onChange: setAvgCost,
      placeholder: "0",
      type: "number",
    },
    { label: "持有股數", value: shares, onChange: setShares, placeholder: "0", type: "number" },
  ];

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/30 transition-opacity ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
      />
      <div
        className={`fixed right-0 bottom-0 left-0 z-50 rounded-t-3xl bg-white transition-transform duration-300 ${
          open ? "translate-y-0" : "pointer-events-none translate-y-full"
        }`}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-[#e5e5ea]" />
        </div>
        <div className="mx-auto max-w-md px-4 pt-2 pb-8">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-[17px] font-semibold text-[#1c1c1e]">新增投資標的</h2>
            <button
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-[#f2f2f7]"
            >
              <X size={14} className="text-[#8e8e93]" />
            </button>
          </div>

          {fields.map(({ label, value, onChange, placeholder, type, upper }) => (
            <div key={label} className="mb-3">
              <label className="mb-1.5 block text-xs font-medium text-[#8e8e93]">{label}</label>
              <input
                type={type ?? "text"}
                value={value}
                onChange={(e) => onChange(upper ? e.target.value.toUpperCase() : e.target.value)}
                placeholder={placeholder}
                className="w-full rounded-xl bg-[#f2f2f7] px-3 py-3 text-sm text-[#1c1c1e] outline-none placeholder:text-[#c7c7cc]"
              />
            </div>
          ))}

          <button
            onClick={handleSubmit}
            disabled={!symbol || !name || !avgCost || !shares || submitting}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#374254] py-3.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            {submitting && <Spinner size={14} />}
            {submitting ? "新增中..." : "新增"}
          </button>
        </div>
      </div>
    </>
  );
}
