import { NextResponse } from "next/server";
import { getBtcApiPayload } from "@/lib/btc-data";

export const dynamic = "force-dynamic";

export async function GET() {
  const payload = await getBtcApiPayload();

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    data: payload,
  });
}
