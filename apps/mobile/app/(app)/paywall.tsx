import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Check, X } from "lucide-react-native";
import Purchases, { PURCHASES_ERROR_CODE, type PurchasesPackage } from "react-native-purchases";
import { FREE_ENTRY_LIMIT } from "@repo/shared";
import { isPurchasesConfigured } from "@/lib/purchases";
import { useIsPremium } from "@/hooks/useIsPremium";
import { FloatingCardsBackground } from "@/components/FloatingCardsBackground";

const PREMIUM_FEATURES = [
  `資產／負債無限新增（免費版上限 ${FREE_ENTRY_LIMIT} 筆）`,
  "保單新增、編輯、刪除",
  "資產配置分析，掌握資產分佈與風險",
] as const;

// RevenueCat's PACKAGE_TYPE is a string enum ("ANNUAL", "MONTHLY", …) — reading
// it as a plain string key sidesteps importing the enum just for a lookup.
const PACKAGE_LABELS: Record<string, string> = {
  LIFETIME: "買斷",
  ANNUAL: "年繳",
  SIX_MONTH: "半年繳",
  THREE_MONTH: "季繳",
  TWO_MONTH: "雙月繳",
  MONTHLY: "月繳",
  WEEKLY: "週繳",
};
const isAnnual = (pkg: PurchasesPackage) => String(pkg.packageType) === "ANNUAL";

// Common view model for a selectable plan — real RevenueCat packages and the
// preview placeholders below both render through this shape.
interface PlanOption {
  id: string;
  label: string;
  priceString: string;
  bestValue: boolean;
}

// Shown only when RevenueCat is genuinely unconfigured (Expo Go, where the
// native store module doesn't exist), so the full paywall UI can be seen and
// tested instead of a dead-end message. NOT used in a configured production
// build — there we never show placeholder prices, even if offerings fail to
// load. Real purchases can't run in this environment; the CTA explains that.
const PREVIEW_PLANS: PlanOption[] = [
  { id: "preview_annual", label: "年繳", priceString: "NT$300 / 年", bestValue: true },
  { id: "preview_monthly", label: "月繳", priceString: "NT$30 / 月", bestValue: false },
];

const PRIVACY_URL = "https://ara-s-web.vercel.app/privacy";
const SUPPORT_URL = "https://ara-s-web.vercel.app/support";

