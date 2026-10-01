import type {
  Dividend,
  Entry,
  EntryHistory,
  Insurance,
  PortfolioItem,
  Recurrence,
  Transaction,
} from "@repo/shared";

// 示範引擎丟出的錯誤。刻意不用 lib/api 的 ApiError：這個資料夾要能被
// apps/web 的 vitest 直接載入，不能牽到 Clerk。demoApi.ts 會把它轉成 ApiError。
export class DemoError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number
  ) {
    super(message);
    this.name = "DemoError";
  }
}

// 後端的 Dividend 列上還有四個不對外的關聯欄位，沖銷時靠它們找回當初寫的帳。
export interface DemoDividend extends Dividend {
  bankHistoryId: string | null;
  transactionId: string | null;
  reinvestHistoryId: string | null;
  reinvestBankHistoryId: string | null;
}

export interface DemoState {
  entries: Entry[];
  history: EntryHistory[];
  insurances: Insurance[];
  dividends: DemoDividend[];
  transactions: Transaction[];
  portfolio: PortfolioItem[];
  recurrences: Recurrence[];
}

/** 進出示範後要去的畫面：先 replace，再視需要 push 一層。 */
export interface DemoNav {
  replace: string;
  push?: string;
}
