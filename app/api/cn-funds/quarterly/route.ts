import { NextResponse } from "next/server";
import { fetchPresetCnFundQuarterlyBatch, getPresetCnFundCodes } from "@/lib/cn-fund-quarterly";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const codes = getPresetCnFundCodes();
  const url = new URL(request.url);
  const forceRefresh = url.searchParams.get("refresh") === "1";
  const results = await fetchPresetCnFundQuarterlyBatch(codes, { forceRefresh });

  return NextResponse.json({
    generatedAt: results.generatedAt,
    fromCache: results.fromCache,
    data: results.data,
  });
}
