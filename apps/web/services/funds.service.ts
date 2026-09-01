import type { FundQuote, FundSearchResult } from "@repo/shared";
import { fetchWithRetry } from "@/lib/fetch-with-timeout";

/**
 * 基金淨值 —— 境內（投信）與境外基金各一個免費、免金鑰的官方來源。
 *
 * 境內：投信投顧公會 (SITCA) 的「證券投資信託基金每日淨值」CSV，掛在政府資料
 * 開放平臺 dataset 11109 底下、每日更新。每檔基金一列（不是歷史），列上的日期
 * 就是那檔基金最新的淨值日 —— 各家投信報價時間不同，所以同一份檔案裡會同時
 * 出現兩個日期。唯一鍵是「基金統編」；「基金代號」是各投信自己的流水號，
 * 跨公司會重複（例如 DDO01 有十幾家都在用），不能拿來當 key。
 *
 * 境外：集保結算所 (TDCC) open data 3-4「境外基金淨值」。這份是最近數個交易日
 * 的整包歷史，同一檔基金會出現多列，所以要自己取每檔的最新日期。
 *
 * 兩邊的代碼空間實測沒有交集（境外多為英數混合、境內統編為 8-9 位），查詢時
 * 先找境內、再找境外即可，不需要在 `Entry.stockCode` 上加前綴。
 */

const SITCA_NAV_CSV = "https://www.sitca.org.tw/MemberK0000/F/03/nav.csv";
const TDCC_OFFSHORE_NAV = "https://openapi.tdcc.com.tw/v1/opendata/3-4";

/**
 * 12 小時。兩個來源都是「每日一次」的批次檔，抓得再勤也不會更新，而境外那包
 * 有 8MB 左右 —— 超過 Next.js Data Cache 單筆 2MB 的上限，所以這裡用的是
 * 模組層記憶體快取（每個 serverless instance 各一份），不是 Data Cache。
 */
const CACHE_MS = 12 * 60 * 60 * 1000;

/** 整包下載＋解析要花好幾秒，預設的 5 秒 timeout 太短。 */
const FETCH_TIMEOUT_MS = 30_000;

export interface FundRecord {
  code: string;
  name: string;
  nav: number;
  currency: string;
  /** 淨值日，YYYY-MM-DD。 */
  navDate: string;
  source: "onshore" | "offshore";
}

interface CacheEntry {
  records: Map<string, FundRecord>;
  fetchedAt: number;
}

/** 20260827 → 2026-08-27。格式不對就回原字串，讓呼叫端看得出哪裡怪。 */
function formatDate(yyyymmdd: string): string {
  const s = yyyymmdd.trim();
  if (!/^\d{8}$/.test(s)) return s;
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

/**
 * 只夠用來解析這兩份檔案的 CSV 切行：欄位可能被雙引號包起來（基金名稱裡有
 * 逗號），引號內的逗號不算分隔。
 */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ",") {
      out.push(field);
      field = "";
    } else {
      field += c;
    }
  }
  out.push(field);
  return out;
}

/**
 * 淨值欄轉數字，只接受正數。
 *
 * 兩個都是實測踩到的坑：空字串走 `Number("")` 會變成 0（是個合法的有限數），
 * 而 TDCC 那份對沒有報價的基金填的是哨兵值 **-9999**（2026-08 的整包裡有數十
 * 檔）。任何一個漏掉，畫面上就會出現淨值 0 或 -9999 的市值與損益。
 */
function parseNav(raw: string | undefined): number | null {
  const s = (raw ?? "").trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** 兩份檔案的 key 都可能帶著 BOM（TDCC 是在 JSON 的 key 裡面）。 */
function stripBom(s: string): string {
  return s.replace(/^\uFEFF/, "").trim();
}

export function parseOnshoreCsv(csv: string): FundRecord[] {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim() !== "");
  const header = splitCsvLine(lines[0] ?? "").map(stripBom);
  const idx = (name: string) => header.indexOf(name);
  const iDate = idx("日期");
  const iCode = idx("基金統編");
  const iName = idx("基金名稱");
  const iNav = idx("基金淨值");
  const iCurrency = idx("幣別");
  if (iCode < 0 || iNav < 0 || iName < 0) return [];

  const out: FundRecord[] = [];
  for (const line of lines.slice(1)) {
    const cols = splitCsvLine(line);
    const code = stripBom(cols[iCode] ?? "");
    const name = (cols[iName] ?? "").trim();
    const nav = parseNav(cols[iNav]);
    if (!code || !name || nav === null) continue;
    out.push({
      code,
      name,
      nav,
      currency: (cols[iCurrency] ?? "TWD").trim() || "TWD",
      navDate: formatDate(cols[iDate] ?? ""),
      source: "onshore",
    });
  }
  return out;
}

export function parseOffshoreJson(rows: Record<string, string>[]): FundRecord[] {
  // 每檔基金有多天，留最新一天。
  const latest = new Map<string, FundRecord>();
  for (const row of rows) {
    const get = (key: string) => {
      const direct = row[key];
      if (direct !== undefined) return direct;
      const bomKey = Object.keys(row).find((k) => stripBom(k) === key);
      return bomKey ? row[bomKey] : undefined;
    };
    const code = stripBom(get("基金代碼") ?? "");
    const name = (get("基金名稱") ?? "").trim();
    const nav = parseNav(get("基金淨值(金額)"));
    if (!code || !name || nav === null) continue;
    const record: FundRecord = {
      code,
      name,
      nav,
      currency: (get("計價幣別") ?? "").trim() || "USD",
      navDate: formatDate(get("日期") ?? ""),
      source: "offshore",
    };
    const existing = latest.get(code);
    if (!existing || record.navDate > existing.navDate) latest.set(code, record);
  }
  return [...latest.values()];
}

