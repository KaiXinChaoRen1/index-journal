import { NextRequest, NextResponse } from "next/server";
import {
  getMarketChartData,
  MARKET_DEFINITIONS,
  parseChartRange,
} from "@/lib/index-data";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol");

  if (!symbol) {
    return NextResponse.json({ error: "Missing symbol query parameter." }, { status: 400 });
  }

  const market = MARKET_DEFINITIONS.find((item) => item.symbol === symbol);

  if (!market) {
    return NextResponse.json({ error: "Unsupported symbol." }, { status: 400 });
  }

  const range = parseChartRange(searchParams.get("range"));
  const data = await getMarketChartData(symbol, range);

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    data,
  });
}
