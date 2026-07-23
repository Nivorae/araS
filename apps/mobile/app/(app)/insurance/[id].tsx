import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, Pencil, Trash2 } from "lucide-react-native";
import { INSURANCE_TYPE_LABELS, type Insurance } from "@repo/shared";
import { useFinanceActions } from "@/hooks/useFinanceActions";
import { InsuranceForm } from "@/components/InsuranceForm";
import { formatCurrency } from "@/lib/format";

const UNKNOWN = "不確定";

function formatDate(iso: string | null): string {
  if (!iso) return UNKNOWN;
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowValue}>{value}</Text>
    </View>
  );
}

export default function InsuranceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { fetchInsurance, deleteInsurance, fetchAll } = useFinanceActions();

  const [insurance, setInsurance] = useState<Insurance | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const result = await fetchInsurance(id);
    setInsurance(result);
    setLoading(false);
  }, [id, fetchInsurance]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleDelete = () => {
    if (!insurance) return;
    Alert.alert("刪除保單", "確定要刪除這張保單嗎？此動作無法復原。", [
      { text: "取消", style: "cancel" },
      {
        text: "刪除",
        style: "destructive",
        onPress: async () => {
          setDeleting(true);
          try {
            await deleteInsurance(insurance.id);
            await fetchAll();
            router.back();
          } catch {
            Alert.alert("刪除失敗", "請稍後再試");
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={[s.root, s.center]}>
        <ActivityIndicator size="large" color="#B8865E" />
      </SafeAreaView>
    );
  }

  if (!insurance) {
    return (
      <SafeAreaView style={[s.root, s.center]}>
        <Text style={s.notFound}>找不到這張保單</Text>
        <TouchableOpacity onPress={() => router.back()} style={s.backLink}>
          <Text style={s.backLinkText}>返回</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (mode === "edit") {
    return (
      <InsuranceForm
        isEdit
        insuranceId={insurance.id}
        initial={{
          insurer: insurance.insurer,
          insuredName: insurance.insuredName,
          insuranceType: insurance.insuranceType,
          policyName: insurance.policyName,
          policyNumber: insurance.policyNumber,
          startDate: insurance.startDate,
          paymentTermYears: insurance.paymentTermYears,
          coveragePeriod: insurance.coveragePeriod,
          annualPremium: insurance.annualPremium,
          coverage: insurance.coverage,
        }}
        onBack={() => setMode("view")}
        onSaved={() => {
          setMode("view");
          load();
        }}
      />
    );
  }

  return (
    <SafeAreaView style={s.root}>
      <View style={s.navRow}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={s.navCircle}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ChevronLeft size={20} color="#1c1c1e" />
        </TouchableOpacity>
        <View style={s.navRight}>
          <TouchableOpacity
            onPress={() => setMode("edit")}
            style={s.navCircle}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Pencil size={18} color="#1c1c1e" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleDelete}
            disabled={deleting}
            style={[s.navCircle, { opacity: deleting ? 0.4 : 1 }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Trash2 size={18} color="#ff3b30" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.scrollContent}>
        <Text style={s.titleText}>{insurance.policyName ?? insurance.insurer}</Text>
        <Text style={s.titleSub}>{INSURANCE_TYPE_LABELS[insurance.insuranceType]}</Text>

        <View style={s.card}>
          <Field label="保險公司" value={insurance.insurer} />
          <View style={s.sep} />
          <Field label="被保人" value={insurance.insuredName} />
          <View style={s.sep} />
          <Field label="險種" value={INSURANCE_TYPE_LABELS[insurance.insuranceType]} />
          <View style={s.sep} />
          <Field label="保單名稱" value={insurance.policyName ?? UNKNOWN} />
          <View style={s.sep} />
          <Field label="保單號碼" value={insurance.policyNumber ?? UNKNOWN} />
        </View>

        {insurance.coverage.length > 0 && (
          <View style={s.card}>
            <Text style={s.sectionLabel}>保障項目</Text>
            {insurance.coverage.map((item, idx) => (
              <View key={item.key}>
                {idx > 0 && <View style={s.sep} />}
                <Field label={item.label} value={formatCurrency(item.value)} />
              </View>
            ))}
          </View>
        )}

        <View style={s.card}>
          <Field
            label="年繳保費"
            value={
              insurance.annualPremium != null ? formatCurrency(insurance.annualPremium) : UNKNOWN
            }
          />
          <View style={s.sep} />
          <Field
            label="繳費年期"
            value={
              insurance.paymentTermYears != null ? `${insurance.paymentTermYears} 年` : UNKNOWN
            }
          />
          <View style={s.sep} />
          <Field label="保障期間" value={insurance.coveragePeriod ?? UNKNOWN} />
          <View style={s.sep} />
          <Field label="投保日期" value={formatDate(insurance.startDate)} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f2f2f7" },
  center: { alignItems: "center", justifyContent: "center" },
  notFound: { fontSize: 15, color: "#8e8e93" },
  backLink: { marginTop: 12 },
  backLinkText: { fontSize: 14, color: "#374254", fontWeight: "600" },

  navRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  navRight: { flexDirection: "row", gap: 8 },
  navCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },

  scrollContent: { paddingHorizontal: 16, paddingBottom: 48 },
  titleText: { fontSize: 22, fontWeight: "700", color: "#1c1c1e", marginTop: 8 },
  titleSub: { fontSize: 14, color: "#8e8e93", marginBottom: 16, marginTop: 2 },

  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: "#f2f2f7", marginHorizontal: 20 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#8e8e93",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 4,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    minHeight: 52,
  },
  rowLabel: { fontSize: 15, fontWeight: "500", color: "#1c1c1e" },
  rowValue: { fontSize: 15, color: "#1c1c1e", flexShrink: 1, textAlign: "right" },
});
