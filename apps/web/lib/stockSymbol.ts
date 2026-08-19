// Mirrors the local helper in EntryDetailPage.tsx — kept here as a shared
// export so DividendForm/ReinvestSheet don't need to import from that
// component (which is being edited concurrently for an unrelated feature).
const METAL_YF_SYMBOL: Record<string, string> = {
  xau: "GC=F",
  xag: "SI=F",
  xap: "PL=F",
  xpd: "PA=F",
};

export function buildYfSymbol(subCategory: string, stockCode: string): string {
  if (subCategory === "貴金屬") return METAL_YF_SYMBOL[stockCode.toLowerCase()] ?? "";
  const suffix = subCategory === "台股" ? ".TW" : subCategory === "加密貨幣" ? "-USD" : "";
  return stockCode + suffix;
}
