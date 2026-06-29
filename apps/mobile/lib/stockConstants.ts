export interface StockItem {
  code: string;
  name: string;
}

export const INVESTMENT_CATS = [
  "投資基金",
  "台股",
  "美股",
  "加密貨幣",
  "貴金屬",
  "其他投資",
] as const;

export const STOCK_CATS = ["台股", "美股", "加密貨幣", "貴金屬"] as const;

export const LOAN_SUBCATS = ["貸款"] as const;

export const METAL_YF_SYMBOL: Record<string, string> = {
  xau: "GC=F",
  xag: "SI=F",
  xap: "PL=F",
  xpd: "PA=F",
};

export const PRECIOUS_METALS: StockItem[] = [
  { code: "twgd", name: "Taiwan gold (tael) (New Taiwan Dollar/Taiwan tael)" },
  { code: "twgdg", name: "Taiwan gold (gram) (New Taiwan Dollar/Gram)" },
  { code: "gt", name: "Hongkong gold (Hong Kong Dollar/Ounce)" },
  { code: "xau", name: "Spot gold (U.S. Dollar/Ounce)" },
  { code: "xpd", name: "Spot palladium (U.S. Dollar/Ounce)" },
  { code: "xag", name: "Spot silver (U.S. Dollar/Ounce)" },
  { code: "xap", name: "Spot platinum (U.S. Dollar/Ounce)" },
];

export function buildYfSymbol(subCategory: string, code: string): string {
  if (subCategory === "貴金屬") return METAL_YF_SYMBOL[code.toLowerCase()] ?? "";
  const suffix = subCategory === "台股" ? ".TW" : subCategory === "加密貨幣" ? "-USD" : "";
  return code + suffix;
}

export function getUnitsLabel(subCat: string): string {
  switch (subCat) {
    case "投資基金":
      return "基金份額";
    case "台股":
    case "美股":
      return "持有股數";
    case "加密貨幣":
      return "持有數量";
    case "貴金屬":
      return "持有重量";
    default:
      return "持有數量";
  }
}
