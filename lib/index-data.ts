import { prisma } from "@/lib/prisma";
import {
  CHART_RANGES,
  formatDate,
  formatDateOrFallback,
  formatIndexValue,
  formatPercent,
  formatPercentOrFallback,
  getDefaultChartRange,
  isChartRange,
  type ChartRange,
  type MarketChartData,
  type MarketChartPoint,
} from "@/lib/market-shared";

export const MARKET_DEFINITIONS = [
  {
    marketKey: "SP500",
    title: "S&P 500",
    symbol: "SPY",
    description: "使用 SPY 作为标普 500 的个人使用替代追踪。",
  },
  {
    marketKey: "NASDAQ100",
    title: "Nasdaq 100",
    symbol: "QQQ",
    description: "使用 QQQ 作为纳指 100 的个人使用替代追踪。",
  },
] as const;

export type MarketKey = (typeof MARKET_DEFINITIONS)[number]["marketKey"];
const MAX_CHART_POINTS = 480;

type DailyPriceRecord = {
  symbol: string;
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type MarketCard = {
  marketKey: MarketKey;
  title: string;
  symbol: string;
  description: string;
  latestDate: Date;
  currentPrice: number;
  dailyChangePct: number;
  weeklyChangePct: number;
  monthlyChangePct: number;
  sixMonthChangePct: number | null;
  oneYearChangePct: number | null;
  twoYearChangePct: number | null;
  fiveYearChangePct: number | null;
  tenYearChangePct: number | null;
  ytdChangePct: number | null;
  fiveYearAnnualizedReturnPct: number | null;
  tenYearAnnualizedReturnPct: number | null;
  drawdownFromAthPct: number | null;
  athClose: number | null;
  athDate: Date | null;
};

function cloneDate(date: Date) {
  return new Date(date.getTime());
}

// 周 / 月 / 年起点都按 UTC 计算，避免服务器时区把“当天属于哪一周”
// 这类边界问题算错。这个项目只做日线，所以统一按日期口径处理最稳。
function startOfWeek(date: Date) {
  const result = cloneDate(date);
  const day = result.getUTCDay();
  const diff = day === 0 ? 6 : day - 1;
  result.setUTCDate(result.getUTCDate() - diff);
  return result;
}

function startOfMonth(date: Date) {
  const result = cloneDate(date);
  result.setUTCDate(1);
  return result;
}

function startOfYear(date: Date) {
  const result = cloneDate(date);
  result.setUTCMonth(0, 1);
  return result;
}

function shiftDateByMonths(date: Date, months: number) {
  const result = cloneDate(date);
  result.setUTCMonth(result.getUTCMonth() - months);
  return result;
}

function shiftDateByYears(date: Date, years: number) {
  const result = cloneDate(date);
  result.setUTCFullYear(result.getUTCFullYear() - years);
  return result;
}

function calcPct(currentValue: number, baseValue: number) {
  return ((currentValue - baseValue) / baseValue) * 100;
}

function calcCagrPct(currentValue: number, baseValue: number, years: number) {
  return (Math.pow(currentValue / baseValue, 1 / years) - 1) * 100;
}

function round(value: number) {
  return Number(value.toFixed(4));
}

// 周涨跌、月涨跌、YTD 会从“该周期起点之后的首个交易日”开始算，
// 因为自然日并不保证是交易日。
function findFirstOnOrAfter(rows: DailyPriceRecord[], targetDate: Date) {
  return rows.find((row) => row.date.getTime() >= targetDate.getTime()) ?? null;
}

// 长周期收益需要遵守“如果目标日不是交易日，就取它之前最近的交易日”。
// 这样 1Y / 5Y / 10Y 的口径才稳定，也更贴近日线数据的真实可得范围。
function findLatestOnOrBefore(rows: DailyPriceRecord[], targetDate: Date) {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    if (rows[index].date.getTime() <= targetDate.getTime()) {
      return rows[index];
    }
  }

  return null;
}

