import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  LayoutChangeEvent,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Eye, EyeOff } from "lucide-react-native";
import type { Entry } from "@repo/shared";
import { useFinanceStore } from "@/store/financeStore";
import { useFinanceActions } from "@/hooks/useFinanceActions";
import { useInvestmentMarketValues } from "@/hooks/useInvestmentMarketValues";
import { formatCurrency } from "@/lib/format";
import { CATEGORIES, getNodeIcon } from "@/lib/categoryConfig";
import {
  CategoryCardStack,
  type CategoryCardStackHandle,
  type StackCategory,
} from "@/components/CategoryCardStack";
import { NAV_CLEARANCE } from "@/components/TopGlassNav";

const CARD_ORDER = CATEGORIES.map((c) => c.name);

export default function AssetsScreen() {
  const router = useRouter();
  const { entries, loading } = useFinanceStore();
  const { fetchAll } = useFinanceActions();
  const [hideBalance, setHideBalance] = useState(false);
  const [isCardExpanded, setIsCardExpanded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [priceNonce, setPriceNonce] = useState(0);
  const cardStackRef = useRef<CategoryCardStackHandle>(null);

  // Live market values for stock-backed investments (item 11). Investment totals
  // are shown at market value (cost + total P&L), not cost. `marketLoading` lets
  // us hold the net-worth total behind a spinner on first load so it doesn't
  // flash the cost-basis figure before the market value arrives.
  const { values: marketValues, loading: marketLoading } = useInvestmentMarketValues(priceNonce);
  const displayEntries = useMemo(
    () =>
      entries.map((e) => (marketValues[e.id] != null ? { ...e, value: marketValues[e.id]! } : e)),
    [entries, marketValues]
  );

  // Pull-to-refresh (item 16). Disabled while a card is expanded so the inner
  // entry list scrolls freely without gesture conflict.
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchAll();
      setPriceNonce((n) => n + 1); // also refresh live prices
    } finally {
      setRefreshing(false);
    }
  }, [fetchAll]);

  const [containerH, setContainerH] = useState(0);
  const topH = useRef(new Animated.Value(0)).current;

  // net worth
  const netWorth = useMemo(() => {
    const assets = displayEntries
      .filter((e) => e.topCategory !== "負債")
      .reduce((s, e) => s + e.value, 0);
    const liabilities = displayEntries
      .filter((e) => e.topCategory === "負債")
      .reduce((s, e) => s + e.value, 0);
    return assets - liabilities;
  }, [displayEntries]);

  // grouped stack categories (skip empty), in CARD_ORDER
  const stackCategories: StackCategory[] = useMemo(() => {
    const grouped = displayEntries.reduce<Record<string, Entry[]>>((acc, e) => {
      (acc[e.topCategory] ??= []).push(e);
      return acc;
    }, {});
    return CARD_ORDER.flatMap((name) => {
      const cfg = CATEGORIES.find((c) => c.name === name)!;
      const catEntries = grouped[name] ?? [];
      if (catEntries.length === 0) return [];
      return [
        {
          name,
          color: cfg.color,
          textColor: cfg.textColor,
          isLiability: cfg.isLiability,
          entries: catEntries,
          total: catEntries.reduce((s, e) => s + e.value, 0),
        },
      ];
    });
  }, [displayEntries]);

  // animate top zone height (40% collapsed → 28% expanded)
  useEffect(() => {
    if (containerH === 0) return;
    Animated.spring(topH, {
      toValue: containerH * (isCardExpanded ? 0.28 : 0.4),
      stiffness: 200,
      damping: 28,
      mass: 1,
      useNativeDriver: false,
    }).start();
  }, [isCardExpanded, containerH, topH]);

  const onContainerLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    setContainerH(h);
    topH.setValue(h * (isCardExpanded ? 0.28 : 0.4));
  };

  if (loading && entries.length === 0) {
    return (
      <SafeAreaView style={[s.root, s.center]} edges={["top"]}>
        <ActivityIndicator size="large" color="#374254" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root} edges={["top"]}>
      <View style={s.body} onLayout={onContainerLayout}>
        {/* Top zone: net worth — pull-to-refresh lives ONLY here, and has no
            Pressable ancestor, so the pull gesture is never intercepted. Both
            scrolling and the refresh control itself are locked while a card is
            expanded, so pulling down there can't trigger a refresh underneath. */}
        <Animated.View style={[s.topZone, { height: topH }]}>
          <ScrollView
            style={s.flex}
            contentContainerStyle={s.netScroll}
            scrollEnabled={!isCardExpanded}
            alwaysBounceVertical={!isCardExpanded}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                enabled={!isCardExpanded}
                tintColor="#374254"
              />
            }
          >
            <View style={s.netLabelRow}>
              <Text style={s.netLabel}>Net Worth (TWD)</Text>
              <TouchableOpacity onPress={() => setHideBalance((v) => !v)} hitSlop={8}>
                {hideBalance ? (
                  <EyeOff size={14} color="#8e8e93" />
                ) : (
                  <Eye size={14} color="#8e8e93" />
                )}
              </TouchableOpacity>
            </View>
            {hideBalance ? (
              <Text style={s.netValue}>araS</Text>
            ) : marketLoading ? (
              // Investments still being priced — hold the total behind a spinner
              // so it doesn't flash the cost-basis figure first.
              <View style={s.netLoading}>
                <ActivityIndicator size="small" color="#8e8e93" />
              </View>
            ) : (
              <Text style={s.netValue}>{formatCurrency(netWorth).replace("NT", "")}</Text>
            )}
          </ScrollView>
        </Animated.View>

        {/* Bottom zone: card stack — a fixed, non-scrolling Pressable, so the
            scrub gesture only peeks cards without shifting the whole stack.
            Tapping empty space here collapses an expanded card. */}
        <Pressable
          style={s.bottomZone}
          onPress={() => {
            if (isCardExpanded) cardStackRef.current?.collapse();
          }}
        >
          {stackCategories.length > 0 ? (
            <CategoryCardStack
              ref={cardStackRef}
              categories={stackCategories}
              hideBalance={hideBalance}
              getEntryIcon={(topCategory, subCategory) => getNodeIcon(topCategory, subCategory)}
              onEntryClick={(entry) => router.push(`/entry/${entry.id}`)}
              onExpandChange={setIsCardExpanded}
              onAddClick={(categoryName) =>
                router.push(`/entry/new?topCategory=${encodeURIComponent(categoryName)}`)
              }
            />
          ) : (
            <View style={s.emptyWrap}>
              <TouchableOpacity
                style={s.emptyCard}
                onPress={() => router.push("/entry/new")}
                activeOpacity={0.7}
              >
                <Text style={s.emptyTitle}>+ 新增第一筆資產</Text>
                <Text style={s.emptySub}>記錄你的資產與負債</Text>
              </TouchableOpacity>
            </View>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f2f2f7", paddingTop: NAV_CLEARANCE },
  center: { alignItems: "center", justifyContent: "center" },
  flex: { flex: 1 },
  body: { flex: 1, overflow: "hidden" },

  topZone: { overflow: "hidden" },
  netScroll: { flexGrow: 1, alignItems: "center", justifyContent: "center" },
  netLabelRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  netLabel: { fontSize: 12, fontWeight: "600", color: "#8e8e93" },
  netValue: { fontSize: 40, fontWeight: "700", letterSpacing: -1, color: "#1c1c1e" },
  netLoading: { height: 48, alignItems: "center", justifyContent: "center" },

  bottomZone: { flex: 1 },

  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  emptyCard: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 48,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  emptyTitle: { fontSize: 15, fontWeight: "500", color: "#374254" },
  emptySub: { fontSize: 13, color: "#8e8e93", marginTop: 4 },
});
