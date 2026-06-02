import {
  calcPct,
  computeChangePct,
  findFirstOnOrAfter,
  round,
  shiftDateByMonths,
  shiftDateByYears,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from "@/lib/price-analytics";

export type DailyCloseRow = {
  date: Date;
  close: number;
};

export type PeriodChangeMetrics = {
  latest: DailyCloseRow;
  previous: DailyCloseRow;
  dailyChangePct: number;
  weeklyChangePct: number;
  monthlyChangePct: number;
  sixMonthChangePct: number | null;
  oneYearChangePct: number | null;
  twoYearChangePct: number | null;
  threeYearChangePct: number | null;
  fiveYearChangePct: number | null;
  tenYearChangePct: number | null;
  ytdChangePct: number | null;
};

export function computePeriodChangeMetrics(rows: DailyCloseRow[]): PeriodChangeMetrics | null {
  const latest = rows.at(-1);
  const previous = rows.at(-2);

  if (!latest || !previous) {
    return null;
  }

  // 当前产品口径：周/月/YTD 使用周期内第一个可用交易日作为基准。
  // 这和部分行情软件“上一周期收盘价”口径不同，改这里会影响所有页面的区间涨跌。
  const weekStartRow = findFirstOnOrAfter(rows, startOfWeek(latest.date));
  const monthStartRow = findFirstOnOrAfter(rows, startOfMonth(latest.date));
  const yearStartRow = findFirstOnOrAfter(rows, startOfYear(latest.date));

  if (!weekStartRow || !monthStartRow) {
    return null;
  }

  return {
    latest,
    previous,
    dailyChangePct: round(calcPct(latest.close, previous.close)),
    weeklyChangePct: round(calcPct(latest.close, weekStartRow.close)),
    monthlyChangePct: round(calcPct(latest.close, monthStartRow.close)),
    sixMonthChangePct: computeChangePct(latest.close, rows, shiftDateByMonths(latest.date, 6)),
    oneYearChangePct: computeChangePct(latest.close, rows, shiftDateByYears(latest.date, 1)),
    twoYearChangePct: computeChangePct(latest.close, rows, shiftDateByYears(latest.date, 2)),
    threeYearChangePct: computeChangePct(latest.close, rows, shiftDateByYears(latest.date, 3)),
    fiveYearChangePct: computeChangePct(latest.close, rows, shiftDateByYears(latest.date, 5)),
    tenYearChangePct: computeChangePct(latest.close, rows, shiftDateByYears(latest.date, 10)),
    ytdChangePct: yearStartRow ? round(calcPct(latest.close, yearStartRow.close)) : null,
  };
}
