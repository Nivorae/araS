"use client";

import { useState, useEffect, useMemo } from "react";
import { ChevronLeft, ChevronRight, Check, Info, RefreshCw, Landmark } from "lucide-react";
import { Spinner } from "../ui/Spinner";
import type { LucideIcon } from "lucide-react";
import { useFinanceStore } from "../../store/useFinanceStore";
import { StockPickerPage, type StockItem } from "./StockPickerPage";
import { BankPickerPage, BANKS, type BankItem } from "./BankPickerPage";
import { LoanFormFields, type LoanFormValues } from "./LoanFormFields";

interface EditItem {
  id: string;
  name: string;
  value: number;
  category: string;
  bankCode?: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void; // back button — close form only
  onSaved: () => void; // after save — close form + menu
  topCategory: string;
  isLiability?: boolean;
  categoryColor: string;
  subCategoryName: string;
  SubCategoryIcon: LucideIcon;
  editItem?: EditItem | null;
  nameSuggestion?: string | undefined;
}

function getUnitsLabel(subCategoryName: string): string {
  switch (subCategoryName) {
    case "投資基金":
      return "基金份額";
    case "台股":
    case "美股":
      return "持有股數";
    case "加密貨幣":
      return "持有數量";
    case "貴金屬":
      return "持有重量";
    default:
      return "持有數量";
  }
}

const INVESTMENT_CATEGORIES = ["投資基金", "台股", "美股", "加密貨幣", "貴金屬", "其他投資"];
const STOCK_PICKER_CATEGORIES = ["台股", "美股", "加密貨幣", "貴金屬"];
const LOAN_SUBCATEGORIES = ["房屋貸款", "汽車貸款", "消費貸款", "學生貸款", "其他貸款"];

const METAL_YF_SYMBOL: Record<string, string> = {
  xau: "GC=F", // Gold Futures
  xag: "SI=F", // Silver Futures
  xap: "PL=F", // Platinum Futures
  xpd: "PA=F", // Palladium Futures
};

const PRECIOUS_METALS: StockItem[] = [
  { code: "twgd", name: "Taiwan gold (tael) (New Taiwan Dollar/Taiwan tael)" },
  { code: "twgdg", name: "Taiwan gold (gram) (New Taiwan Dollar/Gram)" },
  { code: "gt", name: "Hongkong gold (Hong Kong Dollar/Ounce)" },
  { code: "xau", name: "Spot gold (U.S. Dollar/Ounce)" },
  { code: "xpd", name: "Spot palladium (U.S. Dollar/Ounce)" },
  { code: "xag", name: "Spot silver (U.S. Dollar/Ounce)" },
  { code: "xap", name: "Spot platinum (U.S. Dollar/Ounce)" },
];

