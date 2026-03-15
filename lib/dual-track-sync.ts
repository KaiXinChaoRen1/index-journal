import { prisma } from "@/lib/prisma";
import { getBeijingDayStartUtc, getBeijingTimeHM } from "@/lib/beijing-time";
import { parseOfficialTime } from "@/lib/live-price-shared";

const MORNING_SNAPSHOT_JOB = "MORNING_SNAPSHOT";
const FORMAL_EOD_JOB = "FORMAL_EOD";
const MORNING_SYMBOLS = ["SPY", "QQQ"] as const;
const MORNING_CUTOFF_MINUTES = 6 * 60;
const EOD_CUTOFF_MINUTES = 14 * 60;
const RECHECK_COOLDOWN_MS = 10_000;
const TWELVE_DATA_QUOTE_URL = "https://api.twelvedata.com/quote";
const TWELVE_DATA_SERIES_URL = "https://api.twelvedata.com/time_series";

let compensationLastRunAt = 0;
let compensationPending: Promise<void> | null = null;

/**
 * 首页“昨夜收盘快照 / 官方 EOD”双轨口径的服务层。
 *
 * 这个文件最重要的不是技术细节，而是产品口径：
 * - 早晨先给用户一个可快速查看的收盘快照
 * - 中午后如果正式 EOD 已同步完成，则切回正式日线口径
 * - 页面启动时可做一次轻量补偿，尽量避免“今天该有的数据还没到”
 */
type QuotePayload = {
  status?: string;
  message?: string;
  symbol?: string;
  close?: string;
  previous_close?: string;
  change?: string;
  percent_change?: string;
  datetime?: string;
  timestamp?: number | string;
};

export type MorningSnapshotView = {
  symbol: string;
  price: number;
  percentChange: number;
  sourceTimestamp: Date;
  sourceLabel: string;
};

function requireApiKey() {
  const apiKey = process.env.TWELVE_DATA_API_KEY;

  if (!apiKey) {
    throw new Error("Missing TWELVE_DATA_API_KEY in environment.");
  }

  return apiKey;
}

async function markCheckpoint(jobType: string, bizDate: Date, isSuccess: boolean, message?: string) {
  await prisma.syncCheckpoint.upsert({
    where: {
      jobType_bizDate: {
        jobType,
        bizDate,
      },
    },
    update: {
      isSuccess,
      message: message ?? null,
      completedAt: new Date(),
    },
    create: {
      jobType,
      bizDate,
      isSuccess,
      message: message ?? null,
      completedAt: new Date(),
    },
  });
}

async function isCheckpointSuccess(jobType: string, bizDate: Date) {
  const record = await prisma.syncCheckpoint.findUnique({
    where: {
      jobType_bizDate: {
        jobType,
        bizDate,
      },
    },
    select: {
      isSuccess: true,
    },
  });

  return record?.isSuccess === true;
}

function parseQuoteTime(payload: QuotePayload) {
  const byDatetime = parseOfficialTime(payload.datetime);
  const byTimestamp =
    payload.timestamp === undefined
      ? null
      : new Date(Number.parseInt(String(payload.timestamp), 10) * 1000);

  if (byDatetime) {
    return byDatetime;
  }

  if (byTimestamp && Number.isFinite(byTimestamp.getTime())) {
    return byTimestamp;
  }

  return new Date();
}

async function fetchQuoteSnapshot(symbol: string, apiKey: string) {
  const url = new URL(TWELVE_DATA_QUOTE_URL);
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("apikey", apiKey);
  url.searchParams.set("format", "JSON");

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch(url.toString(), {
      headers: {
        accept: "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      if (attempt === 0) {
        continue;
      }

      throw new Error(`Quote request failed for ${symbol}: ${response.status}`);
    }

    const payload = (await response.json()) as QuotePayload;

    if (payload.status === "error") {
      if (attempt === 0) {
        continue;
      }

      throw new Error(payload.message ?? `Quote API error for ${symbol}`);
    }

    const price = Number.parseFloat(String(payload.close ?? ""));
    const previousClose = Number.parseFloat(String(payload.previous_close ?? ""));
    const change = Number.parseFloat(String(payload.change ?? ""));
    const percentChange = Number.parseFloat(String(payload.percent_change ?? ""));

    if (
      !Number.isFinite(price) ||
      !Number.isFinite(previousClose) ||
      !Number.isFinite(change) ||
      !Number.isFinite(percentChange)
    ) {
      if (attempt === 0) {
        continue;
      }

      throw new Error(`Quote payload invalid for ${symbol}`);
    }

    return {
      symbol,
      price,
      previousClose,
      change,
      percentChange,
      sourceTimestamp: parseQuoteTime(payload),
    };
  }

  throw new Error(`Quote retry exhausted for ${symbol}`);
}

