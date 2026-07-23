import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ArrowLeft, Check } from "lucide-react-native";
import Purchases, { PURCHASES_ERROR_CODE, type PurchasesPackage } from "react-native-purchases";
import { isPurchasesConfigured } from "@/lib/purchases";

const PREMIUM_FEATURES = [
  "資產／負債記錄無上限（免費版上限 20 筆）",
  "保單管理（新增、編輯、刪除保單）",
] as const;

export default function PaywallScreen() {
  const router = useRouter();
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);

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

  const handlePurchase = useCallback(async (pkg: PurchasesPackage) => {
    setPurchasingId(pkg.identifier);
    try {
      await Purchases.purchasePackage(pkg);
      Alert.alert("完成", "感謝訂閱！");
    } catch (e) {
      const err = e as { code?: PURCHASES_ERROR_CODE; message?: string };
      if (err.code !== PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
        Alert.alert("購買失敗", err.message ?? "請稍後再試");
      }
    } finally {
      setPurchasingId(null);
    }
  }, []);

  return (
    <View style={s.root}>
      <SafeAreaView edges={["top", "bottom"]} style={s.safe}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={s.backBtn}>
            <ArrowLeft size={24} color="#1c1c1e" />
          </Pressable>
          <Text style={s.headerTitle}>升級 Premium</Text>
          <View style={s.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={s.content}>
          <View style={s.featureCard}>
            {PREMIUM_FEATURES.map((feature) => (
              <View key={feature} style={s.featureRow}>
                <Check size={18} color="#374254" />
                <Text style={s.featureText}>{feature}</Text>
              </View>
            ))}
          </View>

          {loading ? (
            <ActivityIndicator style={s.loading} />
          ) : packages.length === 0 ? (
            <View style={s.card}>
              <Text style={s.emptyText}>訂閱方案尚未上架，敬請期待。</Text>
            </View>
          ) : (
            packages.map((pkg) => (
              <Pressable
                key={pkg.identifier}
                onPress={() => handlePurchase(pkg)}
                disabled={purchasingId !== null}
                style={({ pressed }) => [s.card, s.packageRow, { opacity: pressed ? 0.7 : 1 }]}
              >
                <View style={s.packageInfo}>
                  <Text style={s.packageTitle}>{pkg.product.title || pkg.product.identifier}</Text>
                  <Text style={s.packagePrice}>{pkg.product.priceString}</Text>
                </View>
                {purchasingId === pkg.identifier ? (
                  <ActivityIndicator size="small" color="#374254" />
                ) : (
                  <Check size={20} color="#374254" />
                )}
              </Pressable>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f2f2f7" },
  safe: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontWeight: "700", color: "#1c1c1e" },
  headerSpacer: { width: 32 },
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40, gap: 12 },
  loading: { marginTop: 40 },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 16,
  },
  emptyText: { fontSize: 15, color: "#8e8e93", textAlign: "center" },
  featureCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 16,
    gap: 14,
  },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  featureText: { flex: 1, fontSize: 15, color: "#1c1c1e" },
  packageRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  packageInfo: { gap: 2 },
  packageTitle: { fontSize: 16, fontWeight: "600", color: "#1c1c1e" },
  packagePrice: { fontSize: 14, color: "#3c3c43" },
});
