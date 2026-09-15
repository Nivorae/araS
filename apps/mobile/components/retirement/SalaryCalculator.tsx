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

  const rules = useMemo(
    () => salaryRules(parseFloat(salaryStr), parseFloat(passiveStr)),
    [salaryStr, passiveStr]
  );
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
    <View style={s.root}>
      <View style={s.card}>
        <Text style={s.title}>薪資理財試算</Text>
        <View style={s.inputRow}>
          <AmountInput label="月薪" value={salaryStr} onChange={onChangeSalary} />
          <View style={s.inputDivider} />
          <AmountInput label="被動收入" value={passiveStr} onChange={onChangePassive} />
        </View>
      </View>

      <View style={s.grid}>
        {rules.map((r, i) => (
          <Animated.View
            key={r.key}
            style={s.ruleCell}
            entering={FadeInDown.delay(80 + i * 45)
              .springify()
              .damping(18)}
          >
            <Pressable
              style={({ pressed }) => [s.ruleCard, pressed && s.ruleCardPressed]}
              onPress={() => setOpenKey(r.key)}
              accessibilityRole="button"
              accessibilityHint="顯示計算說明"
            >
              <View style={s.ruleTop}>
                <Text style={s.ruleTitle} numberOfLines={1}>
                  {r.title}
                </Text>
                <ChevronRight size={13} color="#c7c7cc" />
              </View>
              <Text
                style={s.ruleValue}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.6}
                maxFontSizeMultiplier={1.3}
              >
                {fmtNtd(r.value)}
              </Text>
              <Text style={s.ruleFormula}>{r.formula}</Text>
            </Pressable>
          </Animated.View>
        ))}
      </View>

      <InfoModal
        visible={openRule !== null}
        content={openRule?.detail ?? null}
        onClose={() => setOpenKey(null)}
      />
    </View>
  );
}

/** 顯示用：整數部分加上千分位逗點，小數部分原樣保留（輸入中的 "1234." 也不會被吃掉）。 */
function withThousands(raw: string): string {
  const [int = "", ...rest] = raw.split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return rest.length ? `${grouped}.${rest.join("")}` : grouped;
}

/** 金額在上、標籤在下的置中輸入欄。 */
function AmountInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={s.inputCol}>
      <View style={s.inputValueRow}>
        <Text style={s.affix}>NT$</Text>
        <TextInput
          style={s.input}
          value={withThousands(value)}
          onChangeText={(t) => onChange(t.replace(/[^\d.]/g, ""))}
          keyboardType="numeric"
          placeholder="0"
          placeholderTextColor="rgba(255,255,255,0.35)"
          selectionColor="#ffffff"
          maxLength={13}
          accessibilityLabel={label}
        />
      </View>
      <Text style={s.inputLabel}>{label}</Text>
    </View>
  );
}

const cardBase = {
  backgroundColor: "#ffffff",
  borderRadius: 16,
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.05,
  shadowRadius: 4,
  elevation: 2,
} as const;

const s = StyleSheet.create({
  root: { gap: 12 },
  card: { ...cardBase, backgroundColor: "#0e1424", paddingHorizontal: 16, paddingVertical: 18 },
  title: { fontSize: 15, fontWeight: "600", color: "#ffffff", textAlign: "center" },
  inputRow: { flexDirection: "row", alignItems: "stretch", marginTop: 16 },
  inputDivider: { width: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,0.25)" },
  inputCol: { flex: 1, alignItems: "center", paddingHorizontal: 8 },
  inputValueRow: { flexDirection: "row", alignItems: "baseline", gap: 2 },
  affix: { fontSize: 13, fontWeight: "600", color: "rgba(255,255,255,0.6)" },
  input: {
    minWidth: 60,
    maxWidth: 120,
    textAlign: "center",
    fontSize: 20,
    fontWeight: "700",
    color: "#ffffff",
    padding: 0,
  },
  inputLabel: { fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 8 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  ruleCell: { width: "47.5%", flexGrow: 1 },
  ruleCard: { ...cardBase, flex: 1, paddingHorizontal: 16, paddingVertical: 20 },
  ruleCardPressed: { opacity: 0.6 },
  ruleTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 4,
    marginBottom: 12,
  },
  ruleTitle: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: "500",
    color: "#8e8e93",
    letterSpacing: 0.5,
  },
  ruleValue: { fontSize: 22, fontWeight: "700", lineHeight: 28, color: "#374254" },
  ruleFormula: { fontSize: 11, color: "#8e8e93", marginTop: 8 },
});
