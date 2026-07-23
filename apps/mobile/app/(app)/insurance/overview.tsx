import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  type LayoutRectangle,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, X } from "lucide-react-native";
import { INSURANCE_TYPE_LABELS, type Insurance } from "@repo/shared";
import { useFinanceActions } from "@/hooks/useFinanceActions";
import { formatCurrency } from "@/lib/format";
import { CATEGORIES } from "@/lib/categoryConfig";
import { TopGlassNav, NAV_CLEARANCE } from "@/components/TopGlassNav";

const UNKNOWN = "不確定";
const CARD_RADIUS = 22;
const EXPANDED_RADIUS = 26;
const DETAIL_FADE_START = 0.35;

// Text on a light card background (white/grey) reads dark; text on a dark
// card background (blue/navy) reads light.
const LIGHT_BG_TEXT = {
  muted: "rgba(28,28,30,0.55)",
  dashed: "rgba(28,28,30,0.16)",
  closeBg: "rgba(28,28,30,0.08)",
};
const DARK_BG_TEXT = {
  muted: "rgba(255,255,255,0.75)",
  dashed: "rgba(255,255,255,0.3)",
  closeBg: "rgba(255,255,255,0.22)",
};

// The project's five net-worth category colours (see categoryConfig.ts),
// minus the insurance category itself, reused here so each policy card in
// the deck cycles through the same established palette.
const PALETTE = CATEGORIES.filter((c) => c.name !== "保險").map((c) => ({
  bg: c.color,
  text: c.textColor,
  ...(c.textColor === "#ffffff" ? DARK_BG_TEXT : LIGHT_BG_TEXT),
}));

function themeFor(index: number) {
  return PALETTE[index % PALETTE.length]!;
}