function computeChangePct(
  latestClose: number,
  rows: DailyPriceRecord[],
  targetDate: Date,
): number | null {
  const baseRow = findLatestOnOrBefore(rows, targetDate);

  if (!baseRow) {
    return null;
  }

  return round(calcPct(latestClose, baseRow.close));
}

function computeAnnualizedReturnPct(
  latestClose: number,
  rows: DailyPriceRecord[],
  targetDate: Date,
  years: number,
): number | null {
  const baseRow = findLatestOnOrBefore(rows, targetDate);

  if (!baseRow) {
    return null;
  }

  return round(calcCagrPct(latestClose, baseRow.close, years));
}

function computeAth(rows: DailyPriceRecord[]) {
  if (rows.length === 0) {
    return null;
  }

  return rows.reduce((best, current) => (current.close > best.close ? current : best));
}

function getChartStartDate(latestDate: Date, range: ChartRange) {
  switch (range) {
    case "1M":
      return shiftDateByMonths(latestDate, 1);
    case "6M":
      return shiftDateByMonths(latestDate, 6);
    case "1Y":
      return shiftDateByYears(latestDate, 1);
    case "5Y":
      return shiftDateByYears(latestDate, 5);
    case "MAX":
      return null;
  }
}

function downsampleChartRows(rows: DailyPriceRecord[]) {
  if (rows.length <= MAX_CHART_POINTS) {
    return { rows, isSampled: false };
  }

  const step = Math.ceil(rows.length / MAX_CHART_POINTS);
  const sampled = rows.filter((_, index) => index % step === 0);
  const latest = rows.at(-1);

  if (latest && sampled.at(-1)?.date.getTime() !== latest.date.getTime()) {
    sampled.push(latest);
  }

  return { rows: sampled, isSampled: true };
}

// 所有首页指标都集中在这里组装，API 和页面只消费结果。
// 这样以后扩指标时，不需要把计算逻辑散落到 route 或组件里。
function buildMarketCard(
  market: (typeof MARKET_DEFINITIONS)[number],
  rows: DailyPriceRecord[],
): MarketCard | null {
  const latest = rows.at(-1);
  const previous = rows.at(-2);

  if (!latest || !previous) {
    return null;
  }

  const weekStartRow = findFirstOnOrAfter(rows, startOfWeek(latest.date));
  const monthStartRow = findFirstOnOrAfter(rows, startOfMonth(latest.date));
  const yearStartRow = findFirstOnOrAfter(rows, startOfYear(latest.date));
  const athRow = computeAth(rows);

  if (!weekStartRow || !monthStartRow) {
    return null;
  }

  return {
    marketKey: market.marketKey,
    title: market.title,
    symbol: market.symbol,
    description: market.description,
    latestDate: latest.date,
    currentPrice: latest.close,
    dailyChangePct: round(calcPct(latest.close, previous.close)),
    weeklyChangePct: round(calcPct(latest.close, weekStartRow.close)),
    monthlyChangePct: round(calcPct(latest.close, monthStartRow.close)),
    sixMonthChangePct: computeChangePct(latest.close, rows, shiftDateByMonths(latest.date, 6)),
    oneYearChangePct: computeChangePct(latest.close, rows, shiftDateByYears(latest.date, 1)),
    twoYearChangePct: computeChangePct(latest.close, rows, shiftDateByYears(latest.date, 2)),
    fiveYearChangePct: computeChangePct(latest.close, rows, shiftDateByYears(latest.date, 5)),
    tenYearChangePct: computeChangePct(latest.close, rows, shiftDateByYears(latest.date, 10)),
    ytdChangePct: yearStartRow ? round(calcPct(latest.close, yearStartRow.close)) : null,
    fiveYearAnnualizedReturnPct: computeAnnualizedReturnPct(
      latest.close,
      rows,
      shiftDateByYears(latest.date, 5),
      5,
    ),
    tenYearAnnualizedReturnPct: computeAnnualizedReturnPct(
      latest.close,
      rows,
      shiftDateByYears(latest.date, 10),
      10,
    ),
    drawdownFromAthPct: athRow ? round(calcPct(latest.close, athRow.close)) : null,
    athClose: athRow ? round(athRow.close) : null,
    athDate: athRow ? athRow.date : null,
  };
}

