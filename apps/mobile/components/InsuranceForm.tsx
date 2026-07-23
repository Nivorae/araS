import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Calendar, Check, ChevronLeft, ChevronRight, X } from "lucide-react-native";
import {
  INSURANCE_TYPES,
  INSURANCE_TYPE_LABELS,
  INSURANCE_COVERAGE_OPTIONS,
  MAX_COVERAGE_ITEMS,
  INSURER_LIST,
  type InsuranceType,
  type CoverageItem,
  type CoverageOption,
  type CreateInsurance,
  type UpdateInsurance,
} from "@repo/shared";
import { useFinanceActions } from "@/hooks/useFinanceActions";
import { ApiError } from "@/lib/api";
import { InsurerPickerModal } from "./InsurerPickerModal";
import { CoverageItemPicker } from "./CoverageItemPicker";
import { DatePickerModal } from "./DatePickerModal";

function parseISODate(s: string): Date {
  const d = new Date(s);
  return isNaN(d.getTime()) ? new Date() : d;
}
function toISODate(d: Date): string {
  return d.toISOString().split("T")[0] ?? "";
}
function formatDisplayDate(s: string): string {
  if (!s) return "選擇日期";
  const d = parseISODate(s);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

let _coverageKeySeq = 0;
function generateCoverageKey(): string {
  _coverageKeySeq += 1;
  return `custom_${Date.now()}_${_coverageKeySeq}`;
}

interface CoverageRowState {
  key: string;
  label: string;
  valueStr: string;
}

export interface InsuranceFormInitial {
  insurer: string;
  insuredName: string;
  insuranceType: InsuranceType;
  policyName: string | null;
  policyNumber: string | null;
  startDate: string | null;
  paymentTermYears: number | null;
  coveragePeriod: string | null;
  annualPremium: number | null;
  coverage: CoverageItem[];
}

export interface InsuranceFormProps {
  isEdit: boolean;
  insuranceId?: string;
  initial?: InsuranceFormInitial;
  onBack: () => void;
  onSaved: () => void;
}

export function InsuranceForm({
  isEdit,
  insuranceId,
  initial,
  onBack,
  onSaved,
}: InsuranceFormProps) {
  const { addInsurance, updateInsurance, fetchAll } = useFinanceActions();
  const router = useRouter();

  const [insuranceType, setInsuranceType] = useState<InsuranceType | null>(
    initial?.insuranceType ?? null
  );
  const [insurerMode, setInsurerMode] = useState<"list" | "other">(() =>
    initial && !(INSURER_LIST as readonly string[]).includes(initial.insurer) ? "other" : "list"
  );
  const [insurer, setInsurer] = useState(initial?.insurer ?? "");
  const [showInsurerPicker, setShowInsurerPicker] = useState(false);
  const [insuredName, setInsuredName] = useState(initial?.insuredName ?? "本人");
  const [policyName, setPolicyName] = useState(initial?.policyName ?? "");
  const [policyNumber, setPolicyNumber] = useState(initial?.policyNumber ?? "");
  const [startDate, setStartDate] = useState(initial?.startDate ?? "");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [paymentTermYears, setPaymentTermYears] = useState(
    initial?.paymentTermYears != null ? String(initial.paymentTermYears) : ""
  );
  const [coveragePeriod, setCoveragePeriod] = useState(initial?.coveragePeriod ?? "");
  const [annualPremium, setAnnualPremium] = useState(
    initial?.annualPremium != null ? String(initial.annualPremium) : ""
  );
  const [coverage, setCoverage] = useState<CoverageRowState[]>(
    () =>
      initial?.coverage.map((c) => ({ key: c.key, label: c.label, valueStr: String(c.value) })) ??
      []
  );
  const [showCoveragePicker, setShowCoveragePicker] = useState(false);

  const [errors, setErrors] = useState<{
    insuranceType?: string;
    insurer?: string;
    insuredName?: string;
  }>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const remainingOptions: CoverageOption[] = useMemo(() => {
    if (!insuranceType || insuranceType === "OTHER") return [];
    const used = new Set(coverage.map((c) => c.key));
    return INSURANCE_COVERAGE_OPTIONS[insuranceType].filter((o) => !used.has(o.key));
  }, [insuranceType, coverage]);

  const canAddMore =
    coverage.length < MAX_COVERAGE_ITEMS &&
    !!insuranceType &&
    (insuranceType === "OTHER" || remainingOptions.length > 0);

  const handleSelectType = (type: InsuranceType) => {
    if (type === insuranceType) return;
    setInsuranceType(type);
    setCoverage([]); // stale coverage keys don't necessarily belong to the new type
    // Drop the key entirely rather than setting it to `undefined` —
    // exactOptionalPropertyTypes rejects an explicit `undefined` for an
    // optional string field.
    setErrors(({ insuranceType: _insuranceType, ...rest }) => rest);
  };

  const handleAddCoverage = () => {
    if (!insuranceType) return;
    if (insuranceType === "OTHER") {
      setCoverage((prev) => [...prev, { key: generateCoverageKey(), label: "", valueStr: "" }]);
    } else {
      setShowCoveragePicker(true);
    }
  };

  const handleInsurerChange = (value: string) => {
    setInsurer(value);
    if (value.trim()) setErrors(({ insurer: _insurer, ...rest }) => rest);
  };

  const handleInsuredNameChange = (value: string) => {
    setInsuredName(value);
    if (value.trim()) setErrors(({ insuredName: _insuredName, ...rest }) => rest);
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

      if (isEdit && insuranceId) {
        const payload: UpdateInsurance = {
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
        };
        await updateInsurance(insuranceId, payload);
      } else {
        const payload: CreateInsurance = {
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
        await addInsurance(payload);
      }
      await fetchAll();
      onSaved();
    } catch (e) {
      if (e instanceof ApiError && e.code === "PREMIUM_REQUIRED") {
        Alert.alert("保單管理是 Premium 功能", "升級 Premium 即可無限新增與管理保單。", [
          { text: "稍後再決定", style: "cancel" },
          { text: "解鎖 Premium", onPress: () => router.push("/paywall") },
        ]);
        return;
      }
      setError(e instanceof Error ? e.message : "儲存失敗，請重試");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={s.root}>
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView
          style={s.flex}
          contentContainerStyle={s.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
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
                <ActivityIndicator size="small" color="#B8865E" />
              ) : (
                <Check size={20} color="#1c1c1e" strokeWidth={2.5} />
              )}
            </TouchableOpacity>
          </View>

          <Text style={s.titleText}>{isEdit ? "編輯保單" : "新增保單"}</Text>

          {/* ── Step 1: 險種 ─────────────────────────────────────────── */}
          <View style={s.card}>
            <Text style={s.sectionLabel}>險種</Text>
            <View style={s.chipRow}>
              {INSURANCE_TYPES.map((type) => (
                <TouchableOpacity
                  key={type}
                  onPress={() => handleSelectType(type)}
                  style={[s.chip, insuranceType === type && s.chipActive]}
                  activeOpacity={0.7}
                >
                  <Text style={[s.chipText, insuranceType === type && s.chipTextActive]}>
                    {INSURANCE_TYPE_LABELS[type]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {errors.insuranceType && <Text style={s.err}>{errors.insuranceType}</Text>}
          </View>

          {/* ── Step 2: 基本資料 ─────────────────────────────────────── */}
          <View style={s.card}>
            <View style={s.row}>
              <Text style={s.rowLabel}>保險公司</Text>
              {insurerMode === "list" ? (
                <TouchableOpacity
                  onPress={() => setShowInsurerPicker(true)}
                  style={s.rowRight}
                  activeOpacity={0.7}
                >
                  <Text style={insurer ? s.rowValue : s.placeholderText}>
                    {insurer || "未選擇"}
                  </Text>
                  <ChevronRight size={16} color="#c7c7cc" />
                </TouchableOpacity>
              ) : (
                <View style={s.rowRight}>
                  <TextInput
                    style={s.inputRight}
                    value={insurer}
                    onChangeText={handleInsurerChange}
                    placeholder="輸入保險公司名稱"
                    placeholderTextColor="#c7c7cc"
                  />
                </View>
              )}
            </View>
            {insurerMode === "other" && (
              <TouchableOpacity
                onPress={() => {
                  setInsurerMode("list");
                  setInsurer("");
                }}
                style={s.switchModeRow}
              >
                <Text style={s.switchModeLink}>改用清單選擇</Text>
              </TouchableOpacity>
            )}
            {errors.insurer && <Text style={s.err}>{errors.insurer}</Text>}
            <View style={s.sep} />

            <View style={s.row}>
              <Text style={s.rowLabel}>被保人</Text>
              <TextInput
                style={s.inputRight}
                value={insuredName}
                onChangeText={handleInsuredNameChange}
                placeholder="本人"
                placeholderTextColor="#c7c7cc"
              />
            </View>
            {errors.insuredName && <Text style={s.err}>{errors.insuredName}</Text>}
            <View style={s.sep} />

            <View style={s.row}>
              <Text style={s.rowLabel}>保單名稱</Text>
              <TextInput
                style={s.inputRight}
                value={policyName}
                onChangeText={setPolicyName}
                placeholder="選填"
                placeholderTextColor="#c7c7cc"
              />
            </View>
            <View style={s.sep} />

            <View style={s.row}>
              <Text style={s.rowLabel}>保單號碼</Text>
              <TextInput
                style={s.inputRight}
                value={policyNumber}
                onChangeText={setPolicyNumber}
                placeholder="選填"
                placeholderTextColor="#c7c7cc"
              />
            </View>
            <View style={s.sep} />

            <TouchableOpacity
              style={s.row}
              onPress={() => setShowDatePicker(true)}
              activeOpacity={0.7}
            >
              <Text style={s.rowLabel}>投保日期</Text>
              <View style={s.rowRight}>
                <Text style={startDate ? s.rowValue : s.placeholderText}>
                  {formatDisplayDate(startDate)}
                </Text>
                <Calendar size={16} color="#8e8e93" />
              </View>
            </TouchableOpacity>
            <View style={s.sep} />

            <View style={s.row}>
              <Text style={s.rowLabel}>繳費年期（年）</Text>
              <TextInput
                style={s.inputRight}
                value={paymentTermYears}
                onChangeText={setPaymentTermYears}
                placeholder="選填"
                placeholderTextColor="#c7c7cc"
                keyboardType="number-pad"
              />
            </View>
            <View style={s.sep} />

            <View style={s.row}>
              <Text style={s.rowLabel}>保障期間</Text>
              <TextInput
                style={s.inputRight}
                value={coveragePeriod}
                onChangeText={setCoveragePeriod}
                placeholder="終身／定期到 X 歲"
                placeholderTextColor="#c7c7cc"
              />
            </View>
            <View style={s.sep} />

            <View style={s.row}>
              <Text style={s.rowLabel}>年繳保費</Text>
              <TextInput
                style={s.inputRight}
                value={annualPremium}
                onChangeText={setAnnualPremium}
                placeholder="選填"
                placeholderTextColor="#c7c7cc"
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          {/* ── Step 3: 保障細項（B 區） ──────────────────────────────── */}
          {insuranceType && (
            <View style={s.card}>
              <Text style={s.sectionLabel}>保障項目（最多 {MAX_COVERAGE_ITEMS} 項）</Text>
              {coverage.map((item) => (
                <View key={item.key} style={s.coverageRow}>
                  {insuranceType === "OTHER" ? (
                    <TextInput
                      style={s.coverageLabelInput}
                      value={item.label}
                      onChangeText={(t) => updateCoverageLabel(item.key, t)}
                      placeholder="保障名稱"
                      placeholderTextColor="#c7c7cc"
                    />
                  ) : (
                    <Text style={s.coverageLabel} numberOfLines={1}>
                      {item.label}
                    </Text>
                  )}
                  <TextInput
                    style={s.coverageValueInput}
                    value={item.valueStr}
                    onChangeText={(t) => updateCoverageValue(item.key, t)}
                    placeholder="0"
                    placeholderTextColor="#c7c7cc"
                    keyboardType="decimal-pad"
                  />
                  <TouchableOpacity onPress={() => removeCoverage(item.key)} hitSlop={8}>
                    <X size={16} color="#8e8e93" />
                  </TouchableOpacity>
                </View>
              ))}
              {canAddMore && (
                <TouchableOpacity
                  onPress={handleAddCoverage}
                  style={s.addCoverageBtn}
                  activeOpacity={0.7}
                >
                  <Text style={s.addCoverageText}>+ 新增保障</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {error != null && <Text style={s.errorText}>{error}</Text>}
        </ScrollView>
      </KeyboardAvoidingView>

      <InsurerPickerModal
        visible={showInsurerPicker}
        selected={insurerMode === "list" ? insurer : null}
        onClose={() => setShowInsurerPicker(false)}
        onSelect={(value) => {
          if (value === "") {
            setInsurerMode("other");
            setInsurer("");
          } else {
            setInsurerMode("list");
            handleInsurerChange(value);
          }
        }}
      />

      <CoverageItemPicker
        visible={showCoveragePicker}
        options={remainingOptions}
        onClose={() => setShowCoveragePicker(false)}
        onSelect={(option) =>
          setCoverage((prev) => [...prev, { key: option.key, label: option.label, valueStr: "" }])
        }
      />

      <DatePickerModal
        visible={showDatePicker}
        date={parseISODate(startDate)}
        onConfirm={(picked) => setStartDate(toISODate(picked))}
        onClose={() => setShowDatePicker(false)}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f2f2f7" },
  flex: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 48 },

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

  titleText: { fontSize: 22, fontWeight: "700", color: "#1c1c1e", marginBottom: 16 },

  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: "#f2f2f7", marginHorizontal: 20 },

  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#8e8e93",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 4,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, padding: 16 },
  chip: {
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: "#f2f2f7",
  },
  chipActive: { backgroundColor: "#B8865E" },
  chipText: { fontSize: 13, fontWeight: "600", color: "#8e8e93" },
  chipTextActive: { color: "#ffffff" },

  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    minHeight: 52,
  },
  rowLabel: { fontSize: 15, fontWeight: "500", color: "#1c1c1e", flexShrink: 0 },
  rowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
    justifyContent: "flex-end",
  },
  rowValue: { fontSize: 15, color: "#1c1c1e" },
  placeholderText: { fontSize: 15, color: "#c7c7cc" },
  inputRight: { flex: 1, textAlign: "right", fontSize: 15, color: "#1c1c1e" },
  switchModeRow: { paddingHorizontal: 20, paddingBottom: 8 },
  switchModeLink: { fontSize: 12, color: "#374254", textAlign: "right" },
  err: { fontSize: 12, color: "#ff3b30", paddingHorizontal: 20, paddingBottom: 8 },

  coverageRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  coverageLabel: { flex: 1, fontSize: 14, color: "#1c1c1e" },
  coverageLabelInput: {
    flex: 1,
    fontSize: 14,
    color: "#1c1c1e",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e5ea",
    paddingVertical: 4,
  },
  coverageValueInput: {
    width: 90,
    fontSize: 14,
    color: "#1c1c1e",
    textAlign: "right",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e5ea",
    paddingVertical: 4,
  },
  addCoverageBtn: { paddingHorizontal: 20, paddingVertical: 14 },
  addCoverageText: { fontSize: 14, fontWeight: "600", color: "#374254" },

  errorText: {
    marginTop: 4,
    marginBottom: 12,
    textAlign: "center",
    fontSize: 13,
    color: "#ff3b30",
  },
});
