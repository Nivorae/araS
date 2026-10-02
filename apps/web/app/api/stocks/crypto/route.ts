import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { fetchCryptoList } from "@/services/crypto-list.service";
import { logSecurityEvent } from "@/lib/security-log";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    logSecurityEvent({ type: "auth_fail", resource: "/api/stocks/crypto" });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await fetchCryptoList();
  if (result.length === 0) {
    return NextResponse.json({ error: "Failed to fetch" }, { status: 502 });
  }
  return NextResponse.json(result);
}
