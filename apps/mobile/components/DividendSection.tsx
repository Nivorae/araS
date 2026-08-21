import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { pressFeedback, longPressFeedback } from "@/lib/haptics";
import type { Dividend } from "@repo/shared";
import { useFinanceActions } from "@/hooks/useFinanceActions";
import { useFinanceStore } from "@/store/financeStore";
import DividendForm from "@/components/DividendForm";
import ReinvestSheet from "@/components/ReinvestSheet";

/**
 * 一列股利。獨立成元件是為了讓每一列各自持有一個 Animated.Value —— 放在
 * DividendSection 裡的話 rows.map 每次 render 都會重建，或者所有列共用同一個
 * 值而一起縮放。
 *
 * 互動仿 iOS 的長按手勢：按下去先微縮（0.97），長按門檻觸發時「彈起來」到
 * 1.03 並給一次 haptic，放開回到 1。所有動畫都走 useNativeDriver，不佔 JS thread。
 */
function DividendRow({
  dividend,
  isDeleting,
  onPress,
  onLongPress,
  onReinvest,
}: {
  dividend: Dividend;
  isDeleting: boolean;
  onPress: () => void;
  onLongPress: () => void;
  onReinvest: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = useCallback(
    (to: number) => {
      Animated.spring(scale, {
        toValue: to,
        useNativeDriver: true,
        speed: 40,
        bounciness: to > 1 ? 12 : 0,
      }).start();
    },
    [scale]
  );

  const d = dividend;

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={() => {
          pressFeedback();
          onPress();
        }}
        onLongPress={() => {
          longPressFeedback();
          animateTo(1.03);
          onLongPress();
        }}
        onPressIn={() => animateTo(0.97)}
        onPressOut={() => animateTo(1)}
        disabled={isDeleting}
        style={[s.row, isDeleting && s.rowDeleting]}
      >
        <View>
          <Text style={s.rowDate}>{d.payDate.slice(0, 10)}</Text>
          {d.perShare != null && (
            <Text style={s.rowMeta}>
              每股 {d.perShare} × {d.shares ?? "—"} 股
            </Text>
          )}
        </View>
        {isDeleting ? (
          <View style={s.rowRight}>
            <ActivityIndicator size="small" color="#8e8e93" />
            <Text style={s.reinvested}>刪除中…</Text>
          </View>
        ) : (
          <View style={s.rowRight}>
            <Text style={s.rowAmount}>+NT$ {d.amount.toLocaleString()}</Text>
            {d.reinvestedAt ? (
              <Text style={s.reinvested}>
                已再投資 {d.reinvestUnits != null ? `${d.reinvestUnits.toFixed(2)} 股` : ""}
              </Text>
            ) : (
              <Pressable
                onPress={() => {
                  pressFeedback();
                  onReinvest();
                }}
                hitSlop={6}
              >
                <Text style={s.reinvestBtn}>再投資</Text>
              </Pressable>
            )}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

interface DividendSectionProps {
  entryId: string;
  entryName: string;
  subCategory: string;
  stockCode: string;
  currentShares: number | null;
  costBasis: number;
}

export default function DividendSection({
  entryId,
  entryName,
  subCategory,
  stockCode,
  currentShares,
  costBasis,
}: DividendSectionProps) {
  // FIX FOR FINDING 3 (final review) — `fetchAll()` refreshes
  // entries/portfolio/recurrences/transactions, but per-entry history lives in
  // a separate store slice (`historyByEntry`) only refreshed by
  // `fetchEntryHistory(entryId)`. Without also calling it here, 交易記錄 and
  // the totalUnits/costBasis/殖利率 derived from it on entry/[id].tsx stay
  // stale after add/reinvest/delete until the user leaves and returns.
  const { fetchDividends, deleteDividend, fetchAll, fetchEntryHistory } = useFinanceActions();
  const entries = useFinanceStore((s) => s.entries);

  const [rows, setRows] = useState<Dividend[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  // 編輯與新增共用同一個 DividendForm 實例（它從不 unmount，只切 visible）。
  // editTarget 有值就是編輯模式，null + formOpen 就是新增。
  const [editTarget, setEditTarget] = useState<Dividend | null>(null);
  const [reinvestTarget, setReinvestTarget] = useState<Dividend | null>(null);
  // 刪除是長按觸發的原生 Alert，一按「刪除」對話框就立刻關閉——沒有這個狀態的
  // 話，接下來的 API 呼叫與 fetchAll/load 這段完全沒有任何畫面回饋，使用者會
  // 誤以為長按沒反應而重複操作。
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRows(await fetchDividends(entryId));
    } catch {
      // 讀取失敗就維持現有列表 —— 這是輔助資訊，不該讓詳情頁整頁失敗。
    }
    // FIX FOR FINDING 3 — `load()` runs after every dividend mutation (new
    // dividend's onSaved, reinvest's onDone, and delete below), so refreshing
    // `historyByEntry` here covers add/reinvest/delete in one place, in
    // addition to each caller's own `fetchAll()` (not instead of it).
    // Failure is likewise non-fatal: 交易記錄 just stays on its last good
    // value, same tolerance as the dividend list above.
    try {
      await fetchEntryHistory(entryId);
    } catch {
      // 同上：交易記錄暫時沒更新不該讓整頁失敗。
    }
  }, [fetchDividends, fetchEntryHistory, entryId]);

  useEffect(() => {
    void load();
  }, [load]);

  // CONTROLLER RULING R3 — use exactly this. The plan originally divided the
  // ALL-TIME dividend total by cost basis here, but the summary endpoint (and the
  // 股息總覽 screen built on it) defines yieldOnCost on the CURRENT YEAR. Leaving
  // this one on all-time would give the same label 「對成本殖利率」two different
  // meanings on two screens. All-time stays on screen as 「累計股利」.
  const total = useMemo(() => rows.reduce((s, r) => s + r.amount, 0), [rows]);
  const thisYearTotal = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return rows
      .filter((r) => new Date(r.payDate).getFullYear() === currentYear)
      .reduce((s, r) => s + r.amount, 0);
  }, [rows]);
  const yieldOnCost = costBasis > 0 ? (thisYearTotal / costBasis) * 100 : null;

  const bankNameOf = (d: Dividend) =>
    d.bankEntryId ? (entries.find((e) => e.id === d.bankEntryId)?.name ?? null) : null;

  // 後端 DividendsService.update 對「已再投資」一律回 409，連只改備註都擋
  // （沖銷重放會連帶刪掉再投資的兩筆 history）。與其讓使用者填完才吃錯誤，
  // 不如在入口就說清楚。
  const openEdit = (d: Dividend) => {
    if (deletingId) return;
    if (d.reinvestedAt) {
      Alert.alert(
        "已再投資的股利不可修改",
        "再投資是另一筆既成事實，改金額或帳戶會讓兩者對不上。請長按刪除這筆紀錄後重新建立。"
      );
      return;
    }
    setEditTarget(d);
  };

  const confirmDelete = (d: Dividend) => {
    if (deletingId) return; // 已有一筆刪除進行中，避免重複觸發
    Alert.alert("刪除這筆股利？", "入帳與再投資的紀錄會一併沖銷，帳戶餘額回到原本的金額。", [
      { text: "取消", style: "cancel" },
      {
        text: "刪除",
        style: "destructive",
        onPress: async () => {
          setDeletingId(d.id);
          try {
            await deleteDividend(d.id);
            await fetchAll();
            await load();
          } catch (e) {
            Alert.alert("刪除失敗", e instanceof Error ? e.message : "請稍後再試");
          } finally {
            setDeletingId(null);
          }
        },
      },
    ]);
  };

  return (
    <View style={s.section}>
      <View style={s.header}>
        <Text style={s.title}>股息</Text>
        <Pressable onPress={() => setFormOpen(true)} hitSlop={8}>
          <Text style={s.addBtn}>+ 新增</Text>
        </Pressable>
      </View>

      <View style={s.statRow}>
        <Text style={s.statLabel}>累計股利</Text>
        <Text style={s.statValue}>NT$ {total.toLocaleString()}</Text>
      </View>
      {yieldOnCost != null && (
        <View style={s.statRow}>
          <Text style={s.statLabel}>本年度對成本殖利率</Text>
          <Text style={s.statValue}>{yieldOnCost.toFixed(2)}%</Text>
        </View>
      )}

      <View style={s.card}>
        {rows.length === 0 ? (
          <Text style={s.empty}>還沒有股利紀錄</Text>
        ) : (
          rows.map((d, i) => (
            <View key={d.id}>
              {i > 0 && <View style={s.separator} />}
              <DividendRow
                dividend={d}
                isDeleting={deletingId === d.id}
                onPress={() => openEdit(d)}
                onLongPress={() => confirmDelete(d)}
                onReinvest={() => setReinvestTarget(d)}
              />
            </View>
          ))
        )}
      </View>
      <Text style={s.hint}>點一下可編輯，長按可刪除</Text>

      <DividendForm
        visible={formOpen || editTarget !== null}
        editing={editTarget}
        entryId={entryId}
        entryName={entryName}
        subCategory={subCategory}
        stockCode={stockCode}
        currentShares={currentShares}
        onClose={() => {
          setFormOpen(false);
          setEditTarget(null);
        }}
        onSaved={load}
      />

      {reinvestTarget && (
        <ReinvestSheet
          visible
          dividendId={reinvestTarget.id}
          dividendAmount={reinvestTarget.amount}
          entryName={entryName}
          subCategory={subCategory}
          stockCode={stockCode}
          bankName={bankNameOf(reinvestTarget)}
          onClose={() => setReinvestTarget(null)}
          onDone={load}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  section: { paddingHorizontal: 20, paddingTop: 24 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  title: { fontSize: 13, fontWeight: "600", color: "#1c1c1e" },
  addBtn: { fontSize: 13, color: "#66788E", fontWeight: "600" },
  statRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  statLabel: { fontSize: 13, color: "#8e8e93" },
  statValue: { fontSize: 13, fontWeight: "600", color: "#1c1c1e" },
  card: { backgroundColor: "#fff", borderRadius: 14, marginTop: 10, paddingHorizontal: 14 },
  separator: { height: 1, backgroundColor: "#f2f2f7" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  rowDeleting: { opacity: 0.5 },
  rowDate: { fontSize: 14, color: "#1c1c1e" },
  rowMeta: { fontSize: 12, color: "#8e8e93", marginTop: 2 },
  rowRight: { alignItems: "flex-end", gap: 4 },
  rowAmount: { fontSize: 14, fontWeight: "600", color: "#1c1c1e" },
  reinvestBtn: { fontSize: 12, color: "#66788E", fontWeight: "600" },
  reinvested: { fontSize: 12, color: "#8e8e93" },
  empty: { fontSize: 13, color: "#8e8e93", paddingVertical: 18, textAlign: "center" },
  hint: { fontSize: 11, color: "#c7c7cc", marginTop: 8, textAlign: "center" },
});
