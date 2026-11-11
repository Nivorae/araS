"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, Search, X } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { OVERSEAS_SUBCATEGORY } from "../../lib/stockSymbol";
import { getAccountItem, setAccountItem } from "../../lib/accountStorage";

// Web port of apps/mobile/components/StockPickerModal.tsx: search box on top,
// then 最近 (recent picks, per account), 已持有 (台股 holdings) and 全部.

export interface StockItem {
  code: string;
  name: string;
  /** 交易所顯示名稱，只有海外股票的搜尋結果有（例如 "London"）。 */
  exchange?: string;
}

// 海外股票沒有完整清單，改成邊打邊問 /api/stocks/search。
const SEARCH_DEBOUNCE_MS = 400;
const RECENT_KEY = (market: string) => `stockRecent:${market}`;
const RECENT_MAX = 10;
const MAX_DISPLAY = 100;
const LOAD_ERROR = "無法載入股票清單，請檢查網路連線";

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (stock: StockItem) => void;
  market: string;
  color: string;
  holdings?: StockItem[];
}

function displayName(item: StockItem): string {
  return item.exchange ? `${item.name} · ${item.exchange}` : item.name;
}

// Upstream lists (esp. crypto) can repeat a code; keep the first.
function dedupeByCode(items: StockItem[]): StockItem[] {
  const seen = new Set<string>();
  return items.filter((s) => (seen.has(s.code) ? false : (seen.add(s.code), true)));
}

async function fetchTWListedStocks(): Promise<StockItem[]> {
  const res = await fetch("/api/stocks/tw");
  if (!res.ok) throw new Error("fetch failed");
  const data: Record<string, string>[] = await res.json();
  return data
    .map((item) => ({
      code: item["公司代號"] ?? "",
      name: item["公司簡稱"] ?? item["公司名稱"] ?? "",
    }))
    .filter((s) => s.code && s.name);
}

async function fetchJsonList(url: string): Promise<StockItem[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("fetch failed");
  return res.json() as Promise<StockItem[]>;
}

const PRECIOUS_METALS: StockItem[] = [
  { code: "twgd", name: "Taiwan gold (tael) (New Taiwan Dollar/Taiwan tael)" },
  { code: "twgdg", name: "Taiwan gold (gram) (New Taiwan Dollar/Gram)" },
  { code: "gt", name: "Hongkong gold (Hong Kong Dollar/Ounce)" },
  { code: "xau", name: "Spot gold (U.S. Dollar/Ounce)" },
  { code: "xpd", name: "Spot palladium (U.S. Dollar/Ounce)" },
  { code: "xag", name: "Spot silver (U.S. Dollar/Ounce)" },
  { code: "xap", name: "Spot platinum (U.S. Dollar/Ounce)" },
];

function loadMarket(market: string): Promise<StockItem[]> {
  if (market === "貴金屬") return Promise.resolve(PRECIOUS_METALS);
  if (market === "美股") return fetchJsonList("/api/stocks/us");
  if (market === "加密貨幣") return fetchJsonList("/api/stocks/crypto");
  return fetchTWListedStocks();
}

function Row({
  item,
  highlighted,
  onPick,
}: {
  item: StockItem;
  highlighted?: boolean;
  onPick: (s: StockItem) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onPick(item)}
      className={`flex w-full cursor-pointer items-center gap-3 px-5 py-3.5 text-left active:opacity-70 ${
        highlighted ? "bg-[#f8f8fa]" : "bg-white"
      }`}
    >
      <span
        className={`min-w-16 text-[15px] font-bold ${highlighted ? "text-[#374254]" : "text-[#1c1c1e]"}`}
      >
        {item.code}
      </span>
      <span className="min-w-0 flex-1 truncate text-[14px] text-[#8e8e93]">
        {displayName(item)}
      </span>
    </button>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="bg-[#f2f2f7] px-5 pt-3 pb-1 text-[12px] font-semibold text-[#8e8e93]">
      {children}
    </p>
  );
}

