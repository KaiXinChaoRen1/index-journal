import { prisma } from "@/lib/prisma";
import {
  formatDate,
  formatPercentOrFallback,
  type ChartRange,
  type MarketChartData,
} from "@/lib/market-shared";
import { getMarketChartData, parseChartRange } from "@/lib/index-data";
import {
  calcPct,
  computeChangePct,
  findFirstOnOrAfter,
  round,
  shiftDateByMonths,
  shiftDateByYears,
  startOfMonth,
  startOfWeek,
} from "@/lib/price-analytics";

/**
 * BTC 观察页服务层。
 *
 * 这里和首页、汇率页保持一致：统一读本地 dailyPrice，再由服务层计算展示指标。
 * 这样做的好处是页面之间的数据流非常统一，阅读时不需要切换太多思路。
 */
export const BTC_SYMBOL = "BTC/USD" as const;
const BTC_DEFAULT_CHART_RANGE: ChartRange = "1Y";

type DailyPriceRecord = {
  symbol: string;
  date: Date;
  close: number;
};

export type BtcCard = {
  symbol: typeof BTC_SYMBOL;
  title: string;
  description: string;
  latestDate: Date;
  currentPrice: number;
  dailyChangePct: number;
  weeklyChangePct: number;
  monthlyChangePct: number;
  sixMonthChangePct: number | null;
  oneYearChangePct: number | null;
  twoYearChangePct: number | null;
  threeYearChangePct: number | null;
  fiveYearChangePct: number | null;
  tenYearChangePct: number | null;
  maxDrawdownPct: number | null;
};

function computeMaxDrawdownPct(rows: DailyPriceRecord[]) {
  if (rows.length === 0) {
    return null;
  }

  // 口径：按完整历史扫描“峰值 -> 后续最低点”的最大跌幅，输出负百分比。
  let peakClose = rows[0].close;
  let worstDrawdown = 0;

  for (const row of rows) {
    if (row.close > peakClose) {
      peakClose = row.close;
      continue;
    }

    const drawdown = calcPct(row.close, peakClose);

    if (drawdown < worstDrawdown) {
      worstDrawdown = drawdown;
    }
  }

  return round(worstDrawdown);
}

function buildBtcCard(rows: DailyPriceRecord[]): BtcCard | null {
  const latest = rows.at(-1);
  const previous = rows.at(-2);

  if (!latest || !previous) {
    return null;
  }

  const weekStartRow = findFirstOnOrAfter(rows, startOfWeek(latest.date));
  const monthStartRow = findFirstOnOrAfter(rows, startOfMonth(latest.date));

  if (!weekStartRow || !monthStartRow) {
    return null;
  }

  return {
    symbol: BTC_SYMBOL,
    title: "BTC 观察",
    description: "作为补充观察对象，用于快速判断 BTC/USD 的位置与区间变化。",
    latestDate: latest.date,
    currentPrice: latest.close,
    dailyChangePct: round(calcPct(latest.close, previous.close)),
    weeklyChangePct: round(calcPct(latest.close, weekStartRow.close)),
    monthlyChangePct: round(calcPct(latest.close, monthStartRow.close)),
    sixMonthChangePct: computeChangePct(latest.close, rows, shiftDateByMonths(latest.date, 6)),
    oneYearChangePct: computeChangePct(latest.close, rows, shiftDateByYears(latest.date, 1)),
    twoYearChangePct: computeChangePct(latest.close, rows, shiftDateByYears(latest.date, 2)),
    threeYearChangePct: computeChangePct(latest.close, rows, shiftDateByYears(latest.date, 3)),
    fiveYearChangePct: computeChangePct(latest.close, rows, shiftDateByYears(latest.date, 5)),
    tenYearChangePct: computeChangePct(latest.close, rows, shiftDateByYears(latest.date, 10)),
    maxDrawdownPct: computeMaxDrawdownPct(rows),
  };
}

export async function getBtcCard() {
  // 数据流保持与指数、汇率一致：统一读本地 dailyPrice，再由服务层计算指标。
  const rows = await prisma.dailyPrice.findMany({
    where: { symbol: BTC_SYMBOL },
    orderBy: { date: "asc" },
    select: {
      symbol: true,
      date: true,
      close: true,
    },
  });

  return buildBtcCard(rows);
}

export async function getBtcChartData(range: ChartRange = BTC_DEFAULT_CHART_RANGE) {
  return getMarketChartData(BTC_SYMBOL, range);
}

export async function getDefaultBtcChart() {
  return getBtcChartData(BTC_DEFAULT_CHART_RANGE);
}

export async function getBtcApiPayload() {
  const card = await getBtcCard();

  if (!card) {
    return null;
  }

  return {
    symbol: card.symbol,
    title: card.title,
    latestDate: card.latestDate.toISOString().slice(0, 10),
    currentPrice: card.currentPrice,
    dailyChangePct: card.dailyChangePct,
    weeklyChangePct: card.weeklyChangePct,
    monthlyChangePct: card.monthlyChangePct,
    sixMonthChangePct: card.sixMonthChangePct,
    oneYearChangePct: card.oneYearChangePct,
    twoYearChangePct: card.twoYearChangePct,
    threeYearChangePct: card.threeYearChangePct,
    fiveYearChangePct: card.fiveYearChangePct,
    tenYearChangePct: card.tenYearChangePct,
    maxDrawdownPct: card.maxDrawdownPct,
  };
}

export function parseBtcChartRange(value: string | null | undefined) {
  if (!value) {
    return BTC_DEFAULT_CHART_RANGE;
  }

  return parseChartRange(value);
}

export function isBtcSymbolSupported(symbol: string) {
  return symbol === BTC_SYMBOL;
}

export function getBtcMissingDataMessage() {
  if (!process.env.TWELVE_DATA_API_KEY) {
    return "尚未配置 TWELVE_DATA_API_KEY，请先在 .env 中补充 API Key。";
  }

  return "数据库里还没有 BTC/USD 的日线，请先执行 npm run sync:data。";
}

export { formatDate, formatPercentOrFallback, type MarketChartData };
