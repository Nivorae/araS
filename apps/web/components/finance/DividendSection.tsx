"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Dividend } from "@repo/shared";
import { useFinanceStore } from "../../store/useFinanceStore";
import { BottomSheet } from "../ui/BottomSheet";
import { ConfirmSheet, NoticeSheet } from "../ui/ConfirmSheet";
import { FitText } from "../ui/FitText";
import { Spinner } from "../ui/Spinner";
import { DividendForm } from "./DividendForm";
import { ReinvestSheet } from "./ReinvestSheet";

// Web port of apps/mobile/components/DividendSection.tsx: a 2×2 overview card
// (殖利率 + 平均單次股利 / 當年股息 / 明細 preview / 新增 + 歷史紀錄) and a
// 股利紀錄 sheet where a click edits and a long-press (or right-click) deletes.

const LONG_PRESS_MS = 500;

function DividendRow({
  dividend: d,
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
  const [scale, setScale] = useState(1);
  const timer = useRef<number | undefined>(undefined);
  const longPressed = useRef(false);

  const clear = () => {
    window.clearTimeout(timer.current);
    timer.current = undefined;
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-disabled={isDeleting}
      data-testid={`dividend-row-${d.id}`}
      className={`flex cursor-pointer items-center justify-between py-3 select-none ${isDeleting ? "pointer-events-none opacity-50" : ""}`}
      style={{
        transform: `scale(${scale})`,
        transition: `transform 160ms ${scale > 1 ? "cubic-bezier(0.34,1.56,0.64,1)" : "ease-out"}`,
      }}
      onPointerDown={() => {
        longPressed.current = false;
        setScale(0.97);
        clear();
        timer.current = window.setTimeout(() => {
          longPressed.current = true;
          setScale(1.03);
          onLongPress();
        }, LONG_PRESS_MS);
      }}
      onPointerUp={() => {
        clear();
        setScale(1);
      }}
      onPointerLeave={() => {
        clear();
        setScale(1);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        clear();
        if (!longPressed.current) onLongPress();
        longPressed.current = true;
      }}
      onClick={() => {
        if (longPressed.current) return;
        onPress();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onPress();
        } else if (e.key === "Delete" || e.key === "Backspace") {
          e.preventDefault();
          onLongPress();
        }
      }}
    >
      <div>
        <p className="text-[14px] text-[#1c1c1e]">{d.payDate.slice(0, 10)}</p>
        {d.perShare != null && (
          <p className="mt-0.5 text-[12px] text-[#8e8e93]">
            每股 {d.perShare} × {d.shares ?? "—"} 股
          </p>
        )}
      </div>
      {isDeleting ? (
        <div className="flex flex-col items-end gap-1 text-[#8e8e93]">
          <Spinner size={14} />
          <p className="text-[12px]">刪除中…</p>
        </div>
      ) : (
        <div className="flex flex-col items-end gap-1">
          <p className="text-[14px] font-semibold text-[#1c1c1e]">
            +NT$ {d.amount.toLocaleString()}
          </p>
          {d.reinvestedAt ? (
            <p className="text-[12px] text-[#8e8e93]">
              已再投資 {d.reinvestUnits != null ? `${d.reinvestUnits.toFixed(2)} 股` : ""}
            </p>
          ) : (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onReinvest();
              }}
              className="cursor-pointer text-[12px] font-semibold text-[#66788E]"
            >
              再投資
            </button>
          )}
        </div>
      )}
    </div>
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
  /**
   * Called after every add / edit / reinvest / delete — a reinvest writes
   * history rows and changes the entry's value, so the detail page must
   * refetch its 交易記錄 and the store its entries.
   */
  onChanged?: () => void;
}

