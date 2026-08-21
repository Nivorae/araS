import { useMemo } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useAssetAllocation } from "@/hooks/useAssetAllocation";
import { useFinanceStore } from "@/store/financeStore";
import { chartedEntries } from "@/lib/chartedEntries";
import { formatCurrency } from "@/lib/format";
import { getTopCategory } from "@/lib/categoryConfig";

const LIABILITY_COLOR = getTopCategory("負債")?.color ?? "#C7C7D4";

export function AssetAllocationView() {
  const { data, loading, error } = useAssetAllocation();
  // 台股／美股不在 /api/entries/allocation 的 topCategory breakdown 裡（只到
  // 「投資」這層），所以跟 transactions.tsx 算 totalAssets 一樣，自己從
  // entries 篩，維持跟折線圖同一組「納入圖表」項目。
  const entries = useFinanceStore((s) => s.entries);
  const { twValue, usValue } = useMemo(
    () =>
      chartedEntries(entries).reduce(
        (acc, e) => {
          if (e.subCategory === "台股") acc.twValue += e.value;
          else if (e.subCategory === "美股") acc.usValue += e.value;
          return acc;
        },
        { twValue: 0, usValue: 0 }
      ),
    [entries]
  );
  const stockTotal = twValue + usValue;

  if (error) {
    return (
      <View style={s.center}>
        <Text style={s.errorText}>載入失敗，請重試</Text>
      </View>
    );
  }

  if (loading || !data) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="small" color="#8e8e93" />
      </View>
    );
  }

  return (
    <View style={s.root}>
      {data.breakdown.length === 0 ? (
        <Text style={s.emptyText}>尚無資產資料</Text>
      ) : (
        data.breakdown.map((item) => (
          <View key={item.topCategory} style={s.row}>
            <View
              style={[
                s.dot,
                { backgroundColor: getTopCategory(item.topCategory)?.color ?? "#8e8e93" },
              ]}
            />
            <Text style={s.rowName}>{item.topCategory}</Text>
            <Text style={s.rowPercentage}>{item.percentage.toFixed(1)}%</Text>
            <Text style={s.rowValue}>{formatCurrency(item.value)}</Text>
          </View>
        ))
      )}

      {data.concentrationWarnings.length > 0 && (
        <View style={s.warningBox}>
          {data.concentrationWarnings.map((w) => (
            <Text key={w.entryId} style={s.warningText}>
              {`⚠ ${w.name} 佔總資產 ${w.percentage.toFixed(1)}%，集中度偏高`}
            </Text>
          ))}
        </View>
      )}

      <View style={s.ratioRow}>
        <View style={s.ratioLabelRow}>
          <View style={[s.dot, { backgroundColor: LIABILITY_COLOR }]} />
          <Text style={s.ratioLabel}>負債佔總資產</Text>
        </View>
        <Text style={s.ratioValue}>
          {data.debtToAssetRatio === null ? "尚無資料" : `${data.debtToAssetRatio.toFixed(1)}%`}
        </Text>
      </View>

      <View style={s.ratioRow}>
        <Text style={s.ratioLabel}>台股／美股比例</Text>
        <Text style={s.ratioValue}>
          {stockTotal === 0
            ? "尚無資料"
            : `台股 ${((twValue / stockTotal) * 100).toFixed(1)}% / 美股 ${((usValue / stockTotal) * 100).toFixed(1)}%`}
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  errorText: { fontSize: 13, color: "#8e8e93" },
  root: { flex: 1, gap: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, borderWidth: 1, borderColor: "rgba(28,28,30,0.12)" },
  rowName: { flex: 1, fontSize: 13, color: "#1c1c1e", fontWeight: "600" },
  rowPercentage: { fontSize: 13, color: "#8e8e93", width: 48, textAlign: "right" },
  rowValue: { fontSize: 13, color: "#1c1c1e", width: 130, textAlign: "right" },
  emptyText: { fontSize: 13, color: "#8e8e93", textAlign: "center", marginTop: 12 },
  warningBox: {
    marginTop: 6,
    padding: 10,
    borderRadius: 10,
    backgroundColor: "#fdf1e8",
    gap: 4,
  },
  warningText: { fontSize: 12, color: "#B8865E", fontWeight: "600" },
  ratioRow: {
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#e5e5ea",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  ratioLabelRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  ratioLabel: { fontSize: 13, color: "#8e8e93" },
  ratioValue: { fontSize: 13, color: "#1c1c1e", fontWeight: "700" },
});
