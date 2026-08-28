import type { Api } from "@/lib/api";
import type { FundQuote, FundSearchResult } from "@repo/shared";

/**
 * 基金淨值。後端把境內（投信投顧公會）與境外（集保）兩份每日開放資料合成一個
 * 介面，這裡只負責呼叫。
 *
 * 綁定流程：使用者自己打的名稱（例如「安聯台灣大壩」）先用 `searchFunds` 找出
 * 官方基金，選定後把官方代碼寫回 `Entry.stockCode`，之後每次都直接用
 * `fetchFundQuote(code)`，不必再搜尋。
 */

export type { FundQuote, FundSearchResult };

export async function searchFunds(api: Api, query: string): Promise<FundSearchResult[]> {
  return api.get<FundSearchResult[]>(`/api/funds/search?q=${encodeURIComponent(query)}`);
}

export async function fetchFundQuote(api: Api, code: string): Promise<FundQuote> {
  return api.get<FundQuote>(`/api/funds/quote?code=${encodeURIComponent(code)}`);
}

/** 2026-08-27 → 2026/08/27。淨值日不一定是今天，所以畫面一定要標出來。 */
export function formatNavDate(navDate: string): string {
  return navDate.replaceAll("-", "/");
}
