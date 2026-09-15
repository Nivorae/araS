import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Animated, { FadeInDown } from "react-native-reanimated";
import { ChevronRight } from "lucide-react-native";
import {
  PASSIVE_INCOME_STORAGE_KEY,
  SALARY_STORAGE_KEY,
  fmtNtd,
  monthlyIncomeTotal,
  salaryRules,
  type SalaryRule,
} from "@/lib/retirement";
import { InfoModal } from "@/components/retirement/InfoModal";

/** 一個以字串形式持久化到 AsyncStorage 的金額輸入。 */
function usePersistedAmount(key: string) {
  const [value, setValue] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(key)
      .then((saved) => {
        if (saved) setValue(saved);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [key]);

  useEffect(() => {
    if (loaded) AsyncStorage.setItem(key, value).catch(() => {});
  }, [key, value, loaded]);

  return [value, setValue] as const;
}

/** 月薪與被動收入輸入、兩者加總，以及由月薪推算的理財法則。 */
export function useSalary() {
  const [salaryStr, setSalaryStr] = usePersistedAmount(SALARY_STORAGE_KEY);
  const [passiveStr, setPassiveStr] = usePersistedAmount(PASSIVE_INCOME_STORAGE_KEY);

  const rules = useMemo(() => salaryRules(parseFloat(salaryStr)), [salaryStr]);
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
    <View style={s.card}>
      <Text style={s.title}>薪資理財試算</Text>
      <Text style={s.sub}>依月薪推算儲蓄、開支與預備金</Text>

      <View style={s.inputGroup}>
        <AmountInput
          label="目前月薪"
          placeholder="輸入月薪"
          value={salaryStr}
          onChange={onChangeSalary}
        />
        <View style={s.inputDivider} />
        <AmountInput
          label="每月被動收入"
          placeholder="輸入被動收入"
          value={passiveStr}
          onChange={onChangePassive}
        />
      </View>

      {rules.map((r, i) => (
        <Animated.View
          key={r.key}
          entering={FadeInDown.delay(80 + i * 45)
            .springify()
            .damping(18)}
        >
          <Pressable
            style={({ pressed }) => [s.ruleRow, pressed && s.ruleRowPressed]}
            onPress={() => setOpenKey(r.key)}
            accessibilityRole="button"
            accessibilityHint="顯示計算說明"
          >
            <View style={{ flex: 1 }}>
              <Text style={s.ruleTitle}>{r.title}</Text>
              <Text style={s.ruleFormula}>{r.formula}</Text>
            </View>
            <Text style={s.ruleValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              {fmtNtd(r.value)}
            </Text>
            <ChevronRight size={14} color="#c7c7cc" />
          </Pressable>
        </Animated.View>
      ))}

      <InfoModal
        visible={openRule !== null}
        content={openRule?.detail ?? null}
        onClose={() => setOpenKey(null)}
      />
    </View>
  );
}

function AmountInput({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={s.inputRow}>
      <Text style={s.inputLabel}>{label}</Text>
      <View style={s.inputRight}>
        <Text style={s.affix}>NT$</Text>
        <TextInput
          style={s.input}
          value={value}
          onChangeText={(t) => onChange(t.replace(/[^\d.]/g, ""))}
          keyboardType="numeric"
          placeholder={placeholder}
          placeholderTextColor="#c7c7cc"
          maxLength={10}
        />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  title: { fontSize: 15, fontWeight: "600", color: "#1c1c1e" },
  sub: { fontSize: 12, color: "#8e8e93", marginTop: 2, marginBottom: 12 },
  inputGroup: {
    backgroundColor: "#f2f2f7",
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  inputDivider: { height: StyleSheet.hairlineWidth, backgroundColor: "#d1d1d6" },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  inputLabel: { fontSize: 14, fontWeight: "500", color: "#1c1c1e" },
  inputRight: { flexDirection: "row", alignItems: "center", gap: 4 },
  affix: { fontSize: 13, color: "#8e8e93" },
  input: {
    minWidth: 120,
    textAlign: "right",
    fontSize: 16,
    fontWeight: "600",
    color: "#1c1c1e",
    padding: 0,
  },
  ruleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f2f2f7",
    paddingVertical: 10,
  },
  ruleRowPressed: { opacity: 0.5 },
  ruleTitle: { fontSize: 13, fontWeight: "500", color: "#1c1c1e" },
  ruleFormula: { fontSize: 11, color: "#8e8e93", marginTop: 2 },
  ruleValue: { fontSize: 15, fontWeight: "700", color: "#374254", maxWidth: "50%" },
});
