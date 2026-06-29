import { useMemo } from "react";
import { Dimensions, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFinanceStore } from "@/store/financeStore";

const SCREEN_H = Dimensions.get("window").height;
import { BalanceScale } from "@/components/BalanceScale";
import { InvestmentChart } from "@/components/InvestmentChart";
import { aggregateSnapshots, getRangeDisplayLabel } from "@/lib/chartAggregation";
import { formatCurrency } from "@/lib/format";
import { NAV_CLEARANCE } from "@/components/TopGlassNav";

export default function TransactionsScreen() {
  const entries = useFinanceStore((s) => s.entries);
  const valueSnapshots = useFinanceStore((s) => s.valueSnapshots);

  const totalAssets = useMemo(
    () => entries.filter((e) => e.topCategory !== "負債").reduce((s, e) => s + e.value, 0),
    [entries]
  );
  const totalLiabilities = useMemo(
    () => entries.filter((e) => e.topCategory === "負債").reduce((s, e) => s + e.value, 0),
    [entries]
  );

  const investmentData = useMemo(() => aggregateSnapshots(valueSnapshots, "5m"), [valueSnapshots]);
  const periodLabel = useMemo(() => getRangeDisplayLabel("5m"), []);

  return (
    <SafeAreaView style={s.root} edges={["top"]}>
      {/* Header: balance scale — same height as retirement header */}
      <View style={[s.headerZone, { height: SCREEN_H * 0.42 }]}>
        <Text style={s.title}>投資損益</Text>
        <BalanceScale assets={totalAssets} liabilities={totalLiabilities} />

        {/* Asset / Liability values aligned below the pans */}
        <View style={s.valuesRow}>
          <View style={s.valueCol}>
            <Text style={[s.valueNum, { color: "#374254" }]}>{formatCurrency(totalAssets)}</Text>
            <Text style={s.valueLabel}>資產</Text>
          </View>
          <View style={s.valueCol}>
            <Text style={[s.valueNum, { color: "#C7C7D4" }]}>
              {formatCurrency(totalLiabilities)}
            </Text>
            <Text style={s.valueLabel}>負債</Text>
          </View>
        </View>

        <Text style={s.periodLabel}>{periodLabel}</Text>
      </View>

      {/* Chart zone — fills remaining height */}
      <View style={s.chartZone}>
        <InvestmentChart data={investmentData} />
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f2f2f7", paddingTop: NAV_CLEARANCE },
  headerZone: {
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  title: { fontSize: 22, fontWeight: "700", color: "#1c1c1e" },
  valuesRow: {
    width: "75%",
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  valueCol: { alignItems: "center" },
  valueNum: { fontSize: 15, fontWeight: "700" },
  valueLabel: { fontSize: 11, color: "#8e8e93" },
  periodLabel: { fontSize: 11, color: "#c7c7cc" },
  chartZone: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
});
