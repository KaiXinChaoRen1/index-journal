import { NextResponse } from "next/server";
import { FUND_QUARTERLY_KIND, listStoredFundQuarterlies, saveTrackedFundQuarterly } from "@/lib/cn-fund-quarterly";

export const dynamic = "force-dynamic";

function extractFundCode(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const { fundCode } = payload as { fundCode?: unknown };
  return typeof fundCode === "string" ? fundCode : null;
}

export async function GET() {
  const results = await listStoredFundQuarterlies(FUND_QUARTERLY_KIND.otc);

  return NextResponse.json(results);
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as unknown;
    const fundCode = extractFundCode(payload);

    if (!fundCode) {
      return NextResponse.json({ message: "缺少基金代码。" }, { status: 400 });
    }

    const item = await saveTrackedFundQuarterly(FUND_QUARTERLY_KIND.otc, fundCode);

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      item,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "抓取基金季报失败，请稍后重试。";
    const status = message.includes("基金代码") ? 400 : 500;

    return NextResponse.json({ message }, { status });
  }
}
