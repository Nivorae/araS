import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { fetchWithRetry } from "@/lib/fetch-with-timeout";
import { logSecurityEvent } from "@/lib/security-log";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    logSecurityEvent({ type: "auth_fail", resource: "/api/exchange-rate" });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const res = await fetchWithRetry("https://open.er-api.com/v6/latest/USD", {
      next: { revalidate: 3600 },
    });
    if (!res.ok) throw new Error("Non-OK response");
    const data: { rates: Record<string, number> } = await res.json();
    const twd = data.rates["TWD"];
    if (!twd || twd <= 0) throw new Error("Invalid rate");
    return NextResponse.json({ TWD: twd });
  } catch {
    return NextResponse.json({ error: "fetch failed" }, { status: 502 });
  }
}
