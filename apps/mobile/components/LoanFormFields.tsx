import { useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Calendar } from "lucide-react-native";
import type { RepaymentType } from "@repo/shared";
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
  onChange: (v: LoanFormValues) => void;
  errors?: Partial<Record<keyof LoanFormValues, string>>;
}

export function LoanFormFields({ values, color, onChange, errors }: Props) {
  const set = (key: keyof LoanFormValues) => (val: string) => onChange({ ...values, [key]: val });
  const accent = color === "#FFFFFF" ? "#374254" : color;
  const [showDatePicker, setShowDatePicker] = useState(false);

  return (
    <View>
      {/* Loan name */}
      <View style={s.field}>
        <Text style={s.label}>貸款名稱</Text>
        <TextInput
          style={s.bigInput}
          value={values.loanName}
          onChangeText={set("loanName")}
          placeholder="例：台北房貸"
          placeholderTextColor="#c7c7cc"
        />
      </View>

      <View style={s.sep} />

      {/* Total amount */}
      <View style={s.field}>
        <Text style={s.label}>貸款金額</Text>
        <TextInput
          style={s.numInput}
          value={values.totalAmount}
          onChangeText={set("totalAmount")}
          placeholder="0"
          placeholderTextColor="#c7c7cc"
          keyboardType="decimal-pad"
        />
        {errors?.totalAmount && <Text style={s.err}>{errors.totalAmount}</Text>}
      </View>

      <View style={s.sep} />

      {/* Rate + term (split) */}
      <View style={s.splitRow}>
        <View style={[s.half, s.rightBorder]}>
          <Text style={s.label}>年利率 (%)</Text>
          <TextInput
            style={s.halfInput}
            value={values.annualInterestRate}
            onChangeText={set("annualInterestRate")}
            placeholder="2.00"
            placeholderTextColor="#c7c7cc"
            keyboardType="decimal-pad"
          />
          {errors?.annualInterestRate && <Text style={s.err}>{errors.annualInterestRate}</Text>}
        </View>
        <View style={s.half}>
          <Text style={s.label}>貸款期數 (月)</Text>
          <TextInput
            style={s.halfInput}
            value={values.termMonths}
            onChangeText={set("termMonths")}
            placeholder="360"
            placeholderTextColor="#c7c7cc"
            keyboardType="number-pad"
          />
          {errors?.termMonths && <Text style={s.err}>{errors.termMonths}</Text>}
        </View>
      </View>

      <View style={s.sep} />

      {/* Start date + grace period (split) */}
      <View style={s.splitRow}>
        <View style={[s.half, s.rightBorder]}>
          <Text style={s.label}>撥款日期</Text>
          <TouchableOpacity
            style={s.dateRow}
            onPress={() => setShowDatePicker(true)}
            activeOpacity={0.7}
          >
            <Text style={[s.halfInput, !values.startDate && s.datePlaceholder]}>
              {formatDisplayDate(values.startDate)}
            </Text>
            <Calendar size={16} color="#8e8e93" />
          </TouchableOpacity>
          {errors?.startDate && <Text style={s.err}>{errors.startDate}</Text>}
        </View>
        <View style={s.half}>
          <Text style={s.label}>寬限期 (月)</Text>
          <TextInput
            style={s.halfInput}
            value={values.gracePeriodMonths}
            onChangeText={set("gracePeriodMonths")}
            placeholder="0"
            placeholderTextColor="#c7c7cc"
            keyboardType="number-pad"
          />
        </View>
      </View>

      <View style={s.sep} />

      {/* Repayment type */}
      <View style={s.field}>
        <Text style={s.label}>還款方式</Text>
        <View style={s.repayRow}>
          {(
            [
              { value: "principal_interest" as RepaymentType, label: "本息均攤" },
              { value: "principal_equal" as RepaymentType, label: "本金均攤" },
            ] satisfies { value: RepaymentType; label: string }[]
          ).map(({ value, label }) => (
            <TouchableOpacity
              key={value}
              onPress={() => onChange({ ...values, repaymentType: value })}
              style={[
                s.repayBtn,
                values.repaymentType === value
                  ? { backgroundColor: accent }
                  : { backgroundColor: "#f2f2f7" },
              ]}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  s.repayLabel,
                  { color: values.repaymentType === value ? "#fff" : "#8e8e93" },
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <DatePickerModal
        visible={showDatePicker}
        date={parseISODate(values.startDate)}
        onConfirm={(picked) => onChange({ ...values, startDate: toISODate(picked) })}
        onClose={() => setShowDatePicker(false)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  field: { paddingHorizontal: 20, paddingVertical: 16 },
  sep: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#f2f2f7",
    marginHorizontal: 20,
  },
  splitRow: { flexDirection: "row" },
  half: { flex: 1, paddingHorizontal: 20, paddingVertical: 16 },
  rightBorder: {
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: "#f2f2f7",
  },
  label: { fontSize: 12, color: "#8e8e93", marginBottom: 6 },
  bigInput: { fontSize: 17, fontWeight: "600", color: "#1c1c1e" },
  numInput: { fontSize: 20, fontWeight: "700", color: "#1c1c1e" },
  halfInput: { fontSize: 17, fontWeight: "600", color: "#1c1c1e" },
  dateRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  datePlaceholder: { color: "#c7c7cc", fontWeight: "400" },
  err: { fontSize: 12, color: "#ff3b30", marginTop: 4 },
  repayRow: { flexDirection: "row", gap: 8, marginTop: 6 },
  repayBtn: { flex: 1, borderRadius: 12, paddingVertical: 10, alignItems: "center" },
  repayLabel: { fontSize: 14, fontWeight: "600" },
});
