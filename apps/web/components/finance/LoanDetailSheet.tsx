"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { ChevronLeft } from "lucide-react";
import type { Loan } from "@repo/shared";
import { generateAmortizationSchedule, calculateLoanStatus } from "@repo/shared";
import { AmortizationTable } from "./AmortizationTable";
import { formatCurrency } from "../../lib/format";

interface Props {
  open: boolean;
  loan: Loan;
  currentBalance?: number | undefined;
  color: string;
  onClose: () => void;
  onRateUpdated: () => void;
  onSynced?: () => void;
  onDeleted?: () => void;
}

function formatDateStr(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

export function LoanDetailSheet({
  open,
  loan,
  currentBalance,
  color,
  onClose,
  onRateUpdated,
  onSynced,
  onDeleted,
}: Props) {
  const today = useMemo(() => new Date(), []);

  const loanInput = useMemo(
    () => ({
      totalAmount: loan.totalAmount,
      annualInterestRate: loan.annualInterestRate,
      termMonths: loan.termMonths,
      startDate: loan.startDate,
      gracePeriodMonths: loan.gracePeriodMonths,
      repaymentType: loan.repaymentType,
    }),
    [loan]
  );

  const status = useMemo(() => calculateLoanStatus(loanInput, today), [loanInput, today]);

  // Full schedule used to derive effective paid months from currentBalance
  const fullSchedule = useMemo(
    () => generateAmortizationSchedule(loanInput, today),
    [loanInput, today]
  );

  // How many periods have been paid, derived from currentBalance vs schedule
  const effectivePaidMonths = useMemo(() => {
    if (currentBalance === undefined) return status.paidMonths;
    for (let i = 0; i < fullSchedule.length; i++) {
      if (Math.abs(fullSchedule[i].endBalance - currentBalance) < 0.5) return i + 1;
      if (currentBalance > fullSchedule[i].endBalance) return i;
    }
    return fullSchedule.length;
  }, [currentBalance, fullSchedule, status.paidMonths]);

  // Detect extra payment (currentBalance below the scheduled end balance for that period)
  const scheduledEndBalance =
    effectivePaidMonths > 0 ? (fullSchedule[effectivePaidMonths - 1]?.endBalance ?? null) : null;
  const isExtraPayment =
    currentBalance !== undefined &&
    scheduledEndBalance !== null &&
    currentBalance < scheduledEndBalance - 0.5;

  // Next payment row: re-amortize if extra payment, otherwise use next schedule row
  const effectiveNextRow = useMemo(() => {
    if (currentBalance === undefined) return null;
    if (isExtraPayment) {
      const nextDate = fullSchedule[effectivePaidMonths]?.paymentDate;
      if (!nextDate || currentBalance === undefined) return null;
      const reAmortRows = generateAmortizationSchedule(
        { ...loanInput, totalAmount: currentBalance, startDate: nextDate.toISOString() },
        today
      );
      return reAmortRows[0] ?? null;
    }
    return fullSchedule[effectivePaidMonths] ?? null;
  }, [currentBalance, isExtraPayment, fullSchedule, effectivePaidMonths, loanInput, today]);

  const defaultBalance = Math.round(currentBalance ?? status.remainingPrincipal);
  const defaultMonths = loan.overrideTermMonths ?? Math.max(0, loan.termMonths - status.paidMonths);

  // Three manually editable fields
  const [draftBalance, setDraftBalance] = useState(String(defaultBalance));
  const [draftMonths, setDraftMonths] = useState(String(defaultMonths));
  const [draftRate, setDraftRate] = useState(String(loan.annualInterestRate));

  // Schedule is only populated after user clicks 計算
  const [displaySchedule, setDisplaySchedule] = useState<ReturnType<
    typeof generateAmortizationSchedule
  > | null>(null);
  const [calcError, setCalcError] = useState<string | null>(null);

  // Sync sheet state
  const [showSyncSheet, setShowSyncSheet] = useState(false);
  const [syncMode, setSyncMode] = useState<"auto" | "manual">("auto");
  const [manualBalance, setManualBalance] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const parsedMonths = parseInt(draftMonths, 10);
  const displayPaidMonths =
    currentBalance !== undefined
      ? effectivePaidMonths
      : !isNaN(parsedMonths) && parsedMonths >= 0
        ? loan.termMonths - parsedMonths
        : status.paidMonths;

  const manualBalanceNum = parseFloat(manualBalance);
  const manualBalanceValid =
    manualBalance !== "" &&
    !isNaN(manualBalanceNum) &&
    manualBalanceNum >= 0 &&
    manualBalanceNum <= loan.totalAmount;

  const handleCalculate = () => {
    const balance = parseFloat(draftBalance);
    const months = parseInt(draftMonths, 10);
    const rate = parseFloat(draftRate);

    if (!isFinite(balance) || balance < 0) {
      setCalcError("請輸入有效的剩餘本金");
      return;
    }
    if (!isFinite(months) || months < 1) {
      setCalcError("請輸入有效的剩餘期數（至少 1 期）");
      return;
    }
    if (!isFinite(rate) || rate < 0 || rate > 100) {
      setCalcError("請輸入有效的年利率（0 ~ 100%）");
      return;
    }

    setCalcError(null);
    const computed = generateAmortizationSchedule(
      {
        totalAmount: balance,
        annualInterestRate: rate,
        termMonths: months,
        startDate: today.toISOString(),
        gracePeriodMonths: 0,
        repaymentType: loan.repaymentType,
      },
      today
    );
    setDisplaySchedule(computed);
  };

  const nextRow = displaySchedule?.find((row) => !row.isPast) ?? null;

  const handleSync = async (balance?: number) => {
    setSyncing(true);
    setSyncError(null);
    try {
      const parsedOverride = parseInt(draftMonths, 10);
      const overrideTermMonths =
        isFinite(parsedOverride) && parsedOverride > 0 ? parsedOverride : undefined;

      const body: Record<string, unknown> = {};
      if (balance !== undefined) body.manualBalance = balance;
      if (overrideTermMonths !== undefined) body.overrideTermMonths = overrideTermMonths;

      const res = await fetch(`/api/loans/${loan.id}/sync`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      setShowSyncSheet(false);
      setSyncMode("auto");
      setManualBalance("");
      setShowToast(true);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => setShowToast(false), 2000);
      (onSynced ?? onRateUpdated)();
    } catch {
      setSyncError("同步失敗，請稍後再試");
    } finally {
      setSyncing(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/loans/${loan.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      onDeleted?.();
      onClose();
    } catch {
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  const closeSyncSheet = () => {
    setShowSyncSheet(false);
    setSyncMode("auto");
    setManualBalance("");
    setSyncError(null);
  };

  return (
    <>
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
              <h1 className="text-[20px] font-bold text-[#1c1c1e]">{loan.loanName}</h1>
              <p className="text-[12px] text-[#8e8e93]">
                {formatDateStr(loan.startDate)} · {loan.termMonths} 期
              </p>
            </div>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-md space-y-3 px-4 pb-12">
            {/* Three editable input cards */}
            <div className="space-y-2">
              <div className="rounded-2xl bg-white px-4 py-3 shadow-sm">
                <p className="text-[12px] text-[#8e8e93]">剩餘本金</p>
                <div className="flex items-baseline gap-1">
                  <input
                    type="number"
                    aria-label="剩餘本金"
                    value={draftBalance}
                    onChange={(e) => {
                      setDraftBalance(e.target.value);
                      setDisplaySchedule(null);
                    }}
                    className="mt-1 min-w-0 flex-1 bg-transparent text-[22px] font-bold text-[#1c1c1e] outline-none"
                    inputMode="numeric"
                  />
                  <span className="shrink-0 text-[14px] text-[#8e8e93]">元</span>
                </div>
              </div>

              <div className="rounded-2xl bg-white px-4 py-3 shadow-sm">
                <p className="text-[12px] text-[#8e8e93]">剩餘期數</p>
                <div className="flex items-baseline gap-1">
                  <input
                    type="number"
                    value={draftMonths}
                    onChange={(e) => {
                      setDraftMonths(e.target.value);
                      setDisplaySchedule(null);
                    }}
                    className="mt-1 min-w-0 flex-1 bg-transparent text-[22px] font-bold text-[#1c1c1e] outline-none"
                    inputMode="numeric"
                    min={1}
                  />
                  <span className="shrink-0 text-[14px] text-[#8e8e93]">期</span>
                </div>
              </div>

              <div className="rounded-2xl bg-white px-4 py-3 shadow-sm">
                <p className="text-[12px] text-[#8e8e93]">年利率</p>
                <div className="flex items-baseline gap-1">
                  <input
                    type="number"
                    value={draftRate}
                    onChange={(e) => {
                      setDraftRate(e.target.value);
                      setDisplaySchedule(null);
                    }}
                    className="mt-1 min-w-0 flex-1 bg-transparent text-[22px] font-bold text-[#1c1c1e] outline-none"
                    inputMode="decimal"
                    step="0.01"
                  />
                  <span className="shrink-0 text-[14px] text-[#8e8e93]">%</span>
                </div>
              </div>
            </div>

            {/* Progress */}
            <div className="rounded-2xl bg-white px-4 py-3 shadow-sm">
              <div className="mb-1 flex justify-between text-[12px] text-[#8e8e93]">
                <span>已繳 {Math.max(0, displayPaidMonths)} 期</span>
                <span>共 {loan.termMonths} 期</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[#f2f2f7]">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, Math.max(0, (displayPaidMonths / loan.termMonths) * 100))}%`,
                    backgroundColor: color,
                  }}
                />
              </div>
            </div>

            {/* Next payment info — shown when currentBalance is provided */}
            {currentBalance !== undefined && effectiveNextRow && (
              <div className="rounded-2xl bg-white px-4 py-3 shadow-sm">
                <div className="flex justify-between">
                  <p className="text-[12px] text-[#8e8e93]">下期應繳</p>
                  <p className="text-[15px] font-semibold text-[#1c1c1e]">
                    {formatCurrency(effectiveNextRow.totalPayment)}
                  </p>
                </div>
                <div className="mt-1 flex justify-between">
                  <p className="text-[12px] text-[#8e8e93]">下期日期</p>
                  <p className="text-[13px] text-[#1c1c1e]">
                    {formatDateStr(effectiveNextRow.paymentDate.toISOString())}
                  </p>
                </div>
              </div>
            )}

            {/* Calculate button */}
            {calcError && <p className="text-center text-[12px] text-[#ff3b30]">{calcError}</p>}
            <button
              onClick={handleCalculate}
              className="w-full rounded-2xl py-3 text-[15px] font-semibold text-white"
              style={{ backgroundColor: color }}
            >
              計算
            </button>

            {/* Amortization table — only shown after 計算 */}
            {displaySchedule && (
              <div className="rounded-2xl bg-white px-4 py-4 shadow-sm">
                <p className="mb-2 text-[15px] font-semibold text-[#1c1c1e]">還款明細</p>
                <AmortizationTable rows={displaySchedule} color={color} />
              </div>
            )}

            {/* 我已繳款 */}
            {status.nextPaymentDate && (
              <button
                onClick={() => setShowSyncSheet(true)}
                className="w-full rounded-2xl border py-3 text-[15px] font-semibold"
                style={{ borderColor: color, color }}
              >
                我已繳款
              </button>
            )}

            {/* Delete */}
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="w-full rounded-2xl border border-[#ff3b30] py-3 text-[15px] font-semibold text-[#ff3b30]"
              >
                刪除貸款
              </button>
            ) : (
              <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
                <p className="px-4 pt-4 text-center text-[14px] text-[#1c1c1e]">
                  確定要刪除此貸款？此操作無法復原。
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
                    className="flex-1 py-3 text-[15px] font-semibold text-[#ff3b30] disabled:opacity-50"
                  >
                    {deleting ? "刪除中..." : "確認刪除"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sync confirmation sheet */}
      {showSyncSheet && (
        <>
          <div
            data-testid="sync-backdrop"
            className="fixed inset-0 z-[95] bg-black/30"
            onClick={closeSyncSheet}
          />
          <div className="fixed right-0 bottom-0 left-0 z-[96] rounded-t-2xl bg-white px-5 py-6 shadow-xl">
            <div className="mx-auto max-w-md">
              <p className="mb-4 text-[17px] font-semibold text-[#1c1c1e]">確認本期還款</p>

              {syncMode === "auto" ? (
                <>
                  <div className="mb-4 space-y-2">
                    <div className="flex justify-between">
                      <p className="text-[12px] text-[#8e8e93]">本期應繳</p>
                      <p className="text-[15px] font-semibold text-[#1c1c1e]">
                        {formatCurrency(nextRow?.totalPayment ?? status.nextPaymentAmount)}
                      </p>
                    </div>
                    <div className="flex justify-between">
                      <p className="text-[12px] text-[#8e8e93]">還款日</p>
                      <p className="text-[15px] text-[#1c1c1e]">
                        {status.nextPaymentDate
                          ? formatDateStr(status.nextPaymentDate.toISOString())
                          : "—"}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleSync()}
                    disabled={syncing}
                    className="mb-2 w-full rounded-2xl py-3 text-[15px] font-semibold text-white disabled:opacity-50"
                    style={{ backgroundColor: color }}
                  >
                    {syncing ? "同步中..." : "確認已繳"}
                  </button>
                  <button
                    onClick={() => setSyncMode("manual")}
                    className="w-full py-2 text-[13px] font-medium"
                    style={{ color }}
                  >
                    金額不同？手動輸入
                  </button>
                </>
              ) : (
                <>
                  <div className="mb-4">
                    <label
                      htmlFor="manual-balance"
                      className="mb-1 block text-[12px] text-[#8e8e93]"
                    >
                      實際剩餘本金
                    </label>
                    <input
                      id="manual-balance"
                      aria-label="實際剩餘本金"
                      type="number"
                      value={manualBalance}
                      onChange={(e) => setManualBalance(e.target.value)}
                      placeholder="0"
                      className="w-full bg-transparent text-[20px] font-bold text-[#1c1c1e] outline-none placeholder:text-[#c7c7cc]"
                    />
                    {manualBalance !== "" && !manualBalanceValid && (
                      <p className="mt-1 text-[12px] text-[#ff3b30]">
                        請輸入有效金額（0 ～ 貸款總額）
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleSync(manualBalanceNum)}
                    disabled={syncing || !manualBalanceValid}
                    className="mb-2 w-full rounded-2xl py-3 text-[15px] font-semibold text-white disabled:opacity-50"
                    style={{ backgroundColor: color }}
                  >
                    {syncing ? "同步中..." : "確認已繳"}
                  </button>
                  <button
                    onClick={() => {
                      setSyncMode("auto");
                      setManualBalance("");
                      setSyncError(null);
                    }}
                    className="w-full py-2 text-[13px] font-medium"
                    style={{ color }}
                  >
                    ← 返回自動計算
                  </button>
                </>
              )}

              {syncError && (
                <p className="mt-2 text-center text-[12px] text-[#ff3b30]">{syncError}</p>
              )}
            </div>
          </div>
        </>
      )}

      {/* Success toast */}
      {showToast && (
        <div className="fixed top-14 left-1/2 z-[97] -translate-x-1/2">
          <div className="rounded-full bg-[#1c1c1e] px-4 py-2 text-[14px] text-white">✓ 已同步</div>
        </div>
      )}
    </>
  );
}
