import { NextResponse } from "next/server";
import { fetchWithRetry } from "@/lib/fetch-with-timeout";

export const revalidate = 43200; // cache 12 hours

interface CathayRateRow {
  declare_month: string;
  declare_year: string;
  rate_m: string;
  rate_q: string;
  prod_id: string;
  prod_name: string;
  prod_classify: string;
}

export async function GET() {
  try {
    const res = await fetchWithRetry(
      "https://www.cathaylife.com.tw/cathaylifeins/api/DTODBHZ6/getAllByJoinZ5",
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible)",
          Referer: "https://www.cathaylife.com.tw/cathaylifeins/common/rate",
          Accept: "application/json",
        },
        next: { revalidate: 43200 },
      }
    );

    if (!res.ok) {
      return NextResponse.json({ error: "upstream fetch failed" }, { status: 502 });
    }

    const json = await res.json();
    if (json.returnCode !== 0) {
      return NextResponse.json({ error: "upstream error", code: json.returnCode }, { status: 502 });
    }

    const all: CathayRateRow[] = json.data;

    // Current ROC year and month
    const now = new Date();
    const rocYear = String(now.getFullYear() - 1911);
    const month = String(now.getMonth() + 1);

    // USD products = prod_classify "018", current month
    let usdCurrent = all.filter(
      (d) => d.prod_classify === "018" && d.declare_year === rocYear && d.declare_month === month
    );

    // Fallback: if current month not published yet, try previous month
    if (usdCurrent.length === 0) {
      const prevMonth = String(now.getMonth()) || "12";
      const prevYear = now.getMonth() === 0 ? String(now.getFullYear() - 1912) : rocYear;
      usdCurrent = all.filter(
        (d) =>
          d.prod_classify === "018" && d.declare_year === prevYear && d.declare_month === prevMonth
      );
    }

    // Deduplicate by prod_id (keep latest), sort by rate desc
    const seen = new Map<string, CathayRateRow>();
    for (const row of usdCurrent) {
      seen.set(row.prod_id, row);
    }

    const rates = Array.from(seen.values())
      .filter((r) => r.rate_m && r.rate_m !== "--")
      .sort((a, b) => parseFloat(b.rate_m) - parseFloat(a.rate_m));

    const adYear = parseInt(rocYear) + 1911;
    return NextResponse.json({
      data: rates,
      month: `${adYear}/${month.padStart(2, "0")}`,
    });
  } catch (err) {
    console.error("[cathaylife-rates]", err);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
