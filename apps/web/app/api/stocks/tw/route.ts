import { NextResponse } from "next/server";
import { mergeExchangeStocks } from "./mergeExchangeStocks";

// TWSE: all securities traded today (stocks + equity ETFs + bond ETFs listed on TWSE)
const TWSE_ALL = "https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL";
// TWSE: better Chinese short names for listed companies
const TWSE_COMPANIES = "https://openapi.twse.com.tw/v1/opendata/t187ap03_L";
// TPEx (OTC/上櫃): covers bond ETFs (e.g. 00933B) and OTC-listed stocks absent from TWSE
const TPEX_ALL = "https://www.tpex.org.tw/openapi/v1/tpex_mainboard_daily_close_quotes";

// Shared across all serverless instances via Next.js Data Cache (a module-level
// variable would not be — each cold instance has its own memory).
const CACHE_SECONDS = 60 * 60; // 1 hour

async function fetchJSON(url: string, signal: AbortSignal): Promise<Record<string, string>[]> {
  try {
    const res = await fetch(url, { next: { revalidate: CACHE_SECONDS }, signal });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function GET() {
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 5000);
    let allSecurities: Record<string, string>[],
      companies: Record<string, string>[],
      tpexSecurities: Record<string, string>[];
    try {
      [allSecurities, companies, tpexSecurities] = await Promise.all([
        fetchJSON(TWSE_ALL, ctl.signal),
        fetchJSON(TWSE_COMPANIES, ctl.signal),
        fetchJSON(TPEX_ALL, ctl.signal),
      ]);
    } finally {
      clearTimeout(timer);
    }

    const nameMap = new Map<string, string>();
    for (const item of companies) {
      const code = item["公司代號"]?.trim();
      const name = (item["公司簡稱"] ?? item["公司名稱"])?.trim();
      if (code && name) nameMap.set(code, name);
    }

    const result = mergeExchangeStocks(allSecurities, tpexSecurities, nameMap);

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Failed to fetch" }, { status: 502 });
  }
}
