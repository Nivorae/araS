"use client";

import { useState, useEffect } from "react";
import { ChevronLeft } from "lucide-react";
import type { Insurance } from "@repo/shared";

interface Props {
  open: boolean;
  insurance: Insurance;
  onClose: () => void;
  onSaved: () => void;
}

export function PolicyUpdateForm({ open, insurance, onClose, onSaved }: Props) {
  const [surrenderValue, setSurrenderValue] = useState(
    insurance.surrenderValue !== 0 ? String(insurance.surrenderValue) : ""
  );
  const [accumulatedBonus, setAccumulatedBonus] = useState(
    insurance.accumulatedBonus !== 0 ? String(insurance.accumulatedBonus) : ""
  );
  const [accumulatedSumIncrease, setAccumulatedSumIncrease] = useState(
    insurance.accumulatedSumIncrease !== 0 ? String(insurance.accumulatedSumIncrease) : ""
  );
  const [premiumTotal, setPremiumTotal] = useState(
    insurance.premiumTotal != null ? String(insurance.premiumTotal) : ""
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSurrenderValue(insurance.surrenderValue !== 0 ? String(insurance.surrenderValue) : "");
    setAccumulatedBonus(insurance.accumulatedBonus !== 0 ? String(insurance.accumulatedBonus) : "");
    setAccumulatedSumIncrease(
      insurance.accumulatedSumIncrease !== 0 ? String(insurance.accumulatedSumIncrease) : ""
    );
    setPremiumTotal(insurance.premiumTotal != null ? String(insurance.premiumTotal) : "");
    setError(null);
  }, [open, insurance.id]);

  const handleSubmit = async () => {
    const sv = parseFloat(surrenderValue);
    const ab = parseFloat(accumulatedBonus);
    const asi = parseFloat(accumulatedSumIncrease);
    if (isNaN(sv) || isNaN(ab) || isNaN(asi)) {
      setError("請填寫所有欄位");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, number> = {
        surrenderValue: sv,
        accumulatedBonus: ab,
        accumulatedSumIncrease: asi,
      };
      if (premiumTotal !== "") {
        const pt = parseFloat(premiumTotal);
        if (isNaN(pt) || pt <= 0) {
          setError("保費總額必須大於 0");
          setSaving(false);
          return;
        }
        body.premiumTotal = pt;
      }
      const res = await fetch(`/api/insurance/${insurance.id}/values`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("更新失敗");
      onSaved();
    } catch {
      setError("儲存失敗，請稍後再試");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className={`fixed inset-0 z-[90] flex flex-col bg-[#f2f2f7] transition-transform duration-300 ease-in-out ${
        open ? "translate-x-0" : "pointer-events-none translate-x-full"
      }`}
    >
      {/* Header */}
      <div className="mx-auto w-full max-w-md shrink-0 px-4 pt-14 pb-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-sm"
          >
            <ChevronLeft size={20} className="text-[#1c1c1e]" />
          </button>
          <div>
            <h1 className="text-[20px] font-bold text-[#1c1c1e]">更新保單數值</h1>
            <p className="text-[12px] text-[#8e8e93]">手動輸入最新保單記錄</p>
          </div>
        </div>
      </div>

      {/* Fields */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-md space-y-3 px-4 pb-12">
          <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
            {[
              {
                label: "解約金 (USD)",
                value: surrenderValue,
                onChange: setSurrenderValue,
                placeholder: "0.00",
              },
              {
                label: "累計增值回饋分享金 (USD)",
                value: accumulatedBonus,
                onChange: setAccumulatedBonus,
                placeholder: "0.00",
              },
              {
                label: "累計增加保險金額 (USD)",
                value: accumulatedSumIncrease,
                onChange: setAccumulatedSumIncrease,
                placeholder: "0.00",
              },
              {
                label: "保費總額 (USD) — 選填",
                value: premiumTotal,
                onChange: setPremiumTotal,
                placeholder: "尚未填寫",
              },
            ].map(({ label, value, onChange, placeholder }, i, arr) => (
              <div
                key={label}
                className={`px-5 py-4 ${i < arr.length - 1 ? "border-b border-[#f2f2f7]" : ""}`}
              >
                <p className="mb-1 text-[12px] text-[#8e8e93]">{label}</p>
                <input
                  type="number"
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  placeholder={placeholder}
                  step="0.01"
                  min={0}
                  className="w-full bg-transparent text-[20px] font-bold text-[#1c1c1e] outline-none placeholder:text-[#c7c7cc]"
                />
              </div>
            ))}
          </div>

          {error && <p className="text-center text-[13px] text-[#ff3b30]">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={saving}
            className="w-full rounded-2xl bg-[#374254] py-4 text-[16px] font-semibold text-white shadow-sm active:opacity-80 disabled:opacity-50"
          >
            {saving ? "儲存中..." : "儲存"}
          </button>
        </div>
      </div>
    </div>
  );
}