export function AccountFormPage({
  open,
  onClose,
  onSaved,
  topCategory,
  categoryColor,
  subCategoryName,
  SubCategoryIcon,
  editItem,
  nameSuggestion,
}: Props) {
  const { addEntry, updateEntry, fetchAll, entries } = useFinanceStore();

  const twHoldings = useMemo<StockItem[]>(() => {
    const seen = new Set<string>();
    return entries
      .filter((e) => e.subCategory === "台股" && e.stockCode)
      .filter((e) => {
        if (seen.has(e.stockCode!)) return false;
        seen.add(e.stockCode!);
        return true;
      })
      .map((e) => ({ code: e.stockCode!, name: e.name }));
  }, [entries]);

  const isEdit = !!editItem;
  const isInvestment = topCategory === "投資" && INVESTMENT_CATEGORIES.includes(subCategoryName);
  const isLoan = LOAN_SUBCATEGORIES.includes(subCategoryName);
  const hasStockPicker = STOCK_PICKER_CATEGORIES.includes(subCategoryName);

  // Standard form state
  const [balance, setBalance] = useState("");

  // Investment form state
  const [units, setUnits] = useState("");
  const [originalPrice, setOriginalPrice] = useState(0);
  const [currency, setCurrency] = useState("TWD");
  const [exchangeRate, setExchangeRate] = useState(1);
  const [isPriceManual, setIsPriceManual] = useState(false);
  const [manualPriceStr, setManualPriceStr] = useState("");

  // Stock picker state
  const [showStockPicker, setShowStockPicker] = useState(false);
  const [selectedStock, setSelectedStock] = useState<StockItem | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [selectedBank, setSelectedBank] = useState<BankItem | null>(null);
  const [showBankPicker, setShowBankPicker] = useState(false);

  const [name, setName] = useState("");
  const [includeInChart, setIncludeInChart] = useState(true);
  const [note, setNote] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0] ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [loanErrors, setLoanErrors] = useState<Partial<Record<keyof LoanFormValues, string>>>({});
  const [loanValues, setLoanValues] = useState<LoanFormValues>({
    loanName: "",
    totalAmount: "",
    annualInterestRate: "",
    termMonths: "",
    startDate: new Date().toISOString().split("T")[0] ?? "",
    gracePeriodMonths: "0",
    repaymentType: "principal_interest",
  });

  const computedValue = useMemo(() => {
    const u = parseFloat(units) || 0;
    if (!hasStockPicker) return u;
    const price = isPriceManual ? parseFloat(manualPriceStr) || 0 : originalPrice;
    const priceTWD = currency === "TWD" ? price : price * exchangeRate;
    return u * priceTWD;
  }, [units, originalPrice, isPriceManual, manualPriceStr, currency, exchangeRate, hasStockPicker]);

  useEffect(() => {
    if (!open) return;

    setFormError(null);
    setLoanErrors({});
    setName(editItem?.name ?? nameSuggestion ?? "");
    setIncludeInChart(true);
    setNote("");
    setDate(new Date().toISOString().split("T")[0] ?? "");
    setSelectedStock(null);
    setSelectedBank(
      editItem?.bankCode ? (BANKS.find((b) => b.code === editItem.bankCode) ?? null) : null
    );
    setOriginalPrice(0);
    setCurrency("TWD");
    setExchangeRate(1);
    setIsPriceManual(false);
    setManualPriceStr("");
    if (isInvestment) {
      setUnits(editItem ? String(editItem.value) : "");
    } else {
      setBalance(editItem ? String(editItem.value) : "");
    }

    if (isLoan) {
      setLoanValues({
        loanName: nameSuggestion ?? "",
        totalAmount: "",
        annualInterestRate: "",
        termMonths: "",
        startDate: new Date().toISOString().split("T")[0] ?? "",
        gracePeriodMonths: "0",
        repaymentType: "principal_interest",
      });
    }

    // Auto-select stock by name when opening "add" from a detail page
    if (!nameSuggestion || !hasStockPicker || editItem) return;

    let cancelled = false;
    const run = async () => {
      let stocks: StockItem[] = [];
      try {
        if (subCategoryName === "台股") {
          const res = await fetch("/api/stocks/tw");
          const data: Record<string, string>[] = await res.json();
          stocks = data
            .map((item) => ({
              code: item["公司代號"] ?? "",
              name: item["公司簡稱"] ?? item["公司名稱"] ?? "",
            }))
            .filter((s) => s.code && s.name);
        } else if (subCategoryName === "美股") {
          const res = await fetch("/api/stocks/us");
          stocks = (await res.json()) as StockItem[];
        } else if (subCategoryName === "加密貨幣") {
          const res = await fetch("/api/stocks/crypto");
          stocks = (await res.json()) as StockItem[];
        } else if (subCategoryName === "貴金屬") {
          stocks = PRECIOUS_METALS;
        }
      } catch {
        return;
      }
      if (cancelled) return;

      const match = stocks.find((s) => s.name === nameSuggestion);
      if (!match) return;

      setSelectedStock(match);

      let yfSymbol = "";
      if (subCategoryName === "貴金屬") {
        yfSymbol = METAL_YF_SYMBOL[match.code.toLowerCase()] ?? "";
      } else {
        const suffix =
          subCategoryName === "台股" ? ".TW" : subCategoryName === "加密貨幣" ? "-USD" : "";
        yfSymbol = match.code + suffix;
      }
      if (!yfSymbol) return;

      setPriceLoading(true);
      try {
        const r = await fetch(`/api/stocks/price?symbol=${encodeURIComponent(yfSymbol)}`);
        const priceData = await r.json();
        if (cancelled) return;
        if (typeof priceData.price === "number") {
          const fetchedPrice = priceData.price as number;
          const fetchedCurrency = (priceData.currency as string) ?? "USD";
          setOriginalPrice(fetchedPrice);
          setCurrency(fetchedCurrency);
          if (fetchedCurrency !== "TWD") {
            try {
              const fxRes = await fetch(
                `/api/stocks/price?symbol=${encodeURIComponent(fetchedCurrency + "TWD=X")}`
              );
              const fxData = await fxRes.json();
              if (!cancelled && typeof fxData.price === "number")
                setExchangeRate(fxData.price as number);
            } catch {
              /* keep rate = 1 */
            }
          } else {
            setExchangeRate(1);
          }
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setPriceLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [open, editItem, nameSuggestion, isInvestment, hasStockPicker, subCategoryName, isLoan]);

  const handleSelectStock = (stock: StockItem) => {
    setSelectedStock(stock);
    if (!name) setName(stock.name);
    setIsPriceManual(false);
    setManualPriceStr("");

    // Build Yahoo Finance symbol: 台股 → code.TW, 加密貨幣 → code-USD, 美股 → code as-is
    // 貴金屬 → use predefined mapping (xau→XAU=X, etc.); unmapped metals skip price fetch
    let yfSymbol: string;
    if (subCategoryName === "貴金屬") {
      yfSymbol = METAL_YF_SYMBOL[stock.code.toLowerCase()] ?? "";
    } else {
      const suffix =
        subCategoryName === "台股" ? ".TW" : subCategoryName === "加密貨幣" ? "-USD" : "";
      yfSymbol = stock.code + suffix;
    }

    if (!yfSymbol) {
      setOriginalPrice(0);
      setCurrency("TWD");
      setExchangeRate(1);
      return;
    }

    setPriceLoading(true);
    fetch(`/api/stocks/price?symbol=${encodeURIComponent(yfSymbol)}`)
      .then((r) => r.json())
      .then(async (data) => {
        if (typeof data.price !== "number") return;
        const fetchedPrice = data.price as number;
        const fetchedCurrency = (data.currency as string) ?? "USD";
        setOriginalPrice(fetchedPrice);
        setCurrency(fetchedCurrency);
        if (fetchedCurrency !== "TWD") {
          try {
            const fxRes = await fetch(
              `/api/stocks/price?symbol=${encodeURIComponent(fetchedCurrency + "TWD=X")}`
            );
            const fxData = await fxRes.json();
            if (typeof fxData.price === "number") setExchangeRate(fxData.price as number);
          } catch {
            /* keep rate = 1 */
          }
        } else {
          setExchangeRate(1);
        }
      })
      .catch(() => {})
      .finally(() => setPriceLoading(false));
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
      if (!units || parseFloat(units) <= 0) {
        setFormError(`請輸入${getUnitsLabel(subCategoryName)}`);
        return false;
      }
    } else {
      if (!balance || isNaN(parseFloat(balance))) {
        setFormError("請輸入帳戶餘額");
        return false;
      }
    }
    setFormError(null);
    return true;
  };

  const handleSubmit = async () => {
    if (isLoan && !validateLoan()) return;
    if (!isLoan && !validateGeneral()) return;
    setFormError(null);
    setSubmitting(true);
    try {
      if (isLoan) {
        const res = await fetch("/api/loans", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            loanName: loanValues.loanName.trim() || subCategoryName,
            category: subCategoryName,
            totalAmount: parseFloat(loanValues.totalAmount) || 0,
            annualInterestRate: parseFloat(loanValues.annualInterestRate) || 0,
            termMonths: parseInt(loanValues.termMonths) || 0,
            startDate: new Date(loanValues.startDate).toISOString(),
            gracePeriodMonths: parseInt(loanValues.gracePeriodMonths) || 0,
            repaymentType: loanValues.repaymentType,
          }),
        });
        if (!res.ok) throw new Error("貸款建立失敗");
        await fetchAll();
      } else {
        const value = isInvestment ? computedValue : parseFloat(balance) || 0;
        const finalName = name.trim() || selectedStock?.name || subCategoryName;
        const unitsParsed = hasStockPicker ? parseFloat(units) || undefined : undefined;

        if (isEdit && editItem) {
          await updateEntry(editItem.id, {
            name: finalName,
            topCategory,
            subCategory: subCategoryName,
            value,
            ...(selectedStock ? { stockCode: selectedStock.code } : {}),
            ...(unitsParsed != null ? { units: unitsParsed } : {}),
            ...(selectedBank ? { bankCode: selectedBank.code } : {}),
          });
        } else {
          await addEntry({
            name: finalName,
            topCategory,
            subCategory: subCategoryName,
            value,
            ...(selectedStock ? { stockCode: selectedStock.code } : {}),
            ...(unitsParsed != null ? { units: unitsParsed } : {}),
            ...(selectedBank ? { bankCode: selectedBank.code } : {}),
            createdAt: date,
          });
        }
      }
      onSaved();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div
        className={`fixed inset-0 z-[70] bg-[#f2f2f7] transition-transform duration-300 ease-in-out ${
          open ? "translate-x-0" : "pointer-events-none translate-x-full"
        }`}
      >
        <div className="mx-auto max-w-md px-4 pt-14">
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
                <Check size={20} style={{ color: "black" }} strokeWidth={2.5} />
              )}
            </button>
          </div>

          {/* Account type header */}
          <div className="mb-5 flex items-center justify-between">
            <p className="text-[22px] font-bold text-[#1c1c1e]">帳戶</p>
            <div className="flex items-center gap-2">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-xl"
                style={{ backgroundColor: categoryColor + "25" }}
              >
                <SubCategoryIcon size={20} style={{ color: categoryColor }} />
              </div>
              <p className="text-[18px] font-semibold text-[#1c1c1e]">{subCategoryName}</p>
            </div>
          </div>

          {/* Main form card */}
          <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
            {isLoan ? (
              <LoanFormFields
                values={loanValues}
                color={categoryColor}
                onChange={(v) => {
                  setLoanValues(v);
                  setLoanErrors({});
                }}
                errors={loanErrors}
              />
            ) : isInvestment ? (
              <>
                {/* Stock selector row */}
                {hasStockPicker && (
                  <>
                    <button
                      onClick={() => !nameSuggestion && setShowStockPicker(true)}
                      disabled={!!nameSuggestion}
                      className="flex w-full items-center justify-between px-5 py-4 active:bg-[#f2f2f7] disabled:cursor-default disabled:opacity-60"
                    >
                      <p className="text-[16px] font-medium text-[#1c1c1e]">選擇股票</p>
                      <div className="flex items-center gap-2">
                        {selectedStock ? (
                          <div className="text-right">
                            <p className="text-[15px] font-semibold text-[#1c1c1e]">
                              {selectedStock.code}
                            </p>
                            <p className="text-[12px] text-[#8e8e93]">{selectedStock.name}</p>
                          </div>
                        ) : (
                          <p className="text-[15px] text-[#c7c7cc]">未選擇</p>
                        )}
                        {!nameSuggestion && <ChevronRight size={16} className="text-[#c7c7cc]" />}
                      </div>
                    </button>
                    <div className="mx-5 h-px bg-[#f2f2f7]" />
                  </>
                )}

                {/* Price + Units row (split) */}
                {hasStockPicker ? (
                  <div className="flex divide-x divide-[#f2f2f7]">
                    {/* Left: stock price */}
                    <div className="w-1/2 min-w-0 px-5 py-4">
                      <p className="mb-1 text-[12px] text-[#8e8e93]">股價</p>
                      {isPriceManual ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={manualPriceStr}
                            onChange={(e) => setManualPriceStr(e.target.value)}
                            placeholder="0.00"
                            className="min-w-0 flex-1 bg-transparent text-[20px] font-semibold text-[#1c1c1e] outline-none placeholder:text-[#c7c7cc]"
                          />
                          <button
                            onClick={() => setIsPriceManual(false)}
                            className="shrink-0 text-[12px] text-[#374254]"
                          >
                            自動
                          </button>
                        </div>
                      ) : priceLoading ? (
                        <p className="text-[14px] text-[#8e8e93]">查詢中…</p>
                      ) : (
                        <button
                          onClick={() => {
                            setIsPriceManual(true);
                            setManualPriceStr(originalPrice > 0 ? String(originalPrice) : "");
                          }}
                          className="w-full text-left"
                        >
                          <p className="text-[20px] font-semibold text-[#1c1c1e]">
                            {originalPrice > 0
                              ? originalPrice.toLocaleString(undefined, {
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

                    {/* Right: units */}
                    <div className="w-1/2 min-w-0 px-5 py-4">
                      <p className="mb-1 text-[12px] text-[#8e8e93]">
                        {getUnitsLabel(subCategoryName)}
                      </p>
                      <input
                        type="number"
                        value={units}
                        onChange={(e) => {
                          setUnits(e.target.value);
                          setFormError(null);
                        }}
                        placeholder="0"
                        className="w-full bg-transparent text-[20px] font-semibold text-[#1c1c1e] outline-none placeholder:text-[#c7c7cc]"
                      />
                    </div>
                  </div>
                ) : (
                  /* Non-stock-picker investment (fund, other): just enter total value */
                  <div className="flex items-center justify-between px-5 py-4">
                    <p className="text-[16px] font-medium text-[#1c1c1e]">
                      {getUnitsLabel(subCategoryName)}
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={units}
                        onChange={(e) => {
                          setUnits(e.target.value);
                          setFormError(null);
                        }}
                        placeholder="0"
                        className="w-24 bg-transparent text-right text-[20px] font-semibold text-[#1c1c1e] outline-none placeholder:text-[#c7c7cc]"
                      />
                      <span className="rounded-full bg-[#1c1c1e] px-2.5 py-1 text-[11px] font-bold text-white">
                        TWD
                      </span>
                    </div>
                  </div>
                )}

                {/* Computed total */}
                <div className="flex w-full items-center px-5 pb-4">
                  <div className="rounded-lg bg-[#f2f2f7] px-3 py-1.5">
                    <span className="text-[13px] text-[#8e8e93]">
                      =&nbsp;TWD&nbsp;
                      <span className="font-semibold text-[#1c1c1e]">
                        {computedValue.toLocaleString()}
                      </span>
                    </span>
                  </div>
                </div>
              </>
            ) : (
              /* Standard balance */
              <div className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="text-[16px] font-medium text-[#1c1c1e]">帳戶</p>
                  <p className="text-[16px] font-medium text-[#1c1c1e]">餘額</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={balance}
                    onChange={(e) => {
                      setBalance(e.target.value);
                      setFormError(null);
                    }}
                    placeholder="0"
                    className="w-24 bg-transparent text-right text-[20px] font-semibold text-[#1c1c1e] outline-none placeholder:text-[#c7c7cc]"
                  />
                  <span className="rounded-full bg-[#1c1c1e] px-2.5 py-1 text-[11px] font-bold text-white">
                    TWD
                  </span>
                </div>
              </div>
            )}

            <div className="mx-5 h-px bg-[#f2f2f7]" />

            {/* Icon — only for 金融卡 */}
            {subCategoryName === "金融卡" && !isLoan && (
              <>
                <button
                  onClick={() => setShowBankPicker(true)}
                  className="flex w-full items-center justify-between px-5 py-4 active:bg-[#f2f2f7]"
                >
                  <p className="text-[16px] font-medium text-[#1c1c1e]">Icon</p>
                  <div className="flex items-center gap-2">
                    {selectedBank ? (
                      <div className="relative h-8 w-8">
                        <img
                          src={`/banks/${selectedBank.code}.png`}
                          alt={selectedBank.name}
                          className="h-full w-full rounded-lg object-contain"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                            const fallback = e.currentTarget
                              .nextElementSibling as HTMLElement | null;
                            if (fallback) fallback.style.display = "flex";
                          }}
                        />
                        <div
                          className="absolute inset-0 flex items-center justify-center rounded-lg bg-[#e5e5ea] text-[10px] font-bold text-[#636366]"
                          style={{ display: "none" }}
                        >
                          {selectedBank.name[0]}
                        </div>
                      </div>
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f2f2f7]">
                        <Landmark size={16} className="text-[#8e8e93]" />
                      </div>
                    )}
                    <ChevronRight size={16} className="text-[#c7c7cc]" />
                  </div>
                </button>
                <div className="mx-5 h-px bg-[#f2f2f7]" />
              </>
            )}

            {/* Account Name */}
            <div className="flex items-center justify-between px-5 py-4">
              <p className="shrink-0 text-[16px] font-medium text-[#1c1c1e]">帳戶名稱</p>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={`自訂名稱，預設為${subCategoryName}`}
                className="ml-4 min-w-0 flex-1 bg-transparent text-right text-[14px] text-[#8e8e93] outline-none placeholder:text-[#c7c7cc]"
              />
            </div>

            <div className="mx-5 h-px bg-[#f2f2f7]" />

            {/* Date — only shown when adding a new entry */}
            {!isEdit && (
              <>
                <div className="flex items-center justify-between px-5 py-4">
                  <p className="shrink-0 text-[16px] font-medium text-[#1c1c1e]">日期</p>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="bg-transparent text-right text-[14px] text-[#8e8e93] outline-none"
                  />
                </div>
                <div className="mx-5 h-px bg-[#f2f2f7]" />
              </>
            )}

            {/* Include in Chart */}
            <div className="flex items-center justify-between px-5 py-4">
              <p className="text-[16px] font-medium text-[#1c1c1e]">納入圖表</p>
              <button
                onClick={() => setIncludeInChart((v) => !v)}
                className={`relative h-[30px] w-[52px] rounded-full transition-colors duration-200 ${
                  includeInChart ? "bg-[#0e1424]" : "bg-[#e5e5ea]"
                }`}
              >
                <span
                  className={`absolute top-[3px] left-[3px] h-6 w-6 rounded-full bg-white shadow transition-transform duration-200 ${
                    includeInChart ? "translate-x-[22px]" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            <div className="mx-5 h-px bg-[#f2f2f7]" />

            {/* Note */}
            <div className="px-5 py-4">
              <p className="mb-2 text-[16px] font-medium text-[#1c1c1e]">備註</p>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="選填"
                className="w-full bg-transparent text-[14px] text-[#8e8e93] outline-none placeholder:text-[#c7c7cc]"
              />
            </div>
          </div>

          {formError && <p className="mt-3 text-center text-[13px] text-[#ff3b30]">{formError}</p>}

          {/* Recurrences section */}
          <div className="mt-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#1c1c1e]">
                <RefreshCw size={16} className="text-[#1c1c1e]" />
              </div>
              <p className="text-[17px] font-semibold text-[#1c1c1e]">定期項目</p>
            </div>
            <button className="rounded-full border border-[#1c1c1e] px-4 py-1.5 text-[13px] font-medium text-[#1c1c1e] active:bg-[#e5e5ea]">
              新增定期
            </button>
          </div>

          {/* Recurrences info card */}
          <div className="mt-3 flex gap-3 rounded-2xl bg-white p-4 shadow-sm">
            <Info size={18} className="mt-0.5 shrink-0 text-[#8e8e93]" />
            <p className="text-[13px] leading-relaxed text-[#8e8e93]">
              新增定期交易，例如帳單、薪資、租金等。可以先填入預估金額，之後再依實際情況調整。
            </p>
          </div>
        </div>
      </div>

      {/* Stock picker — slides in on top at z-80 */}
      <StockPickerPage
        open={showStockPicker}
        onClose={() => setShowStockPicker(false)}
        onSelect={handleSelectStock}
        market={subCategoryName}
        color={categoryColor}
        {...(subCategoryName === "台股" && { holdings: twHoldings })}
      />
      <BankPickerPage
        open={showBankPicker}
        onClose={() => setShowBankPicker(false)}
        onSelect={(bank) => setSelectedBank(bank)}
        selectedCode={selectedBank?.code ?? null}
      />
    </>
  );
}
