import { z } from "zod";

/**
 * 基金淨值查詢。`source` 區分境內（投信投顧公會）與境外（集保）兩個來源 ——
 * 兩邊的代碼空間沒有交集，但顯示與除錯時知道資料哪裡來的仍然有用。
 */
export const FundSourceSchema = z.enum(["onshore", "offshore"]);
export type FundSource = z.infer<typeof FundSourceSchema>;

/** 搜尋結果只帶綁定所需的欄位，淨值本身留給 quote 端點。 */
export const FundSearchResultSchema = z.object({
  code: z.string(),
  name: z.string(),
  currency: z.string(),
  source: FundSourceSchema,
});
export type FundSearchResult = z.infer<typeof FundSearchResultSchema>;

export const FundQuoteSchema = z.object({
  code: z.string(),
  name: z.string(),
  nav: z.number(),
  currency: z.string(),
  /** 淨值日 YYYY-MM-DD。各家投信報價時間不同，不保證是今天。 */
  navDate: z.string(),
  source: FundSourceSchema,
});
export type FundQuote = z.infer<typeof FundQuoteSchema>;

export const FundSearchQuerySchema = z.object({
  q: z.string().trim().min(1, "請輸入基金名稱"),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export const FundQuoteQuerySchema = z.object({
  code: z.string().trim().min(1, "請提供基金代碼"),
});