export async function getMarketCards() {
  const cards = await Promise.all(
    MARKET_DEFINITIONS.map(async (market) => {
      // 长期指标依赖完整历史，因此这里读取该 ETF 的全部日线。
      const rows = await prisma.dailyPrice.findMany({
        where: { symbol: market.symbol },
        orderBy: { date: "asc" },
      });

      return buildMarketCard(market, rows);
    }),
  );

  return cards.filter((card): card is MarketCard => card !== null);
}

export async function getMarketChartData(
  symbol: string,
  range: ChartRange = getDefaultChartRange(),
): Promise<MarketChartData> {
  const rows = await prisma.dailyPrice.findMany({
    where: { symbol },
    orderBy: { date: "asc" },
  });

  const latest = rows.at(-1) ?? null;

  if (!latest) {
    return {
      symbol,
      range,
      latestDate: null,
      isSampled: false,
      points: [],
    };
  }

  const startDate = getChartStartDate(latest.date, range);
  const filteredRows =
    startDate === null
      ? rows
      : rows.filter((row) => row.date.getTime() >= startDate.getTime());
  // 只有 MAX 视图需要抽样。其他区间优先保留完整日线，保证用户看到的趋势足够真实。
  const normalizedRows = range === "MAX" ? downsampleChartRows(filteredRows) : { rows: filteredRows, isSampled: false };

  return {
    symbol,
    range,
    latestDate: latest.date.toISOString().slice(0, 10),
    isSampled: normalizedRows.isSampled,
    points: normalizedRows.rows.map((row) => ({
      date: row.date.toISOString().slice(0, 10),
      close: round(row.close),
    })),
  };
}

export async function getDefaultMarketCharts() {
  const entries = await Promise.all(
    MARKET_DEFINITIONS.map(async (market) => [
      market.symbol,
      await getMarketChartData(market.symbol, getDefaultChartRange()),
    ] as const),
  );

  return Object.fromEntries(entries);
}

export async function getMarketApiPayload() {
  const cards = await getMarketCards();
  const payload = Object.fromEntries(
    cards.map((card) => [
      card.marketKey,
      {
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
        fiveYearChangePct: card.fiveYearChangePct,
        tenYearChangePct: card.tenYearChangePct,
        ytdChangePct: card.ytdChangePct,
        fiveYearAnnualizedReturnPct: card.fiveYearAnnualizedReturnPct,
        tenYearAnnualizedReturnPct: card.tenYearAnnualizedReturnPct,
        drawdownFromAthPct: card.drawdownFromAthPct,
        athClose: card.athClose,
        athDate: card.athDate ? card.athDate.toISOString().slice(0, 10) : null,
      },
    ]),
  );

  return payload;
}

export function parseChartRange(value: string | null | undefined) {
  if (value && isChartRange(value)) {
    return value;
  }

  return getDefaultChartRange();
}

export {
  CHART_RANGES,
  formatDate,
  formatDateOrFallback,
  formatIndexValue,
  formatPercent,
  formatPercentOrFallback,
  getDefaultChartRange,
};

export function isMarketConfigured() {
  return Boolean(process.env.TWELVE_DATA_API_KEY);
}

export function getMissingDataMessage() {
  if (!isMarketConfigured()) {
    return "尚未配置 TWELVE_DATA_API_KEY，请先在 .env 中补充 API Key。";
  }

  return "数据库里还没有 SPY / QQQ 的最新日线，请先执行 npm run sync:data。";
}
