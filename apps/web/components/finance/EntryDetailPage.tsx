"use client";

import { useEffect, useState } from "react";
import { X, Pencil, Trash2 } from "lucide-react";
import { Spinner } from "../ui/Spinner";
import type { Entry, EntryHistory } from "@repo/shared";
import { formatCurrency } from "../../lib/format";
import { CATEGORIES } from "./categoryConfig";

interface Props {
  open: boolean;
  entry: Entry | null;
  onClose: () => void;
  onAddEntry: () => void;
  onAdjust: () => void;
  onEntryUpdated?: () => void;
  onDelete?: (id: string) => Promise<void>;
}

const STOCK_PICKER_CATEGORIES = ["台股", "美股", "加密貨幣", "貴金屬"];
const DIVIDEND_CATEGORIES = ["台股", "美股"];
const METAL_YF_SYMBOL: Record<string, string> = {
  xau: "GC=F",
  xag: "SI=F",
  xap: "PL=F",
  xpd: "PA=F",
};

function getCategoryColor(topCategory: string): string {
  return CATEGORIES.find((c) => c.name === topCategory)?.color ?? "#374254";
}

function formatDelta(delta: number): string {
  const sign = delta >= 0 ? "+" : "";
  return `${sign}${formatCurrency(delta)}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function buildYfSymbol(subCategory: string, stockCode: string): string {
  if (subCategory === "貴金屬") return METAL_YF_SYMBOL[stockCode.toLowerCase()] ?? "";
  const suffix = subCategory === "台股" ? ".TW" : subCategory === "加密貨幣" ? "-USD" : "";
  return stockCode + suffix;
}

export function EntryDetailPage({
  open,
  entry,
  onClose,
  onAddEntry,
  onAdjust,
  onEntryUpdated,
  onDelete,
}: Props) {
  const [history, setHistory] = useState<EntryHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Dividend state
  const [dividendRate, setDividendRate] = useState<number | null>(null);
  const [dividendYield, setDividendYield] = useState<number | null>(null);
  const [dividendExRate, setDividendExRate] = useState(1);
  const [dividendLoading, setDividendLoading] = useState(false);

  // Edit sheet state
  const [editingHistory, setEditingHistory] = useState<EntryHistory | null>(null);
  const [editNote, setEditNote] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editDelta, setEditDelta] = useState("");
  const [editUnits, setEditUnits] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isStockEntry =
    !!entry && STOCK_PICKER_CATEGORIES.includes(entry.subCategory) && !!entry.stockCode;

  useEffect(() => {
    if (!open || !entry) return;

    setHistory([]);
    setCurrentPrice(null);
    setDividendRate(null);
    setDividendYield(null);
    setDividendExRate(1);

    // Fetch history
    setLoading(true);
    fetch(`/api/entries/${entry.id}/history`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setHistory(json.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    // Fetch current price if this is a stock entry
    if (isStockEntry && entry.stockCode) {
      const yfSymbol = buildYfSymbol(entry.subCategory, entry.stockCode);
      if (!yfSymbol) return;
      setPriceLoading(true);
      fetch(`/api/stocks/price?symbol=${encodeURIComponent(yfSymbol)}`)
        .then((r) => r.json())
        .then((data) => {
          if (typeof data.price === "number") setCurrentPrice(data.price as number);
        })
        .catch(() => {})
        .finally(() => setPriceLoading(false));
    }

    // Fetch dividend data for 台股 / 美股 only
    if (entry.stockCode && DIVIDEND_CATEGORIES.includes(entry.subCategory)) {
      const yfSymbol = buildYfSymbol(entry.subCategory, entry.stockCode);
      if (!yfSymbol) return;
      setDividendLoading(true);
      fetch(`/api/stocks/dividend?symbol=${encodeURIComponent(yfSymbol)}`)
        .then((r) => r.json())
        .then(async (data) => {
          setDividendRate(
            typeof data.dividendRate === "number" ? (data.dividendRate as number) : null
          );
          setDividendYield(
            typeof data.dividendYield === "number" ? (data.dividendYield as number) : null
          );
          // For US stocks, fetch USD→TWD exchange rate
          if (entry.subCategory === "美股" && typeof data.dividendRate === "number") {
            try {
              const fxRes = await fetch(
                `/api/stocks/price?symbol=${encodeURIComponent("USDTWD=X")}`
              );
              const fxData = await fxRes.json();
              if (typeof fxData.price === "number") setDividendExRate(fxData.price as number);
            } catch {
              /* keep rate = 1 */
            }
          }
        })
        .catch(() => {})
        .finally(() => setDividendLoading(false));
    }
  }, [open, entry, isStockEntry]);

  function refetchHistory() {
    if (!entry) return;
    fetch(`/api/entries/${entry.id}/history`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setHistory(json.data);
      })
      .catch(() => {});
  }

  function openEditSheet(h: EntryHistory) {
    setEditingHistory(h);
    setEditNote(h.note ?? "");
    setEditDate(h.createdAt.split("T")[0] ?? "");
    setEditDelta(String(h.delta));
    setEditUnits(h.units != null ? String(h.units) : "");
    setEditError(null);
    setConfirmDelete(false);
  }

  async function handleSaveHistory() {
    if (!editingHistory || !entry) return;
    if (!editDate) {
      setEditError("請選擇日期");
      return;
    }
    if (!editDelta || isNaN(parseFloat(editDelta))) {
      setEditError("請輸入有效的變動金額");
      return;
    }
    setEditError(null);
    setEditSaving(true);
    try {
      const body: Record<string, unknown> = {
        note: editNote.trim() || null,
        createdAt: editDate,
        delta: parseFloat(editDelta) || editingHistory.delta,
        units: editUnits !== "" ? parseFloat(editUnits) : null,
      };
      const res = await fetch(`/api/entries/${entry.id}/history/${editingHistory.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setEditingHistory(null);
        refetchHistory();
        onEntryUpdated?.();
      }
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDeleteHistory() {
    if (!editingHistory || !entry) return;
    setEditSaving(true);
    try {
      const res = await fetch(`/api/entries/${entry.id}/history/${editingHistory.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setEditingHistory(null);
        setConfirmDelete(false);
        refetchHistory();
        onEntryUpdated?.();
      }
    } finally {
      setEditSaving(false);
    }
  }

  if (!entry) return null;

  const color = getCategoryColor(entry.topCategory);
  const isLiability = entry.topCategory === "負債";

  // P&L calculations (only for history records that have units)
  const investmentRecords = history.filter((h) => h.units != null && h.units > 0);
  const totalUnits = investmentRecords.reduce((s, h) => s + (h.units ?? 0), 0);
  const totalCost = investmentRecords.reduce((s, h) => s + h.delta, 0);
  const currentMarketValue = currentPrice != null ? totalUnits * currentPrice : null;
  const totalPnL = currentMarketValue != null ? currentMarketValue - totalCost : null;
  const totalPnLPct = totalCost > 0 && totalPnL != null ? (totalPnL / totalCost) * 100 : null;

  return (
    <div
      className={`fixed inset-0 z-[60] bg-[#f2f2f7] transition-transform duration-300 ease-in-out ${
        open ? "translate-x-0" : "pointer-events-none translate-x-full"
      }`}
    >
      <div className="mx-auto flex h-full max-w-md flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-14 pb-4">
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm"
          >
            <X size={18} className="text-[#1c1c1e]" />
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onAdjust}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm"
            >
              <Pencil size={16} className="text-[#1c1c1e]" />
            </button>
            {onDelete && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm"
              >
                <Trash2 size={16} className="text-[#ff3b30]" />
              </button>
            )}
          </div>
        </div>

        {/* Entry info */}
        <div className="px-5 pb-6">
          {/* Icon + name */}
          <div className="mb-4 flex items-center gap-3">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full"
              style={{ backgroundColor: color + "20" }}
            >
              {entry.bankCode ? (
                <>
                  <img
                    src={`/banks/${entry.bankCode}.svg`}
                    alt={entry.name}
                    className="h-full w-full object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                      const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
                      if (fallback) fallback.style.display = "inline";
                    }}
                  />
                  <span className="text-[13px] font-bold" style={{ color, display: "none" }}>
                    {entry.subCategory.slice(0, 2)}
                  </span>
                </>
              ) : (
                <span className="text-[13px] font-bold" style={{ color }}>
                  {entry.subCategory.slice(0, 2)}
                </span>
              )}
            </div>
            <div>
              <p className="text-[17px] font-semibold text-[#1c1c1e]">{entry.name}</p>
              <p className="text-[13px] text-[#8e8e93]">
                {entry.stockCode ? `${entry.stockCode} · ${entry.subCategory}` : entry.subCategory}
              </p>
            </div>
          </div>

          {/* Value */}
          <p className="text-[38px] font-bold tracking-tight text-[#1c1c1e]">
            {formatCurrency(
              isStockEntry && currentMarketValue != null ? currentMarketValue : entry.value
            )}
          </p>
          {isStockEntry && currentMarketValue != null && (
            <p className="mt-0.5 text-[13px] text-[#8e8e93]">成本 {formatCurrency(entry.value)}</p>
          )}

          {/* P&L summary (stocks only) */}
          {isStockEntry && (
            <div className="mt-2 mb-4 flex items-center gap-4">
              {priceLoading ? (
                <p className="text-[13px] text-[#8e8e93]">查詢股價中…</p>
              ) : currentPrice != null ? (
                <>
                  <p className="text-[13px] text-[#8e8e93]">
                    當日股價 {currentPrice.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                  </p>
                  {totalPnL != null && (
                    <p
                      className="text-[14px] font-semibold"
                      style={{ color: totalPnL >= 0 ? "#0e1424" : "#ff3b30" }}
                    >
                      {formatDelta(totalPnL)}
                      {totalPnLPct != null && (
                        <span className="ml-1 text-[12px] font-medium">
                          ({totalPnL >= 0 ? "+" : ""}
                          {totalPnLPct.toFixed(2)}%)
                        </span>
                      )}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-[13px] text-[#8e8e93]">無法取得股價</p>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className={`flex gap-3 ${isStockEntry ? "" : "mt-6"}`}>
            <button
              onClick={onAddEntry}
              className="flex-1 rounded-full border border-[#e5e5ea] bg-white py-3 text-[15px] font-semibold text-[#1c1c1e] shadow-sm active:bg-[#f2f2f7]"
            >
              新增記錄
            </button>
            <button
              onClick={onAdjust}
              className="flex-1 rounded-full bg-[#1c1c1e] py-3 text-[15px] font-semibold text-white active:opacity-80"
            >
              調整金額
            </button>
          </div>
        </div>

        {/* Dividend estimate card — 台股 / 美股 only */}
        {entry.stockCode && DIVIDEND_CATEGORIES.includes(entry.subCategory) && (
          <div className="px-5 pb-4">
            <div className="overflow-hidden rounded-2xl bg-white px-4 py-3 shadow-sm">
              {dividendLoading ? (
                <p className="text-[13px] text-[#8e8e93]">🪙 查詢配息資料中…</p>
              ) : dividendRate !== null && dividendRate > 0 ? (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[13px] font-semibold text-[#1c1c1e]">🪙 預估年配息</p>
                    <p className="mt-0.5 text-[11px] text-[#8e8e93]">
                      {dividendYield !== null && `殖利率 ${(dividendYield * 100).toFixed(2)}%  ·  `}
                      每股 {formatCurrency(dividendRate * dividendExRate)}
                    </p>
                  </div>
                  <p className="text-[18px] font-bold" style={{ color: "#f0a500" }}>
                    {formatCurrency(dividendRate * dividendExRate * totalUnits)}
                  </p>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <p className="text-[13px] font-semibold text-[#1c1c1e]">🪙 預估年配息</p>
                  <p className="text-[13px] text-[#8e8e93]">無配息資料</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* History list */}
        <div className="flex-1 overflow-y-auto px-5">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[13px] font-semibold text-[#1c1c1e]">交易記錄</p>
            <p className="text-[13px] text-[#8e8e93]">變動</p>
          </div>

          {loading ? (
            <p className="py-8 text-center text-sm text-[#8e8e93]">載入中...</p>
          ) : history.length === 0 ? (
            <p className="py-8 text-center text-sm text-[#c7c7cc]">尚無記錄</p>
          ) : (
            <div className="space-y-0 overflow-hidden rounded-2xl bg-white shadow-sm">
              {history.map((h, i) => {
                const hasUnits = h.units != null && h.units > 0;
                const recordPnL =
                  hasUnits && currentPrice != null ? h.units! * currentPrice - h.delta : null;

                return (
                  <div key={h.id}>
                    {i > 0 && <div className="mx-4 h-px bg-[#f2f2f7]" />}
                    <div
                      className="flex cursor-pointer items-start justify-between px-4 py-3 active:bg-[#f2f2f7]"
                      onClick={() => openEditSheet(h)}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-medium text-[#1c1c1e]">
                          {h.note ?? (h.delta >= 0 ? "新增" : "調整")}
                        </p>
                        <p className="mt-0.5 text-[12px] text-[#8e8e93]">
                          {formatDate(h.createdAt)}
                        </p>
                        {hasUnits && (
                          <p className="mt-0.5 text-[12px] text-[#8e8e93]">
                            {h.units!.toLocaleString()} 股
                          </p>
                        )}
                      </div>
                      <div className="ml-4 shrink-0 text-right">
                        <p
                          className="text-[14px] font-semibold"
                          style={{
                            color: h.delta >= 0 ? (isLiability ? "#ff3b30" : "#0e1424") : "#ff3b30",
                          }}
                        >
                          {formatDelta(h.delta)}
                        </p>
                        <p className="mt-0.5 text-[12px] text-[#8e8e93]">
                          餘額 {formatCurrency(h.balance)}
                        </p>
                        {recordPnL != null && (
                          <p
                            className="mt-0.5 text-[12px] font-medium"
                            style={{ color: recordPnL >= 0 ? "#0e1424" : "#ff3b30" }}
                          >
                            盈虧 {formatDelta(recordPnL)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Delete entry confirmation bottom sheet */}
      {showDeleteConfirm && (
        <>
          <div
            className="fixed inset-0 z-[80] bg-black/40"
            onClick={() => setShowDeleteConfirm(false)}
          />
          <div className="fixed inset-x-0 bottom-0 z-[81] mx-auto max-w-md rounded-t-2xl bg-white px-5 pt-4 pb-10">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#e5e5ea]" />
            <p className="mb-2 text-center text-[16px] font-semibold text-[#1c1c1e]">刪除項目</p>
            <p className="mb-6 text-center text-[13px] text-[#8e8e93]">
              確定要刪除「{entry.name}」？此操作無法復原。
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 rounded-full border border-[#e5e5ea] py-3 text-[15px] font-semibold text-[#1c1c1e] active:bg-[#f2f2f7]"
              >
                取消
              </button>
              <button
                onClick={async () => {
                  if (!onDelete) return;
                  setDeleteLoading(true);
                  try {
                    await onDelete(entry.id);
                    setShowDeleteConfirm(false);
                  } finally {
                    setDeleteLoading(false);
                  }
                }}
                disabled={deleteLoading}
                className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[#ff3b30] py-3 text-[15px] font-semibold text-white active:opacity-80 disabled:opacity-40"
              >
                {deleteLoading && <Spinner size={14} />}
                {deleteLoading ? "刪除中..." : "確認刪除"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Edit history bottom sheet */}
      {editingHistory && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[80] bg-black/40"
            onClick={() => setEditingHistory(null)}
          />

          {/* Sheet */}
          <div className="fixed inset-x-0 bottom-0 z-[81] mx-auto max-w-md rounded-t-2xl bg-white px-5 pt-4 pb-10">
            {/* Handle */}
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#e5e5ea]" />

            <p className="mb-5 text-center text-[16px] font-semibold text-[#1c1c1e]">編輯記錄</p>

            <div className="overflow-hidden rounded-2xl bg-[#f2f2f7]">
              {/* Note */}
              <div className="flex items-center justify-between px-4 py-3">
                <p className="text-[15px] text-[#1c1c1e]">備註</p>
                <input
                  type="text"
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  placeholder="選填"
                  className="ml-4 min-w-0 flex-1 bg-transparent text-right text-[15px] text-[#1c1c1e] outline-none placeholder:text-[#c7c7cc]"
                />
              </div>
              <div className="mx-4 h-px bg-white/60" />

              {/* Date */}
              <div className="flex items-center justify-between px-4 py-3">
                <p className="text-[15px] text-[#1c1c1e]">日期</p>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="bg-transparent text-right text-[15px] text-[#1c1c1e] outline-none"
                />
              </div>
              <div className="mx-4 h-px bg-white/60" />

              {/* Delta */}
              <div className="flex items-center justify-between px-4 py-3">
                <p className="text-[15px] text-[#1c1c1e]">變動金額</p>
                <input
                  type="number"
                  value={editDelta}
                  onChange={(e) => setEditDelta(e.target.value)}
                  className="ml-4 min-w-0 flex-1 bg-transparent text-right text-[15px] font-semibold text-[#1c1c1e] outline-none"
                />
              </div>

              {/* Units (stock entries only) */}
              {isStockEntry && (
                <>
                  <div className="mx-4 h-px bg-white/60" />
                  <div className="flex items-center justify-between px-4 py-3">
                    <p className="text-[15px] text-[#1c1c1e]">持有股數</p>
                    <input
                      type="number"
                      value={editUnits}
                      onChange={(e) => setEditUnits(e.target.value)}
                      placeholder="0"
                      className="ml-4 min-w-0 flex-1 bg-transparent text-right text-[15px] text-[#1c1c1e] outline-none placeholder:text-[#c7c7cc]"
                    />
                  </div>
                </>
              )}
            </div>

            {editError && (
              <p className="mt-3 text-center text-[12px] text-[#ff3b30]">{editError}</p>
            )}

            {/* Save / Cancel */}
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => setEditingHistory(null)}
                className="flex-1 rounded-full border border-[#e5e5ea] py-3 text-[15px] font-semibold text-[#1c1c1e] active:bg-[#f2f2f7]"
              >
                取消
              </button>
              <button
                onClick={handleSaveHistory}
                disabled={editSaving}
                className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[#1c1c1e] py-3 text-[15px] font-semibold text-white active:opacity-80 disabled:opacity-40"
              >
                {editSaving && <Spinner size={14} />}
                {editSaving ? "儲存中..." : "儲存"}
              </button>
            </div>

            {/* Delete */}
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-[#ff3b30] py-3 text-[15px] font-semibold text-[#ff3b30] active:bg-[#fff2f1]"
              >
                <Trash2 size={16} />
                刪除此記錄
              </button>
            ) : (
              <button
                onClick={handleDeleteHistory}
                disabled={editSaving}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-[#ff3b30] py-3 text-[15px] font-semibold text-white active:opacity-80 disabled:opacity-40"
              >
                {editSaving && <Spinner size={14} />}
                {editSaving ? "刪除中..." : "確認刪除"}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
