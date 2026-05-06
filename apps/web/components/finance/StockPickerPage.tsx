"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { ChevronLeft, Search, X } from "lucide-react";

export interface StockItem {
  code: string;
  name: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (stock: StockItem) => void;
  market: string;
  color: string;
  holdings?: StockItem[];
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

async function fetchUSStocks(): Promise<StockItem[]> {
  const res = await fetch("/api/stocks/us");
  if (!res.ok) throw new Error("fetch failed");
  return res.json() as Promise<StockItem[]>;
}

async function fetchCryptoList(): Promise<StockItem[]> {
  const res = await fetch("/api/stocks/crypto");
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

function fetchStocks(
  targetMarket: string,
  setStocks: (s: StockItem[]) => void,
  setLoading: (v: boolean) => void,
  setError: (e: string | null) => void
) {
  if (targetMarket === "貴金屬") {
    setStocks(PRECIOUS_METALS);
    return;
  }
  setLoading(true);
  setError(null);
  const fetcher =
    targetMarket === "美股"
      ? fetchUSStocks
      : targetMarket === "加密貨幣"
        ? fetchCryptoList
        : fetchTWListedStocks;
  fetcher()
    .then(setStocks)
    .catch(() => setError("無法載入股票清單，請檢查網路連線"))
    .finally(() => setLoading(false));
}

export function StockPickerPage({ open, onClose, onSelect, market, color, holdings }: Props) {
  const isTW = market === "台股";

  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [apiStocks, setApiStocks] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const fetchedMarket = useRef<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelRetryRef = useRef(false);

  useEffect(() => {
    if (!open) {
      cancelRetryRef.current = true;
      setQuery("");
      setApiStocks([]);
      setError(null);
    } else {
      cancelRetryRef.current = false;
    }
  }, [open]);

  useEffect(() => {
    if (!open || isTW) return;
    if (fetchedMarket.current === market) return;
    fetchedMarket.current = market;
    setStocks([]);
    setQuery("");
    fetchStocks(market, setStocks, setLoading, setError);
  }, [open, market, isTW]);

  useEffect(() => {
    if (!isTW) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim()) {
      setApiStocks([]);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    debounceRef.current = setTimeout(() => {
      fetchTWListedStocks()
        .then((all) => {
          if (cancelled) return;
          const q = query.trim().toLowerCase();
          const filtered = all.filter(
            (s) => s.code.toLowerCase().startsWith(q) || s.name.toLowerCase().includes(q)
          );
          setApiStocks(filtered);
        })
        .catch(() => {
          if (!cancelled) setError("無法載入股票清單，請檢查網路連線");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 300);

    return () => {
      cancelled = true;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, isTW]);

  const handleRetry = useCallback(() => {
    if (isTW) {
      setError(null);
      setLoading(true);
      const q = query.trim().toLowerCase();
      fetchTWListedStocks()
        .then((all) => {
          if (cancelRetryRef.current) return;
          const filtered = all.filter(
            (s) => s.code.toLowerCase().startsWith(q) || s.name.toLowerCase().includes(q)
          );
          setApiStocks(filtered);
        })
        .catch(() => {
          if (!cancelRetryRef.current) setError("無法載入股票清單，請檢查網路連線");
        })
        .finally(() => {
          if (!cancelRetryRef.current) setLoading(false);
        });
    } else {
      fetchedMarket.current = null;
      setLoading(true);
      setError(null);
      const fetcher =
        market === "美股"
          ? fetchUSStocks
          : market === "加密貨幣"
            ? fetchCryptoList
            : fetchTWListedStocks;
      fetcher()
        .then((items) => {
          if (cancelRetryRef.current) return;
          setStocks(items);
        })
        .catch(() => {
          if (!cancelRetryRef.current) setError("無法載入股票清單，請檢查網路連線");
        })
        .finally(() => {
          if (!cancelRetryRef.current) setLoading(false);
        });
    }
  }, [isTW, query, market, setStocks, setLoading, setError]);

  const MAX_DISPLAY = 100;

  const displayed = useMemo(() => {
    if (isTW) {
      if (!query.trim()) return (holdings ?? []).slice(0, MAX_DISPLAY);
      return apiStocks.slice(0, MAX_DISPLAY);
    }
    if (!query.trim()) return stocks.slice(0, MAX_DISPLAY);
    const q = query.trim().toLowerCase();
    return stocks
      .filter((s) => s.code.toLowerCase().startsWith(q) || s.name.toLowerCase().includes(q))
      .slice(0, MAX_DISPLAY);
  }, [isTW, query, holdings, apiStocks, stocks]);

  const totalCount = isTW
    ? query.trim()
      ? apiStocks.length
      : (holdings ?? []).length
    : query.trim()
      ? stocks.filter((s) => {
          const q = query.trim().toLowerCase();
          return s.code.toLowerCase().startsWith(q) || s.name.toLowerCase().includes(q);
        }).length
      : stocks.length;

  const handleSelect = (stock: StockItem) => {
    onSelect(stock);
    onClose();
  };

  const emptyMessage = isTW
    ? query.trim()
      ? `找不到「${query}」相關股票`
      : "輸入代號或名稱搜尋台股"
    : `找不到「${query}」相關股票`;

  const showHoldingsLabel = isTW && !query.trim() && (holdings ?? []).length > 0;

  return (
    <div
      className={`fixed inset-0 z-[80] flex flex-col bg-[#f2f2f7] transition-transform duration-300 ease-in-out ${
        open ? "translate-x-0" : "pointer-events-none translate-x-full"
      }`}
    >
      <div className="mx-auto w-full max-w-md shrink-0 px-4 pt-14 pb-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-sm"
          >
            <ChevronLeft size={20} className="text-[#1c1c1e]" />
          </button>
          <h1 className="text-[20px] font-bold text-[#1c1c1e]">{market} 選股</h1>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-md px-4">
          {loading ? (
            <div className="py-24 text-center text-[14px] text-[#8e8e93]">載入中...</div>
          ) : error ? (
            <div className="py-24 text-center">
              <p className="text-[14px] text-[#ff3b30]">{error}</p>
              <button onClick={handleRetry} className="mt-3 text-[14px] font-medium text-[#374254]">
                重新載入
              </button>
            </div>
          ) : displayed.length === 0 ? (
            <div className="py-24 text-center text-[14px] text-[#8e8e93]">{emptyMessage}</div>
          ) : (
            <div className="divide-y divide-[#f2f2f7] pb-4">
              {showHoldingsLabel && <p className="py-2 text-[12px] text-[#8e8e93]">現有持倉</p>}
              {displayed.map((stock) => (
                <button
                  key={stock.code}
                  onClick={() => handleSelect(stock)}
                  className="flex w-full items-center gap-3 py-3.5 text-left transition-colors active:bg-white"
                >
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: color + "20" }}
                  >
                    <span className="text-[11px] font-bold" style={{ color }}>
                      {market === "美股"
                        ? "US"
                        : market === "加密貨幣"
                          ? "₿"
                          : market === "貴金屬"
                            ? "Au"
                            : "TW"}
                    </span>
                  </div>
                  <div>
                    <p className="text-[16px] font-semibold text-[#1c1c1e]">{stock.code}</p>
                    <p className="text-[13px] text-[#8e8e93]">{stock.name}</p>
                  </div>
                </button>
              ))}
              {totalCount > MAX_DISPLAY && (
                <p className="py-4 text-center text-[13px] text-[#8e8e93]">
                  顯示前 {MAX_DISPLAY} 筆，請輸入更多字縮小範圍
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto w-full max-w-md shrink-0 px-4 pt-3 pb-10">
        <div className="flex items-center gap-2 rounded-2xl bg-white px-4 py-3 shadow-sm">
          <Search size={16} className="shrink-0 text-[#8e8e93]" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜尋名稱或代號"
            className="flex-1 bg-transparent text-[15px] text-[#1c1c1e] outline-none placeholder:text-[#c7c7cc]"
          />
          {query.length > 0 && (
            <button onClick={() => setQuery("")}>
              <X size={14} className="text-[#8e8e93]" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
