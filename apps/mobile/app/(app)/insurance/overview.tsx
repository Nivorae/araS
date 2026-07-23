import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
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
import { ChevronLeft, Pencil } from "lucide-react-native";
import { INSURANCE_TYPE_LABELS, type Insurance } from "@repo/shared";
import { useFinanceActions } from "@/hooks/useFinanceActions";
import { formatCurrency } from "@/lib/format";
import { TopGlassNav, NAV_CLEARANCE } from "@/components/TopGlassNav";

const UNKNOWN = "不確定";

function formatDate(iso: string | null): string {
  if (!iso) return UNKNOWN;
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

// A label ─ value line on the receipt.
function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowValue}>{value}</Text>
    </View>
  );
}

export default function InsuranceOverviewScreen() {
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const { fetchInsurances } = useFinanceActions();

  // Coverflow geometry. A card is centred when scrollX === index * INTERVAL,
  // thanks to the sideInset padding on the scroll content.
  const CARD_W = Math.min(190, screenW * 0.5);
  const CARD_H = Math.round(CARD_W * 1.32);
  const SPACING = 16;
  const INTERVAL = CARD_W + SPACING;
  const sideInset = (screenW - CARD_W) / 2;

  const [insurances, setInsurances] = useState<Insurance[] | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView>(null);
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

  // Jump the deck to the policy the user tapped — once, after data arrives.
  useEffect(() => {
    if (!insurances || didInitialFocus.current) return;
    didInitialFocus.current = true;
    const idx = Math.max(
      0,
      insurances.findIndex((i) => i.id === focus)
    );
    setSelectedIndex(idx);
    if (idx > 0) {
      requestAnimationFrame(() =>
        scrollRef.current?.scrollTo({ x: idx * INTERVAL, animated: false })
      );
    }
  }, [insurances, focus, INTERVAL]);

  const onScroll = Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
    useNativeDriver: true,
  });

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const count = insurances?.length ?? 1;
    const idx = Math.round(e.nativeEvent.contentOffset.x / INTERVAL);
    setSelectedIndex(Math.max(0, Math.min(idx, count - 1)));
  };

  const goTo = (i: number) => scrollRef.current?.scrollTo({ x: i * INTERVAL, animated: true });

  if (insurances === null) {
    return (
      <View style={[s.root, s.center]}>
        <ActivityIndicator size="large" color="#B8865E" />
      </View>
    );
  }

  // Clamp so a delete that shortened the list can't point past the end.
  const safeIndex = insurances.length > 0 ? Math.min(selectedIndex, insurances.length - 1) : 0;
  const current = insurances[safeIndex] ?? null;

  return (
    <View style={s.root}>
      <SafeAreaView edges={["top", "bottom"]} style={s.safe}>
        {/* Reserve space below the floating nav pill. NAV_CLEARANCE alone isn't
            quite enough clearance here — the pill's actual bottom edge sits a
            little past it, and with no header row above the invoice card (unlike
            the tab screens) there's zero buffer before its rounded top corner,
            so it was getting clipped by the pill. The extra margin fixes that. */}
        <View style={{ height: NAV_CLEARANCE + 24 }} />

        {current === null ? (
          <View style={[s.center, s.flex]}>
            <Text style={s.emptyText}>還沒有保單</Text>
          </View>
        ) : (
          <>
            {/* ── Middle: receipt-style invoice for the centred policy ─────── */}
            <View style={s.invoiceZone}>
              <View style={s.invoiceCard}>
                <Pressable
                  style={s.editBtn}
                  onPress={() => router.push(`/insurance/${current.id}`)}
                  hitSlop={8}
                >
                  <Pencil size={16} color="#8e8e93" />
                </Pressable>

                <ScrollView
                  contentContainerStyle={s.invoiceContent}
                  showsVerticalScrollIndicator={false}
                >
                  <Text style={s.invoiceInsurer}>{current.insurer}</Text>
                  <View style={s.typeTag}>
                    <Text style={s.typeTagText}>
                      {INSURANCE_TYPE_LABELS[current.insuranceType]}
                    </Text>
                  </View>
                  {current.policyName ? (
                    <Text style={s.invoicePolicyName}>{current.policyName}</Text>
                  ) : null}

                  <View style={s.dashed} />

                  <Row label="被保人" value={current.insuredName} />
                  <Row label="保單號碼" value={current.policyNumber ?? UNKNOWN} />
                  <Row label="投保日期" value={formatDate(current.startDate)} />
                  <Row
                    label="繳費年期"
                    value={
                      current.paymentTermYears != null ? `${current.paymentTermYears} 年` : UNKNOWN
                    }
                  />
                  <Row label="保障期間" value={current.coveragePeriod ?? UNKNOWN} />
                  <Row
                    label="年繳保費"
                    value={
                      current.annualPremium != null
                        ? formatCurrency(current.annualPremium)
                        : UNKNOWN
                    }
                  />

                  {current.coverage.length > 0 && (
                    <>
                      <View style={s.dashed} />
                      <Text style={s.coverageTitle}>保障項目</Text>
                      {current.coverage.map((c) => (
                        <Row key={c.key} label={c.label} value={formatCurrency(c.value)} />
                      ))}
                    </>
                  )}

                  <View style={s.dashed} />
                  <Text style={s.invoiceFoot}>araS · 保單摘要</Text>
                </ScrollView>
              </View>
            </View>

            {/* ── Bottom: 3D coverflow of every policy ───────────────────── */}
            <View style={[s.coverflowZone, { height: CARD_H + 40 }]}>
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
                {insurances.map((ins, i) => {
                  const inputRange = [(i - 1) * INTERVAL, i * INTERVAL, (i + 1) * INTERVAL];
                  const rotateY = scrollX.interpolate({
                    inputRange,
                    outputRange: ["45deg", "0deg", "-45deg"],
                    extrapolate: "clamp",
                  });
                  const scale = scrollX.interpolate({
                    inputRange,
                    outputRange: [0.86, 1, 0.86],
                    extrapolate: "clamp",
                  });
                  const opacity = scrollX.interpolate({
                    inputRange,
                    outputRange: [0.55, 1, 0.55],
                    extrapolate: "clamp",
                  });
                  return (
                    <Pressable
                      key={ins.id}
                      onPress={() => goTo(i)}
                      style={{ marginRight: SPACING }}
                    >
                      <Animated.View
                        style={[
                          s.flipCard,
                          {
                            width: CARD_W,
                            height: CARD_H,
                            opacity,
                            transform: [{ perspective: 800 }, { rotateY }, { scale }],
                          },
                        ]}
                      >
                        <Text style={s.flipInsurer} numberOfLines={2}>
                          {ins.insurer}
                        </Text>
                        <Text style={s.flipType}>{INSURANCE_TYPE_LABELS[ins.insuranceType]}</Text>
                      </Animated.View>
                    </Pressable>
                  );
                })}
              </Animated.ScrollView>
            </View>
          </>
        )}
      </SafeAreaView>

      <TopGlassNav onAddPress={() => router.push("/insurance/new")} />
      <Pressable
        style={[s.backBtn, { top: insets.top + 24 }]}
        onPress={() => router.back()}
        hitSlop={8}
      >
        <ChevronLeft size={22} color="#1c1c1e" />
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f2f2f7" },
  safe: { flex: 1 },
  flex: { flex: 1 },
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

  // Middle invoice zone
  invoiceZone: { flex: 1, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  invoiceCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  editBtn: {
    position: "absolute",
    top: 14,
    right: 14,
    zIndex: 2,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f2f2f7",
  },
  invoiceContent: { paddingBottom: 8 },
  invoiceInsurer: { fontSize: 22, fontWeight: "800", color: "#1c1c1e", marginTop: 4 },
  typeTag: {
    alignSelf: "flex-start",
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "#B8865E",
  },
  typeTagText: { fontSize: 12, fontWeight: "700", color: "#ffffff" },
  invoicePolicyName: { fontSize: 14, color: "#8e8e93", marginTop: 8 },
  dashed: {
    borderBottomWidth: 1,
    borderStyle: "dashed",
    borderColor: "#e0e0e0",
    marginVertical: 14,
  },
  coverageTitle: { fontSize: 13, fontWeight: "700", color: "#8e8e93", marginBottom: 6 },
  invoiceFoot: {
    fontSize: 11,
    color: "#c7c7cc",
    textAlign: "center",
    letterSpacing: 1,
    marginTop: 2,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  rowLabel: { fontSize: 14, color: "#8e8e93", flexShrink: 0, marginRight: 12 },
  rowValue: {
    fontSize: 14,
    fontWeight: "500",
    color: "#1c1c1e",
    flexShrink: 1,
    textAlign: "right",
  },

  // Bottom coverflow zone
  coverflowZone: { justifyContent: "center" },
  flipCard: {
    borderRadius: 20,
    backgroundColor: "#B8865E",
    paddingHorizontal: 18,
    paddingVertical: 18,
    justifyContent: "flex-end",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 6,
  },
  flipInsurer: { fontSize: 18, fontWeight: "800", color: "#ffffff" },
  flipType: { fontSize: 13, color: "rgba(255,255,255,0.75)", marginTop: 4 },
});
