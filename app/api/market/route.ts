import { NextResponse } from "next/server";
import { getMarketApiPayload } from "@/lib/index-data";

export const dynamic = "force-dynamic";

// API route 只做协议层包装，真实数据装配在 lib/index-data.ts。
export async function GET() {
  const payload = await getMarketApiPayload();

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    data: payload,
  });
}
