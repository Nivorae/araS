import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const fetchWithRetry = vi.fn();
vi.mock("@/lib/fetch-with-timeout", () => ({
  fetchWithRetry: (...args: unknown[]) => fetchWithRetry(...args),
}));

import { FundsService, parseOnshoreCsv, parseOffshoreJson } from "@/services/funds.service";

// 兩份真實檔案的節錄，欄位順序與 BOM 位置都照抄 —— 這兩個細節正是解析最容易
// 壞掉的地方（境內的 BOM 在檔頭、境外的 BOM 黏在 JSON 的 key 上）。
const ONSHORE_CSV = `\uFEFF日期,會員代號,公司名稱,基金統編,基金代號,基金名稱,基金淨值,漲跌,漲跌幅,類型代號,幣別,受益憑證代號
20260826,A0001,兆豐投信,00512527,DIE02,兆豐美國企業優選投資級公司債ETF基金,13.1006,-0.0173,-0.13188,AH22,TWD,00957B
20260827,A0009,統一投信,01031699A,DDO01,"統一全天候基金-A類型,累積",960.87,12.75,1.34477,AA1,TWD,T0902Y
20260827,A0001,兆豐投信,00965469,DDO01,兆豐第一基金,68.62,0.74,1.09016,AA1,TWD,T0102Y`;

const OFFSHORE_ROWS = [
  {
    基金名稱: "天利(盧森堡)-歐洲策略債券基金(歐元)",
    日期: "20260820",
    "\uFEFF基金代碼": "000AMEEBEI",
    "基金淨值(金額)": "31.617300",
    計價幣別: "EUR",
  },
  {
    基金名稱: "天利(盧森堡)-歐洲策略債券基金(歐元)",
    日期: "20260824",
    "\uFEFF基金代碼": "000AMEEBEI",
    "基金淨值(金額)": "31.596200",
    計價幣別: "EUR",
  },
  {
    基金名稱: "壞資料：沒有淨值",
    日期: "20260824",
    "\uFEFF基金代碼": "BADFUND",
    "基金淨值(金額)": "",
    計價幣別: "USD",
  },
  {
    // TDCC 對沒有報價的基金填 -9999，不是留空。
    基金名稱: "瑞銀 (盧森堡) 策略基金 - 增長型 (美元) I-A1-配息",
    日期: "20260824",
    "\uFEFF基金代碼": "129749602",
    "基金淨值(金額)": "-9999",
    計價幣別: "USD",
  },
];

function csvResponse(body: string) {
  return { ok: true, status: 200, text: async () => body, json: async () => [] };
}
function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body, text: async () => "" };
}

/** 依 URL 決定回哪個來源，讓測試不必在意兩次 fetch 的先後。 */
function respondBoth() {
  fetchWithRetry.mockImplementation(async (url: string) =>
    url.includes("sitca") ? csvResponse(ONSHORE_CSV) : jsonResponse(OFFSHORE_ROWS)
  );
}

describe("parseOnshoreCsv", () => {
  it("讀得到帶 BOM 的檔頭，並解析出每一列", () => {
    const records = parseOnshoreCsv(ONSHORE_CSV);
    expect(records).toHaveLength(3);
    expect(records[0]).toEqual({
      code: "00512527",
      name: "兆豐美國企業優選投資級公司債ETF基金",
      nav: 13.1006,
      currency: "TWD",
      navDate: "2026-08-26",
      source: "onshore",
    });
  });

  it("名稱裡的逗號被雙引號包住時不會被切成兩欄", () => {
    const record = parseOnshoreCsv(ONSHORE_CSV).find((r) => r.code === "01031699A");
    expect(record?.name).toBe("統一全天候基金-A類型,累積");
    expect(record?.nav).toBe(960.87);
  });

  it("同一個「基金代號」跨投信重複時，統編仍然把它們分開", () => {
    // DDO01 在兩家投信底下各有一檔 —— 用基金代號當 key 會少一筆。
    const ddo01 = parseOnshoreCsv(ONSHORE_CSV).filter((r) => r.name.includes("基金"));
    expect(new Set(ddo01.map((r) => r.code)).size).toBe(ddo01.length);
  });
});

