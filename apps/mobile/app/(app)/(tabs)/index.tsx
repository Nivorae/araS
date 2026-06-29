import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  LayoutChangeEvent,
  Pressable,
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
  const [hideBalance, setHideBalance] = useState(false);
  const [isCardExpanded, setIsCardExpanded] = useState(false);
  const cardStackRef = useRef<CategoryCardStackHandle>(null);

  const [containerH, setContainerH] = useState(0);
  const topH = useRef(new Animated.Value(0)).current;

  // net worth
  const netWorth = useMemo(() => {
    const assets = entries.filter((e) => e.topCategory !== "負債").reduce((s, e) => s + e.value, 0);
    const liabilities = entries
      .filter((e) => e.topCategory === "負債")
      .reduce((s, e) => s + e.value, 0);
    return assets - liabilities;
  }, [entries]);

  // grouped stack categories (skip empty), in CARD_ORDER
  const stackCategories: StackCategory[] = useMemo(() => {
    const grouped = entries.reduce<Record<string, Entry[]>>((acc, e) => {
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
  }, [entries]);

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
      <Pressable
        style={s.body}
        onLayout={onContainerLayout}
        onPress={() => {
          if (isCardExpanded) cardStackRef.current?.collapse();
        }}
      >
        {/* Top zone: net worth */}
        <Animated.View style={[s.topZone, { height: topH }]}>
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
          <Text style={s.netValue}>
            {hideBalance ? "araS" : formatCurrency(netWorth).replace("NT", "")}
          </Text>
        </Animated.View>

        {/* Bottom zone: card stack */}
        <View style={s.bottomZone}>
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
        </View>
      </Pressable>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f2f2f7", paddingTop: NAV_CLEARANCE },
  center: { alignItems: "center", justifyContent: "center" },
  body: { flex: 1, overflow: "hidden" },

  topZone: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
  netLabelRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  netLabel: { fontSize: 12, fontWeight: "600", color: "#8e8e93" },
  netValue: { fontSize: 40, fontWeight: "700", letterSpacing: -1, color: "#1c1c1e" },

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
