import { prisma } from "@/lib/prisma";
import {
  getDefaultChartRange,
  type ChartRange,
  type MarketChartData,
} from "@/lib/market-shared";
import {
  round,
  shiftDateByMonths,
  shiftDateByYears,
} from "@/lib/price-analytics";

const MAX_CHART_POINTS = 480;

type DailyPriceRecord = {
  symbol: string;
  date: Date;
  close: number;
};

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

export async function getDailyPriceChartData(
  symbol: string,
  range: ChartRange = getDefaultChartRange(),
): Promise<MarketChartData> {
  const rows = await prisma.dailyPrice.findMany({
    where: { symbol },
    orderBy: { date: "asc" },
    select: {
      symbol: true,
      date: true,
      close: true,
    },
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
  const chartRows =
    range === "MAX"
      ? downsampleChartRows(filteredRows)
      : { rows: filteredRows, isSampled: false };

  return {
    symbol,
    range,
    latestDate: latest.date.toISOString().slice(0, 10),
    isSampled: chartRows.isSampled,
    points: chartRows.rows.map((row) => ({
      date: row.date.toISOString().slice(0, 10),
      close: round(row.close),
    })),
  };
}