describe("parseOffshoreJson", () => {
  it("每檔基金只留最新一天", () => {
    const records = parseOffshoreJson(OFFSHORE_ROWS);
    const fund = records.find((r) => r.code === "000AMEEBEI");
    expect(records.filter((r) => r.code === "000AMEEBEI")).toHaveLength(1);
    expect(fund?.navDate).toBe("2026-08-24");
    expect(fund?.nav).toBe(31.5962);
  });

  it("淨值不是數字的列直接丟掉", () => {
    expect(parseOffshoreJson(OFFSHORE_ROWS).some((r) => r.code === "BADFUND")).toBe(false);
  });

  it("TDCC 的 -9999 哨兵值不會被當成真的淨值", () => {
    expect(parseOffshoreJson(OFFSHORE_ROWS).some((r) => r.code === "129749602")).toBe(false);
  });
});

describe("FundsService", () => {
  let service: FundsService;

  beforeEach(() => {
    fetchWithRetry.mockReset();
    service = new FundsService();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("依名稱搜尋，兩個來源的結果都在裡面", async () => {
    respondBoth();
    const results = await service.search("基金");
    expect(results.some((r) => r.source === "onshore")).toBe(true);
    expect(results.some((r) => r.source === "offshore")).toBe(true);
  });

  it("查詢字串的每一段都要命中才算符合", async () => {
    respondBoth();
    expect(await service.search("兆豐 第一")).toEqual([
      { code: "00965469", name: "兆豐第一基金", currency: "TWD", source: "onshore" },
    ]);
    expect(await service.search("兆豐 不存在")).toEqual([]);
  });

  it("空字串不會去打上游", async () => {
    respondBoth();
    expect(await service.search("   ")).toEqual([]);
    expect(fetchWithRetry).not.toHaveBeenCalled();
  });

  it("用代碼取得淨值", async () => {
    respondBoth();
    await expect(service.getQuote("000AMEEBEI")).resolves.toMatchObject({
      name: "天利(盧森堡)-歐洲策略債券基金(歐元)",
      nav: 31.5962,
      currency: "EUR",
      source: "offshore",
    });
  });

  it("查不到的代碼回 null（由 route 轉 404），不是丟例外", async () => {
    respondBoth();
    await expect(service.getQuote("NOPE")).resolves.toBeNull();
  });

  it("一個來源掛掉時，另一個來源的基金仍然查得到", async () => {
    fetchWithRetry.mockImplementation(async (url: string) => {
      if (url.includes("sitca")) throw new Error("SITCA down");
      return jsonResponse(OFFSHORE_ROWS);
    });
    await expect(service.getQuote("000AMEEBEI")).resolves.toMatchObject({ nav: 31.5962 });
    expect(await service.search("天利")).toHaveLength(1);
  });

  it("兩個來源都掛掉才算失敗", async () => {
    fetchWithRetry.mockRejectedValue(new Error("network"));
    await expect(service.search("基金")).rejects.toThrow("unavailable");
  });

  it("12 小時內不重抓，逾時後才重新下載", async () => {
    vi.useFakeTimers();
    respondBoth();
    await service.search("基金");
    const callsAfterFirst = fetchWithRetry.mock.calls.length;
    expect(callsAfterFirst).toBe(2); // 兩個來源各一次

    await service.search("基金");
    expect(fetchWithRetry).toHaveBeenCalledTimes(callsAfterFirst);

    vi.advanceTimersByTime(12 * 60 * 60 * 1000 + 1);
    await service.search("基金");
    expect(fetchWithRetry).toHaveBeenCalledTimes(callsAfterFirst * 2);
  });

  it("同時進來的兩個查詢共用一次下載", async () => {
    respondBoth();
    await Promise.all([service.search("基金"), service.search("天利")]);
    expect(fetchWithRetry).toHaveBeenCalledTimes(2); // 不是 4
  });
});
