import { NextResponse } from "next/server";

export async function GET() {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 5000);
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      signal: ctl.signal,
      next: { revalidate: 3600 },
    });
    if (!res.ok) throw new Error("Non-OK response");
    const data: { rates: Record<string, number> } = await res.json();
    const twd = data.rates["TWD"];
    if (!twd || twd <= 0) throw new Error("Invalid rate");
    return NextResponse.json({ TWD: twd });
  } catch {
    return NextResponse.json({ error: "fetch failed" }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}
