import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Calendar, Check } from "lucide-react-native";
import * as Sentry from "@sentry/react-native";
import { TRANSFER_TOP_CATEGORIES, type Entry } from "@repo/shared";
import { DatePickerModal } from "@/components/DatePickerModal";
import { useFinanceStore } from "@/store/financeStore";
import { useFinanceActions } from "@/hooks/useFinanceActions";
import { useSheetBottomPadding } from "@/hooks/useSheetBottomPadding";
import { ApiError } from "@/lib/api";
import { formatCurrency, toIntegerDigits, formatThousands } from "@/lib/format";
import { parseISODate, toISODate, todayISO, formatDisplayDate } from "@/lib/date";

export default function TransferEntryScreen() {
  const sheetBottomPad = useSheetBottomPadding();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { transferEntry } = useFinanceActions();

  const entry = useFinanceStore((state) => state.entries.find((e) => e.id === id));
  // Select the stable `entries` array reference and filter locally — a
  // selector that returns a fresh `.filter()` array every call makes
  // useSyncExternalStore think the snapshot changed on every render,
  // which is an infinite re-render loop ("Maximum update depth exceeded").
  const entries = useFinanceStore((state) => state.entries);
  // Single pass over `entries`, bucketed by top category, so building the
  // grouped picker below doesn't re-filter the same list once per category.
  const candidatesByCategory = useMemo(() => {
    const map = new Map<string, Entry[]>();
    for (const e of entries) {
      if (e.id === id || !TRANSFER_TOP_CATEGORIES.includes(e.topCategory)) continue;
      const list = map.get(e.topCategory);
      if (list) list.push(e);
      else map.set(e.topCategory, [e]);
    }
    return map;
  }, [entries, id]);
  const candidates = useMemo(
    () => Array.from(candidatesByCategory.values()).flat(),
    [candidatesByCategory]
  );
  // Grouped by top category, in TRANSFER_TOP_CATEGORIES order (流動資金/負債/
  // 應收款), so the picker reads like the category sections used elsewhere in
  // the app rather than one flat list.
  const candidateGroups = useMemo(
    () =>
      TRANSFER_TOP_CATEGORIES.map((topCategory) => ({
        topCategory,
        items: candidatesByCategory.get(topCategory) ?? [],
      })).filter((g) => g.items.length > 0),
    [candidatesByCategory]
  );

  const [toEntryId, setToEntryId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [fee, setFee] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(todayISO);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const toEntry = useMemo(
    () => candidates.find((e) => e.id === toEntryId) ?? null,
    [candidates, toEntryId]
  );
  const amountValue = parseInt(amount, 10);
  const canSubmit = !!toEntryId && !isNaN(amountValue) && amountValue > 0 && !submitting;

  async function handleSubmit() {
    if (!entry || !toEntryId || !canSubmit) return;
    setSubmitting(true);
    try {
      await transferEntry({
        fromEntryId: entry.id,
        toEntryId,
        amount: amountValue,
        ...(fee ? { fee: parseInt(fee, 10) } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
        createdAt: date,
      });
      router.back();
    } catch (e) {
      if (e instanceof ApiError && e.code === "INSUFFICIENT_BALANCE") {
        Alert.alert("餘額不足", "來源項目的餘額不夠支付這筆轉帳（含手續費）。");
      } else if (e instanceof ApiError && e.code === "NETWORK") {
        Alert.alert("網路連線中斷", "轉帳未完成，請確認網路後再試一次。");
      } else {
        Sentry.captureException(e, { tags: { context: "entry.transfer" } });
        Alert.alert("轉帳失敗", e instanceof Error ? e.message : "請重試");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (!entry) {
    return (
      <SafeAreaView style={[s.root, s.center]}>
        <ActivityIndicator color="#374254" />
      </SafeAreaView>
    );
  }

  return (
    <View style={s.root}>
      <SafeAreaView edges={["top"]} style={{ backgroundColor: "#f2f2f7" }}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.iconBtn}>
            <ArrowLeft size={18} color="#1c1c1e" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>轉帳</Text>
          {/* Invisible spacer — same width as the back button so the title
              stays centered, but no white-circle background (that rendered
              as a blank ghost button with no icon in it). */}
          <View style={s.headerSpacer} />
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView
          style={s.flex}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
        >
          <Text style={s.sectionLabel}>來源</Text>
          <View style={s.card}>
            <View style={s.row}>
              <Text style={s.rowLabel}>{entry.name}</Text>
              <Text style={s.rowValue}>{formatCurrency(entry.value)}</Text>
            </View>
          </View>

          <Text style={s.sectionLabel}>金額</Text>
          <View style={s.card}>
            <View style={s.row}>
              <Text style={s.rowLabel}>轉帳金額</Text>
              <TextInput
                value={formatThousands(amount)}
                onChangeText={(t) => setAmount(toIntegerDigits(t))}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor="#c7c7cc"
                style={s.input}
              />
            </View>
            <View style={s.sep} />
            <View style={s.row}>
              <Text style={s.rowLabel}>手續費（選填）</Text>
              <TextInput
                value={formatThousands(fee)}
                onChangeText={(t) => setFee(toIntegerDigits(t))}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor="#c7c7cc"
                style={s.input}
              />
            </View>
            <View style={s.sep} />
            <TouchableOpacity
              style={s.row}
              onPress={() => setShowDatePicker(true)}
              activeOpacity={0.7}
            >
              <Text style={s.rowLabel}>日期</Text>
              <View style={s.rowRight}>
                <Text style={s.dateText}>{formatDisplayDate(date)}</Text>
                <Calendar size={16} color="#8e8e93" />
              </View>
            </TouchableOpacity>
            <View style={s.sep} />
            <View style={s.row}>
              <Text style={s.rowLabel}>備註</Text>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="選填"
                placeholderTextColor="#c7c7cc"
                maxLength={200}
                style={s.input}
              />
            </View>
          </View>

          <Text style={s.sectionLabel}>轉入項目</Text>
          {candidateGroups.length === 0 ? (
            <View style={s.card}>
              <Text style={s.empty}>沒有可轉入的項目</Text>
            </View>
          ) : (
            candidateGroups.map((group) => (
              <View key={group.topCategory} style={s.group}>
                <Text style={s.groupLabel}>{group.topCategory}</Text>
                <View style={s.card}>
                  {group.items.map((c, i) => {
                    const selected = toEntryId === c.id;
                    return (
                      <View key={c.id}>
                        {i > 0 && <View style={[s.sep, selected && s.sepSelected]} />}
                        <TouchableOpacity
                          style={[s.row, selected && s.rowSelected]}
                          activeOpacity={0.7}
                          onPress={() => setToEntryId(c.id)}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={[s.rowLabel, selected && s.rowLabelSelected]}>
                              {c.name}
                            </Text>
                            <Text style={[s.rowSub, selected && s.rowSubSelected]}>
                              {c.subCategory}
                            </Text>
                          </View>
                          <Text style={[s.rowValue, selected && s.rowValueSelected]}>
                            {formatCurrency(c.value)}
                          </Text>
                          {selected && (
                            <Check size={18} color="#ffffff" style={{ marginLeft: 8 }} />
                          )}
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              </View>
            ))
          )}

          {toEntry && !isNaN(amountValue) && amountValue > 0 && (
            <Text style={s.summary}>
              {entry.name} 轉出 {formatCurrency(amountValue + (parseInt(fee, 10) || 0))}
              {"　→　"}
              {toEntry.name} 收到 {formatCurrency(amountValue)}
            </Text>
          )}
        </ScrollView>

        <View style={[s.footer, { paddingBottom: sheetBottomPad }]}>
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={!canSubmit}
            style={[s.saveBtn, !canSubmit && s.disabledBtn]}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={s.saveBtnText}>確認轉帳</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <DatePickerModal
        visible={showDatePicker}
        date={parseISODate(date)}
        onConfirm={(picked) => setDate(toISODate(picked))}
        onClose={() => setShowDatePicker(false)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f2f2f7" },
  flex: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: { fontSize: 16, fontWeight: "600", color: "#1c1c1e" },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  headerSpacer: { width: 40, height: 40 },

  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#8e8e93",
    marginTop: 20,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  group: { marginBottom: 16 },
  groupLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#8e8e93",
    marginBottom: 6,
    marginLeft: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowSelected: { backgroundColor: "#1c1c1e" },
  rowRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  rowLabel: { fontSize: 15, color: "#1c1c1e" },
  rowLabelSelected: { color: "#ffffff" },
  rowSub: { fontSize: 12, color: "#8e8e93", marginTop: 2 },
  rowSubSelected: { color: "#c7c7cc" },
  rowValue: { fontSize: 15, fontWeight: "600", color: "#1c1c1e" },
  rowValueSelected: { color: "#ffffff" },
  dateText: { fontSize: 15, color: "#1c1c1e" },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: "#f2f2f7", marginHorizontal: 16 },
  sepSelected: { backgroundColor: "#3a3a3c" },
  empty: { textAlign: "center", fontSize: 14, color: "#c7c7cc", paddingVertical: 24 },
  input: { flex: 1, marginLeft: 16, textAlign: "right", fontSize: 15, color: "#1c1c1e" },

  summary: {
    marginTop: 16,
    fontSize: 13,
    color: "#8e8e93",
    textAlign: "center",
  },

  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: "#f2f2f7",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e5e5ea",
  },
  saveBtn: {
    borderRadius: 100,
    backgroundColor: "#1c1c1e",
    paddingVertical: 14,
    alignItems: "center",
  },
  saveBtnText: { fontSize: 15, fontWeight: "600", color: "#ffffff" },
  disabledBtn: { opacity: 0.4 },
});
