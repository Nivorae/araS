"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { NetWorthRange } from "@repo/shared";
import { useFinanceStore } from "../../../store/useFinanceStore";
import { NetWorthChart } from "../../../components/finance/NetWorthChart";
import { AssetAllocationView } from "../../../components/finance/AssetAllocationView";
import { DividendOverview } from "../../../components/finance/DividendOverview";
import {
  EntrySheetsHost,
  type EntrySheetsHandle,
} from "../../../components/finance/EntrySheetsHost";
import { SegmentedToggle } from "../../../components/ui/SegmentedToggle";
import { Spinner } from "../../../components/ui/Spinner";
import { formatCurrency } from "../../../lib/format";
import { chartedEntries } from "../../../lib/chartedEntries";
import { useIsPremium } from "../../../hooks/useIsPremium";
import { promptMobileApp } from "../../../lib/mobileAppPrompt";
import { useTabEnterDirection } from "../nav-context";

type View = "trend" | "allocation" | "dividends";

const VIEWS: { value: View; label: string }[] = [
  { value: "trend", label: "走勢" },
  { value: "allocation", label: "配置" },
  { value: "dividends", label: "股息" },
];

const RANGES: { key: NetWorthRange; label: string }[] = [
  { key: "6m", label: "6M" },
  { key: "1y", label: "1Y" },
  { key: "all", label: "全部" },
];

