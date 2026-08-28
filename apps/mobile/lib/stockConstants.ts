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

/**
 * 基金不在 STOCK_CATS 裡 —— 它的報價來源是官方每日淨值（/api/funds），不是
 * Yahoo，`buildYfSymbol` 對它沒有意義。
 */
export const FUND_SUBCATEGORY = "投資基金";

/**
 * 基金淨值功能的總開關。
 *
 * 2026-08-28 實機驗證通過（搜尋 → 綁定 → 取淨值 → 市值都正確），但決定先不
 * 對使用者放出來，所以整條入口關掉：詳情頁的「獲取淨值／更新淨值」按鈕、
 * 「重新選擇基金」，以及已綁定基金併入清單市值的行為。
 *
 * 關的是入口不是程式碼 —— 後端 `/api/funds/*` 與服務層照常存在（有測試守著），
 * 要放出來時把這裡改成 `true` 就好，不需要重寫任何東西。已經綁在
 * `Entry.stockCode` 上的基金代碼也留著，開回來就直接能用。
 */
// 明確標成 boolean 而不是讓它推論成字面型別 `false` —— 否則 TypeScript 會把
// 旗標後面所有程式碼視為永遠不會執行，型別收窄出一堆 never，改回 true 的那天
// 反而要先跟編譯器打一架。
export const FUND_NAV_ENABLED: boolean = false;

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
