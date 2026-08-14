import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useFinanceStore } from "@/store/financeStore";
import { useResponsive } from "@/hooks/useResponsive";
import { BalanceScale } from "@/components/BalanceScale";
import { InvestmentChart } from "@/components/InvestmentChart";
import { AssetAllocationView } from "@/components/AssetAllocationView";
import { DividendOverview } from "@/components/DividendOverview";
import { aggregateSnapshots, getRangeDisplayLabel } from "@/lib/chartAggregation";
import { formatCurrency } from "@/lib/format";
import { NAV_CLEARANCE } from "@/components/TopGlassNav";
import { useIsPremium } from "@/hooks/useIsPremium";

export default function TransactionsScreen() {
  const router = useRouter();
  const { height: screenH, isTablet, contentWidth, wideContentWidth } = useResponsive();
  const { isPremium } = useIsPremium();
  const [view, setView] = useState<"trend" | "allocation" | "dividends">("trend");
  // Mounted-once-then-kept-alive: switching `view` only toggles which pane is
  // visible below (see `display: none` in chartZone), so a tab's component
  // never unmounts once visited and doesn't reset/refetch on every switch
  // back to it. Trend is visible from the start so it needs no flag; the
  // other two mount lazily on first visit.
  const [everVisitedAllocation, setEverVisitedAllocation] = useState(false);
  const [everVisitedDividends, setEverVisitedDividends] = useState(false);
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
      {/* Header: balance scale — same height as retirement header. Capped to
          the content column on tablet so the values row (a % of its parent)
          does not fan out to the far edges of an iPad while the scale itself
          stays a fixed 220pt composition. */}
      <View
        style={[
          s.headerZone,
          { height: screenH * 0.44 },
          isTablet && { width: contentWidth, alignSelf: "center" },
        ]}
      >
        <Text style={[s.title, isTablet && s.titleTablet]}>投資損益</Text>

        {/* The scale is fixed-size art, so it is scaled as a unit rather than
            re-laid-out; the values below it are a share of the same column. */}
        <View style={isTablet ? s.scaleTablet : undefined}>
          <BalanceScale assets={totalAssets} liabilities={totalLiabilities} />
        </View>

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

        {/* Trend / allocation / dividends toggle. Free users tapping 配置 or
            股息 go straight to the paywall (decision five of the
            asset-allocation-analysis spec, applied identically to dividends
            since that module is also Premium-only) instead of switching —
            the free/premium check must also happen server-side (GET
            /api/entries/allocation and the dividend write endpoints both
            return 403), this is just the fast UX path. */}
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
              setEverVisitedAllocation(true);
              setView("allocation");
            }}
          >
            <Text style={[s.toggleText, view === "allocation" && s.toggleTextActive]}>配置</Text>
          </Pressable>
          <Pressable
            style={[s.toggleBtn, view === "dividends" && s.toggleBtnActive]}
            onPress={() => {
              if (!isPremium) {
                router.push("/paywall");
                return;
              }
              setEverVisitedDividends(true);
              setView("dividends");
            }}
          >
            <Text style={[s.toggleText, view === "dividends" && s.toggleTextActive]}>股息</Text>
          </Pressable>
        </View>
      </View>

      {/* Chart zone — fills remaining height. All visited panes stay mounted;
          `display: none` removes the hidden ones from layout without
          unmounting them, so switching tabs never re-triggers their fetch. */}
      <View style={[s.chartZone, isTablet && { width: wideContentWidth, alignSelf: "center" }]}>
        <View style={[s.tabPane, view !== "trend" && s.hiddenPane]}>
          <InvestmentChart data={investmentData} />
        </View>
        {everVisitedAllocation && (
          <View style={[s.tabPane, view !== "allocation" && s.hiddenPane]}>
            <AssetAllocationView />
          </View>
        )}
        {everVisitedDividends && (
          <View style={[s.tabPane, view !== "dividends" && s.hiddenPane]}>
            <DividendOverview />
          </View>
        )}
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
  titleTablet: { fontSize: 27 },
  // `scale` does not grow the layout box, so the extra 30% of the 108pt art
  // would overlap the title and values; the margin gives it that room back.
  scaleTablet: { transform: [{ scale: 1.3 }], marginVertical: 18 },
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
  tabPane: { flex: 1 },
  hiddenPane: { display: "none" },
});
