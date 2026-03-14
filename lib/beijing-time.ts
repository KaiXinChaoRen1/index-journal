const BEIJING_OFFSET_HOURS = 8;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function toBeijingDate(input: Date) {
  return new Date(input.getTime() + BEIJING_OFFSET_HOURS * 60 * 60 * 1000);
}

export function getBeijingDateKey(input: Date) {
  const date = toBeijingDate(input);
  const year = date.getUTCFullYear();
  const month = pad(date.getUTCMonth() + 1);
  const day = pad(date.getUTCDate());

  return `${year}-${month}-${day}`;
}

export function getBeijingTimeHM(input: Date) {
  const date = toBeijingDate(input);
  const hour = date.getUTCHours();
  const minute = date.getUTCMinutes();

  return hour * 60 + minute;
}

export function getBeijingDayStartUtc(input: Date) {
  const shifted = toBeijingDate(input);
  const utcMidnight = Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate(),
    0,
    0,
    0,
    0,
  );

  return new Date(utcMidnight - BEIJING_OFFSET_HOURS * 60 * 60 * 1000);
}

export function getBeijingDayStartUtcByOffset(input: Date, dayOffset: number) {
  const base = getBeijingDayStartUtc(input);
  return new Date(base.getTime() + dayOffset * MS_PER_DAY);
}
