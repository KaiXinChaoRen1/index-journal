import { NextResponse } from "next/server";
import { fetchPresetCnFundQuarterlyBatch } from "@/lib/cn-fund-quarterly";
import { OTC_FUND_CODES } from "@/lib/otc-fund-config";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const forceRefresh = url.searchParams.get("refresh") === "1";
  const results = await fetchPresetCnFundQuarterlyBatch(OTC_FUND_CODES, { forceRefresh });

  return NextResponse.json({
    generatedAt: results.generatedAt,
    fromCache: results.fromCache,
    data: results.data,
  });
}
