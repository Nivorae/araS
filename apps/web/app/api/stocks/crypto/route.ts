import { NextResponse } from "next/server";
import { fetchCryptoList } from "@/services/crypto-list.service";

export async function GET() {
  const result = await fetchCryptoList();
  if (result.length === 0) {
    return NextResponse.json({ error: "Failed to fetch" }, { status: 502 });
  }
  return NextResponse.json(result);
}
