"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Calculator, Check, ChevronLeft, ChevronRight } from "lucide-react";
import type { Entry } from "@repo/shared";
import { FREE_ENTRY_LIMIT } from "@repo/shared";
import { Spinner } from "../ui/Spinner";
import { BankLogo } from "../ui/BankLogo";
import { DateField } from "../ui/DatePickerSheet";
import { useFinanceStore } from "../../store/useFinanceStore";
import { StockPickerPage, type StockItem } from "./StockPickerPage";
import { BankPickerPage, BANKS, type BankItem } from "./BankPickerPage";
import { LoanFormFields, type LoanFormValues } from "./LoanFormFields";
import { FxCalculatorSheet } from "./FxCalculatorSheet";
import { promptMobileApp, MOBILE_APP_PROMPT } from "../../lib/mobileAppPrompt";
import { buildYfSymbol, OVERSEAS_SUBCATEGORY, STOCK_CATS } from "../../lib/stockSymbol";
import { fetchTwdRate } from "../../lib/twdQuote";
import { formatCurrency } from "../../lib/format";
import { formatDisplayDate, todayISO } from "../../lib/date";

// Web port of apps/mobile/components/EntryForm.tsx. One form, three modes:
//  - new entry                       (`entry` absent)
//  - append a record to an entry     (`entry` + `addRecord`) — "+" on the detail page
//  - edit an entry                   (`entry`) — basic info only, or the loan itself

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  topCategory: string;
  isLiability?: boolean;
  categoryColor: string;
  subCategoryName: string;
  /** The entry being edited / appended to. Absent for a new entry. */
  entry?: Entry | null;
  /** Append a new record (history line) to `entry` instead of editing it. */
  addRecord?: boolean;
}

// Money amount fields accept at most 10 digits (~100 億).
const MAX_AMOUNT_LENGTH = 10;

const INVESTMENT_CATEGORIES = [
  "投資基金",
  "台股",
  "美股",
  OVERSEAS_SUBCATEGORY,
  "加密貨幣",
  "貴金屬",
  "其他投資",
];
// The category picker's only loan node is 負債 → 貸款 (same as mobile LOAN_SUBCATS).
const LOAN_SUBCATEGORIES = ["貸款"];

const ENTRY_LIMIT_MESSAGE = `你的資產版圖越來越豐富了！免費版可記 ${FREE_ENTRY_LIMIT} 筆，升級 Premium 解鎖無上限。${MOBILE_APP_PROMPT}`;

export function getUnitsLabel(subCategoryName: string): string {
  switch (subCategoryName) {
    case "投資基金":
      return "基金份額";
    case "台股":
    case "美股":
    case OVERSEAS_SUBCATEGORY:
      return "持有股數";
    case "加密貨幣":
      return "持有數量";
    case "貴金屬":
      return "持有重量";
    default:
      return "持有數量";
  }
}

function getBalanceLabel(topCategory: string): string {
  if (topCategory === "應收款") return "應收餘額";
  if (topCategory === "負債") return "負債金額";
  return "帳戶餘額";
}

function defaultLoanValues(): LoanFormValues {
  return {
    loanName: "",
    totalAmount: "",
    annualInterestRate: "",
    termMonths: "",
    startDate: todayISO(),
    gracePeriodMonths: "0",
    repaymentType: "principal_interest",
  };
}

/** Keep digits and one decimal point, capped at `max` characters. */
function amountInput(raw: string, max = MAX_AMOUNT_LENGTH): string {
  const cleaned = raw.replace(/[^\d.]/g, "");
  const dot = cleaned.indexOf(".");
  const one =
    dot === -1 ? cleaned : cleaned.slice(0, dot + 1) + cleaned.slice(dot + 1).replace(/\./g, "");
  return one.slice(0, max);
}

