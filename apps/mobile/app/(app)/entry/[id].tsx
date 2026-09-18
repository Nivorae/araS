import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
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
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, ArrowLeftRight, Pencil, Plus, Trash2 } from "lucide-react-native";
import * as Sentry from "@sentry/react-native";
import { TRANSFER_TOP_CATEGORIES, type EntryHistory } from "@repo/shared";
import { BankLogo } from "@/components/BankLogo";
import DividendSection from "@/components/DividendSection";
import FundPickerSheet from "@/components/FundPickerSheet";
import { useFinanceStore } from "@/store/financeStore";
import { useFinanceActions } from "@/hooks/useFinanceActions";
import { useResponsive } from "@/hooks/useResponsive";
import { useSheetBottomPadding } from "@/hooks/useSheetBottomPadding";
import { useFocusRefresh } from "@/hooks/useFocusRefresh";
import { useApi, ApiError } from "@/lib/api";
import { formatCurrency, toIntegerDigits, formatThousands } from "@/lib/format";
import { CATEGORIES } from "@/lib/categoryConfig";
import { fetchFundQuote, formatNavDate, type FundSearchResult } from "@/lib/funds";

import {
  STOCK_CATS,
  FUND_SUBCATEGORY,
  FUND_NAV_ENABLED,
  buildYfSymbol as _buildYfSymbol,
} from "@/lib/stockConstants";
const STOCK_PICKER_CATEGORIES: readonly string[] = STOCK_CATS;

// Taiwan market convention: 紅漲綠跌 — gains are red, losses are green.
const PNL_UP = "#ff3b30";
const PNL_DOWN = "#0e9f6e";
const pnlColor = (v: number) => (v >= 0 ? PNL_UP : PNL_DOWN);

