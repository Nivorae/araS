// Mirrors the local helper in EntryDetailPage.tsx — kept here as a shared
// export so DividendForm/ReinvestSheet don't need to import from that
// component (which is being edited concurrently for an unrelated feature).
const METAL_YF_SYMBOL: Record<string, string> = {
  xau: "GC=F",
  xag: "SI=F",
  xap: "PL=F",
  xpd: "PA=F",
};

// 海外股票的 stockCode 已經是 Yahoo 完整代號（VWRA.L），不加後綴。
export const OVERSEAS_SUBCATEGORY = "海外股票";

/** 有代號、走 Yahoo 報價的投資子分類（基金走官方淨值，不在這裡）。 */
export const STOCK_CATS: readonly string[] = [
  "台股",
  "美股",
  OVERSEAS_SUBCATEGORY,
  "加密貨幣",
  "貴金屬",
];

export function buildYfSymbol(subCategory: string, stockCode: string): string {
  if (subCategory === "貴金屬") return METAL_YF_SYMBOL[stockCode.toLowerCase()] ?? "";
  if (subCategory === OVERSEAS_SUBCATEGORY) return stockCode.toUpperCase();
  const suffix = subCategory === "台股" ? ".TW" : subCategory === "加密貨幣" ? "-USD" : "";
  return stockCode + suffix;
}