function BalanceScale({ assets, liabilities }: { assets: number; liabilities: number }) {
  const total = assets + liabilities;
  const assetRatio = total > 0 ? assets / total : 0.5;
  const rotation = (0.5 - assetRatio) * 28;

  const [mounted, setMounted] = useState(false);
  const [bump, setBump] = useState(0);
  const [isJiggling, setIsJiggling] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 80);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    return () => timers.current.forEach(clearTimeout);
  }, []);

  const displayRotation = mounted ? rotation : 0;
  const currentRotation = displayRotation + bump;
  const dur = isJiggling ? "0.18s ease-in-out" : "1.3s cubic-bezier(0.34, 1.56, 0.64, 1)";

  function handleClick(side: "left" | "right") {
    if (isJiggling) return;
    timers.current.forEach(clearTimeout);
    const dir = side === "left" ? -1 : 1;
    setIsJiggling(true);
    setBump(dir * 11);
    timers.current = [
      setTimeout(() => setBump(dir * -8), 200),
      setTimeout(() => setBump(dir * 5), 400),
      setTimeout(() => setBump(dir * -2), 580),
      setTimeout(() => setBump(0), 740),
      setTimeout(() => setIsJiggling(false), 960),
    ];
  }

  return (
    <div style={{ position: "relative", width: 220, height: 108 }}>
      {/* Stand */}
      <div
        style={{
          position: "absolute",
          top: 11,
          left: "50%",
          transform: "translateX(-50%)",
          width: 6,
          height: 44,
          background: "#1c1c1e",
          borderRadius: 2,
        }}
      />
      {/* Pivot dot */}
      <div
        style={{
          position: "absolute",
          top: 50,
          left: "50%",
          transform: "translateX(-50%)",
          width: 16,
          height: 16,
          borderRadius: "50%",
          background: "#374254",
          zIndex: 1,
        }}
      />
      {/* Beam */}
      <div
        style={{
          position: "absolute",
          top: 55,
          left: 10,
          right: 10,
          height: 6,
          background: "#1c1c1e",
          borderRadius: 2,
          transformOrigin: "center center",
          transform: `rotate(${currentRotation}deg)`,
          transition: `transform ${dur}`,
        }}
      >
        {/* Left (assets) — string + pan */}
        <div
          onClick={() => handleClick("left")}
          style={{
            position: "absolute",
            left: 0,
            top: 3,
            width: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            transformOrigin: "top center",
            transform: `rotate(${-currentRotation}deg)`,
            transition: `transform ${dur}`,
            cursor: "pointer",
          }}
        >
          <div style={{ width: 3, height: 30, background: "#8e8e93" }} />
          <div
            style={{
              width: 52,
              height: 12,
              background: "#374254",
              borderRadius: "0 0 8px 8px",
            }}
          />
        </div>

        {/* Right (liabilities) — string + pan */}
        <div
          onClick={() => handleClick("right")}
          style={{
            position: "absolute",
            right: 0,
            top: 3,
            width: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            transformOrigin: "top center",
            transform: `rotate(${-currentRotation}deg)`,
            transition: `transform ${dur}`,
            cursor: "pointer",
          }}
        >
          <div style={{ width: 3, height: 30, background: "#8e8e93" }} />
          <div
            style={{
              width: 52,
              height: 12,
              background: "#C7C7D4",
              borderRadius: "0 0 8px 8px",
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default function TransactionsPage() {
  const entries = useFinanceStore((s) => s.entries);
  const netWorthHistory = useFinanceStore((s) => s.netWorthHistory);
  const fetchNetWorthHistory = useFinanceStore((s) => s.fetchNetWorthHistory);
  // Until the first load settles we don't know whether this is a guest (no
  // server history) or an account, so the history request waits for it.
  const dataReady = useFinanceStore((s) => s.lastFetchedAt !== null);

  const enterDir = useTabEnterDirection("/transactions");
  const entriesById = useMemo(() => new Map(entries.map((e) => [e.id, e])), [entries]);
  const sheetsRef = useRef<EntrySheetsHandle>(null);

  const [view, setView] = useState<View>("trend");
  const [range, setRange] = useState<NetWorthRange>("6m");
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  // Web has no in-app purchase path, so this only gates the fast-path UX (see
  // CLAUDE.md "No web premium/paywall UI"); the server independently returns
  // 403 PREMIUM_REQUIRED on every premium write.
  const { isPremium, loading: premiumLoading } = useIsPremium();
  // Mounted-once-then-kept-alive: switching `view` only toggles which pane is
  // visible, so a tab's component never unmounts once visited and doesn't
  // refetch on every switch back to it.
  const [everVisitedAllocation, setEverVisitedAllocation] = useState(false);
  const [everVisitedDividends, setEverVisitedDividends] = useState(false);
  const requestTokenRef = useRef(0);

  // 這兩個數字就印在走勢圖正上方，描述的是圖表所呈現的那份資產，所以要跟折線
  // 用同一組項目 —— 折線是伺服器算的、已經濾掉「納入圖表」關閉的項目，這裡漏濾
  // 的話關掉開關後數字不動，看起來就像設定沒生效。
  const charted = useMemo(() => chartedEntries(entries), [entries]);

  const totalAssets = useMemo(
    () => charted.filter((e) => e.topCategory !== "負債").reduce((s, e) => s + e.value, 0),
    [charted]
  );
  const totalLiabilities = useMemo(
    () => charted.filter((e) => e.topCategory === "負債").reduce((s, e) => s + e.value, 0),
    [charted]
  );

  // Only the selected range is fetched, and only once — the store caches it
  // and clears the cache whenever an entry changes. Loading only shows for an
  // uncached range so switching back to an already-fetched range is instant.
  useEffect(() => {
    if (netWorthHistory[range]) {
      setIsHistoryLoading(false);
      return;
    }
    setIsHistoryLoading(true);
    if (!dataReady) return;
    const token = ++requestTokenRef.current;
    fetchNetWorthHistory(range)
      .catch(() => {
        // Failure leaves the range uncached; the chart shows its empty state.
      })
      .finally(() => {
        if (requestTokenRef.current === token) setIsHistoryLoading(false);
      });
  }, [fetchNetWorthHistory, range, netWorthHistory, dataReady]);

  const points = useMemo(() => netWorthHistory[range] ?? [], [netWorthHistory, range]);
  const periodLabel = useMemo(() => {
    if (points.length === 0) return "";
    const first = points[0]!.period;
    const last = points[points.length - 1]!.period;
    return first === last ? first : `${first} – ${last}`;
  }, [points]);

  function selectView(target: View) {
    if (target === "trend") {
      setView("trend");
      return;
    }
    // Free users tapping 配置 or 股息 get the mobile-app prompt instead of
    // switching — web's equivalent of mobile's router.push("/paywall").
    if (premiumLoading) return;
    if (!isPremium) {
      promptMobileApp();
      return;
    }
    if (target === "allocation") setEverVisitedAllocation(true);
    else setEverVisitedDividends(true);
    setView(target);
  }

  return (
    <div
      className="animate-tab-enter relative flex flex-col overflow-hidden"
      style={{
        height: "calc(100dvh - 64px)",
        animation:
          enterDir === 0
            ? undefined
            : `${enterDir > 0 ? "tab-enter-right" : "tab-enter-left"} 420ms cubic-bezier(0.22, 1.2, 0.36, 1)`,
      }}
    >
      {/* Header: balance scale */}
      <div
        className="flex flex-shrink-0 flex-col items-center justify-center gap-4"
        style={{ height: "44dvh" }}
      >
        <h1 className="text-[22px] font-bold text-[#1c1c1e] md:text-[27px]">資產損益</h1>

        {/* The scale is fixed-size art, so it is scaled as a unit on iPad. */}
        <div className="md:my-[18px] md:scale-[1.3]">
          <BalanceScale assets={totalAssets} liabilities={totalLiabilities} />
        </div>

        {/* Asset / Liability values aligned below the pans */}
        <div className="flex w-3/4 items-start justify-between">
          <div className="text-center">
            <p className="text-[15px] font-bold" style={{ color: "#374254" }}>
              {formatCurrency(totalAssets)}
            </p>
            <p className="text-[11px] text-[#8e8e93]">資產</p>
          </div>
          <div className="text-center">
            <p className="text-[15px] font-bold" style={{ color: "#C7C7D4" }}>
              {formatCurrency(totalLiabilities)}
            </p>
            <p className="text-[11px] text-[#8e8e93]">負債</p>
          </div>
        </div>

        <p className="min-h-[14px] text-[11px] text-[#c7c7cc]">{periodLabel}</p>

        <SegmentedToggle options={VIEWS} value={view} onPress={selectView} />
      </div>

      {/* Content zone — fills remaining height. All visited panes stay
          mounted; hiding via `hidden` removes them from layout without
          unmounting, so switching tabs never re-triggers their fetch. */}
      <div className="min-h-0 flex-1 px-[30px] pb-9">
        <div className={`flex h-full flex-col ${view !== "trend" ? "hidden" : ""}`}>
          <div className="mb-2 flex shrink-0 justify-end gap-1">
            {RANGES.map((r) => (
              <button
                key={r.key}
                disabled={isHistoryLoading}
                onClick={() => setRange(r.key)}
                className={`rounded-xl px-3 py-1 text-[11px] font-semibold ${
                  range === r.key ? "bg-[#e5e5ea] text-[#1c1c1e]" : "text-[#c7c7cc]"
                } ${isHistoryLoading ? "opacity-40" : ""}`}
              >
                {r.label}
              </button>
            ))}
          </div>
          {isHistoryLoading ? (
            <div className="flex flex-1 items-center justify-center text-[#8e8e93]">
              <Spinner size={20} />
            </div>
          ) : (
            <div className="flex min-h-0 flex-1">
              <NetWorthChart data={points} />
            </div>
          )}
        </div>

        {everVisitedAllocation && (
          <div className={`h-full overflow-y-auto ${view !== "allocation" ? "hidden" : ""}`}>
            <AssetAllocationView />
          </div>
        )}
        {everVisitedDividends && (
          <div className={`h-full ${view !== "dividends" ? "hidden" : ""}`}>
            <DividendOverview
              onSelectEntry={(id) => {
                const entry = entriesById.get(id);
                if (entry) sheetsRef.current?.openEntry(entry);
              }}
            />
          </div>
        )}
      </div>

      <EntrySheetsHost ref={sheetsRef} />
    </div>
  );
}
