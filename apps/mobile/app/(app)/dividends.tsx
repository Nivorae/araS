import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import type { DividendSummary } from "@repo/shared";
import { useFinanceActions } from "@/hooks/useFinanceActions";

export default function DividendsScreen() {
  const router = useRouter();
  const { fetchDividendSummary } = useFinanceActions();
  const [summary, setSummary] = useState<DividendSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setSummary(await fetchDividendSummary());
    } catch (e) {
      setError(e instanceof Error ? e.message : "讀取失敗");
    }
  }, [fetchDividendSummary]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <View style={s.root}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <ChevronLeft size={24} color="#1c1c1e" />
        </Pressable>
        <Text style={s.headerTitle}>股息總覽</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={s.body}>
        {error && <Text style={s.error}>{error}</Text>}

        <View style={s.totals}>
          <View style={s.totalBox}>
            <Text style={s.totalLabel}>本年度股利</Text>
            <Text style={s.totalValue}>NT$ {(summary?.totalThisYear ?? 0).toLocaleString()}</Text>
          </View>
          <View style={s.totalBox}>
            <Text style={s.totalLabel}>全期累計</Text>
            <Text style={s.totalValue}>NT$ {(summary?.totalAllTime ?? 0).toLocaleString()}</Text>
          </View>
        </View>

        <Text style={s.sectionTitle}>各檔明細</Text>
        <View style={s.card}>
          {!summary || summary.byEntry.length === 0 ? (
            <Text style={s.empty}>還沒有股利紀錄</Text>
          ) : (
            summary.byEntry.map((row, i) => (
              <View key={row.entryId}>
                {i > 0 && <View style={s.separator} />}
                <Pressable style={s.row} onPress={() => router.push(`/entry/${row.entryId}`)}>
                  <View>
                    <Text style={s.rowName}>{row.name}</Text>
                    <Text style={s.rowMeta}>
                      {row.stockCode ?? "—"} · {row.subCategory}
                    </Text>
                  </View>
                  <View style={s.rowRight}>
                    <Text style={s.rowAmount}>NT$ {row.totalAllTime.toLocaleString()}</Text>
                    <Text style={s.rowMeta}>
                      {row.yieldOnCost != null
                        ? `殖利率 ${(row.yieldOnCost * 100).toFixed(2)}%`
                        : "殖利率 —"}
                    </Text>
                  </View>
                </Pressable>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f2f2f7" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 16, fontWeight: "600", color: "#1c1c1e" },
  body: { paddingHorizontal: 20, paddingBottom: 40 },
  totals: { flexDirection: "row", gap: 12 },
  totalBox: { flex: 1, backgroundColor: "#fff", borderRadius: 14, padding: 16 },
  totalLabel: { fontSize: 12, color: "#8e8e93" },
  totalValue: { fontSize: 18, fontWeight: "700", color: "#1c1c1e", marginTop: 6 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1c1c1e",
    marginTop: 24,
    marginBottom: 10,
  },
  card: { backgroundColor: "#fff", borderRadius: 14, paddingHorizontal: 14 },
  separator: { height: 1, backgroundColor: "#f2f2f7" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
  },
  rowName: { fontSize: 15, color: "#1c1c1e" },
  rowMeta: { fontSize: 12, color: "#8e8e93", marginTop: 2 },
  rowRight: { alignItems: "flex-end" },
  rowAmount: { fontSize: 15, fontWeight: "600", color: "#1c1c1e" },
  empty: { fontSize: 13, color: "#8e8e93", paddingVertical: 20, textAlign: "center" },
  error: { color: "#d93025", fontSize: 13, marginBottom: 12 },
});
