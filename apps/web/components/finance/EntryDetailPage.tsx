"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Pencil, Trash2, Plus, ArrowLeftRight } from "lucide-react";
import { motion } from "motion/react";
import type { Entry, EntryHistory } from "@repo/shared";
import { TRANSFER_TOP_CATEGORIES } from "@repo/shared";
import { Spinner } from "../ui/Spinner";
import { BottomSheet } from "../ui/BottomSheet";
import { ConfirmSheet, NoticeSheet } from "../ui/ConfirmSheet";
import { DateField } from "../ui/DatePickerSheet";
import { BankLogo } from "../ui/BankLogo";
import { useFinanceStore } from "../../store/useFinanceStore";
import { formatCurrency, formatThousands, toIntegerDigits } from "../../lib/format";
import { buildYfSymbol, STOCK_CATS } from "../../lib/stockSymbol";
import { fetchTwdQuote } from "../../lib/twdQuote";
import { CATEGORIES } from "./categoryConfig";
import { TransferEntryPage } from "./TransferEntryPage";
import { DividendSection } from "./DividendSection";

// Web port of apps/mobile/app/(app)/entry/[id].tsx.

interface Props {
  open: boolean;
  /** The entry is read live from the store, so edits elsewhere show up here. */
  entryId: string | null;
  onClose: () => void;
  /** "+" — append a record to this entry (add-record mode of the entry form). */
  onAddRecord: (entry: Entry) => void;
  /** ✏️ — edit the entry's basic info. */
  onEdit: (entry: Entry) => void;
  onDelete: (id: string) => Promise<void>;
}

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
// formatCurrency prefixes "NT$" — split it off so the header can render it as
// a small corner label instead of inline.
function formatValueDigits(amount: number) {
  return formatCurrency(amount).replace(/^[^\d-]+/, "");
}
function monthGroupLabel(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}年${d.getMonth() + 1}月`;
}
// Group history rows (already newest-first) into year-month sections.
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

// ─── History Row ─────────────────────────────────────────────────────────────

// Rows alternate sides within each month: even → solid block in the category
// colour flush left, odd → white block flush right (the zig-zag layout).
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
  // Light categories already carry a dark text colour — reuse it, or the text
  // disappears against the light block.
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

  const dateBlock = (
    <div className="flex min-w-[34px] flex-col items-center">
      <span className="text-[20px] leading-6 font-bold" style={{ color: titleColor }}>
        {month}
      </span>
      <span className="text-[20px] leading-6 font-bold" style={{ color: titleColor }}>
        {day}
      </span>
    </div>
  );

  const contentBlock = (
    <div className="min-w-0 flex-1">
      <p className="truncate text-[14px] font-medium" style={{ color: titleColor }}>
        {h.note ?? (h.delta >= 0 ? "新增" : "調整")}
      </p>
      <p className="mt-0.5 text-[14px] font-semibold" style={{ color: deltaColor }}>
        {formatDelta(h.delta)}
      </p>
      <p className="mt-0.5 text-[12px]" style={{ color: metaColor }}>
        餘額 {formatCurrency(h.balance)}
      </p>
      {hasUnits && (
        <p className="mt-0.5 text-[12px]" style={{ color: metaColor }}>
          {h.units!.toLocaleString()} 股
        </p>
      )}
      {recordPnL != null && (
        <p className="mt-0.5 text-[12px]" style={{ color: pnlColor(recordPnL) }}>
          盈虧 {formatDelta(recordPnL)}
        </p>
      )}
    </div>
  );

  return (
    // Entrance (once, on mount): left cards slide in from the left, right
    // cards from the right, fading in.
    <motion.div
      initial={{ x: isOutlined ? 80 : -80, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{
        x: { type: "spring", stiffness: 300, damping: 20 },
        opacity: { duration: 0.22 },
      }}
      className={isOutlined ? "flex justify-end" : "flex justify-start"}
    >
      <button
        type="button"
        onClick={onPress}
        data-testid={`history-row-${h.id}`}
        className={`flex w-[78%] cursor-pointer items-center gap-3.5 px-4 py-3.5 text-left transition-opacity active:opacity-70 ${
          isOutlined ? "justify-between rounded-l-2xl bg-white" : "rounded-r-2xl"
        }`}
        style={isOutlined ? undefined : { backgroundColor: isLightCat ? "#ffffff" : color }}
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
      </button>
    </motion.div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

export function EntryDetailPage({ open, entryId, onClose, onAddRecord, onEdit, onDelete }: Props) {
  const entry = useFinanceStore((s) =>
    entryId ? s.entries.find((e) => e.id === entryId) : undefined
  );
  const refreshEntries = useFinanceStore((s) => s.refreshEntries);

  const [history, setHistory] = useState<EntryHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  // `currentPrice` is the quote in its own currency (display only);
  // `currentPriceTWD` is what every market-value / P&L number must use, because
  // the cost basis in EntryHistory.delta is TWD.
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [currentPriceTWD, setCurrentPriceTWD] = useState<number | null>(null);
  const [currentPriceCurrency, setCurrentPriceCurrency] = useState<string | null>(null);
  const [stockPriceLoading, setStockPriceLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [notice, setNotice] = useState<{ title: string; message: string } | null>(null);

  // Edit sheet state — `editingHistory` stays set through the exit animation.
  const [editingHistory, setEditingHistory] = useState<EntryHistory | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editNote, setEditNote] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editDelta, setEditDelta] = useState("");
  const [editUnits, setEditUnits] = useState("");
  const [editPricePerShare, setEditPricePerShare] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editDeleting, setEditDeleting] = useState(false);
  const [confirmDeleteHistory, setConfirmDeleteHistory] = useState(false);

  const isStockEntry =
    !!entry && STOCK_PICKER_CATEGORIES.includes(entry.subCategory) && !!entry.stockCode;

  // Only the latest history request may write (switching entries quickly).
  const historyToken = useRef(0);
  const isGuest = useFinanceStore((s) => s.isGuest);
  const fetchHistory = useCallback(async (): Promise<EntryHistory[] | null> => {
    if (!entryId) return null;
    // Guests browse static demo data — there is no server history.
    if (isGuest) {
      setHistory([]);
      return [];
    }
    const token = ++historyToken.current;
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/entries/${entryId}/history`);
      const json = await res.json();
      if (token !== historyToken.current || !json.success) return null;
      setHistory(json.data);
      return json.data as EntryHistory[];
    } catch {
      return null;
    } finally {
      if (token === historyToken.current) setHistoryLoading(false);
    }
  }, [entryId, isGuest]);

  // After a history edit/delete the backend recomputes the entry's value, so
  // refetch both the records and the entry list (header total + card totals).
  const resync = useCallback(async () => {
    await Promise.all([fetchHistory(), refreshEntries().catch(() => {})]);
  }, [fetchHistory, refreshEntries]);

  useEffect(() => {
    if (!open || !entryId) return;
    setHistory([]);
    setCurrentPrice(null);
    setCurrentPriceTWD(null);
    setCurrentPriceCurrency(null);
    void fetchHistory();
  }, [open, entryId, fetchHistory]);

  // Quote — only re-runs when the stock changes, not on every entry update.
  const stockCode = entry?.stockCode;
  const subCategory = entry?.subCategory;
  useEffect(() => {
    if (!open || !isStockEntry || !stockCode || !subCategory) return;
    const yfSymbol = buildYfSymbol(subCategory, stockCode);
    if (!yfSymbol) return;
    let active = true;
    setStockPriceLoading(true);
    fetchTwdQuote(yfSymbol)
      .then((quote) => {
        // 報價或匯率拿不到就不顯示市值，退回成本 —— 不能拿原幣價當台幣用。
        if (!active || !quote) return;
        setCurrentPrice(quote.price);
        setCurrentPriceTWD(quote.price * quote.rate);
        setCurrentPriceCurrency(quote.currency !== "TWD" ? quote.currency : null);
      })
      .finally(() => {
        if (active) setStockPriceLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, isStockEntry, stockCode, subCategory]);

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
    setEditOpen(true);
  }

  // A 404 means the record was already removed elsewhere (a double click, a
  // concurrent delete) — close quietly and resync instead of alarming.
  async function runHistoryMutation(req: () => Promise<Response>) {
    try {
      const res = await req();
      if (res.ok || res.status === 404) {
        setEditOpen(false);
        await resync();
        return;
      }
      const json = await res.json().catch(() => null);
      setNotice({ title: "操作失敗", message: json?.error?.message ?? "請重試" });
    } catch {
      // Network interrupted — keep the sheet open so the edit isn't lost.
      setNotice({ title: "網路連線中斷", message: "儲存未完成，請確認網路後再試一次。" });
    }
  }

  async function handleSave() {
    if (!editingHistory || !entryId) return;
    if (!editDate || !editDelta || isNaN(parseInt(editDelta, 10))) return;
    setEditSaving(true);
    try {
      await runHistoryMutation(() =>
        fetch(`/api/entries/${entryId}/history/${editingHistory.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            note: editNote.trim() || null,
            createdAt: editDate,
            delta: parseInt(editDelta, 10),
            units: editUnits !== "" ? parseFloat(editUnits) : null,
            pricePerShare: editPricePerShare !== "" ? parseFloat(editPricePerShare) : null,
          }),
        })
      );
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDeleteHistoryRecord() {
    if (!editingHistory || !entryId) return;
    setEditDeleting(true);
    try {
      await runHistoryMutation(() =>
        fetch(`/api/entries/${entryId}/history/${editingHistory.id}`, { method: "DELETE" })
      );
    } finally {
      setEditDeleting(false);
    }
  }

  async function handleDeleteEntry() {
    if (!entry) return;
    setIsDeleting(true);
    try {
      await onDelete(entry.id);
      setShowDeleteConfirm(false);
    } catch (e) {
      setShowDeleteConfirm(false);
      setNotice({ title: "操作失敗", message: e instanceof Error ? e.message : "請重試" });
    } finally {
      setIsDeleting(false);
    }
  }

  const busy = editSaving || editDeleting;
  const color = entry ? getCategoryColor(entry.topCategory) : "#374254";
  const categoryTextColor = entry ? getCategoryTextColor(entry.topCategory) : "#ffffff";
  const isLiability = entry?.topCategory === "負債";
  const isWhiteCat = color.toUpperCase() === "#FFFFFF";

  return (
    <div
      className={`fixed inset-0 z-[60] overflow-y-auto bg-[#f2f2f7] transition-transform duration-300 ease-in-out ${
        open ? "translate-x-0" : "pointer-events-none translate-x-full"
      }`}
      aria-hidden={!open}
    >
      {entry && (
        <div className="mx-auto flex min-h-full max-w-md flex-col pb-10 md:max-w-xl lg:max-w-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-12 pb-3">
            <button
              onClick={onClose}
              aria-label="返回"
              className="flex h-10 w-10 cursor-pointer items-center justify-center active:opacity-60"
            >
              <ArrowLeft size={18} className="text-[#1c1c1e]" />
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onAddRecord(entry)}
                aria-label="新增記錄"
                className="flex h-10 w-10 cursor-pointer items-center justify-center active:opacity-60"
              >
                <Plus size={18} className="text-[#1c1c1e]" />
              </button>
              {TRANSFER_TOP_CATEGORIES.includes(entry.topCategory) && (
                <button
                  onClick={() => setShowTransfer(true)}
                  aria-label="轉帳"
                  className="flex h-10 w-10 cursor-pointer items-center justify-center active:opacity-60"
                >
                  <ArrowLeftRight size={16} className="text-[#1c1c1e]" />
                </button>
              )}
              <button
                onClick={() => onEdit(entry)}
                aria-label="編輯"
                className="flex h-10 w-10 cursor-pointer items-center justify-center active:opacity-60"
              >
                <Pencil size={16} className="text-[#1c1c1e]" />
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isDeleting}
                aria-label="刪除"
                className="flex h-10 w-10 cursor-pointer items-center justify-center text-[#ff3b30] active:opacity-60"
              >
                {isDeleting ? <Spinner size={16} /> : <Trash2 size={16} />}
              </button>
            </div>
          </div>

          {/* Entry info */}
          <div className="flex flex-col items-center px-5 pt-4 pb-6">
            <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
              {entry.bankCode && <BankLogo code={entry.bankCode} name={entry.name} size={20} />}
              <p className="text-[17px] font-semibold text-[#1c1c1e]">{entry.name}</p>
              <span
                className="rounded-full px-2.5 py-[3px] text-[12px] font-semibold"
                style={{
                  backgroundColor: isWhiteCat ? "#1c1c1e" : color + "20",
                  color: isWhiteCat ? "#ffffff" : color,
                }}
              >
                {entry.subCategory}
              </span>
              {entry.stockCode && (
                <span className="rounded-full bg-[#e5e5ea] px-2.5 py-[3px] text-[12px] font-semibold text-[#8e8e93]">
                  {entry.stockCode}
                </span>
              )}
            </div>
            <div className="flex items-end gap-1">
              <p
                className="text-[48px] leading-none font-extrabold tracking-[-1px] text-[#1c1c1e]"
                data-testid="entry-value"
              >
                {formatValueDigits(
                  isStockEntry && currentMarketValue != null ? currentMarketValue : entry.value
                )}
              </p>
              <span className="mb-1 text-[15px] font-semibold text-[#8e8e93]">NT$</span>
            </div>
            {isStockEntry && currentMarketValue == null && stockPriceLoading && (
              <div className="mt-1 flex items-center gap-1.5 text-[#8e8e93]">
                <Spinner size={13} />
                <span className="text-[13px]">更新市值中…</span>
              </div>
            )}
            {isStockEntry && currentMarketValue != null && (
              <p className="mt-0.5 text-center text-[13px] text-[#8e8e93]">
                成本 {formatCurrency(entry.value)}
              </p>
            )}
            {isStockEntry && currentPrice != null && (
              <div className="mt-2 flex items-center justify-center gap-4">
                <p className="text-[13px] text-[#8e8e93]">
                  當日股價 {currentPriceCurrency ? `${currentPriceCurrency} ` : ""}
                  {currentPrice.toLocaleString("zh-TW", { maximumFractionDigits: 4 })}
                </p>
                {totalPnL != null && (
                  <p className="text-[14px] font-semibold" style={{ color: pnlColor(totalPnL) }}>
                    {formatDelta(totalPnL)}
                    {totalPnLPct != null
                      ? ` (${totalPnL >= 0 ? "+" : ""}${totalPnLPct.toFixed(2)}%)`
                      : ""}
                  </p>
                )}
              </div>
            )}
          </div>

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
              onChanged={() => void resync()}
            />
          )}

          {/* History */}
          <div>
            <p className="mt-6 mb-6 text-center text-[15px] font-semibold text-[#1c1c1e]">
              交易記錄
            </p>
            {historyLoading && history.length === 0 ? (
              <p className="py-8 text-center text-[14px] text-[#c7c7cc]">載入中...</p>
            ) : history.length === 0 ? (
              <p className="py-8 text-center text-[14px] text-[#c7c7cc]">尚無記錄</p>
            ) : (
              historyGroups.map((group) => (
                <div key={group.key} className="mb-4">
                  <p className="mb-1.5 px-5 text-[12px] font-semibold text-[#8e8e93]">
                    {group.key}
                  </p>
                  <div>
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
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <ConfirmSheet
        open={showDeleteConfirm}
        title="刪除項目"
        message={entry ? `確定要刪除「${entry.name}」？此操作無法復原。` : ""}
        busy={isDeleting}
        onConfirm={() => void handleDeleteEntry()}
        onClose={() => setShowDeleteConfirm(false)}
      />

      {/* Edit history */}
      <BottomSheet
        open={editOpen}
        onClose={() => {
          if (!busy) setEditOpen(false);
        }}
        onClosed={() => setEditingHistory(null)}
        dismissOnBackdrop={!busy}
        panelClassName="px-5 pt-3 pb-6"
        label="編輯記錄"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#e5e5ea]" />
        <p className="mb-5 text-center text-[16px] font-semibold text-[#1c1c1e]">編輯記錄</p>

        <div className="overflow-hidden rounded-2xl bg-[#f2f2f7]">
          <div className="flex items-center justify-between px-4 py-3">
            <p className="text-[15px] text-[#1c1c1e]">日期</p>
            <DateField value={editDate} onChange={setEditDate} ariaLabel="日期" />
          </div>
          <div className="mx-4 h-px bg-white/70" />
          <label className="flex items-center justify-between px-4 py-3">
            <span className="text-[15px] text-[#1c1c1e]">變動金額</span>
            <input
              type="text"
              inputMode="numeric"
              value={formatThousands(editDelta)}
              onChange={(e) => setEditDelta(toIntegerDigits(e.target.value))}
              placeholder="0"
              aria-label="變動金額"
              className="ml-4 min-w-0 flex-1 bg-transparent text-right text-[15px] font-semibold text-[#1c1c1e] outline-none placeholder:text-[#c7c7cc]"
            />
          </label>
          {isStockEntry && (
            <>
              <div className="mx-4 h-px bg-white/70" />
              <label className="flex items-center justify-between px-4 py-3">
                <span className="text-[15px] text-[#1c1c1e]">持有股數</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={editUnits}
                  onChange={(e) => setEditUnits(e.target.value.replace(/[^\d.]/g, ""))}
                  placeholder="0"
                  aria-label="持有股數"
                  className="ml-4 min-w-0 flex-1 bg-transparent text-right text-[15px] text-[#1c1c1e] outline-none placeholder:text-[#c7c7cc]"
                />
              </label>
              <div className="mx-4 h-px bg-white/70" />
              <label className="flex items-center justify-between px-4 py-3">
                <span className="text-[15px] text-[#1c1c1e]">單股成交價</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={editPricePerShare}
                  onChange={(e) => setEditPricePerShare(e.target.value.replace(/[^\d.]/g, ""))}
                  placeholder="0"
                  aria-label="單股成交價"
                  className="ml-4 min-w-0 flex-1 bg-transparent text-right text-[15px] text-[#1c1c1e] outline-none placeholder:text-[#c7c7cc]"
                />
              </label>
            </>
          )}
          <div className="mx-4 h-px bg-white/70" />
          <label className="flex items-center justify-between px-4 py-3">
            <span className="text-[15px] text-[#1c1c1e]">備註</span>
            <input
              type="text"
              value={editNote}
              onChange={(e) => setEditNote(e.target.value)}
              placeholder="選填（最多 10 字）"
              maxLength={10}
              aria-label="備註"
              className="ml-4 min-w-0 flex-1 bg-transparent text-right text-[15px] text-[#1c1c1e] outline-none placeholder:text-[#c7c7cc]"
            />
          </label>
        </div>

        <div className="mt-4 flex gap-3">
          <button
            onClick={() => setEditOpen(false)}
            disabled={busy}
            className="flex-1 cursor-pointer rounded-full border border-[#e5e5ea] py-3 text-[15px] font-semibold text-[#1c1c1e] active:bg-[#f2f2f7] disabled:opacity-40"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={busy}
            className="flex flex-1 cursor-pointer items-center justify-center rounded-full bg-[#1c1c1e] py-3 text-[15px] font-semibold text-white active:opacity-80 disabled:opacity-40"
          >
            {editSaving ? <Spinner size={16} /> : "儲存"}
          </button>
        </div>

        {!confirmDeleteHistory ? (
          <button
            onClick={() => setConfirmDeleteHistory(true)}
            disabled={busy}
            className="mt-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-[#ff3b30] py-3 text-[15px] font-semibold text-[#ff3b30] active:bg-[#fff2f1] disabled:opacity-40"
          >
            <Trash2 size={16} />
            刪除此記錄
          </button>
        ) : (
          <button
            onClick={handleDeleteHistoryRecord}
            disabled={busy}
            className="mt-3 flex w-full cursor-pointer items-center justify-center rounded-full bg-[#ff3b30] py-3 text-[15px] font-semibold text-white active:opacity-80 disabled:opacity-40"
          >
            {editDeleting ? <Spinner size={16} /> : "確認刪除"}
          </button>
        )}
      </BottomSheet>

      <NoticeSheet
        open={notice !== null}
        title={notice?.title ?? ""}
        message={notice?.message ?? ""}
        onClose={() => setNotice(null)}
      />

      {entry && (
        <TransferEntryPage
          open={showTransfer}
          entry={entry}
          onClose={() => setShowTransfer(false)}
          onDone={() => {
            setShowTransfer(false);
            void resync();
          }}
        />
      )}
    </div>
  );
}
