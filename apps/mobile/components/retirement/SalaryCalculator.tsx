import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Animated, { FadeInDown } from "react-native-reanimated";
import { SALARY_STORAGE_KEY, salaryRules, type SalaryRule } from "@/lib/retirement";

export const fmtNtd = (v: number) => `NT$ ${Math.round(v).toLocaleString("zh-TW")}`;

/** 月薪輸入（持久化到 AsyncStorage）與由它推算的理財法則。 */
export function useSalary() {
  const [salaryStr, setSalaryStr] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(SALARY_STORAGE_KEY)
      .then((saved) => {
        if (saved) setSalaryStr(saved);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (loaded) AsyncStorage.setItem(SALARY_STORAGE_KEY, salaryStr).catch(() => {});
  }, [salaryStr, loaded]);

  const rules = useMemo(() => salaryRules(parseFloat(salaryStr)), [salaryStr]);

  return { salaryStr, setSalaryStr, rules };
}

/** 退休頁「理財規劃」模式的薪資理財試算：輸入月薪，列出五條經驗法則的建議金額。 */
export function SalaryCalculator({
  salaryStr,
  onChangeSalary,
  rules,
}: {
  salaryStr: string;
  onChangeSalary: (v: string) => void;
  rules: SalaryRule[];
}) {
  return (
    <View style={s.card}>
      <Text style={s.title}>薪資理財試算</Text>
      <Text style={s.sub}>依月薪推算儲蓄、開支與預備金</Text>

      <View style={s.inputRow}>
        <Text style={s.inputLabel}>目前月薪</Text>
        <View style={s.inputRight}>
          <Text style={s.affix}>NT$</Text>
          <TextInput
            style={s.input}
            value={salaryStr}
            onChangeText={(t) => onChangeSalary(t.replace(/[^\d.]/g, ""))}
            keyboardType="numeric"
            placeholder="輸入月薪"
            placeholderTextColor="#c7c7cc"
            maxLength={10}
          />
        </View>
      </View>

      {rules.map((r, i) => (
        <Animated.View
          key={r.key}
          entering={FadeInDown.delay(80 + i * 45)
            .springify()
            .damping(18)}
          style={s.ruleRow}
        >
          <View style={{ flex: 1 }}>
            <Text style={s.ruleTitle}>{r.title}</Text>
            <Text style={s.ruleFormula}>{r.formula}</Text>
          </View>
          <Text style={s.ruleValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            {fmtNtd(r.value)}
          </Text>
        </Animated.View>
      ))}
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
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f2f2f7",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 4,
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
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f2f2f7",
    paddingVertical: 10,
  },
  ruleTitle: { fontSize: 13, fontWeight: "500", color: "#1c1c1e" },
  ruleFormula: { fontSize: 11, color: "#8e8e93", marginTop: 2 },
  ruleValue: { fontSize: 15, fontWeight: "700", color: "#374254", maxWidth: "50%" },
});
