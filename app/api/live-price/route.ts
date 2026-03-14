import { NextRequest, NextResponse } from "next/server";
import { FOREX_DEFINITIONS } from "@/lib/forex-data";
import { fetchOfficialLivePrice } from "@/lib/live-price";
import { MARKET_DEFINITIONS } from "@/lib/index-data";

export const dynamic = "force-dynamic";

const SUPPORTED_SYMBOLS = new Set<string>([
  ...MARKET_DEFINITIONS.map((item) => item.symbol),
  ...FOREX_DEFINITIONS.map((item) => item.symbol),
]);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol");

  if (!symbol) {
    return NextResponse.json({ error: "Missing symbol query parameter." }, { status: 400 });
  }

  if (!SUPPORTED_SYMBOLS.has(symbol)) {
    return NextResponse.json({ error: "Unsupported symbol." }, { status: 400 });
  }

  try {
    const data = await fetchOfficialLivePrice(symbol);

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      data,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown live price error." },
      { status: 502 },
    );
  }
}
