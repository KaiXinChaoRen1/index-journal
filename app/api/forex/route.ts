import { NextResponse } from "next/server";
import { getForexApiPayload } from "@/lib/forex-data";

export const dynamic = "force-dynamic";

export async function GET() {
  const payload = await getForexApiPayload();

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    data: payload,
  });
}
