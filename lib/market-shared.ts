export const CHART_RANGES = ["1M", "6M", "1Y", "5Y", "MAX"] as const;
export type ChartRange = (typeof CHART_RANGES)[number];
const DEFAULT_CHART_RANGE: ChartRange = "1Y";

export type MarketChartPoint = {
  date: string;
  close: number;
};

export type MarketChartData = {
  symbol: string;
  range: ChartRange;
  latestDate: string | null;
  isSampled: boolean;
  points: MarketChartPoint[];
};

export function getDefaultChartRange() {
  return DEFAULT_CHART_RANGE;
}

export function isChartRange(value: string): value is ChartRange {
  return CHART_RANGES.includes(value as ChartRange);
}

export function formatPercent(value: number) {
  const formatter = new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: "always",
  });

  return `${formatter.format(value)}%`;
}

export function formatPercentOrFallback(value: number | null) {
  return value === null ? "数据不足" : formatPercent(value);
}

export function formatIndexValue(value: number) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatDate(value: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

export function formatDateOrFallback(value: Date | null) {
  return value === null ? "数据不足" : formatDate(value);
}