function isEntryLimitError(e: unknown): boolean {
  return (
    (e as { code?: string } | null)?.code === "ENTRY_LIMIT_REACHED" ||
    (e instanceof Error && e.message.includes("上限"))
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-[30px] w-[52px] shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${
        checked ? "bg-[#66788E]" : "bg-[#e5e5ea]"
      }`}
    >
      <span
        className={`absolute top-[3px] left-[3px] h-6 w-6 rounded-full bg-white shadow transition-transform duration-200 ${
          checked ? "translate-x-[22px]" : "translate-x-0"
        }`}
      />
    </button>
  );
}

function SegmentRow<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="mx-4 mt-3.5 flex overflow-hidden rounded-[10px]" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={`flex-1 cursor-pointer py-2.5 text-[13px] font-semibold transition-colors ${
            value === o.value ? "bg-[#374254] text-white" : "bg-[#f2f2f7] text-[#8e8e93]"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function AccountFormPage({
  open,
  onClose,
  onSaved,
  topCategory,
  categoryColor,
  subCategoryName,
  entry = null,
  addRecord = false,
  isLiability = false,
}: Props) {
  const { addEntry, updateEntry, setEntryIncludeInChart, refreshEntries, entries } =
    useFinanceStore();

  const isEdit = !!entry;
  const isInvestment = topCategory === "投資" && INVESTMENT_CATEGORIES.includes(subCategoryName);
  const hasStockPicker = STOCK_CATS.includes(subCategoryName);
  const isLoan = LOAN_SUBCATEGORIES.includes(subCategoryName);
  const isBankCard = subCategoryName === "金融卡";
  const isCrypto = subCategoryName === "加密貨幣";
  // ✏️ edits the entry's BASIC INFO only (name / icon / 納入圖表). The balance
  // lives in the history records, so no amount fields and no `value` is sent.
  const editBasicInfoOnly = isEdit && !addRecord && !isLoan;
  const initialLoan = isEdit && !addRecord ? (entry?.loan ?? null) : null;
  const baseValue = entry?.value ?? 0;

  const twHoldings = useMemo<StockItem[]>(() => {
    if (subCategoryName !== "台股") return [];
    const seen = new Set<string>();
    return entries
      .filter((e) => e.subCategory === "台股" && e.stockCode)
      .filter((e) => {
        if (seen.has(e.stockCode!)) return false;
        seen.add(e.stockCode!);
        return true;
      })
      .map((e) => ({ code: e.stockCode!, name: e.name }));
  }, [entries, subCategoryName]);

  // ── State ──────────────────────────────────────────────────────────────────
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(todayISO);
  const [includeInChart, setIncludeInChart] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [balance, setBalance] = useState("");
  // 收入/支出 — asset entries in add-record mode only; liabilities keep 增加負債.
  const [recordType, setRecordType] = useState<"income" | "expense">("income");
  const isExpenseRecord = addRecord && !isLiability && recordType === "expense";

  const [units, setUnits] = useState("");
  const [selectedStock, setSelectedStock] = useState<StockItem | null>(null);
  const [showStockPicker, setShowStockPicker] = useState(false);
  const [priceLoading, setPriceLoading] = useState(false);
  const [originalPrice, setOriginalPrice] = useState(0);
  const [currency, setCurrency] = useState("TWD");
  const [exchangeRate, setExchangeRate] = useState(1);
  // The stock's quote currency regardless of whether the FX rate loaded — the
  // FX calculator needs it (`currency` falls back to TWD when the rate fails).
  const [quoteCurrency, setQuoteCurrency] = useState<string | null>(null);
  const [showFxCalculator, setShowFxCalculator] = useState(false);
  const hasFxCalculator = quoteCurrency != null && quoteCurrency !== "TWD";
  const [isPriceManual, setIsPriceManual] = useState(false);
  const [manualPriceStr, setManualPriceStr] = useState("");
  const [inputMode, setInputMode] = useState<"units" | "amount">("units");
  const [amountStr, setAmountStr] = useState("");

  const [selectedBank, setSelectedBank] = useState<BankItem | null>(null);
  const [showBankPicker, setShowBankPicker] = useState(false);

  const [loanValues, setLoanValues] = useState<LoanFormValues>(defaultLoanValues);
  const [loanErrors, setLoanErrors] = useState<Partial<Record<keyof LoanFormValues, string>>>({});

  // Only the latest quote request may write (re-opening / re-picking quickly).
  const quoteToken = useRef(0);
  const fetchPriceFor = useCallback(async (yfSymbol: string) => {
    const token = ++quoteToken.current;
    setPriceLoading(true);
    try {
      const res = await fetch(`/api/stocks/price?symbol=${encodeURIComponent(yfSymbol)}`);
      const data = await res.json();
      if (token !== quoteToken.current || typeof data?.price !== "number") return;
      const c = typeof data.currency === "string" ? data.currency : "TWD";
      setQuoteCurrency(c);
      const rate = await fetchTwdRate(c);
      if (token !== quoteToken.current) return;
      if (rate == null) {
        // 匯率不明：當作抓不到價格（顯示 --），手動輸入的股價就以台幣計。
        setOriginalPrice(0);
        setCurrency("TWD");
        setExchangeRate(1);
        return;
      }
      setOriginalPrice(data.price);
      setCurrency(c);
      setExchangeRate(rate);
    } catch {
      /* keep "--"; the user can enter the price manually */
    } finally {
      if (token === quoteToken.current) setPriceLoading(false);
    }
  }, []);

  // Reset everything each time the form opens.
  useEffect(() => {
    if (!open) return;
    quoteToken.current++;
    setError(null);
    setLoanErrors({});
    setSubmitting(false);
    setName(entry?.name ?? "");
    // Appending a record starts a fresh note — the entry's note isn't this line's.
    setNote(addRecord ? "" : (entry?.note ?? ""));
    setDate(todayISO());
    setIncludeInChart(entry?.includeInChart ?? true);
    setRecordType("income");
    setBalance("");
    setUnits(
      isInvestment && !addRecord && entry && hasStockPicker && entry.units != null
        ? String(entry.units)
        : ""
    );
    setAmountStr("");
    setInputMode(isCrypto && entry?.units == null ? "amount" : "units");
    setSelectedStock(entry?.stockCode ? { code: entry.stockCode, name: entry.name } : null);
    setSelectedBank(
      entry?.bankCode ? (BANKS.find((b) => b.code === entry.bankCode) ?? null) : null
    );
    setOriginalPrice(0);
    setCurrency("TWD");
    setExchangeRate(1);
    setQuoteCurrency(null);
    setIsPriceManual(false);
    setManualPriceStr("");
    setPriceLoading(false);
    setLoanValues(
      initialLoan
        ? {
            loanName: initialLoan.loanName,
            totalAmount: String(initialLoan.totalAmount),
            annualInterestRate: String(initialLoan.annualInterestRate),
            termMonths: String(initialLoan.termMonths),
            startDate: initialLoan.startDate.slice(0, 10),
            gracePeriodMonths: String(initialLoan.gracePeriodMonths),
            repaymentType: initialLoan.repaymentType,
          }
        : defaultLoanValues()
    );
    // Fetch the price ONCE when a stock is prefilled; afterwards 更新 refreshes.
    if (entry?.stockCode && hasStockPicker) {
      const yfSymbol = buildYfSymbol(subCategoryName, entry.stockCode);
      if (yfSymbol) void fetchPriceFor(yfSymbol);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ── Derived values ───────────────────────────────────────────────────────────
  const priceTWD = useMemo(() => {
    const price = isPriceManual ? parseFloat(manualPriceStr) || 0 : originalPrice;
    return currency === "TWD" ? price : price * exchangeRate;
  }, [isPriceManual, manualPriceStr, originalPrice, currency, exchangeRate]);

  // Shares implied by a cost amount (amount mode) — also what's saved as units.
  const derivedUnits = useMemo(() => {
    if (inputMode !== "amount") return parseFloat(units) || 0;
    const amount = parseFloat(amountStr) || 0;
    return priceTWD > 0 ? amount / priceTWD : 0;
  }, [inputMode, units, amountStr, priceTWD]);

  const computedValue = useMemo(() => {
    if (!hasStockPicker) return parseFloat(units) || 0;
    if (inputMode === "amount") return parseFloat(amountStr) || 0;
    return (parseFloat(units) || 0) * priceTWD;
  }, [hasStockPicker, inputMode, units, amountStr, priceTWD]);

  // Single source of truth for what's about to be saved (preview card + submit).
  const finalName = isLoan
    ? loanValues.loanName.trim() || subCategoryName
    : name.trim() || selectedStock?.name || subCategoryName;
  const finalValue = useMemo(() => {
    if (isLoan) return parseFloat(loanValues.totalAmount) || 0;
    if (editBasicInfoOnly) return null;
    const typedBalance = parseFloat(balance) || 0;
    const entered = isInvestment ? computedValue : isExpenseRecord ? -typedBalance : typedBalance;
    return addRecord ? baseValue + entered : entered;
  }, [
    isLoan,
    loanValues.totalAmount,
    editBasicInfoOnly,
    balance,
    isInvestment,
    computedValue,
    isExpenseRecord,
    addRecord,
    baseValue,
  ]);
  const finalDate = isLoan ? loanValues.startDate : date;

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleSelectStock = (stock: StockItem) => {
    setSelectedStock(stock);
    if (!name) setName(stock.name);
    setIsPriceManual(false);
    setManualPriceStr("");
    const yfSymbol = buildYfSymbol(subCategoryName, stock.code);
    setOriginalPrice(0);
    setCurrency("TWD");
    setExchangeRate(1);
    setQuoteCurrency(null);
    if (yfSymbol) void fetchPriceFor(yfSymbol);
  };

  const refreshPrice = () => {
    if (!selectedStock) return;
    const yfSymbol = buildYfSymbol(subCategoryName, selectedStock.code);
    if (yfSymbol) void fetchPriceFor(yfSymbol);
  };

  // An existing entry's 納入圖表 saves the moment it's flipped — it reads as a
  // setting, so users flip it and go back. Optimistic; the last flip wins.
  const chartToggleToken = useRef(0);
  const handleIncludeInChartChange = async (next: boolean) => {
    setIncludeInChart(next);
    if (!isEdit || !entry) return;
    const token = ++chartToggleToken.current;
    try {
      await setEntryIncludeInChart(entry.id, next);
    } catch (e) {
      if (chartToggleToken.current !== token) return;
      setIncludeInChart(!next);
      setError(e instanceof Error ? e.message : "納入圖表設定儲存失敗");
    }
  };

  const validateLoan = (): boolean => {
    const errs: Partial<Record<keyof LoanFormValues, string>> = {};
    if (!loanValues.totalAmount || parseFloat(loanValues.totalAmount) <= 0)
      errs.totalAmount = "請輸入貸款金額";
    if (!loanValues.annualInterestRate || parseFloat(loanValues.annualInterestRate) < 0)
      errs.annualInterestRate = "請輸入年利率";
    if (!loanValues.termMonths || parseInt(loanValues.termMonths) <= 0)
      errs.termMonths = "請輸入貸款期數";
    if (!loanValues.startDate) errs.startDate = "請選擇撥款日期";
    setLoanErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateGeneral = (): boolean => {
    if (isInvestment) {
      if (hasStockPicker && inputMode === "amount") {
        if (!amountStr || parseFloat(amountStr) <= 0) {
          setError("請輸入金額");
          return false;
        }
      } else if (!units || parseFloat(units) <= 0) {
        setError(`請輸入${getUnitsLabel(subCategoryName)}`);
        return false;
      }
    } else if (!balance || isNaN(parseFloat(balance))) {
      setError(`請輸入${getBalanceLabel(topCategory)}`);
      return false;
    }
    setError(null);
    return true;
  };

  const handleSubmit = async () => {
    if (submitting) return;
    if (isLoan && !validateLoan()) return;
    if (!isLoan && !editBasicInfoOnly && !validateGeneral()) return;
    setError(null);
    setSubmitting(true);
    try {
      if (isLoan) {
        const loanPayload = {
          loanName: loanValues.loanName.trim() || subCategoryName,
          totalAmount: parseFloat(loanValues.totalAmount) || 0,
          annualInterestRate: parseFloat(loanValues.annualInterestRate) || 0,
          termMonths: parseInt(loanValues.termMonths) || 0,
          startDate: new Date(loanValues.startDate).toISOString(),
          gracePeriodMonths: parseInt(loanValues.gracePeriodMonths) || 0,
          repaymentType: loanValues.repaymentType,
        };
        // Editing PATCHes the loan in place — POSTing would create a duplicate.
        const res = initialLoan
          ? await fetch(`/api/loans/${initialLoan.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(loanPayload),
            })
          : await fetch("/api/loans", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...loanPayload, category: subCategoryName, includeInChart }),
            });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.success) {
          throw Object.assign(new Error(json?.error?.message ?? "貸款儲存失敗"), {
            code: json?.error?.code as string | undefined,
          });
        }
        await refreshEntries();
      } else if (editBasicInfoOnly && entry) {
        // No `value` → the backend writes no history line; the balance is untouched.
        await updateEntry(entry.id, {
          name: finalName,
          includeInChart,
          ...(isBankCard && selectedBank ? { bankCode: selectedBank.code } : {}),
        });
      } else {
        const value = finalValue!;
        // In amount mode `units` is derived from cost ÷ price so the share count
        // (and P&L) stays right.
        const unitsParsed = hasStockPicker ? derivedUnits || undefined : undefined;
        // Store the per-share price actually paid on the history line.
        const pricePerShareParsed = hasStockPicker && priceTWD > 0 ? priceTWD : undefined;
        const payload = {
          name: finalName,
          topCategory,
          subCategory: subCategoryName,
          value,
          includeInChart,
          note: note.trim() || undefined,
          ...(hasStockPicker && selectedStock ? { stockCode: selectedStock.code } : {}),
          ...(unitsParsed != null ? { units: unitsParsed } : {}),
          ...(pricePerShareParsed != null ? { pricePerShare: pricePerShareParsed } : {}),
          ...(isBankCard && selectedBank ? { bankCode: selectedBank.code } : {}),
        };
        if (isEdit && entry) {
          // Back-date the appended record when adding to an existing entry.
          await updateEntry(entry.id, { ...payload, ...(addRecord ? { createdAt: date } : {}) });
        } else {
          await addEntry({ ...payload, createdAt: date });
        }
      }
      onSaved();
    } catch (e) {
      // Web has no in-app purchase path (iOS-only IAP); point users to the app.
      if (isEntryLimitError(e)) {
        promptMobileApp(ENTRY_LIMIT_MESSAGE);
        return;
      }
      setError(e instanceof Error ? e.message : "儲存失敗，請重試");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  const accentColor = categoryColor.toUpperCase() === "#FFFFFF" ? "#374254" : categoryColor;
  const stockLocked = isEdit;
  const unitsLabel = getUnitsLabel(subCategoryName);
  const negative = isLiability || isExpenseRecord;

  return (
    <>
      <div
        className={`fixed inset-0 z-[70] overflow-y-auto bg-[#f2f2f7] transition-transform duration-300 ease-in-out ${
          open ? "translate-x-0" : "pointer-events-none translate-x-full"
        }`}
        aria-hidden={!open}
      >
        <div className="mx-auto max-w-md px-4 pt-12 pb-16 md:max-w-xl lg:max-w-2xl">
          {/* Nav row: back · centred title · sub-category badge */}
          <div className="flex items-center justify-between pt-1 pb-4">
            <button
              onClick={onClose}
              aria-label="返回"
              className="flex h-10 w-10 cursor-pointer items-center justify-center active:opacity-60"
            >
              <ChevronLeft size={20} className="text-[#1c1c1e]" />
            </button>
            <p className="text-[22px] font-bold text-[#1c1c1e]">
              {addRecord ? "新增記錄" : editBasicInfoOnly ? "編輯帳戶" : "帳戶"}
            </p>
            <span className="rounded-full bg-[#66788E] px-2.5 py-1 text-[11px] font-bold text-white">
              {subCategoryName}
            </span>
          </div>

          {/* Preview card — mirrors the fields below and carries the save action */}
          <div
            className="mb-4 flex items-center justify-between rounded-[20px] px-5 py-[18px]"
            style={{ backgroundColor: accentColor }}
            data-testid="entry-preview"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <p className="truncate text-[17px] font-bold text-white">{finalName}</p>
              {finalValue !== null && (
                <p className="text-[24px] font-extrabold text-white">
                  {formatCurrency(finalValue)}
                </p>
              )}
              {hasStockPicker && (
                <p className="text-[12px] font-semibold text-white/90">
                  {`${isCrypto ? "幣價" : "股價"} ${formatCurrency(priceTWD)} · ${unitsLabel} ${
                    derivedUnits > 0
                      ? derivedUnits.toLocaleString("zh-TW", { maximumFractionDigits: 4 })
                      : "--"
                  }`}
                </p>
              )}
              <p className="text-[12px] text-white/75">{formatDisplayDate(finalDate)}</p>
            </div>
            <div className="ml-3 flex flex-col items-center gap-1.5">
              {includeInChart && (
                <span className="flex items-center gap-1 rounded-full bg-white/[0.22] px-2.5 py-1 text-[11px] font-bold text-white">
                  圖表
                  <Check size={12} strokeWidth={3} />
                </span>
              )}
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex h-10 min-w-10 cursor-pointer items-center justify-center text-[15px] font-bold text-white disabled:opacity-40"
              >
                {/* 只改基本資料時寫「新增」會讓人以為不用存、切了就生效。 */}
                {submitting ? <Spinner size={18} /> : editBasicInfoOnly ? "儲存" : "新增"}
              </button>
            </div>
          </div>

          {/* Main form card */}
          <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
            {!editBasicInfoOnly &&
              (isLoan ? (
                <>
                  <LoanFormFields
                    values={loanValues}
                    color={categoryColor}
                    onChange={(v) => {
                      setLoanValues(v);
                      setLoanErrors({});
                    }}
                    errors={loanErrors}
                  />
                  <div className="mx-5 h-px bg-[#f2f2f7]" />
                  <div className="flex items-center justify-between px-5 py-4">
                    <p className="text-[16px] font-medium text-[#1c1c1e]">納入圖表</p>
                    <Toggle
                      checked={includeInChart}
                      onChange={(v) => void handleIncludeInChartChange(v)}
                      label="納入圖表"
                    />
                  </div>
                </>
              ) : isInvestment ? (
                <>
                  {hasStockPicker && (
                    <>
                      <button
                        onClick={() => !stockLocked && setShowStockPicker(true)}
                        disabled={stockLocked}
                        className="flex w-full cursor-pointer items-center justify-between px-5 py-4 active:bg-[#f2f2f7] disabled:cursor-default disabled:opacity-60"
                      >
                        <p className="text-[16px] font-medium text-[#1c1c1e]">選擇標的</p>
                        <div className="flex items-center gap-2">
                          {selectedStock ? (
                            <div className="text-right">
                              <p className="text-[15px] font-bold text-[#1c1c1e]">
                                {selectedStock.code}
                              </p>
                              <p className="max-w-[140px] truncate text-[12px] text-[#8e8e93]">
                                {selectedStock.name}
                              </p>
                            </div>
                          ) : (
                            <p className="text-[15px] text-[#c7c7cc]">未選擇</p>
                          )}
                          {!stockLocked && <ChevronRight size={16} className="text-[#c7c7cc]" />}
                        </div>
                      </button>
                      <div className="mx-5 h-px bg-[#f2f2f7]" />
                      <SegmentRow
                        options={[
                          { value: "units", label: isCrypto ? "依數量" : "依股數" },
                          { value: "amount", label: "依金額" },
                        ]}
                        value={inputMode}
                        onChange={(m) => {
                          setInputMode(m);
                          setError(null);
                        }}
                      />
                    </>
                  )}

                  {hasStockPicker ? (
                    <div className="flex divide-x divide-[#f2f2f7]">
                      {/* Left: price */}
                      <div className="w-1/2 min-w-0 px-5 py-4">
                        <div className="mb-1.5 flex items-center justify-between">
                          <p className="text-[12px] text-[#8e8e93]">{isCrypto ? "幣價" : "股價"}</p>
                          {selectedStock && !isPriceManual && (
                            <button
                              onClick={refreshPrice}
                              disabled={priceLoading}
                              className="cursor-pointer text-[12px] font-semibold text-[#374254]"
                            >
                              {priceLoading ? "更新中…" : "更新"}
                            </button>
                          )}
                        </div>
                        {isPriceManual ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={manualPriceStr}
                              onChange={(e) => setManualPriceStr(amountInput(e.target.value, 20))}
                              placeholder="0.00"
                              aria-label="手動股價"
                              className="min-w-0 flex-1 bg-transparent text-[20px] font-semibold text-[#1c1c1e] outline-none placeholder:text-[#c7c7cc]"
                            />
                            <button
                              onClick={() => setIsPriceManual(false)}
                              className="shrink-0 cursor-pointer text-[12px] text-[#374254]"
                            >
                              自動
                            </button>
                          </div>
                        ) : priceLoading ? (
                          <p className="mt-1 text-[14px] text-[#8e8e93]">查詢中…</p>
                        ) : (
                          <button
                            onClick={() => {
                              setIsPriceManual(true);
                              setManualPriceStr(originalPrice > 0 ? String(originalPrice) : "");
                            }}
                            className="w-full cursor-pointer text-left"
                          >
                            <p className="text-[20px] font-semibold text-[#1c1c1e]">
                              {originalPrice > 0
                                ? originalPrice.toLocaleString("zh-TW", {
                                    maximumFractionDigits: 6,
                                  })
                                : "--"}
                            </p>
                            {currency !== "TWD" && originalPrice > 0 && (
                              <p className="mt-0.5 text-[11px] text-[#8e8e93]">
                                {currency} × {exchangeRate.toFixed(2)}
                              </p>
                            )}
                            <p className="mt-0.5 text-[11px] text-[#374254]">手動輸入</p>
                          </button>
                        )}
                      </div>
                      {/* Right: units or amount */}
                      <div className="w-1/2 min-w-0 px-5 py-4">
                        {inputMode === "amount" ? (
                          <>
                            <div className="mb-1.5 flex items-center justify-between">
                              <p className="text-[12px] text-[#8e8e93]">投入金額 (TWD)</p>
                              {hasFxCalculator && (
                                <button
                                  onClick={() => setShowFxCalculator(true)}
                                  aria-label="換匯計算機"
                                  className="cursor-pointer text-[#8e8e93] active:opacity-60"
                                >
                                  <Calculator size={16} />
                                </button>
                              )}
                            </div>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={amountStr}
                              onChange={(e) => {
                                setAmountStr(amountInput(e.target.value));
                                setError(null);
                              }}
                              placeholder="0"
                              aria-label="投入金額"
                              className="w-full bg-transparent text-[20px] font-semibold text-[#1c1c1e] outline-none placeholder:text-[#c7c7cc]"
                            />
                          </>
                        ) : (
                          <>
                            <p className="mb-1.5 text-[12px] text-[#8e8e93]">{unitsLabel}</p>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={units}
                              onChange={(e) => {
                                setUnits(amountInput(e.target.value, 20));
                                setError(null);
                              }}
                              placeholder="0"
                              aria-label={unitsLabel}
                              className="w-full bg-transparent text-[20px] font-semibold text-[#1c1c1e] outline-none placeholder:text-[#c7c7cc]"
                            />
                          </>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between px-5 py-4">
                      <p className="text-[16px] font-medium text-[#1c1c1e]">{unitsLabel}</p>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={units}
                          onChange={(e) => {
                            setUnits(amountInput(e.target.value));
                            setError(null);
                          }}
                          placeholder="0"
                          aria-label={unitsLabel}
                          className="w-28 bg-transparent text-right text-[20px] font-semibold text-[#1c1c1e] outline-none placeholder:text-[#c7c7cc]"
                        />
                        <span className="rounded-full bg-[#66788E] px-2.5 py-1 text-[11px] font-bold text-white">
                          TWD
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Computed chip — the counterpart of what's typed */}
                  <div className="flex w-full items-center px-5 pb-4">
                    <div className="rounded-lg bg-[#f2f2f7] px-3 py-1.5">
                      {hasStockPicker && inputMode === "amount" ? (
                        <span className="text-[13px] text-[#8e8e93]">
                          ≈{" "}
                          <span className="font-semibold text-[#1c1c1e]">
                            {derivedUnits > 0
                              ? derivedUnits.toLocaleString("zh-TW", { maximumFractionDigits: 4 })
                              : "--"}
                          </span>{" "}
                          {unitsLabel}
                        </span>
                      ) : (
                        <span className="text-[13px] text-[#8e8e93]">
                          = TWD{" "}
                          <span className="font-semibold text-[#1c1c1e]">
                            {Math.round(computedValue).toLocaleString("zh-TW")}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {addRecord && !isLiability && (
                    <SegmentRow
                      options={[
                        { value: "income", label: "收入" },
                        { value: "expense", label: "支出" },
                      ]}
                      value={recordType}
                      onChange={(t) => {
                        setRecordType(t);
                        setError(null);
                      }}
                    />
                  )}
                  <div className="flex items-center justify-between px-5 py-4">
                    <p className="text-[16px] font-medium text-[#1c1c1e]">
                      {addRecord ? "新增金額" : getBalanceLabel(topCategory)}
                    </p>
                    <div className="flex items-center gap-2">
                      {negative && (
                        <span className="text-[20px] font-semibold text-[#ff3b30]">−</span>
                      )}
                      <input
                        type="text"
                        inputMode="decimal"
                        value={balance}
                        onChange={(e) => {
                          setBalance(amountInput(e.target.value));
                          setError(null);
                        }}
                        placeholder="0"
                        aria-label={addRecord ? "新增金額" : getBalanceLabel(topCategory)}
                        className={`w-28 bg-transparent text-right text-[20px] font-semibold outline-none placeholder:text-[#c7c7cc] ${
                          negative ? "text-[#ff3b30]" : "text-[#1c1c1e]"
                        }`}
                      />
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-bold text-white ${
                          negative ? "bg-[#ff3b30]" : "bg-[#66788E]"
                        }`}
                      >
                        TWD
                      </span>
                    </div>
                  </div>
                </>
              ))}

            {!isLoan && !editBasicInfoOnly && <div className="mx-5 h-px bg-[#f2f2f7]" />}

            {/* Bank icon (金融卡) — fixed at creation, so hidden when appending */}
            {isBankCard && !isLoan && !addRecord && (
              <>
                <button
                  onClick={() => setShowBankPicker(true)}
                  className="flex w-full cursor-pointer items-center justify-between px-5 py-4 active:bg-[#f2f2f7]"
                >
                  <p className="text-[16px] font-medium text-[#1c1c1e]">銀行圖示</p>
                  <div className="flex items-center gap-2">
                    {selectedBank ? (
                      <span className="flex items-center gap-1.5">
                        <BankLogo code={selectedBank.code} name={selectedBank.name} size={28} />
                        <span className="text-[15px] text-[#374254]">{selectedBank.name}</span>
                      </span>
                    ) : (
                      <span className="text-[15px] text-[#c7c7cc]">未選擇</span>
                    )}
                    <ChevronRight size={16} className="text-[#c7c7cc]" />
                  </div>
                </button>
                <div className="mx-5 h-px bg-[#f2f2f7]" />
              </>
            )}

            {!isLoan && (
              <>
                {!addRecord && (
                  <label className="flex items-center justify-between px-5 py-4">
                    <span className="shrink-0 text-[16px] font-medium text-[#1c1c1e]">
                      帳戶名稱
                    </span>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={`自訂名稱，預設為${subCategoryName}`}
                      className="ml-4 min-w-0 flex-1 bg-transparent text-right text-[15px] text-[#1c1c1e] outline-none placeholder:text-[#c7c7cc]"
                    />
                  </label>
                )}

                {/* Date — new entries and appended records (back-dating) */}
                {(!isEdit || addRecord) && (
                  <>
                    <div className="mx-5 h-px bg-[#f2f2f7]" />
                    <div className="flex items-center justify-between px-5 py-4">
                      <p className="shrink-0 text-[16px] font-medium text-[#1c1c1e]">日期</p>
                      <DateField value={date} onChange={setDate} ariaLabel="日期" />
                    </div>
                  </>
                )}

                {!addRecord && <div className="mx-5 h-px bg-[#f2f2f7]" />}
                <div className="flex items-center justify-between px-5 py-4">
                  <p className="text-[16px] font-medium text-[#1c1c1e]">納入圖表</p>
                  <Toggle
                    checked={includeInChart}
                    onChange={(v) => void handleIncludeInChartChange(v)}
                    label="納入圖表"
                  />
                </div>

                {!editBasicInfoOnly && (
                  <>
                    <div className="mx-5 h-px bg-[#f2f2f7]" />
                    <div className="px-5 py-4">
                      <p className="mb-2 text-[16px] font-medium text-[#1c1c1e]">備註</p>
                      <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="選填（最多 10 字）"
                        maxLength={10}
                        rows={1}
                        aria-label="備註"
                        className="w-full resize-none bg-transparent text-[15px] text-[#1c1c1e] outline-none placeholder:text-[#c7c7cc]"
                      />
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          {error != null && <p className="mt-3 text-center text-[13px] text-[#ff3b30]">{error}</p>}
        </div>
      </div>

      {hasStockPicker && (
        <StockPickerPage
          open={showStockPicker}
          onClose={() => setShowStockPicker(false)}
          onSelect={handleSelectStock}
          market={subCategoryName}
          color={categoryColor}
          {...(subCategoryName === "台股" && { holdings: twHoldings })}
        />
      )}
      {hasStockPicker && hasFxCalculator && quoteCurrency && (
        <FxCalculatorSheet
          open={showFxCalculator}
          onClose={() => setShowFxCalculator(false)}
          quoteCurrency={quoteCurrency}
          quoteFxRate={currency === quoteCurrency ? exchangeRate : null}
          onApply={(twd) => {
            setAmountStr(String(twd));
            setError(null);
          }}
        />
      )}
      {isBankCard && (
        <BankPickerPage
          open={showBankPicker}
          onClose={() => setShowBankPicker(false)}
          onSelect={(bank) => setSelectedBank(bank)}
          selectedCode={selectedBank?.code ?? null}
        />
      )}
    </>
  );
}
