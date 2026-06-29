import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { EntryForm } from "@/components/EntryForm";
import { useFinanceStore } from "@/store/financeStore";
import { getTopCategory } from "@/lib/categoryConfig";

export default function EditEntryScreen() {
  const { id, mode } = useLocalSearchParams<{ id: string; mode?: string }>();
  const router = useRouter();
  const entry = useFinanceStore((s) => s.entries.find((e) => e.id === id));
  const topCat = entry ? getTopCategory(entry.topCategory) : null;
  const addRecord = mode === "add";

  if (!entry || !topCat) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.center}>
          {entry === undefined ? (
            <ActivityIndicator size="large" color="#374254" />
          ) : (
            <Text style={s.error}>找不到資產項目</Text>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <EntryForm
      topCategory={entry.topCategory}
      subCategory={entry.subCategory}
      isLiability={topCat.isLiability}
      color={topCat.color}
      isEdit
      entryId={entry.id}
      initialName={entry.name}
      initialValue={entry.value}
      initialStockCode={entry.stockCode ?? ""}
      {...(entry.units != null ? { initialUnits: entry.units } : {})}
      initialNote={entry.note ?? ""}
      addRecord={addRecord}
      baseValue={entry.value}
      lockStockPicker={addRecord}
      onBack={() => router.back()}
      onSaved={() => router.back()}
    />
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f2f2f7" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  error: { fontSize: 16, color: "#ff3b30" },
});
