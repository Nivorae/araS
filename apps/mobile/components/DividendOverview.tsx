import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import type { DividendSummary } from "@repo/shared";
import { useFinanceActions } from "@/hooks/useFinanceActions";
import { useFocusRefresh } from "@/hooks/useFocusRefresh";

// Embedded as the 股息 tab on 投資損益 (apps/mobile/app/(app)/(tabs)/transactions.tsx),
// alongside 走勢/配置 — not a standalone routed screen, so it has no back button or
// header of its own and adds no horizontal padding (the parent's chartZone
// already provides it, same convention as AssetAllocationView).
export function DividendOverview() {
  const router = useRouter();
  const { fetchDividendSummary } = useFinanceActions();
  const [summary, setSummary] = useState<DividendSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Refetch on focus so a dividend recorded on the entry detail screen is
  // reflected here instead of showing pre-record totals. Guarded by
  // useFocusRefresh — see that hook for why a plain useEffect isn't enough.
  // Switching tabs remounts this component (the parent renders it
  // conditionally), which also triggers a fresh read — consistent with
  // AssetAllocationView refetching on every mount.
  const { refresh, loading } = useFocusRefresh(
    async () => {
      try {
        const data = await fetchDividendSummary();
        setSummary(data);
        setError(null);
        return data;
      } catch (e) {
        setError(e instanceof Error ? e.message : "讀取失敗");
        return null;
      }
    },
    { context: "dividends.overview.refreshLoop" }
  );

  // Three distinct states, deliberately not collapsed into one another:
  //  - first load in flight: summary and error are both still their initial
  //    null, since neither branch of the fetcher above has run yet.
  //  - load failed with nothing to show yet: error is set, summary is still
  //    null — must not render as "NT$ 0 / 還沒有股利紀錄", which would read
  //    as a confident (and wrong) answer on a financial screen.
  //  - summary !== null: a load has succeeded at least once. Render it even
  //    if a later background refresh failed (error may be non-null here too)
  //    — stale data beats blanking a screen the user was already reading.
  const firstLoadPending = summary === null && error === null;
  const failedWithNoData = summary === null && error !== null;

  if (firstLoadPending) {
    return (
      <View style={s.centerState}>
        <ActivityIndicator size="small" color="#8e8e93" />
      </View>
    );
  }

  if (failedWithNoData) {
    return (
      <View style={s.centerState}>
        <Text style={s.errorTitle}>無法載入股息資料</Text>
        <Text style={s.errorDetail}>{error}</Text>
        <Pressable
          style={s.retryBtn}
          onPress={() => void refresh({ force: true })}
          disabled={loading}
        >
          <Text style={s.retryText}>{loading ? "重試中…" : "重試"}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={s.root} contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
      {/* summary is non-null here — a later background refresh may have
          failed, but the previously-loaded data stays on screen and this
          banner surfaces the failure without blanking it. */}
      {error && <Text style={s.error}>更新失敗，目前顯示上次讀取的資料（{error}）</Text>}

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
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  body: { paddingBottom: 40 },
  centerState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  errorTitle: { fontSize: 15, fontWeight: "600", color: "#1c1c1e" },
  errorDetail: { fontSize: 13, color: "#8e8e93", textAlign: "center" },
  retryBtn: {
    marginTop: 8,
    backgroundColor: "#1c1c1e",
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  retryText: { fontSize: 14, fontWeight: "600", color: "#fff" },
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
