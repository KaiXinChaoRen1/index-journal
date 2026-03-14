import { prisma } from "@/lib/prisma";
import {
  getTodayMorningSnapshots,
  shouldPreferMorningSnapshot,
} from "@/lib/dual-track-sync";
import { formatDateTime } from "@/lib/live-price-shared";
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
import {
  calcCagrPct,
  calcPct,
  computeChangePct,
  findFirstOnOrAfter,
  findLatestOnOrBefore,
  round,
  shiftDateByMonths,
  shiftDateByYears,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from "@/lib/price-analytics";

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
  headlineMode: "morning_snapshot" | "formal_eod";
  headlineTime: string;
  headlineSourceLabel: string;
};

function formatUsEasternMidnight(tradingDate: Date) {
  const date = tradingDate.toISOString().slice(0, 10);
  return `${date} 00:00:00 ET`;
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
    headlineMode: "formal_eod",
    headlineTime: formatUsEasternMidnight(latest.date),
    headlineSourceLabel: "Twelve Data Time Series (1day)",
  };
}

export async function getMarketCards() {
  const [cards, snapshots, preferSnapshot] = await Promise.all([
    Promise.all(
      MARKET_DEFINITIONS.map(async (market) => {
        const rows = await prisma.dailyPrice.findMany({
          where: { symbol: market.symbol },
          orderBy: { date: "asc" },
        });

        return buildMarketCard(market, rows);
      }),
    ),
    getTodayMorningSnapshots(),
    shouldPreferMorningSnapshot(),
  ]);

  const normalized = cards.filter((card): card is MarketCard => card !== null);

  if (!preferSnapshot) {
    return normalized;
  }

  return normalized.map((card) => {
    const snapshot = snapshots.get(card.symbol);

    if (!snapshot) {
      return card;
    }

    return {
      ...card,
      currentPrice: snapshot.price,
      dailyChangePct: snapshot.percentChange,
      headlineMode: "morning_snapshot" as const,
      headlineTime: `${formatDateTime(snapshot.sourceTimestamp)} UTC`,
      headlineSourceLabel: snapshot.sourceLabel,
    };
  });
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
        headlineMode: card.headlineMode,
        headlineTime: card.headlineTime,
        headlineSourceLabel: card.headlineSourceLabel,
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
