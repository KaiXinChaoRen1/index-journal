export type PriceRow = {
  date: Date;
  close: number;
};

export function cloneDate(date: Date) {
  return new Date(date.getTime());
}

export function startOfWeek(date: Date) {
  const result = cloneDate(date);
  const day = result.getUTCDay();
  const diff = day === 0 ? 6 : day - 1;
  result.setUTCDate(result.getUTCDate() - diff);
  return result;
}

export function startOfMonth(date: Date) {
  const result = cloneDate(date);
  result.setUTCDate(1);
  return result;
}

export function startOfYear(date: Date) {
  const result = cloneDate(date);
  result.setUTCMonth(0, 1);
  return result;
}

export function shiftDateByMonths(date: Date, months: number) {
  const result = cloneDate(date);
  result.setUTCMonth(result.getUTCMonth() - months);
  return result;
}

export function shiftDateByYears(date: Date, years: number) {
  const result = cloneDate(date);
  result.setUTCFullYear(result.getUTCFullYear() - years);
  return result;
}

export function calcPct(currentValue: number, baseValue: number) {
  return ((currentValue - baseValue) / baseValue) * 100;
}

export function calcCagrPct(currentValue: number, baseValue: number, years: number) {
  return (Math.pow(currentValue / baseValue, 1 / years) - 1) * 100;
}

export function round(value: number) {
  return Number(value.toFixed(4));
}

export function findFirstOnOrAfter<T extends PriceRow>(rows: T[], targetDate: Date) {
  return rows.find((row) => row.date.getTime() >= targetDate.getTime()) ?? null;
}

export function findLatestOnOrBefore<T extends PriceRow>(rows: T[], targetDate: Date) {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    if (rows[index].date.getTime() <= targetDate.getTime()) {
      return rows[index];
    }
  }

  return null;
}

export function computeChangePct<T extends PriceRow>(
  latestClose: number,
  rows: T[],
  targetDate: Date,
): number | null {
  const baseRow = findLatestOnOrBefore(rows, targetDate);

  if (!baseRow) {
    return null;
  }

  return round(calcPct(latestClose, baseRow.close));
}
