import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const API_QUOTE_URL = "https://api.twelvedata.com/quote";
const BEIJING_OFFSET_HOURS = 8;
const MORNING_JOB = "MORNING_SNAPSHOT";
const SYMBOLS = ["SPY", "QQQ"];

function requireApiKey() {
  const apiKey = process.env.TWELVE_DATA_API_KEY;

  if (!apiKey) {
    throw new Error("Missing TWELVE_DATA_API_KEY in environment.");
  }

  return apiKey;
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

function parseSourceTime(payload) {
  if (payload.datetime) {
    const normalized = payload.datetime.includes("T")
      ? payload.datetime
      : payload.datetime.replace(" ", "T");
    const date = new Date(`${normalized}Z`);

    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  if (payload.timestamp) {
    const byTimestamp = new Date(Number.parseInt(String(payload.timestamp), 10) * 1000);

    if (!Number.isNaN(byTimestamp.getTime())) {
      return byTimestamp;
    }
  }

  return new Date();
}

async function markCheckpoint(isSuccess, message = null) {
  const bizDate = getBeijingDayStartUtc(new Date());
  await prisma.syncCheckpoint.upsert({
    where: {
      jobType_bizDate: {
        jobType: MORNING_JOB,
        bizDate,
      },
    },
    update: {
      isSuccess,
      message,
      completedAt: new Date(),
    },
    create: {
      jobType: MORNING_JOB,
      bizDate,
      isSuccess,
      message,
      completedAt: new Date(),
    },
  });
}

async function fetchQuote(symbol, apiKey) {
  const url = new URL(API_QUOTE_URL);
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

    const payload = await response.json();

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
      sourceTimestamp: parseSourceTime(payload),
    };
  }

  throw new Error(`Quote retry exhausted for ${symbol}`);
}

async function main() {
  const apiKey = requireApiKey();
  const bizDate = getBeijingDayStartUtc(new Date());

  try {
    for (const symbol of SYMBOLS) {
      const quote = await fetchQuote(symbol, apiKey);

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

    await markCheckpoint(true, "Morning snapshot synced by script.");
  } catch (error) {
    await markCheckpoint(false, error instanceof Error ? error.message : "Unknown morning snapshot error.");
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
