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