export function StockPickerPage({ open, onClose, onSelect, market, holdings = [] }: Props) {
  const { userId } = useAuth();
  const isRemote = market === OVERSEAS_SUBCATEGORY;

  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [remoteResults, setRemoteResults] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [recents, setRecents] = useState<StockItem[]>([]);
  const [retryTick, setRetryTick] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const loadedMarket = useRef<string | null>(null);

  const q = query.trim().toLowerCase();

  // Reset + autofocus on open; load this market's recent picks for the account.
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setRemoteResults([]);
    setError(null);
    const t = setTimeout(() => inputRef.current?.focus(), 320);
    let saved: StockItem[] = [];
    if (userId) {
      try {
        const raw = getAccountItem(RECENT_KEY(market), userId);
        const parsed: unknown = raw ? JSON.parse(raw) : [];
        if (Array.isArray(parsed)) saved = parsed as StockItem[];
      } catch {
        /* corrupt entry — start fresh */
      }
    }
    setRecents(saved);
    return () => clearTimeout(t);
  }, [open, market, userId]);

  // Whole list for every market but 海外股票 — loaded once per market, filtered here.
  useEffect(() => {
    if (!open || isRemote) return;
    // A failed load clears loadedMarket, so 重新載入 (retryTick) refetches.
    if (loadedMarket.current === market) return;
    loadedMarket.current = market;
    let cancelled = false;
    setLoading(true);
    setError(null);
    loadMarket(market)
      .then((items) => {
        if (!cancelled) setStocks(dedupeByCode(items));
      })
      .catch(() => {
        if (!cancelled) {
          loadedMarket.current = null;
          setError(LOAD_ERROR);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, market, isRemote, retryTick]);

  // 海外股票: search as you type.
  useEffect(() => {
    if (!open || !isRemote) return;
    const term = query.trim();
    if (!term) {
      setRemoteResults([]);
      setLoading(false);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    const timer = setTimeout(() => {
      fetchJsonList(`/api/stocks/search?q=${encodeURIComponent(term)}`)
        .then((items) => {
          if (!cancelled) setRemoteResults(dedupeByCode(Array.isArray(items) ? items : []));
        })
        .catch(() => {
          if (!cancelled) setError("搜尋失敗，請稍後再試");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, isRemote, query, retryTick]);

  const filteredHoldings = useMemo(
    () =>
      q
        ? holdings.filter(
            (s) => s.code.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)
          )
        : holdings,
    [holdings, q]
  );

  const filteredStocks = useMemo(() => {
    // Remote results are already filtered server-side.
    if (isRemote) return remoteResults;
    return q
      ? stocks.filter((s) => s.code.toLowerCase().includes(q) || s.name.toLowerCase().includes(q))
      : stocks;
  }, [isRemote, remoteResults, stocks, q]);
  const displayed = filteredStocks.slice(0, MAX_DISPLAY);

  const handleSelect = useCallback(
    (stock: StockItem) => {
      // Prepend to the recent list (dedupe by code, cap) and persist per account.
      const next = [stock, ...recents.filter((r) => r.code !== stock.code)].slice(0, RECENT_MAX);
      setRecents(next);
      if (userId) setAccountItem(RECENT_KEY(market), userId, JSON.stringify(next));
      onSelect(stock);
      onClose();
    },
    [recents, userId, market, onSelect, onClose]
  );

  const showRecents = recents.length > 0 && !q;
  const showHoldings = filteredHoldings.length > 0 && !q;

  function emptyMessage(): string {
    if (!isRemote) return q ? "找不到符合的股票" : "暫無資料";
    if (!q) return "搜尋倫敦、香港、東京等海外市場";
    return "找不到符合的股票。美股請到「美股」，台股請到「台股」分類新增。";
  }

  return (
    <div
      className={`fixed inset-0 z-[80] flex flex-col bg-[#f2f2f7] transition-transform duration-300 ease-in-out ${
        open ? "translate-x-0" : "pointer-events-none translate-x-full"
      }`}
      aria-hidden={!open}
    >
      <div className="mx-auto w-full max-w-md shrink-0 px-4 pt-12 pb-3 md:max-w-xl lg:max-w-2xl">
        <div className="mb-3 flex items-center gap-3">
          <button
            onClick={onClose}
            aria-label="返回"
            className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-white shadow-sm"
          >
            <ChevronLeft size={20} className="text-[#1c1c1e]" />
          </button>
          <h1 className="text-[20px] font-bold text-[#1c1c1e]">選擇股票</h1>
        </div>
        <div className="flex items-center gap-2 rounded-2xl bg-white px-4 py-3 shadow-sm">
          <Search size={16} className="shrink-0 text-[#8e8e93]" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={isRemote ? "輸入代號或名稱，例如 VWRA、0700、7203" : "搜尋代碼或名稱"}
            aria-label="搜尋股票"
            autoCapitalize="none"
            className="min-w-0 flex-1 bg-transparent text-[15px] text-[#1c1c1e] outline-none placeholder:text-[#c7c7cc]"
          />
          {query.length > 0 && (
            <button onClick={() => setQuery("")} aria-label="清除" className="cursor-pointer">
              <X size={14} className="text-[#8e8e93]" />
            </button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-md pb-10 md:max-w-xl lg:max-w-2xl">
          {loading ? (
            <p className="py-24 text-center text-[14px] text-[#8e8e93]">
              {isRemote ? "搜尋中…" : "載入中…"}
            </p>
          ) : error ? (
            <div className="py-24 text-center">
              <p className="text-[14px] text-[#ff3b30]">{error}</p>
              <button
                onClick={() => setRetryTick((t) => t + 1)}
                className="mt-3 cursor-pointer text-[14px] font-medium text-[#374254]"
              >
                重新載入
              </button>
            </div>
          ) : (
            <>
              {showRecents && (
                <>
                  <SectionLabel>最近</SectionLabel>
                  {recents.map((r) => (
                    <Row key={`recent-${r.code}`} item={r} highlighted onPick={handleSelect} />
                  ))}
                </>
              )}
              {showHoldings && (
                <>
                  <SectionLabel>已持有</SectionLabel>
                  {filteredHoldings.map((h) => (
                    <Row key={`held-${h.code}`} item={h} highlighted onPick={handleSelect} />
                  ))}
                </>
              )}
              {displayed.length > 0 ? (
                <>
                  {(showRecents || showHoldings) && <SectionLabel>全部</SectionLabel>}
                  <div className="divide-y divide-[#f2f2f7]">
                    {displayed.map((s) => (
                      <Row key={s.code} item={s} onPick={handleSelect} />
                    ))}
                  </div>
                  {filteredStocks.length > MAX_DISPLAY && (
                    <p className="py-4 text-center text-[13px] text-[#8e8e93]">
                      顯示前 {MAX_DISPLAY} 筆，請輸入更多字縮小範圍
                    </p>
                  )}
                </>
              ) : (
                !showRecents &&
                !showHoldings && (
                  <p className="px-6 py-24 text-center text-[14px] text-[#8e8e93]">
                    {emptyMessage()}
                  </p>
                )
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
