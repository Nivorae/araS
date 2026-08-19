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
  STACK_SPRING_CLOSE,
  STACK_SPRING_OPEN,
  type CategoryCardStackHandle,
  type StackCategory,
} from "@/components/CategoryCardStack";
import { NAV_CLEARANCE } from "@/components/TopGlassNav";
import { useResponsive } from "@/hooks/useResponsive";

// Deck order, bottom card → top card. In CategoryCardStack the LAST name renders
// at the very top of the stack, so 保險 is forced to the end to sit above 應收款.
const CARD_ORDER = [...CATEGORIES.map((c) => c.name).filter((n) => n !== "保險"), "保險"];

// The two zones are sized ONCE, for the expanded state, and never resize. What
// used to be a 40%→28% spring on the top zone's `height` is now a translate of
// the deck (and of the net-worth block riding above it) by the same 12%.
//
// The height animation had to run with useNativeDriver:false, so every frame
// re-laid out the whole subtree on the JS thread — and because each card is
// height:"100%" with a 26pt radius and a 12pt shadow, iOS also re-rasterised
// every card's shadow each frame. Meanwhile the card springs themselves run on
// the UI thread. The two clocks drifted apart and the card edges visibly
// juddered; on an iPad, where the shadow passes cover far more pixels, it read
// as a flicker. Transforms keep the whole transition on the UI thread with zero
// layout passes.
const TOP_ZONE_RATIO = 0.28;
const COLLAPSED_DROP_RATIO = 0.12;
// Half the drop, so the net-worth block stays centred in the taller space the
// collapsed deck leaves above it — visually identical to the old 40% zone.
const NET_SHIFT_RATIO = COLLAPSED_DROP_RATIO / 2;

export default function AssetsScreen() {
  const router = useRouter();
  const { isTablet, contentWidth } = useResponsive();
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
  const netShift = useRef(new Animated.Value(0)).current;

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

  // Ride the net-worth block down with the resting deck, on the deck's own
  // spring so the two never drift apart mid-transition.
  useEffect(() => {
    if (containerH === 0) return;
    Animated.spring(netShift, {
      toValue: isCardExpanded ? 0 : containerH * NET_SHIFT_RATIO,
      ...(isCardExpanded ? STACK_SPRING_OPEN : STACK_SPRING_CLOSE),
    }).start();
  }, [isCardExpanded, containerH, netShift]);

  const onContainerLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h === containerH) return;
    setContainerH(h);
    netShift.setValue(isCardExpanded ? 0 : h * NET_SHIFT_RATIO);
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
        <Animated.View
          style={[
            s.topZone,
            { height: containerH * TOP_ZONE_RATIO, transform: [{ translateY: netShift }] },
          ]}
        >
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
            {/* Tapping anywhere in the net-worth block (label OR the number)
                collapses an expanded card. The eye toggle is a nested touchable,
                so it still just flips hideBalance without collapsing. */}
            <Pressable
              style={s.netBlock}
              onPress={() => {
                if (isCardExpanded) cardStackRef.current?.collapse();
              }}
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
                <Text style={[s.netValue, isTablet && s.netValueTablet]}>araS</Text>
              ) : marketLoading ? (
                // Investments still being priced — hold the total behind a spinner
                // so it doesn't flash the cost-basis figure first.
                <View style={s.netLoading}>
                  <ActivityIndicator size="small" color="#8e8e93" />
                </View>
              ) : (
                <Text style={[s.netValue, isTablet && s.netValueTablet]}>
                  {formatCurrency(netWorth).replace("NT", "")}
                </Text>
              )}
            </Pressable>
          </ScrollView>
        </Animated.View>

        {/* Bottom zone: card stack — a fixed, non-scrolling Pressable, so the
            scrub gesture only peeks cards without shifting the whole stack.
            Tapping empty space here collapses an expanded card. */}
        <Pressable
          style={[s.bottomZone, isTablet && { width: contentWidth, alignSelf: "center" }]}
          onPress={() => {
            if (isCardExpanded) cardStackRef.current?.collapse();
          }}
        >
          {/* Held back until the body has been measured: the stack measures its
              own height exactly once to lay the fan out, and before `containerH`
              is known the top zone is 0-tall, so it would measure the full body
              and space the deck too far apart for good. */}
          {containerH === 0 ? null : stackCategories.length > 0 ? (
            <CategoryCardStack
              ref={cardStackRef}
              categories={stackCategories}
              hideBalance={hideBalance}
              collapsedOffset={containerH * COLLAPSED_DROP_RATIO}
              getEntryIcon={(topCategory, subCategory) => getNodeIcon(topCategory, subCategory)}
              onEntryClick={(entry) =>
                // 保險走總攬頁（3D 翻轉＋發票預覽），focus 定位到點選的那張保單。
                entry.insurance
                  ? router.push({
                      pathname: "/insurance/overview",
                      params: { focus: entry.insurance.id },
                    })
                  : router.push(`/entry/${entry.id}`)
              }
              onExpandChange={setIsCardExpanded}
              onAddClick={(categoryName) =>
                // 保險走專屬表單，其餘分類走一般 entry 新增流程。
                categoryName === "保險"
                  ? router.push("/insurance/new")
                  : router.push(`/entry/new?topCategory=${encodeURIComponent(categoryName)}`)
              }
            />
          ) : (
            <View style={s.emptyWrap}>
              <TouchableOpacity
                style={[s.emptyCard, isTablet && { maxWidth: contentWidth }]}
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
  netBlock: { alignItems: "center" },
  netLabelRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  netLabel: { fontSize: 12, fontWeight: "600", color: "#8e8e93" },
  netValue: { fontSize: 40, fontWeight: "700", letterSpacing: -1, color: "#1c1c1e" },
  netValueTablet: { fontSize: 54 },
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
