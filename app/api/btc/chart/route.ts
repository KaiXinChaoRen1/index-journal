import { NextRequest, NextResponse } from "next/server";
import {
  getBtcChartData,
  isBtcSymbolSupported,
  parseBtcChartRange,
} from "@/lib/btc-data";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol");

  if (!symbol) {
    return NextResponse.json({ error: "Missing symbol query parameter." }, { status: 400 });
  }

  if (!isBtcSymbolSupported(symbol)) {
    return NextResponse.json({ error: "Unsupported symbol." }, { status: 400 });
  }

  const range = parseBtcChartRange(searchParams.get("range"));
  const data = await getBtcChartData(range);

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    data,
  });
}