function getCategoryColor(t: string) {
  return CATEGORIES.find((c) => c.name === t)?.color ?? "#374254";
}
function getCategoryTextColor(t: string) {
  return CATEGORIES.find((c) => c.name === t)?.textColor ?? "#ffffff";
}
function formatDelta(d: number) {
  return `${d >= 0 ? "+" : ""}${formatCurrency(d)}`;
}
// formatCurrency already prefixes "NT$" via Intl — split it off so the
// header can render "NT$" as a small corner label instead of inline.
function formatValueDigits(amount: number) {
  return formatCurrency(amount).replace(/^[^\d-]+/, "");
}
function monthGroupLabel(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}年${d.getMonth() + 1}月`;
}
// Group history rows (already sorted newest-first) into year-month sections,
// preserving order so the newest month appears first.
function groupHistoryByMonth(rows: EntryHistory[]): { key: string; rows: EntryHistory[] }[] {
  const groups: { key: string; rows: EntryHistory[] }[] = [];
  for (const h of rows) {
    const key = monthGroupLabel(h.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.rows.push(h);
    else groups.push({ key, rows: [h] });
  }
  return groups;
}
const buildYfSymbol = _buildYfSymbol;

// Stable empty reference for entries with no cached history yet, so `history`
// keeps one identity across renders and the useMemo hooks below stay valid.
const NO_HISTORY: EntryHistory[] = [];

// ─── Error handling for fire-and-forget onPress handlers ──────────────────────
// These async functions are invoked from `onPress` without being awaited by the
// caller, so any rejection they don't catch becomes a genuine *unhandled promise
// rejection* — that's what surfaces in Sentry, not a rendering bug. A 404
// ("Entry"/"History record" not found) means the row the user tapped was already
// removed elsewhere (e.g. a concurrent delete, or a double-tap before the button
// disabled) — that's an expected race, not a crash, so we refresh quietly instead
// of alarming the user. Anything else is reported to Sentry and shown as an alert.
function isNotFoundError(e: unknown): boolean {
  return e instanceof ApiError && e.status === 404;
}
// A NETWORK ApiError (status 0) means the request never reached / never got a
// reply from the server — most often iOS suspending the socket when the app is
// backgrounded mid-request. Like the 404 race above, this is an *expected*
// transient condition, not a bug: we show a friendly retry prompt and log only a
// breadcrumb (not a captured exception) so Sentry isn't flooded with noise.
function isNetworkError(e: unknown): boolean {
  return e instanceof ApiError && e.code === "NETWORK";
}
function reportNetworkError(context: string) {
  Sentry.addBreadcrumb({
    category: "network",
    level: "warning",
    message: `${context}: request interrupted`,
  });
  Alert.alert("網路連線中斷", "儲存未完成，請確認網路後再試一次。");
}
function reportUnexpectedError(e: unknown, context: string) {
  Sentry.captureException(e, { tags: { context } });
  const message = e instanceof Error ? e.message : "請重試";
  Alert.alert("操作失敗", message);
}

// ─── History Row ─────────────────────────────────────────────────────────────

// Rows alternate sides: the 1st, 3rd, 5th... record in each month group is a
// solid block (category color) flush to the left edge; the 2nd, 4th... is an
// outlined block flush to the right edge — matching the requested zig-zag
// layout instead of one continuous card.
function HistoryRow({
  h,
  isLiability,
  currentPrice,
  onPress,
  index,
  color,
  categoryTextColor,
}: {
  h: EntryHistory;
  isLiability: boolean;
  currentPrice: number | null;
  onPress: () => void;
  index: number;
  color: string;
  categoryTextColor: string;
}) {
  const hasUnits = h.units != null && h.units > 0;
  const recordPnL = hasUnits && currentPrice != null ? h.units! * currentPrice - h.delta : null;
  const isOutlined = index % 2 === 1;
  // Some categories (流動資金/負債/保險…) use a light background color, so
  // categoryTextColor is already dark for those — reuse it instead of
  // hardcoding white, or the text disappears against the light block.
  const isLightCat = categoryTextColor.toLowerCase() === "#1c1c1e";
  const needsDarkText = isOutlined || isLightCat;
  const deltaColor = needsDarkText
    ? h.delta >= 0
      ? isLiability
        ? "#ff3b30"
        : "#0e1424"
      : "#ff3b30"
    : "#ffffff";
  const date = new Date(h.createdAt);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const titleColor = needsDarkText ? "#1c1c1e" : "#ffffff";
  const metaColor = needsDarkText ? "#8e8e93" : "rgba(255,255,255,0.85)";

  // 進場動畫：左邊色塊從畫面左側滑入，右邊色塊從畫面右側滑入，各自只在
  // mount 時跑一次。
  const slideX = useRef(new Animated.Value(isOutlined ? 80 : -80)).current;
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideX, {
        toValue: 0,
        useNativeDriver: true,
        speed: 14,
        bounciness: 6,
      }),
      Animated.timing(fade, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dateBlock = (
    <View style={s.rowDate}>
      <Text style={[s.rowDateText, { color: titleColor }]}>{month}</Text>
      <Text style={[s.rowDateText, { color: titleColor }]}>{day}</Text>
    </View>
  );

  const contentBlock = (
    <View style={s.rowContent}>
      <Text style={[s.rowTitle, { color: titleColor }]} numberOfLines={1}>
        {h.note ?? (h.delta >= 0 ? "新增" : "調整")}
      </Text>
      <Text style={[s.rowDelta, { color: deltaColor }]}>{formatDelta(h.delta)}</Text>
      <Text style={[s.rowMeta, { color: metaColor }]}>餘額 {formatCurrency(h.balance)}</Text>
      {hasUnits && (
        <Text style={[s.rowMeta, { color: metaColor }]}>{h.units!.toLocaleString()} 股</Text>
      )}
      {recordPnL != null && (
        <Text style={[s.rowMeta, { color: pnlColor(recordPnL) }]}>
          盈虧 {formatDelta(recordPnL)}
        </Text>
      )}
    </View>
  );

  return (
    <Animated.View style={{ opacity: fade, transform: [{ translateX: slideX }] }}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        style={[
          s.historyRow,
          isOutlined
            ? [s.historyRowRight, s.historyRowOutline]
            : [s.historyRowLeft, { backgroundColor: color }, isLightCat && s.historyRowOutline],
        ]}
      >
        {isOutlined ? (
          <>
            {contentBlock}
            {dateBlock}
          </>
        ) : (
          <>
            {dateBlock}
            {contentBlock}
          </>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function EntryDetailScreen() {
  const { isTablet, contentWidth } = useResponsive();
  // modalSheet 沒有自己的 paddingBottom，儲存/取消按鈕直接貼著螢幕底緣。
  const sheetBottomPad = useSheetBottomPadding();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const api = useApi();
  // Stable ref so useCallback deps don't include api (avoids infinite fetch loop)
  const apiRef = useRef(api);
  apiRef.current = api;

  const { deleteEntry, fetchEntryHistory, updateEntry } = useFinanceActions();
  const entry = useFinanceStore((state) => state.entries.find((e) => e.id === id));

  // Served from the store cache, so re-opening this entry paints its records on
  // the first frame; the focus refetch below then refreshes them in place.
  const history =
    useFinanceStore((state) => (id ? state.historyByEntry[id] : undefined)) ?? NO_HISTORY;
  // `currentPrice` is the raw quote in the stock's own currency (shown as-is
  // in the 當日股價 label). `currentPriceTWD` is that price converted to TWD —
  // every P&L number (totalPnL, per-record recordPnL) must use this one,
  // because the cost basis stored in EntryHistory.delta is always TWD. Mixing
  // a native-currency price into a TWD-cost subtraction silently produces
  // garbage for every non-TWD holding (美股/加密貨幣/貴金屬) — 台股 only looked
  // correct because its native currency already is TWD.
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [currentPriceTWD, setCurrentPriceTWD] = useState<number | null>(null);
  // Shown next to 當日股價 so a non-TWD quote (美股/加密貨幣/貴金屬) doesn't
  // read as if it were the TWD amount above it. Null for TWD (台股) — no
  // label needed when the currency already matches the rest of the screen.
  const [currentPriceCurrency, setCurrentPriceCurrency] = useState<string | null>(null);
  // 基金淨值。淨值日跟股價不同，不保證是今天 —— 各投信報價時間不一，境外基金
  // 還會晚上兩三個交易日，所以畫面一定要把日期標出來。
  const [navDate, setNavDate] = useState<string | null>(null);
  const [fundLoading, setFundLoading] = useState(false);
  const [fundPickerOpen, setFundPickerOpen] = useState(false);

  // Edit modal state
  const [editingHistory, setEditingHistory] = useState<EntryHistory | null>(null);
  const [editNote, setEditNote] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editDelta, setEditDelta] = useState("");
  const [editUnits, setEditUnits] = useState("");
  const [editPricePerShare, setEditPricePerShare] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editDeleting, setEditDeleting] = useState(false);
  const [confirmDeleteHistory, setConfirmDeleteHistory] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isStockEntry =
    !!entry && STOCK_PICKER_CATEGORIES.includes(entry.subCategory) && !!entry.stockCode;
  // 基金走的是淨值（不是股價），但成本、市值、損益的算法與股票完全相同，所以
  // 兩者共用底下同一組 currentPrice / P&L 狀態，只有取價來源與標籤不一樣。
  // FUND_NAV_ENABLED 關著時，基金就跟功能沒做過一樣：沒有按鈕、不抓淨值、
  // 金額維持成本價。已經綁好的 stockCode 留在資料裡，開回來立刻可用。
  const isFundEntry = FUND_NAV_ENABLED && !!entry && entry.subCategory === FUND_SUBCATEGORY;
  const hasQuote = isStockEntry || (isFundEntry && !!entry?.stockCode);

  // Rows land in the store, so the selector above picks them up. useFocusRefresh
  // owns the guarding — see that hook for why an unguarded focus refetch could
  // turn into a request-per-frame loop.
  //
  // `history.length` is read through a ref inside `detail`, never captured as a
  // dependency: making the fetcher depend on `history` would give it a new
  // identity on every store write, which is the churn the hook exists to absorb.
  const historyLenRef = useRef(0);
  historyLenRef.current = history.length;
  const { refresh: fetchHistory, loading: historyLoading } = useFocusRefresh(
    () => (id ? fetchEntryHistory(id) : Promise.resolve(null)),
    {
      context: "history.refreshLoop",
      detail: () => ({ entryId: id, cachedRows: historyLenRef.current }),
    }
  );

  // After a history edit/delete the backend recomputes the entry's value to the
  // most-recent record's running balance (0 when none remain). Mirror that into
  // the store so the header total updates immediately, without a full refetch.
  const syncEntryValueFromHistory = useCallback(
    (rows: EntryHistory[]) => {
      const store = useFinanceStore.getState();
      const current = store.entries.find((e) => e.id === id);
      if (!current) return;
      const newValue = rows.length > 0 ? (rows[0]?.balance ?? 0) : 0;
      if (newValue !== current.value) {
        store.updateEntryLocal(current.id, { ...current, value: newValue });
      }
    },
    [id]
  );

  // Stock price fetch — only re-runs when stockCode changes, not on every render
  const stockCode = entry?.stockCode;
  const subCategory = entry?.subCategory;
  // Tracks the initial (and any) quote fetch so the header can show a spinner
  // instead of silently sitting on the cost value until the market price lands.
  const [stockPriceLoading, setStockPriceLoading] = useState(false);
  useEffect(() => {
    if (!isStockEntry || !stockCode || !subCategory) return;
    const yfSymbol = buildYfSymbol(subCategory, stockCode);
    if (!yfSymbol) return;
    let active = true;
    setStockPriceLoading(true);
    (async () => {
      try {
        const data = await apiRef.current.rawGet<{ price: number; currency?: string }>(
          `/api/stocks/price?symbol=${encodeURIComponent(yfSymbol)}`
        );
        if (typeof data.price !== "number") return;
        const currency = data.currency ?? "TWD";
        let rate = 1;
        if (currency !== "TWD") {
          const fx = await apiRef.current
            .rawGet<{
              price: number;
            }>(`/api/stocks/price?symbol=${encodeURIComponent(currency + "TWD=X")}`)
            .catch(() => null);
          rate = fx && typeof fx.price === "number" ? fx.price : 1;
        }
        if (active) {
          setCurrentPrice(data.price);
          setCurrentPriceTWD(data.price * rate);
          setCurrentPriceCurrency(currency !== "TWD" ? currency : null);
        }
      } catch {
        // Keep whatever price was already on screen — a failed refresh
        // shouldn't blank out the P&L.
      } finally {
        if (active) setStockPriceLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [isStockEntry, stockCode, subCategory]); // primitive deps only

  // 基金淨值。與上面的股價 effect 分開寫而不是塞進同一個 if：來源、錯誤語意、
  // 以及「還沒綁代碼」這個只有基金才有的狀態都不一樣，混在一起只會兩邊都難讀。
  const loadFundQuote = useCallback(
    async (code: string) => {
      setFundLoading(true);
      try {
        const quote = await fetchFundQuote(apiRef.current, code);
        let rate = 1;
        if (quote.currency !== "TWD") {
          // 非台幣計價的基金要換算成台幣才能跟 EntryHistory 裡的台幣成本相減，
          // 匯率來源沿用股票那條路徑。
          const fx = await apiRef.current
            .rawGet<{
              price: number;
            }>(`/api/stocks/price?symbol=${encodeURIComponent(quote.currency + "TWD=X")}`)
            .catch(() => null);
          rate = fx && typeof fx.price === "number" ? fx.price : 1;
        }
        setCurrentPrice(quote.nav);
        setCurrentPriceTWD(quote.nav * rate);
        setCurrentPriceCurrency(quote.currency !== "TWD" ? quote.currency : null);
        setNavDate(quote.navDate);
      } catch (e) {
        if (isNotFoundError(e)) {
          Alert.alert("查不到淨值", "這檔基金的代碼可能已經失效，請重新選擇基金。");
        } else if (isNetworkError(e)) {
          reportNetworkError("fund.quote");
        } else {
          reportUnexpectedError(e, "fund.quote");
        }
      } finally {
        setFundLoading(false);
      }
    },
    [] // apiRef 是穩定的 ref
  );

  // 已經綁過代碼的基金，一進畫面就把最新淨值抓回來，不用使用者再按一次。
  useEffect(() => {
    if (!isFundEntry || !stockCode) return;
    void loadFundQuote(stockCode);
  }, [isFundEntry, stockCode, loadFundQuote]);

  /** 從搜尋結果選定一檔基金：把官方代碼寫回 entry，之後都直接用代碼查。 */
  async function handleFundSelected(fund: FundSearchResult) {
    setFundPickerOpen(false);
    if (!id) return;
    try {
      await updateEntry(id, { stockCode: fund.code });
      await loadFundQuote(fund.code);
    } catch (e) {
      if (isNetworkError(e)) reportNetworkError("fund.bind");
      else reportUnexpectedError(e, "fund.bind");
    }
  }

  // P&L — memoized on `history` (a stable store reference) so typing in the edit
  // modal doesn't re-walk every record on each keystroke.
  const { totalUnits, totalCost } = useMemo(() => {
    const investmentRecords = history.filter((h) => h.units != null && h.units > 0);
    return {
      totalUnits: investmentRecords.reduce((sum, h) => sum + (h.units ?? 0), 0),
      totalCost: investmentRecords.reduce((sum, h) => sum + h.delta, 0),
    };
  }, [history]);
  const currentMarketValue = currentPriceTWD != null ? totalUnits * currentPriceTWD : null;
  const totalPnL = currentMarketValue != null ? currentMarketValue - totalCost : null;
  const totalPnLPct = totalCost > 0 && totalPnL != null ? (totalPnL / totalCost) * 100 : null;

  // Rebuilding every month-group on each modal keystroke re-rendered the whole list.
  const historyGroups = useMemo(() => groupHistoryByMonth(history), [history]);

  function openEdit(h: EntryHistory) {
    setEditNote(h.note ?? "");
    setEditDate(h.createdAt.split("T")[0] ?? "");
    // 變動金額 is integer-only — round away any stored decimal remainder.
    setEditDelta(toIntegerDigits(String(Math.round(h.delta))));
    setEditUnits(h.units != null ? String(h.units) : "");
    setEditPricePerShare(h.pricePerShare != null ? String(h.pricePerShare) : "");
    setConfirmDeleteHistory(false);
    setEditingHistory(h);
  }

  async function handleSave() {
    if (!editingHistory || !id) return;
    if (!editDate || !editDelta || isNaN(parseInt(editDelta, 10))) return;
    setEditSaving(true);
    try {
      await apiRef.current.patch(`/api/entries/${id}/history/${editingHistory.id}`, {
        note: editNote.trim() || null,
        createdAt: editDate,
        delta: parseInt(editDelta, 10),
        units: editUnits !== "" ? parseFloat(editUnits) : null,
        pricePerShare: editPricePerShare !== "" ? parseFloat(editPricePerShare) : null,
      });
      setEditingHistory(null);
      const rows = await fetchHistory({ force: true });
      if (rows) syncEntryValueFromHistory(rows);
    } catch (e) {
      if (isNotFoundError(e)) {
        // Record was already deleted elsewhere — close the modal and resync.
        setEditingHistory(null);
        const rows = await fetchHistory({ force: true });
        if (rows) syncEntryValueFromHistory(rows);
      } else if (isNetworkError(e)) {
        // Interrupted (e.g. app backgrounded mid-save). Keep the modal open so
        // the edit isn't lost — the user can just tap 儲存 again.
        reportNetworkError("history.save");
      } else {
        reportUnexpectedError(e, "history.save");
      }
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDeleteHistoryRecord() {
    if (!editingHistory || !id) return;
    setEditDeleting(true);
    try {
      await apiRef.current.delete(`/api/entries/${id}/history/${editingHistory.id}`);
      setEditingHistory(null);
      const rows = await fetchHistory({ force: true });
      if (rows) syncEntryValueFromHistory(rows);
    } catch (e) {
      if (isNotFoundError(e)) {
        setEditingHistory(null);
        const rows = await fetchHistory({ force: true });
        if (rows) syncEntryValueFromHistory(rows);
      } else if (isNetworkError(e)) {
        // Keep the modal open so the user can retry the delete.
        reportNetworkError("history.delete");
      } else {
        reportUnexpectedError(e, "history.delete");
      }
    } finally {
      setEditDeleting(false);
    }
  }

  function confirmDeleteEntry() {
    if (!entry || isDeleting) return;
    Alert.alert("刪除項目", `確定要刪除「${entry.name}」？此操作無法復原。`, [
      { text: "取消", style: "cancel" },
      {
        text: "刪除",
        style: "destructive",
        onPress: async () => {
          setIsDeleting(true);
          try {
            // `deleteEntry` already treats 404 (already gone) as success.
            await deleteEntry(id!);
            router.back();
          } catch (e) {
            reportUnexpectedError(e, "entry.delete");
          } finally {
            setIsDeleting(false);
          }
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
  const categoryTextColor = getCategoryTextColor(entry.topCategory);
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
            {TRANSFER_TOP_CATEGORIES.includes(entry.topCategory) && (
              <TouchableOpacity
                onPress={() => router.push(`/entry/${id}/transfer`)}
                style={s.iconBtn}
              >
                <ArrowLeftRight size={16} color="#1c1c1e" />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => router.push(`/entry/${id}/edit`)} style={s.iconBtn}>
              <Pencil size={16} color="#1c1c1e" />
            </TouchableOpacity>
            <TouchableOpacity onPress={confirmDeleteEntry} style={s.iconBtn} disabled={isDeleting}>
              {isDeleting ? (
                <ActivityIndicator size="small" color="#ff3b30" />
              ) : (
                <Trash2 size={16} color="#ff3b30" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          { paddingBottom: 40 },
          isTablet && { width: contentWidth, alignSelf: "center" },
        ]}
      >
        {/* Entry info */}
        <View style={s.infoSection}>
          <View style={s.titleRow}>
            {/* A chosen bank icon (金融卡) leads the title when set. */}
            {entry.bankCode && <BankLogo code={entry.bankCode} name={entry.name} size={20} />}
            <Text style={s.entryName}>{entry.name}</Text>
            <View style={[s.badge, { backgroundColor: isWhiteCat ? "#1c1c1e" : color + "20" }]}>
              <Text style={[s.badgeText, { color: isWhiteCat ? "#ffffff" : color }]}>
                {entry.subCategory}
              </Text>
            </View>
            {entry.stockCode && (
              <View style={s.badgeNeutral}>
                <Text style={s.badgeNeutralText}>{entry.stockCode}</Text>
              </View>
            )}
          </View>
          <View style={s.valueRow}>
            <Text style={s.entryValue}>
              {formatValueDigits(
                hasQuote && currentMarketValue != null ? currentMarketValue : entry.value
              )}
            </Text>
            <Text style={s.currencyLabel}>NT$</Text>
          </View>
          {/* 市值還在抓（股票/基金報價未到）時給一個提示，別讓成本價安靜地
              停在畫面上看起來像是最終數字。 */}
          {hasQuote &&
            currentMarketValue == null &&
            (isFundEntry ? fundLoading : stockPriceLoading) && (
              <View style={s.quoteLoadingRow}>
                <ActivityIndicator size="small" color="#8e8e93" />
                <Text style={s.quoteLoadingText}>更新市值中…</Text>
              </View>
            )}
          {hasQuote && currentMarketValue != null && (
            <Text style={s.costLabel}>成本 {formatCurrency(entry.value)}</Text>
          )}
          {hasQuote && currentPrice != null && (
            <View style={s.pnlRow}>
              <Text style={s.priceLabel}>
                {isFundEntry ? `淨值 (${navDate ? formatNavDate(navDate) : "—"})` : "當日股價"}{" "}
                {currentPriceCurrency ? `${currentPriceCurrency} ` : ""}
                {currentPrice.toLocaleString("zh-TW", { maximumFractionDigits: 4 })}
              </Text>
              {totalPnL != null && (
                <Text style={[s.pnlText, { color: pnlColor(totalPnL) }]}>
                  {formatDelta(totalPnL)}
                  {totalPnLPct != null
                    ? ` (${totalPnL >= 0 ? "+" : ""}${totalPnLPct.toFixed(2)}%)`
                    : ""}
                </Text>
              )}
            </View>
          )}
          {isFundEntry && (
            <Pressable
              onPress={() =>
                entry.stockCode ? void loadFundQuote(entry.stockCode) : setFundPickerOpen(true)
              }
              disabled={fundLoading}
              style={({ pressed }) => [
                s.navButton,
                { opacity: fundLoading ? 0.6 : pressed ? 0.85 : 1 },
              ]}
            >
              {fundLoading ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={s.navButtonLabel}>{entry.stockCode ? "更新淨值" : "獲取淨值"}</Text>
              )}
            </Pressable>
          )}
          {/* 綁錯基金是使用者自己看得出來的（名稱對不上），所以留一個換一檔的
              入口，不用回編輯頁重打名稱。 */}
          {isFundEntry && entry.stockCode ? (
            <Pressable onPress={() => setFundPickerOpen(true)} hitSlop={8}>
              <Text style={s.navRebind}>重新選擇基金</Text>
            </Pressable>
          ) : null}
        </View>

        {isStockEntry && entry.stockCode && (
          <DividendSection
            entryId={entry.id}
            entryName={entry.name}
            subCategory={entry.subCategory}
            stockCode={entry.stockCode}
            currentShares={history.reduce((sum, h) => sum + (h.units ?? 0), 0) || null}
            costBasis={history.reduce((sum, h) => sum + h.delta, 0)}
            color={color}
            categoryTextColor={categoryTextColor}
          />
        )}

        {/* History */}
        <View style={s.historySection}>
          <Text style={s.historySectionTitle}>交易記錄</Text>
          {/* Show cached records while a background refetch runs; only show the
              loading text on the very first load when nothing is cached yet. */}
          {historyLoading && history.length === 0 ? (
            <Text style={s.historyEmpty}>載入中...</Text>
          ) : history.length === 0 ? (
            <Text style={s.historyEmpty}>尚無記錄</Text>
          ) : (
            historyGroups.map((group) => (
              <View key={group.key} style={s.historyGroup}>
                <Text style={s.historyGroupLabel}>{group.key}</Text>
                <View style={s.historyList}>
                  {group.rows.map((h, i) => (
                    <HistoryRow
                      key={h.id}
                      h={h}
                      isLiability={isLiability}
                      currentPrice={currentPriceTWD}
                      onPress={() => openEdit(h)}
                      index={i}
                      color={color}
                      categoryTextColor={categoryTextColor}
                    />
                  ))}
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <FundPickerSheet
        visible={fundPickerOpen}
        initialQuery={entry.name}
        onClose={() => setFundPickerOpen(false)}
        onSelect={(fund) => void handleFundSelected(fund)}
      />

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
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setEditingHistory(null)} />

          {/* Sheet — rendered on top of backdrop */}
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}>
            <View style={[s.modalSheet, { paddingBottom: sheetBottomPad }]}>
              <View style={s.modalHandle} />
              <Text style={s.modalTitle}>編輯記錄</Text>

              <View style={s.formCard}>
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
                    value={formatThousands(editDelta)}
                    onChangeText={(t) => setEditDelta(toIntegerDigits(t))}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor="#c7c7cc"
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
                    <View style={s.formDivider} />
                    <View style={s.formRow}>
                      <Text style={s.formLabel}>單股成交價</Text>
                      <TextInput
                        value={editPricePerShare}
                        onChangeText={setEditPricePerShare}
                        keyboardType="decimal-pad"
                        placeholder="0"
                        placeholderTextColor="#c7c7cc"
                        style={s.formInput}
                      />
                    </View>
                  </>
                )}
                <View style={s.formRow}>
                  <Text style={s.formLabel}>備註</Text>
                  <TextInput
                    value={editNote}
                    onChangeText={setEditNote}
                    placeholder="選填（最多 10 字）"
                    placeholderTextColor="#c7c7cc"
                    maxLength={10}
                    style={s.formInput}
                  />
                </View>
              </View>

              <View style={s.modalBtns}>
                <TouchableOpacity
                  onPress={() => setEditingHistory(null)}
                  disabled={editSaving || editDeleting}
                  style={[s.cancelBtn, (editSaving || editDeleting) && s.disabledBtn]}
                >
                  <Text style={s.cancelBtnText}>取消</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSave}
                  disabled={editSaving || editDeleting}
                  style={[s.saveBtn, (editSaving || editDeleting) && s.disabledBtn]}
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
                  disabled={editSaving || editDeleting}
                  style={[s.deleteOutlineBtn, (editSaving || editDeleting) && s.disabledBtn]}
                >
                  <Trash2 size={16} color="#ff3b30" />
                  <Text style={s.deleteOutlineBtnText}>刪除此記錄</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={handleDeleteHistoryRecord}
                  disabled={editSaving || editDeleting}
                  style={[s.deleteFilledBtn, (editSaving || editDeleting) && s.disabledBtn]}
                >
                  {editDeleting ? (
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
  navButton: {
    alignSelf: "stretch",
    marginTop: 16,
    backgroundColor: "#374254",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  navButtonLabel: { color: "#ffffff", fontSize: 15, fontWeight: "700" },
  navRebind: {
    marginTop: 10,
    textAlign: "center",
    fontSize: 13,
    color: "#8e8e93",
    textDecorationLine: "underline",
  },
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
    alignItems: "center",
    justifyContent: "center",
  },

  infoSection: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24, alignItems: "center" },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  entryName: { fontSize: 17, fontWeight: "600", color: "#1c1c1e" },
  badge: { borderRadius: 100, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontSize: 12, fontWeight: "600" },
  badgeNeutral: {
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 3,
    backgroundColor: "#f2f2f7",
  },
  badgeNeutralText: { fontSize: 12, fontWeight: "600", color: "#8e8e93" },
  valueRow: { flexDirection: "row", alignItems: "flex-end", gap: 4 },
  entryValue: { fontSize: 48, fontWeight: "800", color: "#1c1c1e", letterSpacing: -1 },
  currencyLabel: { fontSize: 15, fontWeight: "600", color: "#8e8e93", marginBottom: 8 },
  quoteLoadingRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  quoteLoadingText: { fontSize: 13, color: "#8e8e93" },
  costLabel: { fontSize: 13, color: "#8e8e93", marginTop: 2, textAlign: "center" },
  pnlRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    marginTop: 8,
  },
  priceLabel: { fontSize: 13, color: "#8e8e93" },
  pnlText: { fontSize: 14, fontWeight: "600" },

  historySection: { paddingHorizontal: 0 },
  historySectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1c1c1e",
    textAlign: "center",
    marginTop: 24,
    marginBottom: 24,
  },
  historyGroup: { marginBottom: 16 },
  historyGroupLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#8e8e93",
    marginBottom: 6,
    paddingHorizontal: 20,
  },
  historyEmpty: { textAlign: "center", fontSize: 14, color: "#c7c7cc", paddingVertical: 32 },
  historyList: { gap: 0 },
  historyRow: {
    width: "78%",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  historyRowLeft: {
    alignSelf: "flex-start",
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
  },
  historyRowRight: {
    alignSelf: "flex-end",
    justifyContent: "space-between",
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  historyRowOutline: {
    backgroundColor: "#ffffff",
  },
  rowDate: { alignItems: "center", minWidth: 34 },
  rowDateText: { fontSize: 20, fontWeight: "700", lineHeight: 24 },
  rowContent: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 14, fontWeight: "500" },
  rowDelta: { fontSize: 14, fontWeight: "600", marginTop: 2 },
  rowMeta: { fontSize: 12, marginTop: 2 },

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