export default function PaywallScreen() {
  const router = useRouter();
  const { isPremium, refresh } = useIsPremium();
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState(false);

  // RevenueCat's native module doesn't exist in Expo Go, so no real offerings
  // load there. In that case we show preview plans instead of a dead-end
  // message, and the CTA explains purchases only work in a real build.
  const previewMode = !isPurchasesConfigured();

  useEffect(() => {
    if (!isPurchasesConfigured()) {
      setLoading(false);
      return;
    }
    Purchases.getOfferings()
      .then((offerings) => setPackages(offerings.current?.availablePackages ?? []))
      .catch(() => setPackages([]))
      .finally(() => setLoading(false));
  }, []);

  // Real offerings when RevenueCat provides them; otherwise the preview plans,
  // but only when genuinely unconfigured — never placeholder prices in a
  // configured production build whose offerings merely failed to load.
  const plans = useMemo<PlanOption[]>(() => {
    if (packages.length > 0) {
      return packages.map((pkg) => ({
        id: pkg.identifier,
        label: PACKAGE_LABELS[String(pkg.packageType)] ?? pkg.product.title,
        priceString: pkg.product.priceString,
        bestValue: isAnnual(pkg),
      }));
    }
    return previewMode ? PREVIEW_PLANS : [];
  }, [packages, previewMode]);

  // Default to the best-value plan once plans are known, if nothing's picked.
  useEffect(() => {
    if (plans.length === 0 || selectedId) return;
    const best = plans.find((p) => p.bestValue);
    setSelectedId((best ?? plans[0]!).id);
  }, [plans, selectedId]);

  const handlePurchase = useCallback(async () => {
    // Preview mode has no real package to buy (Expo Go / unconfigured store).
    if (previewMode) {
      Alert.alert(
        "測試環境無法購買",
        "Expo Go 無法完成實際購買。請於正式版（TestFlight／App Store）購買，或用「設定 → 模擬升級」測試 Premium 功能。"
      );
      return;
    }
    const pkg = packages.find((p) => p.identifier === selectedId);
    if (!pkg) return;
    setPurchasing(true);
    try {
      await Purchases.purchasePackage(pkg);
      // The backend learns of the purchase via Apple's server notification, so
      // re-read entitlement status now rather than waiting for the next app
      // launch — otherwise the just-upgraded user still reads as free.
      await refresh();
      Alert.alert("完成", "感謝訂閱！");
    } catch (e) {
      const err = e as { code?: PURCHASES_ERROR_CODE; message?: string };
      if (err.code !== PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
        Alert.alert("購買失敗", err.message ?? "請稍後再試");
      }
    } finally {
      setPurchasing(false);
    }
  }, [previewMode, packages, selectedId, refresh]);

  return (
    <View style={s.root}>
      <FloatingCardsBackground />
      <View style={s.overlay} pointerEvents="none" />

      <SafeAreaView edges={["top", "bottom"]} style={s.safe}>
        {/* Top hero — just the title/subtitle, floating over the background. */}
        <View style={s.top}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={s.closeBtn}>
            <X size={18} color="#ffffff" />
          </Pressable>
          <View style={s.hero}>
            <Text style={s.title}>升級 Premium</Text>
            <Text style={s.subtitle}>解鎖完整功能，體驗無限可能</Text>
          </View>
        </View>

        {/* Bottom sheet — plans, feature list, CTA, footer links. */}
        <View style={s.bottom}>
          <ScrollView
            style={s.scroll}
            contentContainerStyle={s.content}
            showsVerticalScrollIndicator={false}
          >
            {/* Always visible — what upgrading gets you, regardless of premium/
                loading/offering state. This must never be conditional on
                !isPremium: a premium tester (or anyone re-visiting after
                purchasing) should still be able to see what the plan includes. */}
            <Text style={s.includedLabel}>升級後即可解鎖</Text>
            <View style={s.features}>
              {PREMIUM_FEATURES.map((feature) => (
                <View key={feature} style={s.featureRow}>
                  <Check size={16} color="#ffffff" />
                  <Text style={s.featureText}>{feature}</Text>
                </View>
              ))}
            </View>

            {loading ? (
              <ActivityIndicator style={s.loading} color="#ffffff" />
            ) : isPremium ? (
              <View style={s.messageCard}>
                <Check size={20} color="#ffffff" />
                <Text style={s.messageText}>你已是 Premium 會員</Text>
              </View>
            ) : plans.length > 0 ? (
              <>
                <View style={s.packageGroup}>
                  {plans.map((plan) => {
                    const selected = plan.id === selectedId;
                    return (
                      <Pressable
                        key={plan.id}
                        onPress={() => setSelectedId(plan.id)}
                        style={[s.packageRow, selected && s.packageRowSelected]}
                      >
                        <View style={[s.radio, selected && s.radioSelected]}>
                          {selected ? <View style={s.radioDot} /> : null}
                        </View>
                        <View style={s.packageInfo}>
                          <Text style={s.packageTitle}>{plan.label}</Text>
                          <Text style={s.packagePrice}>{plan.priceString}</Text>
                        </View>
                        {plan.bestValue ? (
                          <View style={s.badge}>
                            <Text style={s.badgeText}>最划算</Text>
                          </View>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
                {previewMode ? (
                  <Text style={s.previewNote}>預覽模式：實際方案與價格以正式版為準</Text>
                ) : null}
              </>
            ) : (
              <View style={s.messageCard}>
                <Text style={s.messageText}>訂閱方案尚未上架，敬請期待。</Text>
              </View>
            )}

            {!isPremium && !loading && plans.length > 0 ? (
              <Pressable
                onPress={handlePurchase}
                disabled={purchasing || !selectedId}
                style={({ pressed }) => [
                  s.ctaBtn,
                  { opacity: purchasing || !selectedId ? 0.6 : pressed ? 0.85 : 1 },
                ]}
              >
                {purchasing ? (
                  <ActivityIndicator size="small" color="#1c1c1e" />
                ) : (
                  <Text style={s.ctaText}>取得完整權限</Text>
                )}
              </Pressable>
            ) : null}
          </ScrollView>

          {/* Pinned to the very bottom of the page, outside the scroll area. */}
          <View style={s.privacyRow}>
            <Pressable onPress={() => Linking.openURL(PRIVACY_URL)} hitSlop={8}>
              <Text style={s.footerLink}>隱私權政策</Text>
            </Pressable>
            <Text style={s.footerDot}>·</Text>
            <Pressable onPress={() => Linking.openURL(SUPPORT_URL)} hitSlop={8}>
              <Text style={s.footerLink}>支援與聯絡</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0e1424", overflow: "hidden" },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(8,10,18,0.78)" },
  safe: { flex: 1 },

  // Top hero — kept compact so the bottom sheet has room to fit its content
  // without scrolling.
  top: {
    flex: 0.26,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  closeBtn: {
    position: "absolute",
    top: 4,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
  },

  // Bottom sheet — holds everything else; enlarged so content fits unscrolled.
  bottom: {
    flex: 0.74,
    backgroundColor: "rgba(20,22,34,0.55)",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: "hidden",
  },
  // Without this, the ScrollView has no bounded height inside the flex:0.6
  // sheet — its content (feature list, CTA button) overflows past what
  // `bottom`'s overflow:hidden shows, instead of scrolling into view.
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 32, gap: 14 },

  hero: { alignItems: "center", gap: 6 },
  title: { fontSize: 24, fontWeight: "800", color: "#ffffff", textAlign: "center" },
  subtitle: { fontSize: 14, color: "rgba(255,255,255,0.68)", textAlign: "center" },

  loading: { marginTop: 24 },

  messageCard: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: "center",
    gap: 8,
  },
  messageText: { fontSize: 15, color: "rgba(255,255,255,0.85)", textAlign: "center" },

  previewNote: {
    fontSize: 12,
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
    marginTop: 2,
  },

  packageGroup: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    padding: 8,
    gap: 8,
  },
  packageRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "transparent",
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  packageRowSelected: {
    borderColor: "rgba(255,255,255,0.85)",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: { borderColor: "#ffffff" },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#ffffff" },
  packageInfo: { flex: 1, gap: 2 },
  packageTitle: { fontSize: 16, fontWeight: "700", color: "#ffffff" },
  packagePrice: { fontSize: 13, color: "rgba(255,255,255,0.6)" },
  badge: {
    backgroundColor: "#ff2d78",
    borderRadius: 100,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  badgeText: { fontSize: 11, fontWeight: "700", color: "#ffffff" },

  includedLabel: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
    color: "rgba(255,255,255,0.55)",
    marginTop: 8,
  },
  features: { gap: 12 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  featureText: { flex: 1, fontSize: 14, color: "rgba(255,255,255,0.9)" },

  ctaBtn: {
    marginTop: 8,
    backgroundColor: "#ffffff",
    borderRadius: 100,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: { fontSize: 16, fontWeight: "700", color: "#1c1c1e" },

  privacyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
  },
  footerLink: { fontSize: 12, color: "rgba(255,255,255,0.55)" },
  footerDot: { fontSize: 12, color: "rgba(255,255,255,0.35)" },
});
