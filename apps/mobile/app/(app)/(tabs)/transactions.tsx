import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Dimensions, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import type { NetWorthRange } from "@repo/shared";
import { useFinanceStore } from "@/store/financeStore";

const SCREEN_H = Dimensions.get("window").height;
import { BalanceScale } from "@/components/BalanceScale";
import { NetWorthChart } from "@/components/NetWorthChart";
import { AssetAllocationView } from "@/components/AssetAllocationView";
import { DividendOverview } from "@/components/DividendOverview";
import { formatCurrency } from "@/lib/format";
import { NAV_CLEARANCE } from "@/components/TopGlassNav";
import { useIsPremium } from "@/hooks/useIsPremium";
import { useFinanceActions } from "@/hooks/useFinanceActions";

const RANGES: { key: NetWorthRange; label: string }[] = [
  { key: "6m", label: "6M" },
  { key: "1y", label: "1Y" },
  { key: "all", label: "全部" },
];

export default function TransactionsScreen() {
  const router = useRouter();
  const { isPremium } = useIsPremium();
  const { fetchNetWorthHistory } = useFinanceActions();
  const [view, setView] = useState<"trend" | "allocation" | "dividends">("trend");
  const [range, setRange] = useState<NetWorthRange>("6m");
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  // Mounted-once-then-kept-alive: switching `view` only toggles which pane is
  // visible below (see `display: none` in chartZone), so a tab's component
  // never unmounts once visited and doesn't reset/refetch on every switch
  // back to it. Trend is visible from the start so it needs no flag; the
  // other two mount lazily on first visit.
  const [everVisitedAllocation, setEverVisitedAllocation] = useState(false);
  const [everVisitedDividends, setEverVisitedDividends] = useState(false);
  const entries = useFinanceStore((s) => s.entries);
  const netWorthHistory = useFinanceStore((s) => s.netWorthHistory);

  const totalAssets = useMemo(
    () => entries.filter((e) => e.topCategory !== "負債").reduce((s, e) => s + e.value, 0),
    [entries]
  );
  const totalLiabilities = useMemo(
    () => entries.filter((e) => e.topCategory === "負債").reduce((s, e) => s + e.value, 0),
    [entries]
  );

  // Only the selected range is fetched, and only once — the store caches it and
  // clears the cache whenever an entry changes. Loading only shows for an
  // uncached range so switching back to an already-fetched range is instant.
  useEffect(() => {
    if (netWorthHistory[range]) return;
    let cancelled = false;
    setIsHistoryLoading(true);
    void fetchNetWorthHistory(range).finally(() => {
      if (!cancelled) setIsHistoryLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchNetWorthHistory, range, netWorthHistory]);

  const points = useMemo(() => netWorthHistory[range] ?? [], [netWorthHistory, range]);
  const periodLabel = useMemo(() => {
    if (points.length === 0) return "";
    const first = points[0]!.period;
    const last = points[points.length - 1]!.period;
    return first === last ? first : `${first} – ${last}`;
  }, [points]);

  return (
    <SafeAreaView style={s.root} edges={["top"]}>
      {/* Header: balance scale — same height as retirement header */}
      <View style={[s.headerZone, { height: SCREEN_H * 0.44 }]}>
        <Text style={s.title}>資產損益</Text>
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
      <View style={s.chartZone}>
        <View style={[s.tabPane, view !== "trend" && s.hiddenPane]}>
          <View style={s.rangeRow}>
            {RANGES.map((r) => (
              <Pressable
                key={r.key}
                disabled={isHistoryLoading}
                style={[
                  s.rangeBtn,
                  range === r.key && s.rangeBtnActive,
                  isHistoryLoading && s.rangeBtnDisabled,
                ]}
                onPress={() => setRange(r.key)}
              >
                <Text style={[s.rangeText, range === r.key && s.rangeTextActive]}>{r.label}</Text>
              </Pressable>
            ))}
          </View>
          {isHistoryLoading ? (
            <View style={s.chartLoading}>
              <ActivityIndicator size="small" color="#8e8e93" />
            </View>
          ) : (
            <NetWorthChart data={points} />
          )}
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
  rangeRow: {
    flexDirection: "row",
    alignSelf: "flex-end",
    gap: 4,
    marginBottom: 8,
  },
  rangeBtn: { paddingVertical: 4, paddingHorizontal: 12, borderRadius: 12 },
  rangeBtnActive: { backgroundColor: "#e5e5ea" },
  rangeBtnDisabled: { opacity: 0.4 },
  rangeText: { fontSize: 11, fontWeight: "600", color: "#c7c7cc" },
  rangeTextActive: { color: "#1c1c1e" },
  chartLoading: { flex: 1, alignItems: "center", justifyContent: "center" },
  tabPane: { flex: 1 },
  hiddenPane: { display: "none" },
});
