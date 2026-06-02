import { prisma } from "@/lib/prisma";
import { getDailyPriceChartData } from "@/lib/daily-chart-data";
import { computePeriodChangeMetrics } from "@/lib/daily-price-metrics";
import { getDisplayIndexPoints } from "@/lib/display-index-points";
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
  parseChartRange as parseSharedChartRange,
  type ChartRange,
} from "@/lib/market-shared";
import {
  calcCagrPct,
  calcPct,
  findLatestOnOrBefore,
  round,
  shiftDateByYears,
} from "@/lib/price-analytics";

/**
 * 首页 /api/market /api/market/chart 的核心服务层。
 *
 * 你可以把这个文件理解成“首页后端服务”：
 * - 从 SQLite 读取 dailyPrice / morningCloseSnapshot
 * - 统一计算页面卡片需要的指标
 * - 统一组织图表数据
 *
 * 阅读建议：
 * 1. 先看 getMarketCards()
 * 2. 再看 buildMarketCard()
 * 3. 最后看 getMarketChartData()
 */
export const MARKET_DEFINITIONS = [
  {
    marketKey: "SP500",
    title: "S&P 500",
    symbol: "SPY",
    description: "用 SPY 近似追踪标普 500，展示的是 ETF 数据而非指数本体。",
  },
  {
    marketKey: "NASDAQ100",
    title: "Nasdaq 100",
    symbol: "QQQ",
    description: "用 QQQ 近似追踪纳指 100，展示的是 ETF 数据而非指数本体。",
  },
] as const;

export type MarketKey = (typeof MARKET_DEFINITIONS)[number]["marketKey"];
type MarketDefinition = (typeof MARKET_DEFINITIONS)[number];

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
  displayPrice: number | null;
  displaySourceLabel: string | null;
  displaySourceTime: string | null;
  displayWarningMessage: string | null;
};

function formatUsEasternTradingDate(tradingDate: Date) {
  const date = tradingDate.toISOString().slice(0, 10);
  return `${date} ET 交易日`;
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

function buildMarketCard(market: MarketDefinition, rows: DailyPriceRecord[]): MarketCard | null {
  const metrics = computePeriodChangeMetrics(rows);

  if (!metrics) {
    return null;
  }

  const { latest } = metrics;
  const athRow = computeAth(rows);

  return {
    marketKey: market.marketKey,
    title: market.title,
    symbol: market.symbol,
    description: market.description,
    latestDate: latest.date,
    currentPrice: latest.close,
    dailyChangePct: metrics.dailyChangePct,
    weeklyChangePct: metrics.weeklyChangePct,
    monthlyChangePct: metrics.monthlyChangePct,
    sixMonthChangePct: metrics.sixMonthChangePct,
    oneYearChangePct: metrics.oneYearChangePct,
    twoYearChangePct: metrics.twoYearChangePct,
    fiveYearChangePct: metrics.fiveYearChangePct,
    tenYearChangePct: metrics.tenYearChangePct,
    ytdChangePct: metrics.ytdChangePct,
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
    headlineTime: formatUsEasternTradingDate(latest.date),
    headlineSourceLabel: "Twelve Data Time Series (1day)",
    displayPrice: null,
    displaySourceLabel: null,
    displaySourceTime: null,
    displayWarningMessage: null,
  };
}

export async function getMarketCards() {
  const [cards, snapshots, preferSnapshot, displayIndexPoints] = await Promise.all([
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
    getDisplayIndexPoints(),
  ]);

  const baseCards = cards.filter((card): card is MarketCard => card !== null);

  return baseCards.map((card) => {
    const displayPoint = displayIndexPoints.get(card.marketKey) ?? null;
    const snapshot = snapshots.get(card.symbol);
    const effectiveCard =
      preferSnapshot && snapshot
        ? {
            ...card,
            currentPrice: snapshot.price,
            dailyChangePct: snapshot.percentChange,
            headlineMode: "morning_snapshot" as const,
            headlineTime: `${formatDateTime(snapshot.sourceTimestamp)} UTC`,
            headlineSourceLabel: snapshot.sourceLabel,
          }
        : card;

    return {
      ...effectiveCard,
      displayPrice:
        displayPoint && displayPoint.sourceStatus !== "unavailable"
          ? round(displayPoint.price)
          : null,
      displaySourceLabel: displayPoint?.sourceLabel ?? null,
      displaySourceTime: displayPoint?.sourceTimeLabel ?? null,
      displayWarningMessage: displayPoint?.warningMessage ?? null,
    };
  });
}

export async function getMarketChartData(
  symbol: string,
  range: ChartRange = getDefaultChartRange(),
) {
  return getDailyPriceChartData(symbol, range);
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

  // API 层只负责把服务层结果序列化成 JSON 友好的格式。
  const apiPayload = Object.fromEntries(
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
        displayPrice: card.displayPrice,
        displaySourceLabel: card.displaySourceLabel,
        displaySourceTime: card.displaySourceTime,
        displayWarningMessage: card.displayWarningMessage,
      },
    ]),
  );

  return apiPayload;
}

export function parseChartRange(value: string | null | undefined) {
  return parseSharedChartRange(value);
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
  // 这两条文案是给"部署后第一次打开却看不到数据"的人看的，
  // 所以要分清是"没配 Key"还是"配了 Key 但还没同步过数据"这两种不同原因。
  if (!isMarketConfigured()) {
    return "未检测到 TWELVE_DATA_API_KEY。请在部署环境的 .env 中配置有效的 Twelve Data API Key 后重启服务。";
  }

  return "已检测到 API Key，但数据库里还没有 SPY / QQQ 的日线数据，需要先完成一次数据同步。";
}

// 把"距历史高点回撤"翻译成一句普通人能懂的位置判断。
// 目的：首页不只给一堆数字，而是先回答"现在该不该担心"，
// 这正是它区别于手机行情 App 的核心价值。
export function getMarketStanceText(card: MarketCard): string {
  const drawdown = card.drawdownFromAthPct; // ≤ 0，表示当前价距历史高点的距离

  if (drawdown === null) {
    return "历史数据不足，暂不给出位置判断。";
  }

  const distance = Math.abs(drawdown);
  let position: string;

  if (distance <= 2) {
    position = "基本贴近历史高点，处在偏高位置";
  } else if (distance <= 10) {
    position = "略低于历史高点，仍在高位区间";
  } else if (distance <= 20) {
    position = "已从高点中度回撤";
  } else {
    position = "已从高点深度回撤";
  }

  const oneYear = card.oneYearChangePct;
  const trend =
    oneYear === null
      ? ""
      : `，近一年累计 ${oneYear >= 0 ? "+" : ""}${oneYear.toFixed(1)}%`;

  return `距历史高点 ${drawdown.toFixed(1)}%，${position}${trend}。`;
}
