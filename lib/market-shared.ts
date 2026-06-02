// 页面与 API 共享的轻量类型 / 格式化层。
// 如果你在读代码时看到 formatPercent / ChartRange 这类名字，定义都在这里。
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

export function parseChartRange(value: string | null | undefined) {
  if (value && isChartRange(value)) {
    return value;
  }

  return getDefaultChartRange();
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

export function formatFxValue(value: number) {
  const abs = Math.abs(value);
  const fractionDigits = abs >= 100 ? 2 : abs >= 10 ? 3 : 4;

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

export function formatDate(value: Date) {
  // 必须固定 timeZone：交易日来自 `${date}T00:00:00Z`（UTC 零点），
  // 若按运行环境本地时区格式化，服务端与浏览器时区不同会把同一天显示成不同日期，
  // 在客户端组件里就会触发 React 注水（hydration）不一致。用 UTC 才能稳定显示真实交易日。
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "UTC",
  }).format(value);
}

export function formatDateOrFallback(value: Date | null) {
  return value === null ? "数据不足" : formatDate(value);
}