export function DividendSection({
  entryId,
  entryName,
  subCategory,
  stockCode,
  currentShares,
  costBasis,
  color,
  categoryTextColor,
  onChanged,
}: DividendSectionProps) {
  const entries = useFinanceStore((s) => s.entries);

  const [rows, setRows] = useState<Dividend[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  // 編輯與新增共用同一個 DividendForm 實例。editTarget 有值就是編輯模式。
  const [editTarget, setEditTarget] = useState<Dividend | null>(null);
  // Kept after closing so the sheet can play its exit with content intact.
  const [reinvestTarget, setReinvestTarget] = useState<Dividend | null>(null);
  const [reinvestOpen, setReinvestOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<Dividend | null>(null);
  const [notice, setNotice] = useState<{ title: string; message: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/dividends?entryId=${encodeURIComponent(entryId)}`);
      const json = await res.json();
      if (json.success) setRows(json.data);
    } catch {
      // 讀取失敗就維持現有列表 —— 這是輔助資訊，不該讓詳情頁整頁失敗。
    } finally {
      setInitialLoading(false);
    }
  }, [entryId]);

  useEffect(() => {
    void load();
  }, [load]);

  const afterMutation = useCallback(async () => {
    await load();
    onChanged?.();
  }, [load, onChanged]);

  // Row actions close the history sheet first and open the next sheet once it
  // has fully gone (same order as mobile 4db4136), so two sheets never overlap.
  const afterHistoryClosed = useRef<(() => void) | null>(null);
  const openFromHistory = (open: () => void) => {
    afterHistoryClosed.current = open;
    setHistoryOpen(false);
  };
  const runAfterHistoryClosed = () => {
    const open = afterHistoryClosed.current;
    afterHistoryClosed.current = null;
    open?.();
  };

  const currentYear = new Date().getFullYear();
  const { thisYearTotal, thisYearCount } = useMemo(() => {
    const thisYear = rows.filter((r) => new Date(r.payDate).getFullYear() === currentYear);
    return {
      thisYearTotal: thisYear.reduce((s, r) => s + r.amount, 0),
      thisYearCount: thisYear.length,
    };
  }, [rows, currentYear]);
  const yieldOnCost = costBasis > 0 ? (thisYearTotal / costBasis) * 100 : null;
  const avgPerPayment = thisYearCount > 0 ? thisYearTotal / thisYearCount : null;
  const isLightCat = categoryTextColor.toLowerCase() === "#1c1c1e";

  const bankNameOf = (d: Dividend) =>
    d.bankEntryId ? (entries.find((e) => e.id === d.bankEntryId)?.name ?? null) : null;

  // 後端對「已再投資」的股利一律回 409，與其讓使用者填完才吃錯誤，不如在入口說清楚。
  const openEdit = (d: Dividend) => {
    if (deletingId) return;
    if (d.reinvestedAt) {
      openFromHistory(() =>
        setNotice({
          title: "已再投資的股利不可修改",
          message:
            "再投資是另一筆既成事實，改金額或帳戶會讓兩者對不上。請長按刪除這筆紀錄後重新建立。",
        })
      );
      return;
    }
    openFromHistory(() => setEditTarget(d));
  };

  const askDelete = (d: Dividend) => {
    if (deletingId) return;
    openFromHistory(() => setConfirmTarget(d));
  };

  async function doDelete() {
    const d = confirmTarget;
    if (!d) return;
    setDeletingId(d.id);
    try {
      const res = await fetch(`/api/dividends/${d.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "請稍後再試");
      setConfirmTarget(null);
      await afterMutation();
    } catch (e) {
      setConfirmTarget(null);
      setNotice({ title: "刪除失敗", message: e instanceof Error ? e.message : "請稍後再試" });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="px-5">
      <p className="mt-6 mb-6 text-center text-[15px] font-semibold text-[#1c1c1e]">股息</p>

      {initialLoading ? (
        <div className="flex min-h-[290px] items-center justify-center text-[#8e8e93]">
          <Spinner size={20} />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          {/* 左上：殖利率 + 平均單次股利 */}
          <div className="flex min-h-[140px] flex-col items-center justify-center rounded-2xl bg-white p-3.5">
            <div className="flex flex-col items-center gap-0.5">
              <p className="text-center text-[12px] text-[#8e8e93]">本年度殖利率</p>
              <p className="text-center text-[18px] font-bold text-[#1c1c1e]">
                {yieldOnCost != null ? `${yieldOnCost.toFixed(2)}%` : "—"}
              </p>
            </div>
            <div className="my-2.5 h-px w-full bg-[#f2f2f7]" />
            <div className="flex flex-col items-center gap-0.5">
              <p className="text-center text-[12px] text-[#8e8e93]">平均單次股利</p>
              <p className="text-center text-[18px] font-bold text-[#1c1c1e]">
                {avgPerPayment != null ? `NT$ ${Math.round(avgPerPayment).toLocaleString()}` : "—"}
              </p>
            </div>
          </div>

          {/* 右上：當年股息 */}
          <div
            className="relative flex min-h-[140px] items-center justify-center rounded-2xl"
            style={{
              backgroundColor: color,
              border: isLightCat ? "1px solid #e5e5ea" : undefined,
            }}
          >
            <div className="pointer-events-none absolute -top-3.5 right-0 left-0 flex justify-center">
              <span className="rounded-full bg-white px-3.5 py-[5px] text-[12px] font-bold text-[#1c1c1e] shadow-[0_1px_3px_rgba(0,0,0,0.1)]">
                當年股息
              </span>
            </div>
            <div className="w-full px-3.5">
              <FitText
                fontSize={30}
                minScale={0.4}
                className="text-center font-extrabold tracking-[-0.5px]"
                style={{ color: isLightCat ? "#1c1c1e" : "#ffffff" }}
              >
                {thisYearTotal.toLocaleString()}
              </FitText>
            </div>
            <span
              className="absolute right-3 bottom-2.5 text-[12px] font-semibold"
              style={{ color: isLightCat ? "#8e8e93" : "rgba(255,255,255,0.85)" }}
            >
              NT$
            </span>
          </div>

          {/* 左下：股利明細 */}
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            className="min-h-[140px] cursor-pointer rounded-2xl bg-white p-3.5 text-left active:opacity-80"
          >
            <p className="mb-2 text-[12px] text-[#8e8e93]">股利明細</p>
            {rows.length === 0 ? (
              <p className="text-[13px] text-[#c7c7cc]">還沒有紀錄</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {rows.slice(0, 3).map((d) => (
                  <div key={d.id} className="flex justify-between">
                    <span className="text-[12px] text-[#8e8e93]">{d.payDate.slice(5, 10)}</span>
                    <span className="text-[13px] font-semibold text-[#1c1c1e]">
                      +{d.amount.toLocaleString()}
                    </span>
                  </div>
                ))}
                {rows.length > 3 && (
                  <p className="mt-1 text-[11px] text-[#c7c7cc]">還有 {rows.length - 3} 筆…</p>
                )}
              </div>
            )}
          </button>

          {/* 右下：新增 / 歷史紀錄 */}
          <div className="flex min-h-[140px] flex-col justify-center gap-2">
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className="cursor-pointer rounded-xl py-2 text-[13px] font-bold active:opacity-85"
              style={{ backgroundColor: color, color: isLightCat ? "#1c1c1e" : "#ffffff" }}
            >
              ＋ 新增
            </button>
            <button
              type="button"
              onClick={() => setHistoryOpen(true)}
              className="cursor-pointer rounded-xl bg-white py-2 text-[12px] font-semibold text-[#66788E] active:opacity-70"
            >
              歷史紀錄
            </button>
          </div>
        </div>
      )}

      {/* 股利紀錄 */}
      <BottomSheet
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onClosed={runAfterHistoryClosed}
        maxHeight="80dvh"
        panelClassName="pt-3"
        label="股利紀錄"
      >
        <div className="mx-auto mb-4 h-1 w-10 shrink-0 rounded-full bg-[#e5e5ea]" />
        <p className="mb-4 px-5 text-center text-[16px] font-semibold text-[#1c1c1e]">股利紀錄</p>
        <div className="min-h-0 overflow-y-auto px-5 pb-3">
          {rows.length === 0 ? (
            <p className="py-[18px] text-center text-[13px] text-[#8e8e93]">還沒有股利紀錄</p>
          ) : (
            rows.map((d, i) => (
              <div key={d.id}>
                {i > 0 && <div className="h-px bg-[#f2f2f7]" />}
                <DividendRow
                  dividend={d}
                  isDeleting={deletingId === d.id}
                  onPress={() => openEdit(d)}
                  onLongPress={() => askDelete(d)}
                  onReinvest={() =>
                    openFromHistory(() => {
                      setReinvestTarget(d);
                      setReinvestOpen(true);
                    })
                  }
                />
              </div>
            ))
          )}
        </div>
        <p className="shrink-0 pb-6 text-center text-[11px] text-[#c7c7cc]">
          點一下可編輯，長按或按右鍵可刪除
        </p>
      </BottomSheet>

      <DividendForm
        open={formOpen || editTarget !== null}
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
        onSaved={afterMutation}
      />

      {reinvestTarget && (
        <ReinvestSheet
          open={reinvestOpen}
          dividendId={reinvestTarget.id}
          dividendAmount={reinvestTarget.amount}
          entryName={entryName}
          subCategory={subCategory}
          stockCode={stockCode}
          bankName={bankNameOf(reinvestTarget)}
          onClose={() => setReinvestOpen(false)}
          onDone={afterMutation}
        />
      )}

      <ConfirmSheet
        open={confirmTarget !== null}
        title="刪除這筆股利？"
        message="入帳與再投資的紀錄會一併沖銷，帳戶餘額回到原本的金額。"
        busy={deletingId !== null}
        onConfirm={() => void doDelete()}
        onClose={() => setConfirmTarget(null)}
      />

      <NoticeSheet
        open={notice !== null}
        title={notice?.title ?? ""}
        message={notice?.message ?? ""}
        onClose={() => setNotice(null)}
      />
    </div>
  );
}
