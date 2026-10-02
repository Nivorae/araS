type RawGet = <T>(path: string) => Promise<T>;

/**
 * 幣別 → 台幣匯率，透過 `/api/stocks/price?symbol=<幣別>TWD=X`。
 *
 * 抓不到就回 `null`，**絕不退回 1**：退回 1 等於把外幣金額直接當台幣，只有美元時
 * 偶爾錯一下看不太出來，多了英鎊、港幣之後市值會靜默算錯。呼叫端拿到 null 就把
 * 這次報價當作失敗（沿用成本，或讓使用者手動輸入）。
 */
export async function fetchTwdRate(rawGet: RawGet, currency: string): Promise<number | null> {
  if (currency === "TWD") return 1;
  try {
    const fx = await rawGet<{ price?: unknown }>(
      `/api/stocks/price?symbol=${encodeURIComponent(currency + "TWD=X")}`
    );
    return typeof fx?.price === "number" && fx.price > 0 ? fx.price : null;
  } catch {
    return null;
  }
}

/** 換匯計算機提供的常用幣別（Yahoo 都有 `<幣別>TWD=X`，2026-10-02 驗證過）。 */
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
 * 計算機的幣別選項：這檔股票的報價幣別排第一（最常用），後面接常用幣別，
 * 不重複。報價幣別不在常用清單裡（例如 SEK）時，名稱就只顯示代碼。
 */
export function calculatorCurrencies(quoteCurrency: string): { code: string; name: string }[] {
  const quote = POPULAR_CURRENCIES.find((c) => c.code === quoteCurrency) ?? {
    code: quoteCurrency,
    name: quoteCurrency,
  };
  return [quote, ...POPULAR_CURRENCIES.filter((c) => c.code !== quoteCurrency)];
}

/** 同一次刷新裡共用的版本：每個幣別只查一次（失敗也記住，不重試）。 */
export function createTwdRateLookup(rawGet: RawGet): (currency: string) => Promise<number | null> {
  const cache = new Map<string, Promise<number | null>>();
  return (currency) => {
    let rate = cache.get(currency);
    if (!rate) {
      rate = fetchTwdRate(rawGet, currency);
      cache.set(currency, rate);
    }
    return rate;
  };
}
