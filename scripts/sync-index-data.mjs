import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const API_BASE_URL = "https://api.twelvedata.com/time_series";
const FULL_HISTORY_START = new Date("1990-01-01T00:00:00Z");
const CHUNK_YEARS = 10;
const RECENT_REFRESH_DAYS = 14;
const RATE_LIMIT_WAIT_MS = 65_000;
const MAX_RATE_LIMIT_RETRIES = 3;
const BEIJING_OFFSET_HOURS = 8;
const FORMAL_EOD_JOB = "FORMAL_EOD";

const MARKET_DEFINITIONS = [
  { marketKey: "SP500", symbol: "SPY", title: "S&P 500", historyStart: FULL_HISTORY_START },
  { marketKey: "NASDAQ100", symbol: "QQQ", title: "Nasdaq 100", historyStart: FULL_HISTORY_START },
  { marketKey: "USDCNY", symbol: "USD/CNY", title: "USD/CNY", historyStart: new Date("2000-01-01T00:00:00Z") },
  { marketKey: "USDJPY", symbol: "USD/JPY", title: "USD/JPY", historyStart: new Date("2000-01-01T00:00:00Z") },
  { marketKey: "USDINR", symbol: "USD/INR", title: "USD/INR", historyStart: new Date("2000-01-01T00:00:00Z") },
  { marketKey: "USDEUR", symbol: "USD/EUR", title: "USD/EUR", historyStart: new Date("2000-01-01T00:00:00Z") },
];

function requireApiKey() {
  const apiKey = process.env.TWELVE_DATA_API_KEY;

  if (!apiKey) {
    throw new Error("Missing TWELVE_DATA_API_KEY in environment.");
  }

  return apiKey;
}

function buildUrlWithRange(symbol, apiKey, startDate, endDate) {
  const url = new URL(API_BASE_URL);
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("interval", "1day");
  url.searchParams.set("apikey", apiKey);

  if (startDate) {
    url.searchParams.set("start_date", formatIsoDate(startDate));
  }

  if (endDate) {
    url.searchParams.set("end_date", formatIsoDate(endDate));
  }

  // Twelve Data 官方文档说明单次最多返回 5000 条。
  // 对日线来说 15 年通常低于这个限制，这里仍显式设为上限，避免被默认值截断。
  url.searchParams.set("outputsize", "5000");
  url.searchParams.set("format", "JSON");
  return url.toString();
}

function formatIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function cloneDate(date) {
  return new Date(date.getTime());
}

function shiftYears(date, years) {
  const result = cloneDate(date);
  result.setUTCFullYear(result.getUTCFullYear() + years);
  return result;
}

