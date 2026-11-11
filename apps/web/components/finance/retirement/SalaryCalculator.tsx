"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { ChevronRight } from "lucide-react";
import {
  PASSIVE_INCOME_STORAGE_KEY,
  SALARY_STORAGE_KEY,
  fmtNtd,
  monthlyIncomeTotal,
  salaryRules,
  sanitizeAmountInput,
  withThousands,
  type SalaryRule,
} from "../../../lib/retirement";
import { getAccountItem, setAccountItem } from "../../../lib/accountStorage";
import { FitText } from "../../ui/FitText";
import { InfoModal } from "./InfoModal";

// Web port of apps/mobile/components/retirement/SalaryCalculator.tsx.

/**
 * 一個以字串形式持久化到 localStorage 的金額輸入，依帳號分開存。
 * Signed-out guests browse demo data and get nothing persisted.
 */
function usePersistedAmount(key: string) {
  const { userId } = useAuth();
  const [value, setValue] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!userId) return;
    const saved = getAccountItem(key, userId);
    if (saved) setValue(saved);
    setLoaded(true);
  }, [key, userId]);

  useEffect(() => {
    if (loaded && userId) setAccountItem(key, userId, value);
  }, [key, value, loaded, userId]);

  return [value, setValue] as const;
}

/** 月薪與被動收入輸入、兩者加總，以及由月薪推算的理財法則。 */
export function useSalary() {
  const [salaryStr, setSalaryStr] = usePersistedAmount(SALARY_STORAGE_KEY);
  const [passiveStr, setPassiveStr] = usePersistedAmount(PASSIVE_INCOME_STORAGE_KEY);

  const rules = useMemo(
    () => salaryRules(parseFloat(salaryStr), parseFloat(passiveStr)),
    [salaryStr, passiveStr]
  );
  const total = monthlyIncomeTotal(parseFloat(salaryStr), parseFloat(passiveStr));

  return { salaryStr, setSalaryStr, passiveStr, setPassiveStr, total, rules };
}

/**
 * 退休頁「理財規劃」模式的薪資理財試算：輸入月薪與被動收入，列出五條經驗法則的
 * 建議金額；點任一條會開啟與退休指標卡相同的說明抽屜。
 */
export function SalaryCalculator({
  salaryStr,
  onChangeSalary,
  passiveStr,
  onChangePassive,
  rules,
}: {
  salaryStr: string;
  onChangeSalary: (v: string) => void;
  passiveStr: string;
  onChangePassive: (v: string) => void;
  rules: SalaryRule[];
}) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  // Looked up on every render so the sheet reflects edits to the salary.
  const openRule = rules.find((r) => r.key === openKey) ?? null;

  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-[#0e1424] px-4 py-[18px] shadow-sm">
        <p className="text-center text-[15px] font-semibold text-white">薪資理財試算</p>
        <div className="mt-4 flex items-stretch">
          <AmountInput label="月薪" value={salaryStr} onChange={onChangeSalary} />
          <div className="w-px bg-white/25" />
          <AmountInput label="被動收入" value={passiveStr} onChange={onChangePassive} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {rules.map((r, i) => (
          <button
            key={r.key}
            type="button"
            onClick={() => setOpenKey(r.key)}
            aria-description="顯示計算說明"
            data-testid={`rule-${r.key}`}
            className="animate-enter-down cursor-pointer rounded-2xl bg-white px-4 py-5 text-left shadow-sm transition-opacity active:opacity-60 [&:last-child:nth-child(odd)]:col-span-2"
            style={{ animationDelay: `${80 + i * 45}ms` }}
          >
            <div className="mb-3 flex items-center justify-between gap-1">
              <span className="truncate text-[11px] font-medium tracking-[0.5px] text-[#8e8e93]">
                {r.title}
              </span>
              <ChevronRight size={13} className="flex-shrink-0 text-[#c7c7cc]" />
            </div>
            <FitText fontSize={22} className="leading-[28px] font-bold text-[#374254]">
              {fmtNtd(r.value)}
            </FitText>
            <p className="mt-2 text-[11px] text-[#8e8e93]">{r.formula}</p>
          </button>
        ))}
      </div>

      {openRule && <InfoModal content={openRule.detail} onClose={() => setOpenKey(null)} />}
    </div>
  );
}

/** 金額在上、標籤在下的置中輸入欄。 */
function AmountInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const display = withThousands(value);
  return (
    <div className="flex flex-1 flex-col items-center px-2">
      <div className="flex items-baseline gap-0.5">
        <span className="text-[13px] font-semibold text-white/60">NT$</span>
        <input
          type="text"
          inputMode="decimal"
          value={display}
          onChange={(e) => onChange(sanitizeAmountInput(e.target.value))}
          placeholder="0"
          maxLength={13}
          aria-label={label}
          className="bg-transparent p-0 text-center text-[20px] font-bold text-white caret-white outline-none placeholder:text-white/35"
          style={{ width: `clamp(60px, ${Math.max(1, display.length) + 1}ch, 120px)` }}
        />
      </div>
      <span className="mt-2 text-[12px] text-white/60">{label}</span>
    </div>
  );
}
