/**
 * 幣別 → 台幣匯率。抓不到回 `null`，**絕不退回 1** —— 退回 1 等於把外幣金額
 * 直接當台幣，多了英鎊、港幣等幣別之後市值會靜默算錯。（手機版同一套邏輯在
 * `apps/mobile/lib/fx.ts`。）
 */
export async function fetchTwdRate(currency: string): Promise<number | null> {
  if (currency === "TWD") return 1;
  try {
    const res = await fetch(`/api/stocks/price?symbol=${encodeURIComponent(currency + "TWD=X")}`);
    const data = await res.json();
    return typeof data?.price === "number" && data.price > 0 ? data.price : null;
  } catch {
    return null;
  }
}

export interface TwdQuote {
  /** 原幣價格（畫面上顯示用）。 */
  price: number;
  currency: string;
  /** 原幣 → 台幣匯率，台幣報價是 1。 */
  rate: number;
}

/** 換匯計算機提供的常用幣別（同 apps/mobile/lib/fx.ts）。 */
export const POPULAR_CURRENCIES: { code: string; name: string }[] = [
  { code: "USD", name: "美元" },
  { code: "JPY", name: "日圓" },
  { code: "EUR", name: "歐元" },
  { code: "KRW", name: "韓圓" },
  { code: "GBP", name: "英鎊" },
  { code: "HKD", name: "港幣" },
  { code: "CNY", name: "人民幣" },
  { code: "AUD", name: "澳幣" },
  { code: "SGD", name: "新加坡幣" },
  { code: "CAD", name: "加幣" },
  { code: "CHF", name: "瑞士法郎" },
];

/**
 * 計算機的幣別選項：這檔股票的報價幣別排第一，後面接常用幣別，不重複。報價幣別
 * 不在常用清單裡（例如 SEK）時，名稱就只顯示代碼。
 */
export function calculatorCurrencies(quoteCurrency: string): { code: string; name: string }[] {
  const quote = POPULAR_CURRENCIES.find((c) => c.code === quoteCurrency) ?? {
    code: quoteCurrency,
    name: quoteCurrency,
  };
  return [quote, ...POPULAR_CURRENCIES.filter((c) => c.code !== quoteCurrency)];
}

/** 報價加上換匯。報價或匯率任一個拿不到就回 `null`，呼叫端當作抓不到價格。 */
export async function fetchTwdQuote(symbol: string): Promise<TwdQuote | null> {
  try {
    const res = await fetch(`/api/stocks/price?symbol=${encodeURIComponent(symbol)}`);
    const data = await res.json();
    if (typeof data?.price !== "number") return null;
    const currency = typeof data.currency === "string" ? data.currency : "TWD";
    const rate = await fetchTwdRate(currency);
    if (rate == null) return null;
    return { price: data.price, currency, rate };
  } catch {
    return null;
  }
}
