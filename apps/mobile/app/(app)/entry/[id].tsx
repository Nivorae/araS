import { useEffect, useState, useRef, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Pencil, Plus, Trash2 } from "lucide-react-native";
import type { EntryHistory } from "@repo/shared";
import { useFinanceStore } from "@/store/financeStore";
import { useFinanceActions } from "@/hooks/useFinanceActions";
import { useApi } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { CATEGORIES } from "@/lib/categoryConfig";

import { STOCK_CATS, buildYfSymbol as _buildYfSymbol } from "@/lib/stockConstants";
const STOCK_PICKER_CATEGORIES: readonly string[] = STOCK_CATS;

function getCategoryColor(t: string) {
  return CATEGORIES.find((c) => c.name === t)?.color ?? "#374254";
}
function formatDelta(d: number) {
  return `${d >= 0 ? "+" : ""}${formatCurrency(d)}`;
}
function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}
const buildYfSymbol = _buildYfSymbol;

// ─── History Row ─────────────────────────────────────────────────────────────

function HistoryRow({
  h,
  isLiability,
  currentPrice,
  onPress,
  isFirst,
}: {
  h: EntryHistory;
  isLiability: boolean;
  currentPrice: number | null;
  onPress: () => void;
  isFirst: boolean;
}) {
  const hasUnits = h.units != null && h.units > 0;
  const recordPnL = hasUnits && currentPrice != null ? h.units! * currentPrice - h.delta : null;
  const deltaColor = h.delta >= 0 ? (isLiability ? "#ff3b30" : "#0e1424") : "#ff3b30";

  return (
    <>
      {!isFirst && <View style={s.separator} />}
      <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={s.historyRow}>
        <View style={s.historyLeft}>
          <Text style={s.historyNote}>{h.note ?? (h.delta >= 0 ? "新增" : "調整")}</Text>
          <Text style={s.historyMeta}>{formatDate(h.createdAt)}</Text>
          {hasUnits && <Text style={s.historyMeta}>{h.units!.toLocaleString()} 股</Text>}
        </View>
        <View style={s.historyRight}>
          <Text style={[s.historyDelta, { color: deltaColor }]}>{formatDelta(h.delta)}</Text>
          <Text style={s.historyMeta}>餘額 {formatCurrency(h.balance)}</Text>
          {recordPnL != null && (
            <Text style={[s.historyPnl, { color: recordPnL >= 0 ? "#0e1424" : "#ff3b30" }]}>
              盈虧 {formatDelta(recordPnL)}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    </>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function EntryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const api = useApi();
  // Stable ref so useCallback deps don't include api (avoids infinite fetch loop)
  const apiRef = useRef(api);
  apiRef.current = api;

  const { deleteEntry } = useFinanceActions();
  const entry = useFinanceStore((state) => state.entries.find((e) => e.id === id));

  const [history, setHistory] = useState<EntryHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);

  // Edit modal state
  const [editingHistory, setEditingHistory] = useState<EntryHistory | null>(null);
  const [editNote, setEditNote] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editDelta, setEditDelta] = useState("");
  const [editUnits, setEditUnits] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [confirmDeleteHistory, setConfirmDeleteHistory] = useState(false);

  const isStockEntry =
    !!entry && STOCK_PICKER_CATEGORIES.includes(entry.subCategory) && !!entry.stockCode;

  // Stable fetchHistory — api excluded from deps via ref
  const fetchHistory = useCallback(async () => {
    if (!id) return;
    setHistoryLoading(true);
    try {
      const data = await apiRef.current.get<EntryHistory[]>(`/api/entries/${id}/history`);
      setHistory(data);
    } catch {
      /* silently fail */
    } finally {
      setHistoryLoading(false);
    }
  }, [id]); // intentionally exclude api — use apiRef instead

  // Refetch on focus so a record added via the "+" flow shows up on return.
  useFocusEffect(
    useCallback(() => {
      fetchHistory();
    }, [fetchHistory])
  );

  // Stock price fetch — only re-runs when stockCode changes, not on every render
  const stockCode = entry?.stockCode;
  const subCategory = entry?.subCategory;
  useEffect(() => {
    if (!isStockEntry || !stockCode || !subCategory) return;
    const yfSymbol = buildYfSymbol(subCategory, stockCode);
    if (!yfSymbol) return;
    apiRef.current
      .rawGet<{ price: number }>(`/api/stocks/price?symbol=${encodeURIComponent(yfSymbol)}`)
      .then((data) => {
        if (typeof data.price === "number") setCurrentPrice(data.price);
      })
      .catch(() => {});
  }, [isStockEntry, stockCode, subCategory]); // primitive deps only

  // P&L
  const investmentRecords = history.filter((h) => h.units != null && h.units > 0);
  const totalUnits = investmentRecords.reduce((sum, h) => sum + (h.units ?? 0), 0);
  const totalCost = investmentRecords.reduce((sum, h) => sum + h.delta, 0);
  const currentMarketValue = currentPrice != null ? totalUnits * currentPrice : null;
  const totalPnL = currentMarketValue != null ? currentMarketValue - totalCost : null;
  const totalPnLPct = totalCost > 0 && totalPnL != null ? (totalPnL / totalCost) * 100 : null;

  function openEdit(h: EntryHistory) {
    setEditNote(h.note ?? "");
    setEditDate(h.createdAt.split("T")[0] ?? "");
    setEditDelta(String(h.delta));
    setEditUnits(h.units != null ? String(h.units) : "");
    setConfirmDeleteHistory(false);
    setEditingHistory(h);
  }

  async function handleSave() {
    if (!editingHistory || !id) return;
    if (!editDate || !editDelta || isNaN(parseFloat(editDelta))) return;
    setEditSaving(true);
    try {
      await apiRef.current.patch(`/api/entries/${id}/history/${editingHistory.id}`, {
        note: editNote.trim() || null,
        createdAt: editDate,
        delta: parseFloat(editDelta),
        units: editUnits !== "" ? parseFloat(editUnits) : null,
      });
      setEditingHistory(null);
      fetchHistory();
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDeleteHistoryRecord() {
    if (!editingHistory || !id) return;
    setEditSaving(true);
    try {
      await apiRef.current.delete(`/api/entries/${id}/history/${editingHistory.id}`);
      setEditingHistory(null);
      fetchHistory();
    } finally {
      setEditSaving(false);
    }
  }

  function confirmDeleteEntry() {
    if (!entry) return;
    Alert.alert("刪除項目", `確定要刪除「${entry.name}」？此操作無法復原。`, [
      { text: "取消", style: "cancel" },
      {
        text: "刪除",
        style: "destructive",
        onPress: async () => {
          await deleteEntry(id!);
          router.back();
        },
      },
    ]);
  }

  if (!entry) {
    return (
      <SafeAreaView style={[s.root, s.center]}>
        <ActivityIndicator color="#374254" />
      </SafeAreaView>
    );
  }

  const color = getCategoryColor(entry.topCategory);
  const isLiability = entry.topCategory === "負債";
  const isWhiteCat = color.toUpperCase() === "#FFFFFF";

  return (
    <View style={s.root}>
      <SafeAreaView edges={["top"]} style={{ backgroundColor: "#f2f2f7" }}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.iconBtn}>
            <ArrowLeft size={18} color="#1c1c1e" />
          </TouchableOpacity>
          <View style={s.headerActions}>
            <TouchableOpacity
              onPress={() =>
                // Append a new record (子項目) to THIS entry — same id, no new
                // entry created. The form runs in add-record mode and the service
                // logs the entered amount as a fresh history line.
                router.push(`/entry/${id}/edit?mode=add`)
              }
              style={s.iconBtn}
            >
              <Plus size={18} color="#1c1c1e" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push(`/entry/${id}/edit`)} style={s.iconBtn}>
              <Pencil size={16} color="#1c1c1e" />
            </TouchableOpacity>
            <TouchableOpacity onPress={confirmDeleteEntry} style={s.iconBtn}>
              <Trash2 size={16} color="#ff3b30" />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Entry info */}
        <View style={s.infoSection}>
          <View style={s.nameRow}>
            {/* 流動資金 is white — use a dark circle so the label stays legible */}
            <View
              style={[s.iconCircle, { backgroundColor: isWhiteCat ? "#1c1c1e" : color + "20" }]}
            >
              <Text style={[s.iconLabel, { color: isWhiteCat ? "#ffffff" : color }]}>
                {entry.subCategory.slice(0, 2)}
              </Text>
            </View>
            <View>
              <Text style={s.entryName}>{entry.name}</Text>
              <Text style={s.entrySub}>
                {entry.stockCode ? `${entry.stockCode} · ${entry.subCategory}` : entry.subCategory}
              </Text>
            </View>
          </View>
          <Text style={s.entryValue}>
            {formatCurrency(
              isStockEntry && currentMarketValue != null ? currentMarketValue : entry.value
            )}
          </Text>
          {isStockEntry && currentMarketValue != null && (
            <Text style={s.costLabel}>成本 {formatCurrency(entry.value)}</Text>
          )}
          {isStockEntry && currentPrice != null && (
            <View style={s.pnlRow}>
              <Text style={s.priceLabel}>
                當日股價 {currentPrice.toLocaleString("zh-TW", { maximumFractionDigits: 4 })}
              </Text>
              {totalPnL != null && (
                <Text style={[s.pnlText, { color: totalPnL >= 0 ? "#0e1424" : "#ff3b30" }]}>
                  {formatDelta(totalPnL)}
                  {totalPnLPct != null
                    ? ` (${totalPnL >= 0 ? "+" : ""}${totalPnLPct.toFixed(2)}%)`
                    : ""}
                </Text>
              )}
            </View>
          )}
        </View>

        {/* History */}
        <View style={s.historySection}>
          <View style={s.historySectionHeader}>
            <Text style={s.historySectionTitle}>交易記錄</Text>
            <Text style={s.historySectionSub}>變動</Text>
          </View>
          {historyLoading ? (
            <Text style={s.historyEmpty}>載入中...</Text>
          ) : history.length === 0 ? (
            <Text style={s.historyEmpty}>尚無記錄</Text>
          ) : (
            <View style={s.historyCard}>
              {history.map((h, i) => (
                <HistoryRow
                  key={h.id}
                  h={h}
                  isLiability={isLiability}
                  currentPrice={currentPrice}
                  onPress={() => openEdit(h)}
                  isFirst={i === 0}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── Edit History Modal ──────────────────────────────────────────── */}
      <Modal
        visible={!!editingHistory}
        transparent
        animationType="slide"
        onRequestClose={() => setEditingHistory(null)}
      >
        {/* Full-screen wrapper: backdrop + sheet aligned to bottom */}
        <View style={s.modalWrapper}>
          {/* Backdrop — tap to dismiss */}
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={() => setEditingHistory(null)}
          />

          {/* Sheet — rendered on top of backdrop */}
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}>
            <View style={s.modalSheet}>
              <View style={s.modalHandle} />
              <Text style={s.modalTitle}>編輯記錄</Text>

              <View style={s.formCard}>
                <View style={s.formRow}>
                  <Text style={s.formLabel}>備註</Text>
                  <TextInput
                    value={editNote}
                    onChangeText={setEditNote}
                    placeholder="選填"
                    placeholderTextColor="#c7c7cc"
                    style={s.formInput}
                  />
                </View>
                <View style={s.formDivider} />
                <View style={s.formRow}>
                  <Text style={s.formLabel}>日期</Text>
                  <TextInput
                    value={editDate}
                    onChangeText={setEditDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#c7c7cc"
                    style={s.formInput}
                  />
                </View>
                <View style={s.formDivider} />
                <View style={s.formRow}>
                  <Text style={s.formLabel}>變動金額</Text>
                  <TextInput
                    value={editDelta}
                    onChangeText={setEditDelta}
                    keyboardType="numeric"
                    style={[s.formInput, { fontWeight: "600" }]}
                  />
                </View>
                {isStockEntry && (
                  <>
                    <View style={s.formDivider} />
                    <View style={s.formRow}>
                      <Text style={s.formLabel}>持有股數</Text>
                      <TextInput
                        value={editUnits}
                        onChangeText={setEditUnits}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor="#c7c7cc"
                        style={s.formInput}
                      />
                    </View>
                  </>
                )}
              </View>

              <View style={s.modalBtns}>
                <TouchableOpacity onPress={() => setEditingHistory(null)} style={s.cancelBtn}>
                  <Text style={s.cancelBtnText}>取消</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSave}
                  disabled={editSaving}
                  style={[s.saveBtn, editSaving && s.disabledBtn]}
                >
                  {editSaving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={s.saveBtnText}>儲存</Text>
                  )}
                </TouchableOpacity>
              </View>

              {!confirmDeleteHistory ? (
                <TouchableOpacity
                  onPress={() => setConfirmDeleteHistory(true)}
                  style={s.deleteOutlineBtn}
                >
                  <Trash2 size={16} color="#ff3b30" />
                  <Text style={s.deleteOutlineBtnText}>刪除此記錄</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={handleDeleteHistoryRecord}
                  disabled={editSaving}
                  style={[s.deleteFilledBtn, editSaving && s.disabledBtn]}
                >
                  {editSaving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={s.saveBtnText}>確認刪除</Text>
                  )}
                </TouchableOpacity>
              )}
              <View style={{ height: 24 }} />
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f2f2f7" },
  center: { alignItems: "center", justifyContent: "center" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
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

  infoSection: { paddingHorizontal: 20, paddingBottom: 24 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  iconLabel: { fontSize: 13, fontWeight: "700" },
  entryName: { fontSize: 17, fontWeight: "600", color: "#1c1c1e" },
  entrySub: { fontSize: 13, color: "#8e8e93", marginTop: 2 },
  entryValue: { fontSize: 38, fontWeight: "700", color: "#1c1c1e", letterSpacing: -0.5 },
  costLabel: { fontSize: 13, color: "#8e8e93", marginTop: 2 },
  pnlRow: { flexDirection: "row", alignItems: "center", gap: 16, marginTop: 8 },
  priceLabel: { fontSize: 13, color: "#8e8e93" },
  pnlText: { fontSize: 14, fontWeight: "600" },

  historySection: { paddingHorizontal: 20 },
  historySectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  historySectionTitle: { fontSize: 13, fontWeight: "600", color: "#1c1c1e" },
  historySectionSub: { fontSize: 13, color: "#8e8e93" },
  historyCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  historyEmpty: { textAlign: "center", fontSize: 14, color: "#c7c7cc", paddingVertical: 32 },
  historyRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: "#f2f2f7", marginHorizontal: 16 },
  historyLeft: { flex: 1, minWidth: 0 },
  historyRight: { alignItems: "flex-end", marginLeft: 16, flexShrink: 0 },
  historyNote: { fontSize: 14, fontWeight: "500", color: "#1c1c1e" },
  historyMeta: { fontSize: 12, color: "#8e8e93", marginTop: 2 },
  historyDelta: { fontSize: 14, fontWeight: "600" },
  historyPnl: { fontSize: 12, fontWeight: "500", marginTop: 2 },

  // Modal — correct bottom-sheet layout
  modalWrapper: {
    flex: 1,
    justifyContent: "flex-end", // push sheet to bottom
    backgroundColor: "rgba(0,0,0,0.4)", // backdrop color on the wrapper itself
  },
  modalSheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
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
    marginBottom: 20,
  },

  formCard: { backgroundColor: "#f2f2f7", borderRadius: 16, overflow: "hidden" },
  formRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  formLabel: { fontSize: 15, color: "#1c1c1e" },
  formInput: { flex: 1, marginLeft: 16, textAlign: "right", fontSize: 15, color: "#1c1c1e" },
  formDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.7)",
    marginHorizontal: 16,
  },

  modalBtns: { flexDirection: "row", gap: 12, marginTop: 16 },
  cancelBtn: {
    flex: 1,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: "#e5e5ea",
    paddingVertical: 12,
    alignItems: "center",
  },
  cancelBtnText: { fontSize: 15, fontWeight: "600", color: "#1c1c1e" },
  saveBtn: {
    flex: 1,
    borderRadius: 100,
    backgroundColor: "#1c1c1e",
    paddingVertical: 12,
    alignItems: "center",
  },
  saveBtnText: { fontSize: 15, fontWeight: "600", color: "#ffffff" },
  deleteOutlineBtn: {
    marginTop: 12,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: "#ff3b30",
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  deleteOutlineBtnText: { fontSize: 15, fontWeight: "600", color: "#ff3b30" },
  deleteFilledBtn: {
    marginTop: 12,
    borderRadius: 100,
    backgroundColor: "#ff3b30",
    paddingVertical: 12,
    alignItems: "center",
  },
  disabledBtn: { opacity: 0.4 },
});