export async function syncMorningSnapshotsForToday(now = new Date()) {
  const apiKey = requireApiKey();
  const bizDate = getBeijingDayStartUtc(now);

  try {
    for (const symbol of MORNING_SYMBOLS) {
      const quote = await fetchQuoteSnapshot(symbol, apiKey);
      await prisma.morningCloseSnapshot.upsert({
        where: {
          symbol_snapshotDate: {
            symbol,
            snapshotDate: bizDate,
          },
        },
        update: {
          price: quote.price,
          previousClose: quote.previousClose,
          change: quote.change,
          percentChange: quote.percentChange,
          sourceTimestamp: quote.sourceTimestamp,
          sourceLabel: "Twelve Data Quote",
          fetchedAt: new Date(),
        },
        create: {
          symbol,
          snapshotDate: bizDate,
          price: quote.price,
          previousClose: quote.previousClose,
          change: quote.change,
          percentChange: quote.percentChange,
          sourceTimestamp: quote.sourceTimestamp,
          sourceLabel: "Twelve Data Quote",
          fetchedAt: new Date(),
        },
      });
    }

    await markCheckpoint(MORNING_SNAPSHOT_JOB, bizDate, true, "Morning snapshot synced.");
  } catch (error) {
    await markCheckpoint(
      MORNING_SNAPSHOT_JOB,
      bizDate,
      false,
      error instanceof Error ? error.message : "Unknown snapshot sync error.",
    );
    throw error;
  }
}

async function fetchRecentSeries(symbol: string, apiKey: string) {
  const url = new URL(TWELVE_DATA_SERIES_URL);
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("interval", "1day");
  url.searchParams.set("apikey", apiKey);
  url.searchParams.set("outputsize", "20");
  url.searchParams.set("format", "JSON");

  const response = await fetch(url.toString(), {
    headers: {
      accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`EOD request failed for ${symbol}: ${response.status}`);
  }

  const payload = (await response.json()) as {
    status?: string;
    message?: string;
    values?: Array<{
      datetime: string;
      open: string;
      high: string;
      low: string;
      close: string;
      volume: string;
    }>;
  };

  if (payload.status === "error") {
    throw new Error(payload.message ?? `EOD API error for ${symbol}`);
  }

  if (!Array.isArray(payload.values) || payload.values.length === 0) {
    throw new Error(`EOD values missing for ${symbol}`);
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
    .filter((row) => Number.isFinite(row.close) && !Number.isNaN(row.date.getTime()))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

export async function syncFormalEodForToday(now = new Date()) {
  const apiKey = requireApiKey();
  const bizDate = getBeijingDayStartUtc(now);

  try {
    for (const symbol of MORNING_SYMBOLS) {
      const rows = await fetchRecentSeries(symbol, apiKey);

      for (const row of rows) {
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

    await markCheckpoint(FORMAL_EOD_JOB, bizDate, true, "Formal EOD synced.");
  } catch (error) {
    await markCheckpoint(
      FORMAL_EOD_JOB,
      bizDate,
      false,
      error instanceof Error ? error.message : "Unknown formal EOD sync error.",
    );
    throw error;
  }
}

async function runStartupCompensation(now = new Date()) {
  if (!process.env.TWELVE_DATA_API_KEY) {
    return;
  }

  const bizDate = getBeijingDayStartUtc(now);
  const beijingMinutesNow = getBeijingTimeHM(now);

  if (beijingMinutesNow >= MORNING_CUTOFF_MINUTES) {
    const hasMorning = await isCheckpointSuccess(MORNING_SNAPSHOT_JOB, bizDate);

    if (!hasMorning) {
      await syncMorningSnapshotsForToday(now);
    }
  }

  if (beijingMinutesNow >= EOD_CUTOFF_MINUTES) {
    const hasEod = await isCheckpointSuccess(FORMAL_EOD_JOB, bizDate);

    if (!hasEod) {
      await syncFormalEodForToday(now);
    }
  }
}

export async function ensureStartupCompensation() {
  const now = Date.now();

  if (compensationPending) {
    return compensationPending;
  }

  if (now - compensationLastRunAt < RECHECK_COOLDOWN_MS) {
    return;
  }

  compensationPending = runStartupCompensation()
    .catch((error) => {
      console.error("Startup compensation failed:", error);
    })
    .finally(() => {
      compensationLastRunAt = Date.now();
      compensationPending = null;
    });

  return compensationPending;
}

export async function getTodayMorningSnapshots(now = new Date()) {
  const bizDate = getBeijingDayStartUtc(now);
  const rows = await prisma.morningCloseSnapshot.findMany({
    where: {
      snapshotDate: bizDate,
    },
    select: {
      symbol: true,
      price: true,
      percentChange: true,
      sourceTimestamp: true,
      sourceLabel: true,
    },
  });

  return new Map<string, MorningSnapshotView>(
    rows.map((row) => [
      row.symbol,
      {
        symbol: row.symbol,
        price: row.price,
        percentChange: row.percentChange,
        sourceTimestamp: row.sourceTimestamp,
        sourceLabel: row.sourceLabel,
      },
    ]),
  );
}

export async function shouldPreferMorningSnapshot(now = new Date()) {
  const beijingMinutesNow = getBeijingTimeHM(now);

  if (beijingMinutesNow < MORNING_CUTOFF_MINUTES) {
    return false;
  }

  const bizDate = getBeijingDayStartUtc(now);
  const hasEod = await isCheckpointSuccess(FORMAL_EOD_JOB, bizDate);
  return !hasEod;
}
