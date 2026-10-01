import type {
  CreateDividend,
  CreateEntry,
  CreateInsurance,
  CreateLoan,
  CreatePortfolioItem,
  CreateRecurrence,
  CreateTransaction,
  NetWorthRange,
  ReinvestDividend,
  TransferEntry,
  UpdateDividend,
  UpdateEntry,
  UpdateEntryHistory,
  UpdateInsurance,
  UpdateLoan,
  UpdatePortfolioItem,
  UpdateRecurrence,
} from "@repo/shared";
import type { DemoEngine } from "./engine";
import { DemoError } from "./types";

export type DemoMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

// 行情類：示範中照常打真後端（使用者已登入，有權限），不造假價格。
const PASSTHROUGH_PREFIXES = ["/api/stocks/", "/api/funds/", "/api/quotes/"];
const PASSTHROUGH_EXACT = ["/api/exchange-rate", "/api/cathaylife-rates"];

export function isPassthroughPath(path: string): boolean {
  const pathname = path.split("?")[0] ?? "";
  return (
    PASSTHROUGH_EXACT.includes(pathname) || PASSTHROUGH_PREFIXES.some((p) => pathname.startsWith(p))
  );
}

function queryParam(query: string, name: string): string | undefined {
  for (const pair of query.split("&")) {
    const [key, value = ""] = pair.split("=");
    if (key === name) return decodeURIComponent(value);
  }
  return undefined;
}

const NET_WORTH_RANGES: readonly string[] = ["6m", "1y", "all"];

// 不認得的路徑一律丟錯。寧可讓畫面顯示錯誤，也不能默默落到真後端 ——
// 那會讓示範中的操作寫進使用者的真實帳號。
function unsupported(): never {
  throw new DemoError("DEMO_UNSUPPORTED", "示範模式不支援此操作", 0);
}

function blocked(): never {
  throw new DemoError("DEMO_BLOCKED", "示範模式中無法進行此操作", 403);
}

export function handleDemoRequest(
  engine: DemoEngine,
  method: DemoMethod,
  path: string,
  body?: unknown
): unknown {
  const [pathname = "", query = ""] = path.split("?");
  const [root, resource, a, b, c, extra] = pathname.split("/").filter(Boolean);
  if (root !== "api" || extra !== undefined) unsupported();
  const isUpdate = method === "PUT" || method === "PATCH";

  switch (resource) {
    case "entries": {
      if (a === undefined) {
        if (method === "GET") return engine.listEntries();
        if (method === "POST") return engine.createEntry(body as CreateEntry);
        return unsupported();
      }
      if (b === undefined) {
        if (a === "allocation" && method === "GET") return engine.allocation();
        if (a === "net-worth-history" && method === "GET") {
          const range = queryParam(query, "range");
          return engine.netWorthHistory(
            range && NET_WORTH_RANGES.includes(range) ? (range as NetWorthRange) : "6m"
          );
        }
        if (a === "transfer" && method === "POST") return engine.transfer(body as TransferEntry);
        if (isUpdate) return engine.updateEntry(a, body as UpdateEntry);
        if (method === "DELETE") {
          engine.deleteEntry(a);
          return null;
        }
        return unsupported();
      }
      if (b !== "history") return unsupported();
      if (c === undefined) return method === "GET" ? engine.entryHistory(a) : unsupported();
      if (isUpdate) return engine.updateHistory(a, c, body as UpdateEntryHistory);
      if (method === "DELETE") {
        engine.deleteHistory(a, c);
        return null;
      }
      return unsupported();
    }

    case "loans": {
      if (b !== undefined) return unsupported();
      if (a === undefined) {
        return method === "POST" ? engine.createLoan(body as CreateLoan) : unsupported();
      }
      return isUpdate ? engine.updateLoan(a, body as UpdateLoan) : unsupported();
    }

    case "insurances": {
      if (b !== undefined) return unsupported();
      if (a === undefined) {
        if (method === "GET") return engine.listInsurances();
        if (method === "POST") return engine.createInsurance(body as CreateInsurance);
        return unsupported();
      }
      if (method === "GET") return engine.getInsurance(a);
      if (isUpdate) return engine.updateInsurance(a, body as UpdateInsurance);
      if (method === "DELETE") {
        engine.deleteInsurance(a);
        return null;
      }
      return unsupported();
    }

    case "dividends": {
      if (a === undefined) {
        if (method === "GET") return engine.listDividends(queryParam(query, "entryId"));
        if (method === "POST") return engine.createDividend(body as CreateDividend);
        return unsupported();
      }
      if (b === undefined) {
        if (a === "summary") return method === "GET" ? engine.dividendSummary() : unsupported();
        if (isUpdate) return engine.updateDividend(a, body as UpdateDividend);
        if (method === "DELETE") {
          engine.deleteDividend(a);
          return null;
        }
        return unsupported();
      }
      if (b === "reinvest" && c === undefined && method === "POST") {
        return engine.reinvestDividend(a, body as ReinvestDividend);
      }
      return unsupported();
    }

    case "transactions": {
      if (b !== undefined) return unsupported();
      if (a === undefined) {
        if (method === "GET") return engine.listTransactions();
        if (method === "POST") return engine.createTransaction(body as CreateTransaction);
        return unsupported();
      }
      if (method !== "DELETE") return unsupported();
      engine.deleteTransaction(a);
      return null;
    }

    case "portfolio": {
      if (b !== undefined) return unsupported();
      if (a === undefined) {
        if (method === "GET") return engine.listPortfolio();
        if (method === "POST") return engine.createPortfolioItem(body as CreatePortfolioItem);
        return unsupported();
      }
      if (isUpdate) return engine.updatePortfolioItem(a, body as UpdatePortfolioItem);
      if (method === "DELETE") {
        engine.deletePortfolioItem(a);
        return null;
      }
      return unsupported();
    }

    case "recurrences": {
      if (b !== undefined) return unsupported();
      if (a === undefined) {
        if (method === "GET") return engine.listRecurrences();
        if (method === "POST") return engine.createRecurrence(body as CreateRecurrence);
        return unsupported();
      }
      // 種子資料的定期交易下一次都排在未來，沒有東西要補產生。
      if (a === "process") return method === "POST" ? { created: 0 } : unsupported();
      if (isUpdate) return engine.updateRecurrence(a, body as UpdateRecurrence);
      if (method === "DELETE") {
        engine.deleteRecurrence(a);
        return null;
      }
      return unsupported();
    }

    case "entitlements":
      return a === undefined && method === "GET" ? { isPremium: true } : unsupported();

    // 這兩支作用在真實帳號上。畫面已把入口藏起來，這裡是第二道。
    case "account":
    case "dev":
      return blocked();

    default:
      return unsupported();
  }
}
