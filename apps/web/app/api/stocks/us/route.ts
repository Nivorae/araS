import { NextResponse } from "next/server";

// SEC EDGAR company tickers — free, no auth required
const SEC_TICKERS_URL = "https://www.sec.gov/files/company_tickers.json";

// Common ETFs not covered by SEC EDGAR company tickers
const COMMON_ETFS: { code: string; name: string }[] = [
  // Broad US market
  { code: "VOO", name: "Vanguard S&P 500 ETF" },
  { code: "SPY", name: "SPDR S&P 500 ETF Trust" },
  { code: "IVV", name: "iShares Core S&P 500 ETF" },
  { code: "VTI", name: "Vanguard Total Stock Market ETF" },
  { code: "ITOT", name: "iShares Core S&P Total US Stock Market ETF" },
  { code: "SCHB", name: "Schwab US Broad Market ETF" },
  { code: "QQQ", name: "Invesco QQQ Trust" },
  { code: "QQQM", name: "Invesco Nasdaq 100 ETF" },
  { code: "DIA", name: "SPDR Dow Jones Industrial Average ETF Trust" },
  { code: "MDY", name: "SPDR S&P MidCap 400 ETF Trust" },
  { code: "IWM", name: "iShares Russell 2000 ETF" },
  // Growth / Value / Factor
  { code: "VUG", name: "Vanguard Growth ETF" },
  { code: "VTV", name: "Vanguard Value ETF" },
  { code: "VBK", name: "Vanguard Small-Cap Growth ETF" },
  { code: "VBR", name: "Vanguard Small-Cap Value ETF" },
  { code: "MTUM", name: "iShares MSCI USA Momentum Factor ETF" },
  { code: "QUAL", name: "iShares MSCI USA Quality Factor ETF" },
  { code: "VLUE", name: "iShares MSCI USA Value Factor ETF" },
  // International
  { code: "VEA", name: "Vanguard FTSE Developed Markets ETF" },
  { code: "VWO", name: "Vanguard FTSE Emerging Markets ETF" },
  { code: "EFA", name: "iShares MSCI EAFE ETF" },
  { code: "EEM", name: "iShares MSCI Emerging Markets ETF" },
  { code: "IEFA", name: "iShares Core MSCI EAFE ETF" },
  { code: "IEMG", name: "iShares Core MSCI Emerging Markets ETF" },
  { code: "VT", name: "Vanguard Total World Stock ETF" },
  // US Sectors (SPDR)
  { code: "XLF", name: "Financial Select Sector SPDR Fund" },
  { code: "XLK", name: "Technology Select Sector SPDR Fund" },
  { code: "XLE", name: "Energy Select Sector SPDR Fund" },
  { code: "XLV", name: "Health Care Select Sector SPDR Fund" },
  { code: "XLY", name: "Consumer Discretionary Select Sector SPDR Fund" },
  { code: "XLP", name: "Consumer Staples Select Sector SPDR Fund" },
  { code: "XLI", name: "Industrial Select Sector SPDR Fund" },
  { code: "XLB", name: "Materials Select Sector SPDR Fund" },
  { code: "XLU", name: "Utilities Select Sector SPDR Fund" },
  { code: "XLRE", name: "Real Estate Select Sector SPDR Fund" },
  { code: "XLC", name: "Communication Services Select Sector SPDR Fund" },
  // Fixed income
  { code: "BND", name: "Vanguard Total Bond Market ETF" },
  { code: "AGG", name: "iShares Core US Aggregate Bond ETF" },
  { code: "TLT", name: "iShares 20+ Year Treasury Bond ETF" },
  { code: "IEF", name: "iShares 7-10 Year Treasury Bond ETF" },
  { code: "SHY", name: "iShares 1-3 Year Treasury Bond ETF" },
  { code: "LQD", name: "iShares iBoxx $ Investment Grade Corporate Bond ETF" },
  { code: "HYG", name: "iShares iBoxx $ High Yield Corporate Bond ETF" },
  { code: "VCIT", name: "Vanguard Intermediate-Term Corporate Bond ETF" },
  { code: "VCSH", name: "Vanguard Short-Term Corporate Bond ETF" },
  { code: "BNDX", name: "Vanguard Total International Bond ETF" },
  // Dividend
  { code: "VYM", name: "Vanguard High Dividend Yield ETF" },
  { code: "SCHD", name: "Schwab US Dividend Equity ETF" },
  { code: "DVY", name: "iShares Select Dividend ETF" },
  { code: "HDV", name: "iShares Core High Dividend ETF" },
  { code: "DGRO", name: "iShares Core Dividend Growth ETF" },
  // Real estate
  { code: "VNQ", name: "Vanguard Real Estate ETF" },
  { code: "IYR", name: "iShares US Real Estate ETF" },
  // Commodities & metals
  { code: "GLD", name: "SPDR Gold Shares" },
  { code: "IAU", name: "iShares Gold Trust" },
  { code: "SLV", name: "iShares Silver Trust" },
  { code: "GDX", name: "VanEck Gold Miners ETF" },
  { code: "GDXJ", name: "VanEck Junior Gold Miners ETF" },
  { code: "USO", name: "United States Oil Fund" },
  { code: "PDBC", name: "Invesco Optimum Yield Diversified Commodity Strategy ETF" },
  // Thematic / popular
  { code: "ARKK", name: "ARK Innovation ETF" },
  { code: "ARKG", name: "ARK Genomic Revolution ETF" },
  { code: "ARKW", name: "ARK Next Generation Internet ETF" },
  { code: "ARKF", name: "ARK Fintech Innovation ETF" },
  { code: "ARKQ", name: "ARK Autonomous Technology & Robotics ETF" },
  { code: "BOTZ", name: "Global X Robotics & Artificial Intelligence ETF" },
  { code: "ICLN", name: "iShares Global Clean Energy ETF" },
  { code: "SOXX", name: "iShares Semiconductor ETF" },
  { code: "SMH", name: "VanEck Semiconductor ETF" },
  { code: "CIBR", name: "First Trust Nasdaq Cybersecurity ETF" },
  { code: "HACK", name: "ETFMG Prime Cyber Security ETF" },
  // Leveraged / inverse (popular)
  { code: "TQQQ", name: "ProShares UltraPro QQQ" },
  { code: "SQQQ", name: "ProShares UltraPro Short QQQ" },
  { code: "UPRO", name: "ProShares UltraPro S&P 500" },
  { code: "SPXS", name: "Direxion Daily S&P 500 Bear 3X Shares" },
  { code: "SOXL", name: "Direxion Daily Semiconductor Bull 3X Shares" },
  { code: "SOXS", name: "Direxion Daily Semiconductor Bear 3X Shares" },
  { code: "SPXU", name: "ProShares UltraPro Short S&P 500" },
  // Multi-asset / all-in-one
  { code: "AOM", name: "iShares Core Moderate Allocation ETF" },
  { code: "AOA", name: "iShares Core Aggressive Allocation ETF" },
  { code: "AOK", name: "iShares Core Conservative Allocation ETF" },
];

// Shared across all serverless instances via Next.js Data Cache (a module-level
// variable would not be — each cold instance has its own memory).
const CACHE_SECONDS = 24 * 60 * 60; // 24 hours (list changes rarely)

export async function GET() {
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 5000);
    let res: Response;
    try {
      res = await fetch(SEC_TICKERS_URL, {
        signal: ctl.signal,
        next: { revalidate: CACHE_SECONDS },
        headers: { "User-Agent": "araS-finance-app contact@example.com" },
      });
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      return NextResponse.json({ error: "Failed to fetch" }, { status: 502 });
    }

    const raw: Record<string, { cik_str: number; ticker: string; title: string }> =
      await res.json();

    const secStocks = Object.values(raw)
      .map((item) => ({
        code: item.ticker?.toUpperCase() ?? "",
        name: item.title ?? "",
      }))
      .filter((s) => s.code && s.name);

    const secCodes = new Set(secStocks.map((s) => s.code));
    const merged = [...secStocks, ...COMMON_ETFS.filter((etf) => !secCodes.has(etf.code))].sort(
      (a, b) => a.code.localeCompare(b.code)
    );

    return NextResponse.json(merged);
  } catch {
    return NextResponse.json({ error: "Failed to fetch" }, { status: 502 });
  }
}