function formatDate(iso: string | null): string {
  if (!iso) return UNKNOWN;
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

type Theme = { text: string; muted: string };

// A label ─ value line in the expanded detail card.
function Row({ label, value, theme }: { label: string; value: string; theme: Theme }) {
  return (
    <View style={s.row}>
      <Text style={[s.rowLabel, { color: theme.muted }]}>{label}</Text>
      <Text style={[s.rowValue, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

export default function InsuranceOverviewScreen() {
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const { fetchInsurances } = useFinanceActions();

  // Coverflow geometry. Cards overlap (negative SPACING) so ~2 neighbours
  // peek on each side of the active card, like a Framer-style cover flow.
  // A card is centred when scrollX === index * INTERVAL, thanks to the
  // sideInset padding on the scroll content.
  const CARD_W = Math.round(screenW * 0.54);
  const CARD_H = Math.round(CARD_W * 1.35);
  const SPACING = -Math.round(CARD_W * 0.38);
  const INTERVAL = CARD_W + SPACING;
  const sideInset = (screenW - CARD_W) / 2;

  // Bounds the tapped card grows into — a near-fullscreen detail card,
  // centred over the deck.
  const EXPANDED_W = Math.round(screenW * 0.86);
  const EXPANDED_H = Math.round(screenH * 0.72);
  const EXPANDED_LEFT = (screenW - EXPANDED_W) / 2;
  const EXPANDED_TOP = (screenH - EXPANDED_H) / 2;
  const HEADER_H_EXPANDED = 116;

  const [insurances, setInsurances] = useState<Insurance[] | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [expanded, setExpanded] = useState<Insurance | null>(null);
  const [expandedIndex, setExpandedIndex] = useState(0);
  const [cardOrigin, setCardOrigin] = useState<LayoutRectangle | null>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const growth = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView>(null);
  const cardRefs = useRef<Record<string, View | null>>({});
  const didInitialFocus = useRef(false);

  // Refetch on focus so an edit/delete on the detail screen is reflected on
  // return. Source of truth is the backend, not the store's slim entry copy.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      fetchInsurances()
        .then((data) => {
          if (active) setInsurances(data);
        })
        .catch(() => {
          if (active) setInsurances([]);
        });
      return () => {
        active = false;
      };
    }, [fetchInsurances])
  );

  // Oldest first, so the deck reads left → right in creation order.
  const sorted = useMemo(() => {
    if (!insurances) return [];
    return [...insurances].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }, [insurances]);

  // Centre the deck on the policy the user tapped in from elsewhere — once, after data arrives.
  useEffect(() => {
    if (!insurances || didInitialFocus.current) return;
    didInitialFocus.current = true;
    const idx = Math.max(
      0,
      sorted.findIndex((i) => i.id === focus)
    );
    setActiveIndex(idx);
    if (idx > 0) {
      requestAnimationFrame(() =>
        scrollRef.current?.scrollTo({ x: idx * INTERVAL, animated: false })
      );
    }
  }, [insurances, sorted, focus, INTERVAL]);

  const onScroll = useRef(
    Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: true })
  ).current;

  const onMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const count = sorted.length || 1;
      const idx = Math.round(e.nativeEvent.contentOffset.x / INTERVAL);
      setActiveIndex(Math.max(0, Math.min(idx, count - 1)));
    },
    [sorted.length, INTERVAL]
  );

  const goTo = useCallback(
    (i: number) => scrollRef.current?.scrollTo({ x: i * INTERVAL, animated: true }),
    [INTERVAL]
  );

  // Grow the tapped card, in place, from its measured on-screen rect into
  // the full detail card — no separate modal sliding in.
  const openDetail = useCallback(
    (ins: Insurance, index: number) => {
      const node = cardRefs.current[ins.id];
      node?.measureInWindow((x, y, width, height) => {
        setCardOrigin({ x, y, width, height });
        setExpanded(ins);
        setExpandedIndex(index);
        Animated.spring(growth, {
          toValue: 1,
          useNativeDriver: false,
          friction: 9,
          tension: 70,
        }).start();
      });
    },
    [growth]
  );

  const closeDetail = useCallback(() => {
    Animated.timing(growth, { toValue: 0, duration: 220, useNativeDriver: false }).start(() => {
      setExpanded(null);
      setCardOrigin(null);
    });
  }, [growth]);

  if (insurances === null) {
    return (
      <View style={[s.root, s.center]}>
        <ActivityIndicator size="large" color="#B8865E" />
      </View>
    );
  }

  const origin = cardOrigin ?? {
    x: EXPANDED_LEFT,
    y: EXPANDED_TOP,
    width: EXPANDED_W,
    height: EXPANDED_H,
  };
  const growLeft = growth.interpolate({
    inputRange: [0, 1],
    outputRange: [origin.x, EXPANDED_LEFT],
  });
  const growTop = growth.interpolate({ inputRange: [0, 1], outputRange: [origin.y, EXPANDED_TOP] });
  const growWidth = growth.interpolate({
    inputRange: [0, 1],
    outputRange: [origin.width, EXPANDED_W],
  });
  const growHeight = growth.interpolate({
    inputRange: [0, 1],
    outputRange: [origin.height, EXPANDED_H],
  });
  const growRadius = growth.interpolate({
    inputRange: [0, 1],
    outputRange: [CARD_RADIUS, EXPANDED_RADIUS],
  });
  // The header block shrinks from the full card height (text sits centred in
  // the whole collapsed card) down to a fixed top strip (text centred just
  // within that strip) — so the header text stays continuously centred in
  // its own box the entire time, instead of jumping from middle to top.
  const headerHeight = growth.interpolate({
    inputRange: [0, 1],
    outputRange: [origin.height, HEADER_H_EXPANDED],
  });
  const detailOpacity = growth.interpolate({
    inputRange: [DETAIL_FADE_START, 1],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  const backdropOpacity = growth.interpolate({ inputRange: [0, 1], outputRange: [0, 0.55] });

  const expandedTheme = themeFor(expandedIndex);

  return (
    <View style={s.root}>
      <SafeAreaView edges={["top", "bottom"]} style={s.safe}>
        {/* Reserve space below the floating nav pill. */}
        <View style={{ height: NAV_CLEARANCE + 24 }} />

        {/* ── The coverflow deck is vertically centred in the remaining space ── */}
        <View style={s.centerZone}>
          {sorted.length === 0 ? (
            <Text style={s.emptyText}>還沒有保單</Text>
          ) : (
            <View style={{ height: CARD_H }}>
              <Animated.ScrollView
                ref={scrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                snapToInterval={INTERVAL}
                decelerationRate="fast"
                contentContainerStyle={{ paddingHorizontal: sideInset, alignItems: "center" }}
                onScroll={onScroll}
                scrollEventThrottle={16}
                onMomentumScrollEnd={onMomentumEnd}
              >
                {sorted.map((ins, i) => {
                  const inputRange = [
                    (i - 2) * INTERVAL,
                    (i - 1) * INTERVAL,
                    i * INTERVAL,
                    (i + 1) * INTERVAL,
                    (i + 2) * INTERVAL,
                  ];
                  const rotateY = scrollX.interpolate({
                    inputRange,
                    outputRange: ["55deg", "40deg", "0deg", "-40deg", "-55deg"],
                    extrapolate: "clamp",
                  });
                  const scale = scrollX.interpolate({
                    inputRange,
                    outputRange: [0.66, 0.82, 1, 0.82, 0.66],
                    extrapolate: "clamp",
                  });
                  const opacity = scrollX.interpolate({
                    inputRange,
                    outputRange: [0.4, 0.7, 1, 0.7, 0.4],
                    extrapolate: "clamp",
                  });
                  const isActive = i === activeIndex;
                  const isBeingExpanded = expanded?.id === ins.id;
                  const theme = themeFor(i);
                  return (
                    <Pressable
                      key={ins.id}
                      onPress={() => (isActive ? openDetail(ins, i) : goTo(i))}
                      style={{ zIndex: sorted.length - Math.abs(i - activeIndex) }}
                    >
                      <Animated.View
                        ref={(node) => {
                          cardRefs.current[ins.id] = node as unknown as View | null;
                        }}
                        style={[
                          s.policyCard,
                          {
                            width: CARD_W,
                            height: CARD_H,
                            marginRight: i === sorted.length - 1 ? 0 : SPACING,
                            backgroundColor: theme.bg,
                            opacity: isBeingExpanded ? 0 : opacity,
                            transform: [{ perspective: 900 }, { rotateY }, { scale }],
                          },
                        ]}
                      >
                        <Text style={[s.policyType, { color: theme.text }]}>
                          {INSURANCE_TYPE_LABELS[ins.insuranceType]}
                        </Text>
                        <Text style={[s.policyInsurer, { color: theme.muted }]} numberOfLines={2}>
                          {ins.insurer}
                        </Text>
                      </Animated.View>
                    </Pressable>
                  );
                })}
              </Animated.ScrollView>
            </View>
          )}
        </View>
      </SafeAreaView>

      <TopGlassNav onAddPress={() => router.push("/insurance/new")} />
      <Pressable
        style={[s.backBtn, { top: insets.top + 24 }]}
        onPress={() => router.back()}
        hitSlop={8}
      >
        <ChevronLeft size={22} color="#1c1c1e" />
      </Pressable>

      {/* ── The tapped card grows in place into the detail card ─────────── */}
      {expanded && (
        <View style={[StyleSheet.absoluteFill, s.overlay]} pointerEvents="box-none">
          <Animated.View
            style={[StyleSheet.absoluteFill, s.backdrop, { opacity: backdropOpacity }]}
          >
            <Pressable style={StyleSheet.absoluteFill} onPress={closeDetail} />
          </Animated.View>

          <Animated.View
            style={[
              s.growCard,
              {
                left: growLeft,
                top: growTop,
                width: growWidth,
                height: growHeight,
                borderRadius: growRadius,
                backgroundColor: expandedTheme.bg,
              },
            ]}
          >
            {/* Header text stays centred within its own (shrinking) box, so
                it never jumps — it just settles into a smaller strip. */}
            <Animated.View style={[s.growHeader, { height: headerHeight }]}>
              <Text style={[s.policyType, { color: expandedTheme.text }]}>
                {INSURANCE_TYPE_LABELS[expanded.insuranceType]}
              </Text>
              <Text style={[s.policyInsurer, { color: expandedTheme.muted }]} numberOfLines={2}>
                {expanded.insurer}
              </Text>
            </Animated.View>

            {/* Detail content fades in below the header once the card has mostly grown. */}
            <Animated.View style={[s.growDetail, { top: headerHeight, opacity: detailOpacity }]}>
              <ScrollView
                contentContainerStyle={s.expandedContent}
                showsVerticalScrollIndicator={false}
              >
                {expanded.policyName ? (
                  <Text style={[s.expandedPolicyName, { color: expandedTheme.muted }]}>
                    {expanded.policyName}
                  </Text>
                ) : null}

                <View style={[s.dashed, { borderColor: expandedTheme.dashed }]} />

                <Row label="被保人" value={expanded.insuredName} theme={expandedTheme} />
                <Row
                  label="保單號碼"
                  value={expanded.policyNumber ?? UNKNOWN}
                  theme={expandedTheme}
                />
                <Row
                  label="投保日期"
                  value={formatDate(expanded.startDate)}
                  theme={expandedTheme}
                />
                <Row
                  label="繳費年期"
                  value={
                    expanded.paymentTermYears != null ? `${expanded.paymentTermYears} 年` : UNKNOWN
                  }
                  theme={expandedTheme}
                />
                <Row
                  label="保障期間"
                  value={expanded.coveragePeriod ?? UNKNOWN}
                  theme={expandedTheme}
                />
                <Row
                  label="年繳保費"
                  value={
                    expanded.annualPremium != null
                      ? formatCurrency(expanded.annualPremium)
                      : UNKNOWN
                  }
                  theme={expandedTheme}
                />

                {expanded.coverage.length > 0 && (
                  <>
                    <View style={[s.dashed, { borderColor: expandedTheme.dashed }]} />
                    <Text style={[s.coverageTitle, { color: expandedTheme.muted }]}>保障項目</Text>
                    {expanded.coverage.map((c) => (
                      <Row
                        key={c.key}
                        label={c.label}
                        value={formatCurrency(c.value)}
                        theme={expandedTheme}
                      />
                    ))}
                  </>
                )}
              </ScrollView>
            </Animated.View>

            <Animated.View style={[s.closeBtnWrap, { opacity: detailOpacity }]}>
              <Pressable
                style={[s.closeBtn, { backgroundColor: expandedTheme.closeBg }]}
                onPress={closeDetail}
                hitSlop={10}
              >
                <X size={18} color={expandedTheme.text} />
              </Pressable>
            </Animated.View>
          </Animated.View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f2f2f7" },
  safe: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center" },
  emptyText: { fontSize: 15, color: "#8e8e93" },

  backBtn: {
    position: "absolute",
    left: 16,
    zIndex: 101,
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },

  centerZone: { flex: 1, alignItems: "center", justifyContent: "center" },

  policyCard: {
    borderRadius: CARD_RADIUS,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 8,
  },
  policyType: { fontSize: 24, fontWeight: "800", textAlign: "center" },
  policyInsurer: { fontSize: 15, fontWeight: "600", marginTop: 6, textAlign: "center" },

  // Grow-in-place detail overlay. Same background colour as the collapsed
  // card throughout — only position/size animate, nothing cross-fades.
  overlay: { zIndex: 200 },
  backdrop: { backgroundColor: "#000" },
  growCard: {
    position: "absolute",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 12,
  },
  growHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  growDetail: { position: "absolute", left: 0, right: 0, bottom: 0 },
  closeBtnWrap: {
    position: "absolute",
    top: 14,
    right: 14,
    zIndex: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  expandedContent: { paddingHorizontal: 20, paddingBottom: 24 },
  expandedPolicyName: { fontSize: 14, textAlign: "center" },
  dashed: {
    borderBottomWidth: 1,
    borderStyle: "dashed",
    marginVertical: 14,
  },
  coverageTitle: { fontSize: 13, fontWeight: "700", marginBottom: 6 },

  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  rowLabel: { fontSize: 14, flexShrink: 0, marginRight: 12 },
  rowValue: { fontSize: 14, fontWeight: "500", flexShrink: 1, textAlign: "right" },
});