export class FundsService {
  private onshore: CacheEntry | null = null;
  private offshore: CacheEntry | null = null;
  // 同一個 instance 上的併發請求共用同一次下載，不然冷啟動時的兩個查詢會各拉
  // 一份 8MB。
  private inflight = new Map<string, Promise<CacheEntry>>();

  /** 測試用：清掉記憶體快取。 */
  resetCache(): void {
    this.onshore = null;
    this.offshore = null;
    this.inflight.clear();
  }

  private fresh(entry: CacheEntry | null): boolean {
    return !!entry && Date.now() - entry.fetchedAt < CACHE_MS;
  }

  private async load(source: "onshore" | "offshore"): Promise<CacheEntry> {
    const cached = source === "onshore" ? this.onshore : this.offshore;
    if (this.fresh(cached)) return cached as CacheEntry;

    const pending = this.inflight.get(source);
    if (pending) return pending;

    const task = (async () => {
      const records = source === "onshore" ? await this.fetchOnshore() : await this.fetchOffshore();
      const entry: CacheEntry = {
        records: new Map(records.map((r) => [r.code, r])),
        fetchedAt: Date.now(),
      };
      if (source === "onshore") this.onshore = entry;
      else this.offshore = entry;
      return entry;
    })().finally(() => this.inflight.delete(source));

    this.inflight.set(source, task);
    return task;
  }

  private async fetchOnshore(): Promise<FundRecord[]> {
    const res = await fetchWithRetry(SITCA_NAV_CSV, undefined, { timeoutMs: FETCH_TIMEOUT_MS });
    if (!res.ok) throw new Error(`SITCA responded ${res.status}`);
    return parseOnshoreCsv(await res.text());
  }

  private async fetchOffshore(): Promise<FundRecord[]> {
    const res = await fetchWithRetry(TDCC_OFFSHORE_NAV, undefined, {
      timeoutMs: FETCH_TIMEOUT_MS,
    });
    if (!res.ok) throw new Error(`TDCC responded ${res.status}`);
    return parseOffshoreJson(await res.json());
  }

  /**
   * 兩個來源分開載入、各自失敗各自算。單一來源掛掉時仍然回得出另一邊的結果 ——
   * 對使用者來說「查得到一部分」遠比整個功能壞掉好。
   */
  private async loadAll(): Promise<FundRecord[]> {
    const [onshore, offshore] = await Promise.allSettled([
      this.load("onshore"),
      this.load("offshore"),
    ]);
    const records: FundRecord[] = [];
    if (onshore.status === "fulfilled") records.push(...onshore.value.records.values());
    if (offshore.status === "fulfilled") records.push(...offshore.value.records.values());
    if (records.length === 0) throw new Error("Both fund NAV sources are unavailable");
    return records;
  }

  /**
   * 依名稱搜尋。使用者輸入的是自己記的名字（「安聯台灣大壩」），不是官方全名
   * （「安聯台灣大壩基金-A累積類型(新臺幣)」），所以比對規則是「查詢字串的每
   * 一段都出現在官方名稱裡」，而不是整串相等；名稱開頭命中的排前面。
   */
  async search(query: string, limit = 20): Promise<FundSearchResult[]> {
    const q = query.trim();
    if (!q) return [];
    const records = await this.loadAll();
    const terms = q.split(/\s+/).filter(Boolean);

    const scored: { record: FundRecord; score: number }[] = [];
    for (const record of records) {
      if (!terms.every((t) => record.name.includes(t))) continue;
      // 直接以查詢開頭的最像使用者要的那一檔。
      scored.push({ record, score: record.name.startsWith(terms[0] ?? "") ? 0 : 1 });
    }
    scored.sort((a, b) => a.score - b.score || a.record.name.localeCompare(b.record.name, "zh-TW"));

    return scored.slice(0, limit).map(({ record }) => ({
      code: record.code,
      name: record.name,
      currency: record.currency,
      source: record.source,
    }));
  }

  /** 用官方代碼取最新淨值。查不到回 null，由 route 轉成 404。 */
  async getQuote(code: string): Promise<FundQuote | null> {
    const wanted = code.trim();
    if (!wanted) return null;
    const [onshore, offshore] = await Promise.allSettled([
      this.load("onshore"),
      this.load("offshore"),
    ]);
    for (const result of [onshore, offshore]) {
      if (result.status !== "fulfilled") continue;
      const record = result.value.records.get(wanted);
      if (record) {
        return {
          code: record.code,
          name: record.name,
          nav: record.nav,
          currency: record.currency,
          navDate: record.navDate,
          source: record.source,
        };
      }
    }
    if (onshore.status === "rejected" && offshore.status === "rejected") {
      throw new Error("Both fund NAV sources are unavailable");
    }
    return null;
  }
}

export const fundsService = new FundsService();