function shiftDays(date, days) {
  const result = cloneDate(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function getBeijingDayStartUtc(input) {
  const shifted = new Date(input.getTime() + BEIJING_OFFSET_HOURS * 60 * 60 * 1000);
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

async function markFormalEodCheckpoint(isSuccess, message = null) {
  const bizDate = getBeijingDayStartUtc(new Date());

  await prisma.syncCheckpoint.upsert({
    where: {
      jobType_bizDate: {
        jobType: FORMAL_EOD_JOB,
        bizDate,
      },
    },
    update: {
      isSuccess,
      message,
      completedAt: new Date(),
    },
    create: {
      jobType: FORMAL_EOD_JOB,
      bizDate,
      isSuccess,
      message,
      completedAt: new Date(),
    },
  });
}

async function fetchSeriesRange(symbol, apiKey, startDate, endDate) {
  for (let attempt = 0; attempt <= MAX_RATE_LIMIT_RETRIES; attempt += 1) {
    const response = await fetch(buildUrlWithRange(symbol, apiKey, startDate, endDate), {
      headers: {
        accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Twelve Data request failed for ${symbol}: ${response.status} ${startDate ? formatIsoDate(startDate) : ""} ${endDate ? formatIsoDate(endDate) : ""}`.trim(),
      );
    }

    const payload = await response.json();

    if (payload.status === "error") {
      const message = String(payload.message ?? "Unknown Twelve Data error");

      if (
        message.includes("run out of API credits for the current minute") &&
        attempt < MAX_RATE_LIMIT_RETRIES
      ) {
        console.log(
          `Rate limit hit for ${symbol}. Waiting ${Math.round(RATE_LIMIT_WAIT_MS / 1000)}s before retry...`,
        );
        await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_WAIT_MS));
        continue;
      }

      throw new Error(`Twelve Data error for ${symbol}: ${message}`);
    }

    if (!Array.isArray(payload.values) || payload.values.length === 0) {
      throw new Error(
        `No time series values returned for ${symbol} in range ${startDate ? formatIsoDate(startDate) : "open"} -> ${endDate ? formatIsoDate(endDate) : "open"}.`,
      );
    }

    return payload.values
      .map((row) => ({
        symbol,
        date: new Date(`${row.datetime}T00:00:00Z`),
        open: Number.parseFloat(row.open),
        high: Number.parseFloat(row.high),
        low: Number.parseFloat(row.low),
        close: Number.parseFloat(row.close),
        volume: Number.isInteger(Number.parseInt(row.volume, 10))
          ? Number.parseInt(row.volume, 10)
          : 0,
      }))
      .filter(
        (row) =>
          !Number.isNaN(row.date.getTime()) &&
          Number.isFinite(row.open) &&
          Number.isFinite(row.high) &&
          Number.isFinite(row.low) &&
          Number.isFinite(row.close) &&
          Number.isInteger(row.volume),
      )
      .sort((left, right) => left.date.getTime() - right.date.getTime());
  }

  throw new Error(`Rate limit retries exhausted for ${symbol}.`);
}

function buildDateChunks(startDate, endDate) {
  const chunks = [];
  let cursor = cloneDate(startDate);

  while (cursor.getTime() <= endDate.getTime()) {
    const chunkStart = cloneDate(cursor);
    const chunkEnd = shiftDays(shiftYears(chunkStart, CHUNK_YEARS), -1);
    const boundedEnd = chunkEnd.getTime() < endDate.getTime() ? chunkEnd : endDate;
    chunks.push({ startDate: chunkStart, endDate: boundedEnd });
    cursor = shiftDays(boundedEnd, 1);
  }

  return chunks;
}

async function fetchHistoricalWindow(symbol, apiKey, startDate, endDate) {
  const chunks = buildDateChunks(startDate, endDate);
  const rows = [];

  for (const chunk of chunks) {
    const chunkRows = await fetchSeriesRange(symbol, apiKey, chunk.startDate, chunk.endDate);
    rows.push(...chunkRows);
  }

  return rows;
}

async function getHistoryBounds(symbol) {
  const [earliest, latest] = await Promise.all([
    prisma.dailyPrice.findFirst({
      where: { symbol },
      orderBy: { date: "asc" },
      select: { date: true },
    }),
    prisma.dailyPrice.findFirst({
      where: { symbol },
      orderBy: { date: "desc" },
      select: { date: true },
    }),
  ]);

  return {
    earliestDate: earliest?.date ?? null,
    latestDate: latest?.date ?? null,
  };
}

async function upsertBars(symbol, rows) {
  for (const row of rows) {
    // 个人项目的数据量很小，逐条 upsert 已经足够稳定且方便重跑。
    await prisma.dailyPrice.upsert({
      where: {
        symbol_date: {
          symbol,
          date: row.date,
        },
      },
      update: row,
      create: row,
    });
  }
}

async function main() {
  const apiKey = requireApiKey();
  const today = new Date();
  try {
    for (const market of MARKET_DEFINITIONS) {
      const targetHistoryStart = market.historyStart ?? FULL_HISTORY_START;
      const { earliestDate, latestDate } = await getHistoryBounds(market.symbol);
      const windows = [];

      if (!earliestDate || !latestDate || earliestDate.getTime() > targetHistoryStart.getTime()) {
        windows.push({
          startDate: targetHistoryStart,
          endDate: today,
          label: "history-sync",
        });
      } else {
        windows.push({
          startDate: shiftDays(latestDate, -RECENT_REFRESH_DAYS),
          endDate: today,
          label: "incremental-refresh",
        });
      }

      let totalRowsFetched = 0;

      for (const window of windows) {
        if (window.startDate.getTime() > window.endDate.getTime()) {
          continue;
        }

        const rows = await fetchHistoricalWindow(
          market.symbol,
          apiKey,
          window.startDate,
          window.endDate,
        );
        await upsertBars(market.symbol, rows);
        totalRowsFetched += rows.length;
        console.log(
          `Fetched ${market.symbol} ${window.label}: ${rows.length} rows (${formatIsoDate(window.startDate)} -> ${formatIsoDate(window.endDate)})`,
        );
      }

      const latest = await prisma.dailyPrice.findFirst({
        where: { symbol: market.symbol },
        orderBy: { date: "desc" },
        select: { date: true },
      });
      const count = await prisma.dailyPrice.count({
        where: { symbol: market.symbol },
      });

      console.log(
        `Synced ${market.title} via ${market.symbol}, fetched=${totalRowsFetched}, stored=${count}, latest=${latest?.date.toISOString().slice(0, 10)}`,
      );
    }

    await markFormalEodCheckpoint(true, "Formal EOD sync completed by sync:data.");
  } catch (error) {
    await markFormalEodCheckpoint(
      false,
      error instanceof Error ? error.message : "Unknown sync:data error.",
    );
    throw error;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
