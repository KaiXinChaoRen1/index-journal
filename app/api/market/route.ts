import { NextResponse } from "next/server";
import { getMarketApiPayload } from "@/lib/index-data";

export const dynamic = "force-dynamic";

export async function GET() {
  const payload = await getMarketApiPayload();

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    data: payload,
  });
}
