import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  Pressable,
  ScrollView,
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
 *
 * 純文字條列（不用色塊）——這裡是點開「歷史紀錄」modal 才會看到的完整清單。
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
            <Text style={s.rowMeta}>刪除中…</Text>
          </View>
        ) : (
          <View style={s.rowRight}>
            <Text style={s.rowAmount}>+NT$ {d.amount.toLocaleString()}</Text>
            {d.reinvestedAt ? (
              <Text style={s.rowMeta}>
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
  color: string;
  categoryTextColor: string;
}

export default function DividendSection({
  entryId,
  entryName,
  subCategory,
  stockCode,
  currentShares,
  costBasis,
  color,
  categoryTextColor,
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
  const [historyOpen, setHistoryOpen] = useState(false);
  // 只蓋第一次載入 —— 之後每次新增/編輯/刪除都會重打 load()，不該讓卡片
  // 每次都閃一次 loading。
  const [initialLoading, setInitialLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setRows(await fetchDividends(entryId));
    } catch {
      // 讀取失敗就維持現有列表 —— 這是輔助資訊，不該讓詳情頁整頁失敗。
    } finally {
      setInitialLoading(false);
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

  // RN only handles one native <Modal> reliably at a time — stacking the
  // history-list modal underneath DividendForm/ReinvestSheet (both opened
  // from a row *inside* that modal) left the history modal half-alive and
  // ate touches on the whole screen afterwards. Closing it the instant any
  // of those open keeps exactly one Modal mounted-visible at once.
  useEffect(() => {
    if (formOpen || editTarget !== null || reinvestTarget !== null) {
      setHistoryOpen(false);
    }
  }, [formOpen, editTarget, reinvestTarget]);

  // CONTROLLER RULING R3 — use exactly this. The plan originally divided the
  // ALL-TIME dividend total by cost basis here, but the summary endpoint (and the
  // 股息總覽 screen built on it) defines yieldOnCost on the CURRENT YEAR.
  const thisYearTotal = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return rows
      .filter((r) => new Date(r.payDate).getFullYear() === currentYear)
      .reduce((s, r) => s + r.amount, 0);
  }, [rows]);
  const yieldOnCost = costBasis > 0 ? (thisYearTotal / costBasis) * 100 : null;
  // 殖利率之外的第二個指標：本年度平均單次股利，讓左上角不會只有一個數字。
  const thisYearCount = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return rows.filter((r) => new Date(r.payDate).getFullYear() === currentYear).length;
  }, [rows]);
  const avgPerPayment = thisYearCount > 0 ? thisYearTotal / thisYearCount : null;
  const isLightCat = categoryTextColor.toLowerCase() === "#1c1c1e";

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
      <Text style={s.title}>股息</Text>

      {/* 2x2：左上=殖利率+平均單次股利、右上=當年股息總額、左下=明細清單
          （可點開全部）、右下=新增／歷史紀錄。 */}
      {initialLoading ? (
        <View style={s.loadingBox}>
          <ActivityIndicator color="#8e8e93" />
        </View>
      ) : (
        <View style={s.grid}>
          <View style={s.gridRow}>
            <View style={s.cellTL}>
              <View style={s.tlStat}>
                <Text style={s.tlLabel}>本年度殖利率</Text>
                <Text style={s.tlValue}>
                  {yieldOnCost != null ? `${yieldOnCost.toFixed(2)}%` : "—"}
                </Text>
              </View>
              <View style={s.tlDivider} />
              <View style={s.tlStat}>
                <Text style={s.tlLabel}>平均單次股利</Text>
                <Text style={s.tlValue}>
                  {avgPerPayment != null
                    ? `NT$ ${Math.round(avgPerPayment).toLocaleString()}`
                    : "—"}
                </Text>
              </View>
            </View>

            <View
              style={[
                s.cellTR,
                { backgroundColor: color },
                isLightCat && { borderWidth: 1, borderColor: "#e5e5ea" },
              ]}
            >
              <View style={s.trBadgeWrap} pointerEvents="none">
                <View style={s.trBadge}>
                  <Text style={s.trBadgeText}>當年股息</Text>
                </View>
              </View>
              <View style={s.trValueWrap}>
                <Text
                  style={[s.trValue, { color: isLightCat ? "#1c1c1e" : "#ffffff" }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.4}
                >
                  {thisYearTotal.toLocaleString()}
                </Text>
              </View>
              <Text
                style={[
                  s.trCurrencyCorner,
                  { color: isLightCat ? "#8e8e93" : "rgba(255,255,255,0.85)" },
                ]}
              >
                NT$
              </Text>
            </View>
          </View>

          <View style={s.gridRow}>
            <Pressable style={s.cellBL} onPress={() => setHistoryOpen(true)}>
              <Text style={s.blLabel}>股利明細</Text>
              {rows.length === 0 ? (
                <Text style={s.blEmpty}>還沒有紀錄</Text>
              ) : (
                <View style={s.blList}>
                  {rows.slice(0, 3).map((d) => (
                    <View key={d.id} style={s.blRow}>
                      <Text style={s.blDate}>{d.payDate.slice(5, 10)}</Text>
                      <Text style={s.blAmount}>+{d.amount.toLocaleString()}</Text>
                    </View>
                  ))}
                  {rows.length > 3 && <Text style={s.blMore}>還有 {rows.length - 3} 筆…</Text>}
                </View>
              )}
            </Pressable>

            <View style={s.cellBR}>
              <Pressable
                onPress={() => setFormOpen(true)}
                style={({ pressed }) => [
                  s.brAddBtn,
                  { backgroundColor: color, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={[s.brAddBtnText, { color: isLightCat ? "#1c1c1e" : "#ffffff" }]}>
                  ＋ 新增
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setHistoryOpen(true)}
                style={({ pressed }) => [s.brHistoryBtn, { opacity: pressed ? 0.7 : 1 }]}
              >
                <Text style={s.brHistoryBtnText}>歷史紀錄</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {/* ── 股利明細 Modal — 點左下角卡片或「歷史紀錄」都會開這個 ─────────── */}
      <Modal
        visible={historyOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setHistoryOpen(false)}
      >
        <View style={s.modalWrapper}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setHistoryOpen(false)} />
          <View style={s.modalSheet}>
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>股利紀錄</Text>
            <ScrollView style={s.modalScroll} contentContainerStyle={s.modalListContent}>
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
            </ScrollView>
            <Text style={s.hint}>點一下可編輯，長按可刪除</Text>
          </View>
        </View>
      </Modal>

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
  section: { paddingHorizontal: 20 },
  title: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1c1c1e",
    textAlign: "center",
    marginTop: 24,
    marginBottom: 24,
  },

  grid: { gap: 10 },
  gridRow: { flexDirection: "row", gap: 10 },
  loadingBox: { minHeight: 290, alignItems: "center", justifyContent: "center" },

  // ── 左上：殖利率 + 平均單次股利 ──────────────────────────────────────
  cellTL: {
    flex: 1,
    minHeight: 140,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  tlStat: { alignItems: "center", gap: 2 },
  tlLabel: { fontSize: 12, color: "#8e8e93", textAlign: "center" },
  tlValue: { fontSize: 18, fontWeight: "700", color: "#1c1c1e", textAlign: "center" },
  tlDivider: { height: StyleSheet.hairlineWidth, backgroundColor: "#f2f2f7", marginVertical: 10 },

  // ── 右上：當年股息（類別主題色色塊 + 上緣徽章）────────────────────────
  // position:'relative' + 徽章用 absolute 蓋在上緣，數字才不會被徽章的
  // flow 高度影響，能真正在色塊裡置中。
  cellTR: {
    flex: 1,
    minHeight: 140,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "visible",
  },
  trBadgeWrap: {
    position: "absolute",
    top: -14,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  trBadge: {
    backgroundColor: "#ffffff",
    borderRadius: 100,
    paddingHorizontal: 14,
    paddingVertical: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  trBadgeText: { fontSize: 12, fontWeight: "700", color: "#1c1c1e" },
  // 金額本身可能很長（大股息戶），用 adjustsFontSizeToFit 讓它在固定寬度內
  // 自動縮小，而不是被截斷或撐破色塊。
  trValueWrap: { width: "100%", paddingHorizontal: 14 },
  trValue: { fontSize: 30, fontWeight: "800", letterSpacing: -0.5, textAlign: "center" },
  // NT$ 固定貼在色塊右下角，不會跟著長金額被推走。
  trCurrencyCorner: {
    position: "absolute",
    right: 12,
    bottom: 10,
    fontSize: 12,
    fontWeight: "600",
  },

  // ── 左下：股利明細（可點開全部）────────────────────────────────────
  cellBL: {
    flex: 1,
    minHeight: 140,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 14,
  },
  blLabel: { fontSize: 12, color: "#8e8e93", marginBottom: 8 },
  blEmpty: { fontSize: 13, color: "#c7c7cc" },
  blList: { gap: 6 },
  blRow: { flexDirection: "row", justifyContent: "space-between" },
  blDate: { fontSize: 12, color: "#8e8e93" },
  blAmount: { fontSize: 13, fontWeight: "600", color: "#1c1c1e" },
  blMore: { fontSize: 11, color: "#c7c7cc", marginTop: 4 },

  // ── 右下：新增／歷史紀錄 ───────────────────────────────────────────
  // 按鈕不再撐滿整格高度 —— 固定小巧尺寸、置中排列，格子其餘空間留白。
  cellBR: { flex: 1, minHeight: 140, justifyContent: "center", gap: 8 },
  brAddBtn: {
    borderRadius: 12,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  brAddBtnText: { fontSize: 13, fontWeight: "700" },
  brHistoryBtn: {
    borderRadius: 12,
    paddingVertical: 8,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  brHistoryBtnText: { fontSize: 12, fontWeight: "600", color: "#66788E" },

  // ── 股利明細 Modal — 單純文字條列，不用色塊 ─────────────────────
  modalWrapper: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  modalSheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    maxHeight: "80%",
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#e5e5ea",
    alignSelf: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1c1c1e",
    textAlign: "center",
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  modalScroll: { flexGrow: 0 },
  modalListContent: { paddingHorizontal: 20, paddingBottom: 12 },

  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: "#f2f2f7" },
  rowDeleting: { opacity: 0.5 },
  rowDate: { fontSize: 14, color: "#1c1c1e" },
  rowMeta: { fontSize: 12, color: "#8e8e93", marginTop: 2 },
  rowRight: { alignItems: "flex-end", gap: 4 },
  rowAmount: { fontSize: 14, fontWeight: "600", color: "#1c1c1e" },
  reinvestBtn: { fontSize: 12, color: "#66788E", fontWeight: "600" },
  empty: {
    fontSize: 13,
    color: "#8e8e93",
    paddingVertical: 18,
    paddingHorizontal: 20,
    textAlign: "center",
  },
  hint: {
    fontSize: 11,
    color: "#c7c7cc",
    marginTop: 4,
    marginBottom: 20,
    paddingHorizontal: 20,
    textAlign: "center",
  },
});
