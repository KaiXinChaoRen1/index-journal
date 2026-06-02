import { prisma } from "@/lib/prisma";
import { getDailyPriceChartData } from "@/lib/daily-chart-data";
import { computePeriodChangeMetrics } from "@/lib/daily-price-metrics";
import {
  formatDate,
  formatPercentOrFallback,
  getDefaultChartRange,
  parseChartRange,
  type ChartRange,
  type MarketChartData,
} from "@/lib/market-shared";

/**
 * 汇率观察页服务层。
 *
 * 它故意复用 index-data 的图表能力与 price-analytics 的纯计算逻辑，
 * 这样汇率页和首页就能共享一套“从 SQLite 读日线 -> 本地算指标 -> 页面展示”的模式。
 */
export const FOREX_DEFINITIONS = [
  {
    symbol: "USD/CNY",
    title: "美元兑人民币",
    description: "1 美元可以兑换多少人民币，是汇率观察页的核心对象。",
    priority: "core",
  },
  {
    symbol: "USD/JPY",
    title: "美元兑日元",
    description: "用于补充观察美元强弱与亚洲市场环境。",
    priority: "primary",
  },
  {
    symbol: "USD/INR",
    title: "美元兑印度卢比",
    description: "提供新兴市场视角下的美元汇率变化参考。",
    priority: "primary",
  },
  {
    symbol: "USD/EUR",
    title: "美元兑欧元",
    description: "作为主流货币体系下的辅助观察项。",
    priority: "secondary",
  },
] as const;

type ForexDefinition = (typeof FOREX_DEFINITIONS)[number];

type DailyPriceRecord = {
  symbol: string;
  date: Date;
  close: number;
};

export type ForexCard = {
  symbol: ForexDefinition["symbol"];
  title: string;
  description: string;
  priority: ForexDefinition["priority"];
  latestDate: Date;
  currentPrice: number;
  dailyChangePct: number;
  weeklyChangePct: number;
  monthlyChangePct: number;
  sixMonthChangePct: number | null;
  oneYearChangePct: number | null;
};

function buildForexCard(forex: ForexDefinition, rows: DailyPriceRecord[]): ForexCard | null {
  const metrics = computePeriodChangeMetrics(rows);

  if (!metrics) {
    return null;
  }

  return {
    symbol: forex.symbol,
    title: forex.title,
    description: forex.description,
    priority: forex.priority,
    latestDate: metrics.latest.date,
    currentPrice: metrics.latest.close,
    dailyChangePct: metrics.dailyChangePct,
    weeklyChangePct: metrics.weeklyChangePct,
    monthlyChangePct: metrics.monthlyChangePct,
    sixMonthChangePct: metrics.sixMonthChangePct,
    oneYearChangePct: metrics.oneYearChangePct,
  };
}

export async function getForexCards() {
  const cards = await Promise.all(
    FOREX_DEFINITIONS.map(async (forex) => {
      // 数据流沿用现有 dailyPrice + Prisma 模式，前端只消费整理后的结果。
      const rows = await prisma.dailyPrice.findMany({
        where: { symbol: forex.symbol },
        orderBy: { date: "asc" },
        select: {
          symbol: true,
          date: true,
          close: true,
        },
      });

      return buildForexCard(forex, rows);
    }),
  );

  return cards.filter((card): card is ForexCard => card !== null);
}

export async function getForexChartData(symbol: string, range: ChartRange = getDefaultChartRange()) {
  return getDailyPriceChartData(symbol, range);
}

export async function getDefaultForexCharts() {
  const entries = await Promise.all(
    FOREX_DEFINITIONS.map(async (forex) => [
      forex.symbol,
      await getForexChartData(forex.symbol, getDefaultChartRange()),
    ] as const),
  );

  return Object.fromEntries(entries);
}

export async function getForexApiPayload() {
  const cards = await getForexCards();

  return Object.fromEntries(
    cards.map((card) => [
      card.symbol,
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
      },
    ]),
  );
}

export function parseForexChartRange(value: string | null | undefined) {
  return parseChartRange(value);
}

export function isForexSymbolSupported(symbol: string) {
  return FOREX_DEFINITIONS.some((item) => item.symbol === symbol);
}

export function getForexMissingDataMessage() {
  if (!process.env.TWELVE_DATA_API_KEY) {
    return "尚未配置 TWELVE_DATA_API_KEY，请先在 .env 中补充 API Key。";
  }

  return "数据库里还没有汇率日线，请先执行 npm run sync:data。";
}

export { formatDate, formatPercentOrFallback, type MarketChartData };
