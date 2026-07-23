"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, Check, X } from "lucide-react";
import { Spinner } from "../ui/Spinner";
import {
  INSURANCE_TYPES,
  INSURANCE_TYPE_LABELS,
  INSURANCE_COVERAGE_OPTIONS,
  MAX_COVERAGE_ITEMS,
  INSURER_LIST,
  type InsuranceType,
  type Insurance,
} from "@repo/shared";

interface CoverageRowState {
  key: string;
  label: string;
  valueStr: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  categoryColor: string;
  editItem?: Insurance | null;
}

let coverageKeySeq = 0;
function generateCoverageKey(): string {
  coverageKeySeq += 1;
  return `custom_${Date.now()}_${coverageKeySeq}`;
}

export function InsuranceFormPage({ open, onClose, onSaved, categoryColor, editItem }: Props) {
  const isEdit = !!editItem;

  const [insuranceType, setInsuranceType] = useState<InsuranceType | null>(null);
  const [insurerMode, setInsurerMode] = useState<"list" | "other">("list");
  const [insurer, setInsurer] = useState("");
  const [insuredName, setInsuredName] = useState("本人");
  const [policyName, setPolicyName] = useState("");
  const [policyNumber, setPolicyNumber] = useState("");
  const [startDate, setStartDate] = useState("");
  const [paymentTermYears, setPaymentTermYears] = useState("");
  const [coveragePeriod, setCoveragePeriod] = useState("");
  const [annualPremium, setAnnualPremium] = useState("");
  const [coverage, setCoverage] = useState<CoverageRowState[]>([]);
  const [pendingCoverageKey, setPendingCoverageKey] = useState("");

  const [errors, setErrors] = useState<{
    insuranceType?: string;
    insurer?: string;
    insuredName?: string;
  }>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setInsuranceType(editItem?.insuranceType ?? null);
    setInsurerMode(
      editItem && !(INSURER_LIST as readonly string[]).includes(editItem.insurer) ? "other" : "list"
    );
    setInsurer(editItem?.insurer ?? "");
    setInsuredName(editItem?.insuredName ?? "本人");
    setPolicyName(editItem?.policyName ?? "");
    setPolicyNumber(editItem?.policyNumber ?? "");
    setStartDate(editItem?.startDate ? (editItem.startDate.split("T")[0] ?? "") : "");
    setPaymentTermYears(
      editItem?.paymentTermYears != null ? String(editItem.paymentTermYears) : ""
    );
    setCoveragePeriod(editItem?.coveragePeriod ?? "");
    setAnnualPremium(editItem?.annualPremium != null ? String(editItem.annualPremium) : "");
    setCoverage(
      editItem?.coverage.map((c) => ({ key: c.key, label: c.label, valueStr: String(c.value) })) ??
        []
    );
    setErrors({});
    setError(null);
  }, [open, editItem]);

  const remainingOptions = useMemo(() => {
    if (!insuranceType || insuranceType === "OTHER") return [];
    const used = new Set(coverage.map((c) => c.key));
    return INSURANCE_COVERAGE_OPTIONS[insuranceType].filter((o) => !used.has(o.key));
  }, [insuranceType, coverage]);

  useEffect(() => {
    setPendingCoverageKey(remainingOptions[0]?.key ?? "");
  }, [remainingOptions]);

  const canAddMore =
    coverage.length < MAX_COVERAGE_ITEMS &&
    !!insuranceType &&
    (insuranceType === "OTHER" || remainingOptions.length > 0);

  const handleSelectType = (type: InsuranceType) => {
    if (type === insuranceType) return;
    setInsuranceType(type);
    setCoverage([]); // stale coverage keys don't necessarily belong to the new type
    setErrors(({ insuranceType: _dropped, ...rest }) => rest);
  };

  const handleAddCoverage = () => {
    if (!insuranceType) return;
    if (insuranceType === "OTHER") {
      setCoverage((prev) => [...prev, { key: generateCoverageKey(), label: "", valueStr: "" }]);
    } else {
      const opt = remainingOptions.find((o) => o.key === pendingCoverageKey);
      if (!opt) return;
      setCoverage((prev) => [...prev, { key: opt.key, label: opt.label, valueStr: "" }]);
    }
  };

  const updateCoverageLabel = (key: string, label: string) =>
    setCoverage((prev) => prev.map((c) => (c.key === key ? { ...c, label } : c)));
  const updateCoverageValue = (key: string, valueStr: string) =>
    setCoverage((prev) => prev.map((c) => (c.key === key ? { ...c, valueStr } : c)));
  const removeCoverage = (key: string) => setCoverage((prev) => prev.filter((c) => c.key !== key));

  const validate = (): boolean => {
    const errs: typeof errors = {};
    if (!insuranceType) errs.insuranceType = "請選擇險種";
    if (!insurer.trim()) errs.insurer = "請輸入保險公司";
    if (!insuredName.trim()) errs.insuredName = "請輸入被保人";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate() || !insuranceType) return;
    setError(null);
    setSubmitting(true);
    try {
      const trimmedCoverage = coverage
        .filter((c) => c.label.trim().length > 0)
        .map((c) => ({ key: c.key, label: c.label.trim(), value: Number(c.valueStr) || 0 }));

      const body = isEdit
        ? {
            insurer: insurer.trim(),
            insuredName: insuredName.trim(),
            insuranceType,
            policyName: policyName.trim() || null,
            policyNumber: policyNumber.trim() || null,
            startDate: startDate || null,
            paymentTermYears: paymentTermYears ? parseInt(paymentTermYears, 10) : null,
            coveragePeriod: coveragePeriod.trim() || null,
            annualPremium: annualPremium ? parseFloat(annualPremium) : null,
            coverage: trimmedCoverage,
          }
        : {
            insurer: insurer.trim(),
            insuredName: insuredName.trim(),
            insuranceType,
            ...(policyName.trim() ? { policyName: policyName.trim() } : {}),
            ...(policyNumber.trim() ? { policyNumber: policyNumber.trim() } : {}),
            ...(startDate ? { startDate } : {}),
            ...(paymentTermYears ? { paymentTermYears: parseInt(paymentTermYears, 10) } : {}),
            ...(coveragePeriod.trim() ? { coveragePeriod: coveragePeriod.trim() } : {}),
            ...(annualPremium ? { annualPremium: parseFloat(annualPremium) } : {}),
            ...(trimmedCoverage.length > 0 ? { coverage: trimmedCoverage } : {}),
          };

      const res = await fetch(isEdit ? `/api/insurances/${editItem!.id}` : "/api/insurances", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) {
        if (json.error?.code === "PREMIUM_REQUIRED") {
          window.alert("保單管理是 Premium 功能。請於 araS App 內升級 Premium 解鎖無限保單管理。");
          return;
        }
        throw new Error(json.error?.message ?? "儲存失敗，請重試");
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "儲存失敗，請重試");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className={`fixed inset-0 z-[70] bg-[#f2f2f7] transition-transform duration-300 ease-in-out ${
        open ? "translate-x-0" : "pointer-events-none translate-x-full"
      }`}
    >
      <div
        className="mx-auto max-w-md overflow-y-auto px-4 pt-14 pb-12"
        style={{ height: "100vh" }}
      >
        {/* Top nav */}
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm"
          >
            <ChevronLeft size={20} className="text-[#1c1c1e]" />
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm disabled:opacity-40"
          >
            {submitting ? (
              <span style={{ color: categoryColor }}>
                <Spinner size={20} />
              </span>
            ) : (
              <Check size={20} className="text-black" strokeWidth={2.5} />
            )}
          </button>
        </div>

        <p className="mb-5 text-[22px] font-bold text-[#1c1c1e]">
          {isEdit ? "編輯保單" : "新增保單"}
        </p>

        {/* 險種 */}
        <div className="mb-4 overflow-hidden rounded-2xl bg-white shadow-sm">
          <p className="px-5 pt-4 pb-1 text-[13px] font-semibold text-[#8e8e93]">險種</p>
          <div className="flex flex-wrap gap-2 px-5 pb-4">
            {INSURANCE_TYPES.map((type) => {
              const active = insuranceType === type;
              return (
                <button
                  key={type}
                  onClick={() => handleSelectType(type)}
                  className="rounded-full px-3.5 py-2 text-[13px] font-semibold"
                  style={{
                    backgroundColor: active ? categoryColor : "#f2f2f7",
                    color: active ? "#ffffff" : "#8e8e93",
                  }}
                >
                  {INSURANCE_TYPE_LABELS[type]}
                </button>
              );
            })}
          </div>
          {errors.insuranceType && (
            <p className="px-5 pb-3 text-[12px] text-[#ff3b30]">{errors.insuranceType}</p>
          )}
        </div>

        {/* 基本資料 */}
        <div className="mb-4 overflow-hidden rounded-2xl bg-white shadow-sm">
          <div className="flex items-center justify-between px-5 py-4">
            <p className="shrink-0 text-[16px] font-medium text-[#1c1c1e]">保險公司</p>
            {insurerMode === "list" ? (
              <select
                value={insurer}
                onChange={(e) => {
                  if (e.target.value === "__other__") {
                    setInsurerMode("other");
                    setInsurer("");
                  } else {
                    setInsurer(e.target.value);
                  }
                }}
                className="ml-4 min-w-0 flex-1 bg-transparent text-right text-[14px] text-[#1c1c1e] outline-none"
              >
                <option value="" disabled>
                  未選擇
                </option>
                {INSURER_LIST.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
                <option value="__other__">其他（自行填寫）</option>
              </select>
            ) : (
              <div className="ml-4 flex min-w-0 flex-1 items-center gap-2">
                <input
                  type="text"
                  value={insurer}
                  onChange={(e) => setInsurer(e.target.value)}
                  placeholder="輸入保險公司名稱"
                  className="min-w-0 flex-1 bg-transparent text-right text-[14px] text-[#1c1c1e] outline-none placeholder:text-[#c7c7cc]"
                />
                <button
                  onClick={() => {
                    setInsurerMode("list");
                    setInsurer("");
                  }}
                  className="shrink-0 text-[12px] text-[#374254]"
                >
                  改用清單
                </button>
              </div>
            )}
          </div>
          {errors.insurer && (
            <p className="px-5 pb-3 text-[12px] text-[#ff3b30]">{errors.insurer}</p>
          )}
          <div className="mx-5 h-px bg-[#f2f2f7]" />

          <div className="flex items-center justify-between px-5 py-4">
            <p className="text-[16px] font-medium text-[#1c1c1e]">被保人</p>
            <input
              type="text"
              value={insuredName}
              onChange={(e) => setInsuredName(e.target.value)}
              placeholder="本人"
              className="ml-4 min-w-0 flex-1 bg-transparent text-right text-[14px] text-[#1c1c1e] outline-none placeholder:text-[#c7c7cc]"
            />
          </div>
          {errors.insuredName && (
            <p className="px-5 pb-3 text-[12px] text-[#ff3b30]">{errors.insuredName}</p>
          )}
          <div className="mx-5 h-px bg-[#f2f2f7]" />

          <div className="flex items-center justify-between px-5 py-4">
            <p className="text-[16px] font-medium text-[#1c1c1e]">保單名稱</p>
            <input
              type="text"
              value={policyName}
              onChange={(e) => setPolicyName(e.target.value)}
              placeholder="選填"
              className="ml-4 min-w-0 flex-1 bg-transparent text-right text-[14px] text-[#8e8e93] outline-none placeholder:text-[#c7c7cc]"
            />
          </div>
          <div className="mx-5 h-px bg-[#f2f2f7]" />

          <div className="flex items-center justify-between px-5 py-4">
            <p className="text-[16px] font-medium text-[#1c1c1e]">保單號碼</p>
            <input
              type="text"
              value={policyNumber}
              onChange={(e) => setPolicyNumber(e.target.value)}
              placeholder="選填"
              className="ml-4 min-w-0 flex-1 bg-transparent text-right text-[14px] text-[#8e8e93] outline-none placeholder:text-[#c7c7cc]"
            />
          </div>
          <div className="mx-5 h-px bg-[#f2f2f7]" />

          <div className="flex items-center justify-between px-5 py-4">
            <p className="text-[16px] font-medium text-[#1c1c1e]">投保日期</p>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent text-right text-[14px] text-[#8e8e93] outline-none"
            />
          </div>
          <div className="mx-5 h-px bg-[#f2f2f7]" />

          <div className="flex items-center justify-between px-5 py-4">
            <p className="text-[16px] font-medium text-[#1c1c1e]">繳費年期（年）</p>
            <input
              type="number"
              value={paymentTermYears}
              onChange={(e) => setPaymentTermYears(e.target.value)}
              placeholder="選填"
              min="1"
              className="ml-4 w-20 bg-transparent text-right text-[14px] text-[#8e8e93] outline-none placeholder:text-[#c7c7cc]"
            />
          </div>
          <div className="mx-5 h-px bg-[#f2f2f7]" />

          <div className="flex items-center justify-between px-5 py-4">
            <p className="text-[16px] font-medium text-[#1c1c1e]">保障期間</p>
            <input
              type="text"
              value={coveragePeriod}
              onChange={(e) => setCoveragePeriod(e.target.value)}
              placeholder="終身／定期到 X 歲"
              className="ml-4 min-w-0 flex-1 bg-transparent text-right text-[14px] text-[#8e8e93] outline-none placeholder:text-[#c7c7cc]"
            />
          </div>
          <div className="mx-5 h-px bg-[#f2f2f7]" />

          <div className="flex items-center justify-between px-5 py-4">
            <p className="text-[16px] font-medium text-[#1c1c1e]">年繳保費</p>
            <input
              type="number"
              value={annualPremium}
              onChange={(e) => setAnnualPremium(e.target.value)}
              placeholder="選填"
              min="0"
              className="ml-4 w-24 bg-transparent text-right text-[14px] text-[#8e8e93] outline-none placeholder:text-[#c7c7cc]"
            />
          </div>
        </div>

        {/* 保障細項 */}
        {insuranceType && (
          <div className="mb-4 overflow-hidden rounded-2xl bg-white shadow-sm">
            <p className="px-5 pt-4 pb-1 text-[13px] font-semibold text-[#8e8e93]">
              保障項目（最多 {MAX_COVERAGE_ITEMS} 項）
            </p>
            <div className="px-5 pb-2">
              {coverage.map((item) => (
                <div key={item.key} className="flex items-center gap-3 py-2">
                  {insuranceType === "OTHER" ? (
                    <input
                      type="text"
                      value={item.label}
                      onChange={(e) => updateCoverageLabel(item.key, e.target.value)}
                      placeholder="保障名稱"
                      className="min-w-0 flex-1 border-b border-[#e5e5ea] bg-transparent py-1 text-[14px] text-[#1c1c1e] outline-none placeholder:text-[#c7c7cc]"
                    />
                  ) : (
                    <p className="flex-1 truncate text-[14px] text-[#1c1c1e]">{item.label}</p>
                  )}
                  <input
                    type="number"
                    value={item.valueStr}
                    onChange={(e) => updateCoverageValue(item.key, e.target.value)}
                    placeholder="0"
                    className="w-24 border-b border-[#e5e5ea] bg-transparent py-1 text-right text-[14px] text-[#1c1c1e] outline-none placeholder:text-[#c7c7cc]"
                  />
                  <button onClick={() => removeCoverage(item.key)}>
                    <X size={16} className="text-[#8e8e93]" />
                  </button>
                </div>
              ))}
            </div>
            {canAddMore && (
              <div className="flex items-center gap-2 px-5 pb-4">
                {insuranceType !== "OTHER" && (
                  <select
                    value={pendingCoverageKey}
                    onChange={(e) => setPendingCoverageKey(e.target.value)}
                    className="min-w-0 flex-1 rounded-lg bg-[#f2f2f7] px-3 py-2 text-[13px] text-[#1c1c1e] outline-none"
                  >
                    {remainingOptions.map((o) => (
                      <option key={o.key} value={o.key}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  onClick={handleAddCoverage}
                  className="shrink-0 text-[14px] font-semibold text-[#374254]"
                >
                  + 新增保障
                </button>
              </div>
            )}
          </div>
        )}

        {error && <p className="mt-3 text-center text-[13px] text-[#ff3b30]">{error}</p>}
      </div>
    </div>
  );
}
