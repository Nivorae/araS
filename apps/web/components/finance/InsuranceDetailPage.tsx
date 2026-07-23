"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, Pencil, Trash2 } from "lucide-react";
import { Spinner } from "../ui/Spinner";
import { INSURANCE_TYPE_LABELS, type Insurance } from "@repo/shared";
import { formatCurrency } from "../../lib/format";
import { InsuranceFormPage } from "./InsuranceFormPage";

const UNKNOWN = "不確定";

interface Props {
  open: boolean;
  insuranceId: string | null;
  color: string;
  onClose: () => void;
  onChanged: () => void; // refresh entries store — call after edit save or delete
}

function formatDate(iso: string | null): string {
  if (!iso) return UNKNOWN;
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-5 py-4">
      <p className="text-[15px] font-medium text-[#1c1c1e]">{label}</p>
      <p className="ml-4 text-right text-[15px] text-[#1c1c1e]">{value}</p>
    </div>
  );
}

export function InsuranceDetailPage({ open, insuranceId, color, onClose, onChanged }: Props) {
  const [insurance, setInsurance] = useState<Insurance | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open || !insuranceId) return;
    setMode("view");
    setConfirmDelete(false);
    setLoading(true);
    fetch(`/api/insurances/${insuranceId}`)
      .then((r) => r.json())
      .then((json) => setInsurance(json.success ? json.data : null))
      .catch(() => setInsurance(null))
      .finally(() => setLoading(false));
  }, [open, insuranceId]);

  const handleDelete = async () => {
    if (!insurance) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/insurances/${insurance.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      onChanged();
      onClose();
    } catch {
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  if (mode === "edit" && insurance) {
    return (
      <InsuranceFormPage
        open={open}
        onClose={() => setMode("view")}
        onSaved={() => {
          setMode("view");
          onChanged();
          fetch(`/api/insurances/${insurance.id}`)
            .then((r) => r.json())
            .then((json) => setInsurance(json.success ? json.data : null))
            .catch(() => {});
        }}
        categoryColor={color}
        editItem={insurance}
      />
    );
  }

  return (
    <div
      className={`fixed inset-0 z-[90] flex flex-col bg-[#f2f2f7] transition-transform duration-300 ease-in-out ${
        open ? "translate-x-0" : "pointer-events-none translate-x-full"
      }`}
    >
      {/* Header */}
      <div className="mx-auto w-full max-w-md shrink-0 px-4 pt-14 pb-3">
        <div className="flex items-center justify-between">
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm"
          >
            <ChevronLeft size={20} className="text-[#1c1c1e]" />
          </button>
          {insurance && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMode("edit")}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm"
              >
                <Pencil size={16} className="text-[#1c1c1e]" />
              </button>
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm"
              >
                <Trash2 size={16} className="text-[#ff3b30]" />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-md px-4 pb-12">
          {loading ? (
            <p className="py-8 text-center text-[13px] text-[#8e8e93]">載入中...</p>
          ) : !insurance ? (
            <p className="py-8 text-center text-[13px] text-[#8e8e93]">找不到這張保單</p>
          ) : (
            <>
              <p className="mt-2 text-[20px] font-bold text-[#1c1c1e]">
                {insurance.policyName ?? insurance.insurer}
              </p>
              <p className="mt-0.5 mb-4 text-[13px] text-[#8e8e93]">
                {INSURANCE_TYPE_LABELS[insurance.insuranceType]}
              </p>

              <div className="mb-4 overflow-hidden rounded-2xl bg-white shadow-sm">
                <Field label="保險公司" value={insurance.insurer} />
                <div className="mx-5 h-px bg-[#f2f2f7]" />
                <Field label="被保人" value={insurance.insuredName} />
                <div className="mx-5 h-px bg-[#f2f2f7]" />
                <Field label="險種" value={INSURANCE_TYPE_LABELS[insurance.insuranceType]} />
                <div className="mx-5 h-px bg-[#f2f2f7]" />
                <Field label="保單名稱" value={insurance.policyName ?? UNKNOWN} />
                <div className="mx-5 h-px bg-[#f2f2f7]" />
                <Field label="保單號碼" value={insurance.policyNumber ?? UNKNOWN} />
              </div>

              {insurance.coverage.length > 0 && (
                <div className="mb-4 overflow-hidden rounded-2xl bg-white shadow-sm">
                  <p className="px-5 pt-4 pb-1 text-[13px] font-semibold text-[#8e8e93]">
                    保障項目
                  </p>
                  {insurance.coverage.map((item, idx) => (
                    <div key={item.key}>
                      {idx > 0 && <div className="mx-5 h-px bg-[#f2f2f7]" />}
                      <Field label={item.label} value={formatCurrency(item.value)} />
                    </div>
                  ))}
                </div>
              )}

              <div className="mb-4 overflow-hidden rounded-2xl bg-white shadow-sm">
                <Field
                  label="年繳保費"
                  value={
                    insurance.annualPremium != null
                      ? formatCurrency(insurance.annualPremium)
                      : UNKNOWN
                  }
                />
                <div className="mx-5 h-px bg-[#f2f2f7]" />
                <Field
                  label="繳費年期"
                  value={
                    insurance.paymentTermYears != null
                      ? `${insurance.paymentTermYears} 年`
                      : UNKNOWN
                  }
                />
                <div className="mx-5 h-px bg-[#f2f2f7]" />
                <Field label="保障期間" value={insurance.coveragePeriod ?? UNKNOWN} />
                <div className="mx-5 h-px bg-[#f2f2f7]" />
                <Field label="投保日期" value={formatDate(insurance.startDate)} />
              </div>

              {/* Delete */}
              {!confirmDelete ? (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="w-full rounded-2xl border border-[#ff3b30] py-3 text-[15px] font-semibold text-[#ff3b30]"
                >
                  刪除保單
                </button>
              ) : (
                <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
                  <p className="px-4 pt-4 text-center text-[14px] text-[#1c1c1e]">
                    確定要刪除這張保單？此操作無法復原。
                  </p>
                  <div className="mt-4 flex divide-x divide-[#e5e5ea] border-t border-[#e5e5ea]">
                    <button
                      onClick={() => setConfirmDelete(false)}
                      className="flex-1 py-3 text-[15px] font-semibold text-[#8e8e93]"
                    >
                      取消
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="flex flex-1 items-center justify-center gap-2 py-3 text-[15px] font-semibold text-[#ff3b30] disabled:opacity-50"
                    >
                      {deleting && <Spinner size={14} />}
                      {deleting ? "刪除中..." : "確認刪除"}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
