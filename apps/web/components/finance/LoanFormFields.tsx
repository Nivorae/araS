"use client";

import type { RepaymentType } from "@repo/shared";
import { DateField } from "../ui/DatePickerSheet";

export interface LoanFormValues {
  loanName: string;
  totalAmount: string;
  annualInterestRate: string;
  termMonths: string;
  startDate: string;
  gracePeriodMonths: string;
  repaymentType: RepaymentType;
}

interface Props {
  values: LoanFormValues;
  color: string;
  onChange: (values: LoanFormValues) => void;
  errors?: Partial<Record<keyof LoanFormValues, string>>;
}

export function LoanFormFields({ values, color, onChange, errors }: Props) {
  const set = (key: keyof LoanFormValues) => (val: string) => onChange({ ...values, [key]: val });

  return (
    <div className="divide-y divide-[#f2f2f7]">
      {/* Loan name */}
      <div className="px-5 py-4">
        <p className="mb-1 text-[12px] text-[#8e8e93]">貸款名稱</p>
        <input
          type="text"
          value={values.loanName}
          onChange={(e) => set("loanName")(e.target.value)}
          placeholder="例：台北房貸"
          className="w-full bg-transparent text-[17px] font-semibold text-[#1c1c1e] outline-none placeholder:text-[#c7c7cc]"
        />
      </div>

      {/* Total amount */}
      <div className="px-5 py-4">
        <p className="mb-1 text-[12px] text-[#8e8e93]">貸款金額</p>
        <input
          type="number"
          value={values.totalAmount}
          onChange={(e) => set("totalAmount")(e.target.value)}
          placeholder="0"
          className="w-full bg-transparent text-[20px] font-bold text-[#1c1c1e] outline-none placeholder:text-[#c7c7cc]"
        />
        {errors?.totalAmount && (
          <p className="mt-1 text-[12px] text-[#ff3b30]">{errors.totalAmount}</p>
        )}
      </div>

      {/* Rate + term (split row) */}
      <div className="flex divide-x divide-[#f2f2f7]">
        <div className="w-1/2 px-5 py-4">
          <p className="mb-1 text-[12px] text-[#8e8e93]">年利率 (%)</p>
          <input
            type="number"
            value={values.annualInterestRate}
            onChange={(e) => set("annualInterestRate")(e.target.value)}
            placeholder="2.00"
            step="0.01"
            className="w-full bg-transparent text-[17px] font-semibold text-[#1c1c1e] outline-none placeholder:text-[#c7c7cc]"
          />
          {errors?.annualInterestRate && (
            <p className="mt-1 text-[12px] text-[#ff3b30]">{errors.annualInterestRate}</p>
          )}
        </div>
        <div className="w-1/2 px-5 py-4">
          <p className="mb-1 text-[12px] text-[#8e8e93]">貸款期數 (月)</p>
          <input
            type="number"
            value={values.termMonths}
            onChange={(e) => set("termMonths")(e.target.value)}
            placeholder="360"
            className="w-full bg-transparent text-[17px] font-semibold text-[#1c1c1e] outline-none placeholder:text-[#c7c7cc]"
          />
          {errors?.termMonths && (
            <p className="mt-1 text-[12px] text-[#ff3b30]">{errors.termMonths}</p>
          )}
        </div>
      </div>

      {/* Start date + grace (split row) */}
      <div className="flex divide-x divide-[#f2f2f7]">
        <div className="w-1/2 px-5 py-4">
          <p className="mb-1 text-[12px] text-[#8e8e93]">撥款日期</p>
          <DateField
            value={values.startDate}
            onChange={set("startDate")}
            ariaLabel="撥款日期"
            className="font-semibold"
          />
          {errors?.startDate && (
            <p className="mt-1 text-[12px] text-[#ff3b30]">{errors.startDate}</p>
          )}
        </div>
        <div className="w-1/2 px-5 py-4">
          <p className="mb-1 text-[12px] text-[#8e8e93]">寬限期 (月)</p>
          <input
            type="number"
            value={values.gracePeriodMonths}
            onChange={(e) => set("gracePeriodMonths")(e.target.value)}
            placeholder="0"
            className="w-full bg-transparent text-[17px] font-semibold text-[#1c1c1e] outline-none placeholder:text-[#c7c7cc]"
          />
        </div>
      </div>

      {/* Repayment type */}
      <div className="px-5 py-4">
        <p className="mb-2 text-[12px] text-[#8e8e93]">還款方式</p>
        <div className="flex gap-2">
          {(
            [
              { value: "principal_interest", label: "本息均攤" },
              { value: "principal_equal", label: "本金均攤" },
            ] as { value: RepaymentType; label: string }[]
          ).map(({ value, label }) => (
            <button
              key={value}
              onClick={() => onChange({ ...values, repaymentType: value })}
              className="flex-1 rounded-xl py-2 text-[14px] font-semibold transition-colors"
              style={
                values.repaymentType === value
                  ? { backgroundColor: color, color: "white" }
                  : { backgroundColor: "#f2f2f7", color: "#8e8e93" }
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
