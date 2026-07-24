import { useMemo, useState } from "react";
import { Dimensions, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useFinanceStore } from "@/store/financeStore";

const SCREEN_H = Dimensions.get("window").height;
import { BalanceScale } from "@/components/BalanceScale";
import { InvestmentChart } from "@/components/InvestmentChart";
import { AssetAllocationView } from "@/components/AssetAllocationView";
import { aggregateSnapshots, getRangeDisplayLabel } from "@/lib/chartAggregation";
import { formatCurrency } from "@/lib/format";
import { NAV_CLEARANCE } from "@/components/TopGlassNav";
import { useIsPremium } from "@/hooks/useIsPremium";

export default function TransactionsScreen() {
  const router = useRouter();
  const { isPremium } = useIsPremium();
  const [view, setView] = useState<"trend" | "allocation">("trend");
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
      <View style={[s.headerZone, { height: SCREEN_H * 0.44 }]}>
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

        {/* Trend / allocation toggle. Free users tapping 配置 go straight to
            the paywall (decision five of the asset-allocation-analysis spec)
            instead of switching — the free/premium check must also happen
            server-side (GET /api/entries/allocation returns 403), this is
            just the fast UX path. */}
        <View style={s.toggleRow}>
          <Pressable
            style={[s.toggleBtn, view === "trend" && s.toggleBtnActive]}
            onPress={() => setView("trend")}
          >
            <Text style={[s.toggleText, view === "trend" && s.toggleTextActive]}>走勢</Text>
          </Pressable>
          <Pressable
            style={[s.toggleBtn, view === "allocation" && s.toggleBtnActive]}
            onPress={() => {
              if (!isPremium) {
                router.push("/paywall");
                return;
              }
              setView("allocation");
            }}
          >
            <Text style={[s.toggleText, view === "allocation" && s.toggleTextActive]}>配置</Text>
          </Pressable>
        </View>
      </View>

      {/* Chart zone — fills remaining height */}
      <View style={s.chartZone}>
        {view === "trend" ? <InvestmentChart data={investmentData} /> : <AssetAllocationView />}
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
  toggleRow: {
    flexDirection: "row",
    backgroundColor: "#e5e5ea",
    borderRadius: 20,
    padding: 3,
    gap: 3,
  },
  toggleBtn: { paddingVertical: 6, paddingHorizontal: 18, borderRadius: 17 },
  toggleBtnActive: { backgroundColor: "#ffffff" },
  toggleText: { fontSize: 13, fontWeight: "600", color: "#8e8e93" },
  toggleTextActive: { color: "#1c1c1e" },
  chartZone: {
    flex: 1,
    paddingHorizontal: 30,
    paddingBottom: 36,
  },
});
