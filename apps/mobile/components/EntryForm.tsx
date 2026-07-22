import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Calendar, Check, ChevronLeft, ChevronRight } from "lucide-react-native";
import { BankLogo } from "./BankLogo";
import { useFinanceActions } from "@/hooks/useFinanceActions";
import { useFinanceStore } from "@/store/financeStore";
import { useApi, ApiError } from "@/lib/api";
import { getNodeIcon } from "@/lib/categoryConfig";
import {
  INVESTMENT_CATS,
  STOCK_CATS,
  LOAN_SUBCATS,
  buildYfSymbol,
  getUnitsLabel,
  type StockItem,
} from "@/lib/stockConstants";
import { StockPickerModal } from "./StockPickerModal";
import { BankPickerModal, BANKS, type BankItem } from "./BankPickerModal";
import { LoanFormFields, type LoanFormValues } from "./LoanFormFields";
import { DatePickerModal } from "./DatePickerModal";
import type { RepaymentType } from "@repo/shared";

// ─── helpers ──────────────────────────────────────────────────────────────────

function getBalanceLabel(topCategory: string) {
  if (topCategory === "應收款") return "應收餘額";
  if (topCategory === "負債") return "負債金額";
  return "帳戶餘額";
}

function parseISODate(s: string): Date {
  const d = new Date(s);
  return isNaN(d.getTime()) ? new Date() : d;
}
function toISODate(d: Date): string {
  return d.toISOString().split("T")[0] ?? "";
}
function formatDisplayDate(s: string): string {
  const d = parseISODate(s);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

// ─────────────────────────────────────────────────────────────────────────────

function defaultLoanValues(): LoanFormValues {
  return {
    loanName: "",
    totalAmount: "",
    annualInterestRate: "",
    termMonths: "",
    startDate: new Date().toISOString().split("T")[0] ?? "",
    gracePeriodMonths: "0",
    repaymentType: "principal_interest" as RepaymentType,
  };
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface EntryFormProps {
  topCategory: string;
  subCategory: string;
  isLiability: boolean;
  color: string;
  isEdit: boolean;
  entryId?: string;
  initialName?: string;
  initialValue?: number;
  initialStockCode?: string;
  initialUnits?: number;
  initialNote?: string;
  /** Pre-select the bank icon (金融卡) chosen when the entry was created. */
  initialBankCode?: string;
  /** Whether this entry counts toward the net-worth chart (default true). */
  initialIncludeInChart?: boolean;
  /** Lock the stock to the prefilled one (adding a record to an existing holding). */
  lockStockPicker?: boolean;
  /**
   * Append a new record to THIS entry (same id) instead of replacing its value.
   * The entered amount is ADDED on top of `baseValue`, and the service logs the
   * difference as a fresh history line ("子項目"). Requires `isEdit` + `entryId`.
   */
  addRecord?: boolean;
  /** Current value of the entry, used as the base when `addRecord` is true. */
  baseValue?: number;
  onBack: () => void;
  onSaved: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function EntryForm({
  topCategory,
  subCategory,
  isLiability,
  color,
  isEdit,
  entryId,
  initialName = "",
  initialValue,
  initialStockCode = "",
  initialUnits,
  initialNote = "",
  initialBankCode = "",
  initialIncludeInChart = true,
  lockStockPicker = false,
  addRecord = false,
  baseValue = 0,
  onBack,
  onSaved,
}: EntryFormProps) {
  const { addEntry, updateEntry, fetchAll } = useFinanceActions();
  const entries = useFinanceStore((s) => s.entries);
  const api = useApi();
  const apiRef = useRef(api);
  apiRef.current = api;
  const router = useRouter();

  // ── Mode flags ───────────────────────────────────────────────────────────────
  const isInvestment =
    topCategory === "投資" && (INVESTMENT_CATS as readonly string[]).includes(subCategory);
  const hasStockPicker = (STOCK_CATS as readonly string[]).includes(subCategory);
  const isLoan = (LOAN_SUBCATS as readonly string[]).includes(subCategory);
  const isBankCard = subCategory === "金融卡";
  // The ✏️ edit button edits the entry's BASIC INFO only (name / icon / 納入圖表).
  // It must not touch the balance — that lives in the history records — so the
  // amount fields are hidden and `value` is never sent (no history line created).
  const editBasicInfoOnly = isEdit && !addRecord && !isLoan;

  // ── Common state ─────────────────────────────────────────────────────────────
  const [name, setName] = useState(initialName);
  // Appending a record starts a fresh note — the entry's stored note belongs to
  // the entry/last record, not this new line, so it must not pre-fill here.
  const [note, setNote] = useState(addRecord ? "" : initialNote);
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0] ?? "");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [includeInChart, setIncludeInChart] = useState(initialIncludeInChart);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Re-enable together with the "新增定期" action block below.
  // const [showRecurrenceInfo, setShowRecurrenceInfo] = useState(false);

  // ── Standard balance ─────────────────────────────────────────────────────────
  // When adding a record, the field is the NEW amount to append — start empty.
  const [balance, setBalance] = useState(
    !isInvestment && !addRecord && initialValue != null ? String(initialValue) : ""
  );

  // ── Investment / stock state ──────────────────────────────────────────────────
  const [units, setUnits] = useState(() => {
    if (!isInvestment || addRecord) return "";
    if (hasStockPicker) return initialUnits != null ? String(initialUnits) : "";
    return initialValue != null ? String(initialValue) : "";
  });

  const [selectedStock, setSelectedStock] = useState<StockItem | null>(
    initialStockCode ? { code: initialStockCode, name: initialName } : null
  );
  const [showStockPicker, setShowStockPicker] = useState(false);
  const [priceLoading, setPriceLoading] = useState(false);
  const [originalPrice, setOriginalPrice] = useState(0);
  const [currency, setCurrency] = useState("TWD");
  const [exchangeRate, setExchangeRate] = useState(1);
  const [isPriceManual, setIsPriceManual] = useState(false);
  const [manualPriceStr, setManualPriceStr] = useState("");
  // Input mode for stock-picker investments: enter a quantity ("units") or a
  // cost amount in TWD ("amount"). Crypto defaults to amount — fractional coin
  // counts are unintuitive, so users think in money (item 4). Stocks default to
  // quantity but can switch to amount → shares (item 17).
  const isCrypto = subCategory === "加密貨幣";
  const [inputMode, setInputMode] = useState<"units" | "amount">(
    isCrypto && initialUnits == null ? "amount" : "units"
  );
  const [amountStr, setAmountStr] = useState("");

  // ── Bank picker ───────────────────────────────────────────────────────────────
  // Pre-select the bank chosen at creation so editing shows the current icon.
  const [selectedBank, setSelectedBank] = useState<BankItem | null>(() =>
    initialBankCode ? (BANKS.find((b) => b.code === initialBankCode) ?? null) : null
  );
  const [showBankPicker, setShowBankPicker] = useState(false);

  // ── Loan state ────────────────────────────────────────────────────────────────
  const [loanValues, setLoanValues] = useState<LoanFormValues>(() => defaultLoanValues());
  const [loanErrors, setLoanErrors] = useState<Partial<Record<keyof LoanFormValues, string>>>({});

  // ── Price + computed value (investment) ───────────────────────────────────────
  // Effective per-unit price in TWD (manual override or fetched × FX).
  const priceTWD = useMemo(() => {
    const price = isPriceManual ? parseFloat(manualPriceStr) || 0 : originalPrice;
    return currency === "TWD" ? price : price * exchangeRate;
  }, [isPriceManual, manualPriceStr, originalPrice, currency, exchangeRate]);

  // Shares implied by a cost amount (amount mode). Used both for the preview chip
  // and for the `units` saved to the backend so P&L keeps working.
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

  // ── Existing holdings for picker (台股 dedup) ──────────────────────────────
  const twHoldings = useMemo<StockItem[]>(() => {
    if (subCategory !== "台股") return [];
    const seen = new Set<string>();
    return entries
      .filter((e) => e.subCategory === "台股" && e.stockCode)
      .filter((e) => {
        if (seen.has(e.stockCode!)) return false;
        seen.add(e.stockCode!);
        return true;
      })
      .map((e) => ({ code: e.stockCode!, name: e.name }));
  }, [entries, subCategory]);

  // ── Shared price fetch (mount, on select, and manual 更新 button) ─────────────
  const fetchPriceFor = useCallback(async (yfSymbol: string) => {
    setPriceLoading(true);
    try {
      const data = await apiRef.current.rawGet<{ price: number; currency: string }>(
        `/api/stocks/price?symbol=${encodeURIComponent(yfSymbol)}`
      );
      if (typeof data.price !== "number") return;
      setOriginalPrice(data.price);
      const c = data.currency ?? "TWD";
      setCurrency(c);
      if (c !== "TWD") {
        const fx = await apiRef.current
          .rawGet<{
            price: number;
          }>(`/api/stocks/price?symbol=${encodeURIComponent(c + "TWD=X")}`)
          .catch(() => null);
        if (fx && typeof fx.price === "number") setExchangeRate(fx.price);
      } else {
        setExchangeRate(1);
      }
    } catch {
      /* silently fail */
    } finally {
      setPriceLoading(false);
    }
  }, []);

  // Fetch the price ONCE on mount when a stock is prefilled (editing an existing
  // stock entry, or adding a record to a holding). Item 8: no repeated auto-fetch
  // afterwards — the user taps 更新 to refresh.
  useEffect(() => {
    if (!initialStockCode || !isInvestment || !hasStockPicker) return;
    const yfSymbol = buildYfSymbol(subCategory, initialStockCode);
    if (yfSymbol) fetchPriceFor(yfSymbol);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // mount only — intentionally ignore deps; values are stable at mount

  // ── Fetch price when a stock is selected in the picker ────────────────────────
  const handleSelectStock = useCallback(
    async (stock: StockItem) => {
      setSelectedStock(stock);
      if (!name) setName(stock.name);
      setIsPriceManual(false);
      setManualPriceStr("");

      const yfSymbol = buildYfSymbol(subCategory, stock.code);
      if (!yfSymbol) {
        setOriginalPrice(0);
        setCurrency("TWD");
        setExchangeRate(1);
        return;
      }
      await fetchPriceFor(yfSymbol);
    },
    [name, subCategory, fetchPriceFor]
  );

  // Manual refresh (item 8): re-fetch the currently selected stock's price.
  const refreshPrice = useCallback(() => {
    if (!selectedStock) return;
    const yfSymbol = buildYfSymbol(subCategory, selectedStock.code);
    if (yfSymbol) fetchPriceFor(yfSymbol);
  }, [selectedStock, subCategory, fetchPriceFor]);

  // ── Validation ────────────────────────────────────────────────────────────────
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
        setError(`請輸入${getUnitsLabel(subCategory)}`);
        return false;
      }
    } else {
      if (!balance || isNaN(parseFloat(balance))) {
        setError(`請輸入${getBalanceLabel(topCategory)}`);
        return false;
      }
    }
    setError(null);
    return true;
  };

  // ── Submit ────────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (isLoan && !validateLoan()) return;
    // Basic-info edit has no amount field, so skip the value/units validation.
    if (!isLoan && !editBasicInfoOnly && !validateGeneral()) return;
    setError(null);
    setSubmitting(true);

    try {
      if (isLoan) {
        await apiRef.current.post("/api/loans", {
          loanName: loanValues.loanName.trim() || subCategory,
          category: subCategory,
          totalAmount: parseFloat(loanValues.totalAmount) || 0,
          annualInterestRate: parseFloat(loanValues.annualInterestRate) || 0,
          termMonths: parseInt(loanValues.termMonths) || 0,
          startDate: new Date(loanValues.startDate).toISOString(),
          gracePeriodMonths: parseInt(loanValues.gracePeriodMonths) || 0,
          repaymentType: loanValues.repaymentType,
        });
        await fetchAll();
      } else if (editBasicInfoOnly && entryId) {
        // Edit basic info only: update name + icon (金融卡). No `value` is sent,
        // so the backend creates no history line and the balance is untouched.
        await updateEntry(entryId, {
          name: name.trim() || selectedStock?.name || subCategory,
          includeInChart,
          ...(isBankCard && selectedBank ? { bankCode: selectedBank.code } : {}),
        });
      } else {
        const entered = isInvestment ? computedValue : parseFloat(balance) || 0;
        // Add-record mode appends on top of the current value; edit/create replace.
        const value = addRecord ? baseValue + entered : entered;
        const finalName = name.trim() || selectedStock?.name || subCategory;
        // In amount mode `units` is derived from the cost amount ÷ price so the
        // holding's share count (and P&L) stays correct.
        const unitsParsed = hasStockPicker ? derivedUnits || undefined : undefined;

        if (isEdit && entryId) {
          await updateEntry(entryId, {
            name: finalName,
            topCategory,
            subCategory,
            value,
            includeInChart,
            note: note.trim() || undefined,
            ...(hasStockPicker && selectedStock ? { stockCode: selectedStock.code } : {}),
            ...(unitsParsed != null ? { units: unitsParsed } : {}),
            ...(isBankCard && selectedBank ? { bankCode: selectedBank.code } : {}),
            // Back-date the appended record when adding to an existing holding.
            ...(addRecord ? { createdAt: date } : {}),
          });
        } else {
          await addEntry({
            name: finalName,
            topCategory,
            subCategory,
            value,
            includeInChart,
            note: note.trim() || undefined,
            ...(hasStockPicker && selectedStock ? { stockCode: selectedStock.code } : {}),
            ...(unitsParsed != null ? { units: unitsParsed } : {}),
            ...(isBankCard && selectedBank ? { bankCode: selectedBank.code } : {}),
            createdAt: date,
          });
        }
      }
      onSaved();
    } catch (e) {
      if (e instanceof ApiError && e.code === "ENTRY_LIMIT_REACHED") {
        Alert.alert(
          "你的資產版圖越來越豐富了",
          "身為重度用戶，你值得更大的空間。免費版可記 20 筆，升級 Premium 解鎖無上限，輕鬆管理。",
          [
            { text: "稍後再決定", style: "cancel" },
            { text: "解鎖無上限", onPress: () => router.push("/paywall") },
          ]
        );
        return;
      }
      setError(e instanceof Error ? e.message : "儲存失敗，請重試");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  const Icon = getNodeIcon(topCategory, subCategory);
  const accentColor = color === "#FFFFFF" ? "#374254" : color;
  const stockLocked = isEdit || lockStockPicker;

  return (
    <SafeAreaView style={s.root}>
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView
          style={s.flex}
          contentContainerStyle={s.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Floating nav buttons ────────────────────────────────────── */}
          <View style={s.navRow}>
            <TouchableOpacity
              onPress={onBack}
              style={s.navCircle}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <ChevronLeft size={20} color="#1c1c1e" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={submitting}
              style={[s.navCircle, { opacity: submitting ? 0.4 : 1 }]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={accentColor} />
              ) : (
                <Check size={20} color="#1c1c1e" strokeWidth={2.5} />
              )}
            </TouchableOpacity>
          </View>

          {/* ── Title row ───────────────────────────────────────────────── */}
          <View style={s.titleRow}>
            <Text style={s.titleText}>
              {addRecord ? "新增記錄" : editBasicInfoOnly ? "編輯帳戶" : "帳戶"}
            </Text>
            <View style={s.titleRight}>
              <View style={[s.titleIcon, { backgroundColor: accentColor + "25" }]}>
                <Icon size={20} color="#66788E" />
              </View>
              <Text style={s.titleSub}>{subCategory}</Text>
            </View>
          </View>

          {/* ── Main form card ─────────────────────────────────────────── */}
          <View style={s.card}>
            {/* Amount block — hidden when editing basic info only. */}
            {!editBasicInfoOnly &&
              (isLoan ? (
                <LoanFormFields
                  values={loanValues}
                  color={color}
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
                      <TouchableOpacity
                        onPress={() => !stockLocked && setShowStockPicker(true)}
                        disabled={stockLocked}
                        style={[s.row, { opacity: stockLocked ? 0.6 : 1 }]}
                        activeOpacity={0.7}
                      >
                        <Text style={s.rowLabel}>選擇標的</Text>
                        <View style={s.rowRight}>
                          {selectedStock ? (
                            <View style={{ alignItems: "flex-end" }}>
                              <Text style={s.stockCode}>{selectedStock.code}</Text>
                              <Text style={s.stockNameSmall} numberOfLines={1}>
                                {selectedStock.name}
                              </Text>
                            </View>
                          ) : (
                            <Text style={s.placeholderText}>未選擇</Text>
                          )}
                          {!stockLocked && <ChevronRight size={16} color="#c7c7cc" />}
                        </View>
                      </TouchableOpacity>
                      <View style={s.sep} />
                    </>
                  )}

                  {/* Input mode: quantity vs cost amount (items 4 & 17) */}
                  {hasStockPicker && (
                    <View style={s.modeRow}>
                      {(
                        [
                          { mode: "units" as const, label: isCrypto ? "依數量" : "依股數" },
                          { mode: "amount" as const, label: "依金額" },
                        ] satisfies { mode: "units" | "amount"; label: string }[]
                      ).map(({ mode, label }) => (
                        <TouchableOpacity
                          key={mode}
                          onPress={() => {
                            setInputMode(mode);
                            setError(null);
                          }}
                          style={[s.modeBtn, inputMode === mode && s.modeBtnActive]}
                          activeOpacity={0.7}
                        >
                          <Text style={[s.modeText, inputMode === mode && s.modeTextActive]}>
                            {label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  {/* Price (left) | Units-or-Amount (right) */}
                  {hasStockPicker ? (
                    <View style={s.splitRow}>
                      <View style={[s.half, s.rightBorder]}>
                        <View style={s.priceLabelRow}>
                          <Text style={s.fieldLabel}>{isCrypto ? "幣價" : "股價"}</Text>
                          {/* Manual refresh (item 8) — price is fetched once, then
                              refreshed on demand instead of on every render. */}
                          {selectedStock && !isPriceManual && (
                            <TouchableOpacity
                              onPress={refreshPrice}
                              disabled={priceLoading}
                              hitSlop={6}
                            >
                              <Text style={s.refreshLink}>{priceLoading ? "更新中…" : "更新"}</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                        {isPriceManual ? (
                          <View style={s.manualRow}>
                            <TextInput
                              style={s.priceInput}
                              value={manualPriceStr}
                              onChangeText={setManualPriceStr}
                              placeholder="0.00"
                              placeholderTextColor="#c7c7cc"
                              keyboardType="decimal-pad"
                            />
                            <TouchableOpacity onPress={() => setIsPriceManual(false)}>
                              <Text style={s.autoLink}>自動</Text>
                            </TouchableOpacity>
                          </View>
                        ) : priceLoading ? (
                          <Text style={s.priceLoading}>查詢中…</Text>
                        ) : (
                          <TouchableOpacity
                            onPress={() => {
                              setIsPriceManual(true);
                              setManualPriceStr(originalPrice > 0 ? String(originalPrice) : "");
                            }}
                          >
                            <Text style={s.priceValue}>
                              {originalPrice > 0
                                ? originalPrice.toLocaleString("zh-TW", {
                                    maximumFractionDigits: 6,
                                  })
                                : "--"}
                            </Text>
                            {currency !== "TWD" && originalPrice > 0 && (
                              <Text style={s.fxNote}>
                                {currency} × {exchangeRate.toFixed(2)}
                              </Text>
                            )}
                            <Text style={s.manualHint}>手動輸入</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                      <View style={s.half}>
                        {inputMode === "amount" ? (
                          <>
                            <Text style={s.fieldLabel}>投入金額 (TWD)</Text>
                            <TextInput
                              style={s.unitsInput}
                              value={amountStr}
                              onChangeText={(t) => {
                                setAmountStr(t);
                                setError(null);
                              }}
                              placeholder="0"
                              placeholderTextColor="#c7c7cc"
                              keyboardType="decimal-pad"
                            />
                          </>
                        ) : (
                          <>
                            <Text style={s.fieldLabel}>{getUnitsLabel(subCategory)}</Text>
                            <TextInput
                              style={s.unitsInput}
                              value={units}
                              onChangeText={(t) => {
                                setUnits(t);
                                setError(null);
                              }}
                              placeholder="0"
                              placeholderTextColor="#c7c7cc"
                              keyboardType="decimal-pad"
                            />
                          </>
                        )}
                      </View>
                    </View>
                  ) : (
                    <View style={s.row}>
                      <Text style={s.rowLabel}>{getUnitsLabel(subCategory)}</Text>
                      <View style={s.rowRight}>
                        <TextInput
                          style={[s.bigInput, { textAlign: "right" }]}
                          value={units}
                          onChangeText={(t) => {
                            setUnits(t);
                            setError(null);
                          }}
                          placeholder="0"
                          placeholderTextColor="#c7c7cc"
                          keyboardType="decimal-pad"
                        />
                        <View style={s.badge}>
                          <Text style={s.badgeText}>TWD</Text>
                        </View>
                      </View>
                    </View>
                  )}

                  {/* Computed value chip — shows the counterpart of what's typed:
                      amount mode → implied units; quantity mode → TWD value. */}
                  <View style={s.computedRow}>
                    <View style={s.computedChip}>
                      {hasStockPicker && inputMode === "amount" ? (
                        <Text style={s.computedText}>
                          {"≈ "}
                          <Text style={s.computedNum}>
                            {derivedUnits > 0
                              ? derivedUnits.toLocaleString("zh-TW", { maximumFractionDigits: 4 })
                              : "--"}
                          </Text>
                          {` ${getUnitsLabel(subCategory)}`}
                        </Text>
                      ) : (
                        <Text style={s.computedText}>
                          {"= TWD "}
                          <Text style={s.computedNum}>
                            {Math.round(computedValue).toLocaleString("zh-TW")}
                          </Text>
                        </Text>
                      )}
                    </View>
                  </View>
                </>
              ) : (
                /* Standard balance */
                <View style={s.row}>
                  <Text style={s.rowLabel}>
                    {addRecord ? "新增金額" : getBalanceLabel(topCategory)}
                  </Text>
                  <View style={s.rowRight}>
                    {isLiability && <Text style={s.minus}>−</Text>}
                    <TextInput
                      style={[
                        s.bigInput,
                        { textAlign: "right" },
                        isLiability && { color: "#ff3b30" },
                      ]}
                      value={balance}
                      onChangeText={(t) => {
                        setBalance(t);
                        setError(null);
                      }}
                      placeholder="0"
                      placeholderTextColor="#c7c7cc"
                      keyboardType="decimal-pad"
                    />
                    <View style={[s.badge, isLiability && { backgroundColor: "#ff3b30" }]}>
                      <Text style={s.badgeText}>TWD</Text>
                    </View>
                  </View>
                </View>
              ))}

            {!isLoan && !editBasicInfoOnly && <View style={s.sep} />}

            {/* Bank picker (金融卡 only). Hidden when appending a record — the
                bank icon is fixed at creation time and can't be changed here. */}
            {isBankCard && !isLoan && !addRecord && (
              <>
                <TouchableOpacity
                  onPress={() => setShowBankPicker(true)}
                  style={s.row}
                  activeOpacity={0.7}
                >
                  <Text style={s.rowLabel}>銀行圖示</Text>
                  <View style={s.rowRight}>
                    {selectedBank ? (
                      <View style={s.bankIcon}>
                        <BankLogo code={selectedBank.code} name={selectedBank.name} size={28} />
                        <Text style={s.bankLabel}>{selectedBank.name}</Text>
                      </View>
                    ) : (
                      <Text style={[s.bankLabel, { color: "#c7c7cc" }]}>未選擇</Text>
                    )}
                    <ChevronRight size={16} color="#c7c7cc" />
                  </View>
                </TouchableOpacity>
                <View style={s.sep} />
              </>
            )}

            {/* Account name — the name is fixed at creation time, so when merely
                appending a record we only expose 新增金額 / 納入圖表 / 備註. */}
            {!isLoan && (
              <>
                {!addRecord && (
                  <View style={s.row}>
                    <Text style={s.rowLabel}>帳戶名稱</Text>
                    <TextInput
                      style={s.inputRight}
                      value={name}
                      onChangeText={setName}
                      placeholder={`自訂名稱，預設為${subCategory}`}
                      placeholderTextColor="#c7c7cc"
                      returnKeyType="done"
                    />
                  </View>
                )}

                {/* Date — pure-JS picker, not free text. Shown when creating a
                    new entry and when appending a record (item 7), so the record
                    can be back-dated to the actual transaction date. */}
                {(!isEdit || addRecord) && (
                  <>
                    <View style={s.sep} />
                    <TouchableOpacity
                      style={s.row}
                      onPress={() => setShowDatePicker(true)}
                      activeOpacity={0.7}
                    >
                      <Text style={s.rowLabel}>日期</Text>
                      <View style={s.rowRight}>
                        <Text style={s.dateText}>{formatDisplayDate(date)}</Text>
                        <Calendar size={16} color="#8e8e93" />
                      </View>
                    </TouchableOpacity>
                  </>
                )}

                {/* Include in chart — skip the divider in add-record mode where the
                    account-name row above is hidden, to avoid a doubled separator. */}
                {!addRecord && <View style={s.sep} />}
                <View style={s.row}>
                  <Text style={s.rowLabel}>納入圖表</Text>
                  <Switch
                    value={includeInChart}
                    onValueChange={setIncludeInChart}
                    trackColor={{ false: "#e5e5ea", true: "#66788E" }}
                    thumbColor="#ffffff"
                    ios_backgroundColor="#e5e5ea"
                  />
                </View>

                {/* Note (vertical layout) — hidden when editing basic info only. */}
                {!editBasicInfoOnly && (
                  <>
                    <View style={s.sep} />
                    <View style={s.noteSection}>
                      <Text style={s.rowLabel}>備註</Text>
                      <TextInput
                        style={s.noteInput}
                        value={note}
                        onChangeText={setNote}
                        placeholder="選填（最多 10 字）"
                        placeholderTextColor="#c7c7cc"
                        returnKeyType="done"
                        maxLength={10}
                        multiline
                      />
                    </View>
                  </>
                )}
              </>
            )}
          </View>

          {error != null && <Text style={s.errorText}>{error}</Text>}

          {/* ── Bottom action row ───────────────────────────────────────── */}
          {/* {!isLoan && (
            <View style={s.bottomRow}>
              <TouchableOpacity style={s.addRecurrenceBtn} activeOpacity={0.8}>
                <Text style={s.addRecurrenceText}>新增定期</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowRecurrenceInfo((v) => !v)} style={s.infoBtn}>
                <Info size={14} color="#8e8e93" />
              </TouchableOpacity>
            </View>
          )}

          {showRecurrenceInfo && (
            <View style={s.infoCard}>
              <Info size={16} color="#8e8e93" style={{ marginTop: 2 }} />
              <Text style={s.infoText}>
                新增定期交易，例如帳單、薪資、租金等。可以先填入預估金額，之後再依實際情況調整。
              </Text>
            </View>
          )} */}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Pickers ──────────────────────────────────────────────────────── */}
      {isInvestment && hasStockPicker && (
        <StockPickerModal
          visible={showStockPicker}
          onClose={() => setShowStockPicker(false)}
          onSelect={handleSelectStock}
          subCategory={subCategory}
          existingHoldings={twHoldings}
        />
      )}
      {isBankCard && (
        <BankPickerModal
          visible={showBankPicker}
          onClose={() => setShowBankPicker(false)}
          onSelect={setSelectedBank}
          selectedCode={selectedBank?.code ?? null}
        />
      )}

      {/* ── Date picker ──────────────────────────────────────────────────── */}
      <DatePickerModal
        visible={showDatePicker}
        date={parseISODate(date)}
        onConfirm={(picked) => setDate(toISODate(picked))}
        onClose={() => setShowDatePicker(false)}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f2f2f7" },
  flex: { flex: 1 },

  scrollContent: { paddingHorizontal: 16, paddingBottom: 48 },

  // ── Floating nav ─────────────────────────────────────────────────────────────
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 4,
    paddingBottom: 16,
  },
  navCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },

  // ── Title row ─────────────────────────────────────────────────────────────────
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  titleText: { fontSize: 22, fontWeight: "700", color: "#1c1c1e" },
  titleRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  titleIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  titleSub: { fontSize: 18, fontWeight: "600", color: "#1c1c1e" },

  // ── Card ──────────────────────────────────────────────────────────────────────
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sep: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#f2f2f7",
    marginHorizontal: 20,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    minHeight: 52,
  },
  rowLabel: { fontSize: 16, fontWeight: "500", color: "#1c1c1e", flexShrink: 0 },
  rowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
    justifyContent: "flex-end",
  },

  // Note section (vertical)
  noteSection: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 16,
    gap: 8,
  },
  noteInput: {
    fontSize: 14,
    color: "#8e8e93",
    minHeight: 36,
  },

  // Split row (price | units)
  splitRow: { flexDirection: "row" },
  half: { flex: 1, paddingHorizontal: 16, paddingVertical: 14 },
  rightBorder: {
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: "#f2f2f7",
  },
  fieldLabel: { fontSize: 12, color: "#8e8e93", marginBottom: 6 },

  // Input-mode toggle (依股數 / 依金額)
  modeRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  modeBtn: {
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 14,
    backgroundColor: "#f2f2f7",
  },
  modeBtnActive: { backgroundColor: "#374254" },
  modeText: { fontSize: 13, fontWeight: "600", color: "#8e8e93" },
  modeTextActive: { color: "#ffffff" },
  priceLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  refreshLink: { fontSize: 12, fontWeight: "600", color: "#374254" },

  // Stock price display
  priceValue: { fontSize: 20, fontWeight: "600", color: "#1c1c1e" },
  priceLoading: { fontSize: 14, color: "#8e8e93", marginTop: 4 },
  fxNote: { fontSize: 11, color: "#8e8e93", marginTop: 2 },
  manualHint: { fontSize: 11, color: "#374254", marginTop: 2 },
  manualRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  priceInput: { flex: 1, fontSize: 20, fontWeight: "600", color: "#1c1c1e" },
  autoLink: { fontSize: 12, color: "#374254" },
  unitsInput: { fontSize: 20, fontWeight: "600", color: "#1c1c1e" },

  // Computed chip
  computedRow: { paddingHorizontal: 16, paddingBottom: 14 },
  computedChip: {
    alignSelf: "flex-start",
    backgroundColor: "#f2f2f7",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  computedText: { fontSize: 13, color: "#8e8e93" },
  computedNum: { fontWeight: "600", color: "#1c1c1e" },

  // Inputs
  inputRight: {
    flex: 1,
    textAlign: "right",
    fontSize: 14,
    color: "#8e8e93",
    minWidth: 60,
    marginLeft: 12,
  },
  bigInput: { fontSize: 20, fontWeight: "600", color: "#1c1c1e", minWidth: 80 },
  dateText: { fontSize: 15, color: "#1c1c1e" },
  minus: { fontSize: 20, fontWeight: "600", color: "#ff3b30" },
  badge: {
    backgroundColor: "#66788E",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: { fontSize: 11, fontWeight: "700", color: "#fff" },
  placeholderText: { fontSize: 15, color: "#c7c7cc" },

  // Stock display
  stockCode: { fontSize: 15, fontWeight: "700", color: "#1c1c1e", textAlign: "right" },
  stockNameSmall: { fontSize: 12, color: "#8e8e93", maxWidth: 140, textAlign: "right" },

  // Bank display
  bankIcon: { flexDirection: "row", alignItems: "center", gap: 6 },
  bankLabel: { fontSize: 15, color: "#374254" },

  errorText: {
    marginTop: 12,
    textAlign: "center",
    fontSize: 13,
    color: "#ff3b30",
  },

  // Bottom action
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 24,
  },
  addRecurrenceBtn: {
    flex: 1,
    backgroundColor: "#1c1c1e",
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
  },
  addRecurrenceText: { fontSize: 14, fontWeight: "600", color: "#ffffff" },
  infoBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#c7c7cc",
    alignItems: "center",
    justifyContent: "center",
  },
  infoCard: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    marginTop: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  infoText: { flex: 1, fontSize: 13, color: "#8e8e93", lineHeight: 20 },
});
