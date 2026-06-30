import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { EntryForm } from "@/components/EntryForm";
import { getTopCategory } from "@/lib/categoryConfig";

export default function AddEntryFormScreen() {
  const { topCategory, subCategory, name, stockCode, lockStock } = useLocalSearchParams<{
    topCategory: string;
    subCategory: string;
    name?: string;
    stockCode?: string;
    lockStock?: string;
  }>();
  const router = useRouter();

  const topCat = getTopCategory(topCategory ?? "");
  if (!topCat || !subCategory) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.center}>
          <Text style={s.error}>無效的類別</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <EntryForm
      topCategory={topCat.name}
      subCategory={subCategory}
      isLiability={topCat.isLiability}
      color={topCat.color}
      isEdit={false}
      {...(name ? { initialName: name } : {})}
      {...(stockCode ? { initialStockCode: stockCode } : {})}
      lockStockPicker={lockStock === "1"}
      onBack={() => router.back()}
      onSaved={() => router.navigate("/(app)/(tabs)")}
    />
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f2f2f7" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  error: { fontSize: 16, color: "#ff3b30" },
});
