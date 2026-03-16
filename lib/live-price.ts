import {
  formatDateTime,
  parseQuoteTime,
  type LivePricePayload,
} from "@/lib/live-price-shared";

const TWELVE_DATA_QUOTE_URL = "https://api.twelvedata.com/quote";
const LIVE_PRICE_CACHE_MS = 60_000;

type CacheEntry = {
  expiresAt: number;
  data: LivePricePayload;
};

const livePriceCache = new Map<string, CacheEntry>();
const livePricePending = new Map<string, Promise<LivePricePayload>>();

export async function fetchOfficialLivePrice(symbol: string): Promise<LivePricePayload> {
  const now = Date.now();
  const cacheKey = symbol.toUpperCase();
  const cached = livePriceCache.get(cacheKey);

  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const pending = livePricePending.get(cacheKey);

  if (pending) {
    return pending;
  }

  const task = fetchOfficialLivePriceInner(symbol).finally(() => {
    livePricePending.delete(cacheKey);
  });
  livePricePending.set(cacheKey, task);

  try {
    const data = await task;
    livePriceCache.set(cacheKey, {
      expiresAt: Date.now() + LIVE_PRICE_CACHE_MS,
      data,
    });

    return data;
  } catch (error) {
    if (cached) {
      return cached.data;
    }

    throw error;
  }
}

async function fetchOfficialLivePriceInner(symbol: string): Promise<LivePricePayload> {
  const apiKey = process.env.TWELVE_DATA_API_KEY;

  if (!apiKey) {
    throw new Error("Missing TWELVE_DATA_API_KEY in environment.");
  }

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

      throw new Error(`Official quote request failed: ${response.status}`);
    }

    const payload = (await response.json()) as {
      status?: string;
      message?: string;
      symbol?: string;
      close?: string;
      datetime?: string;
      timestamp?: number | string;
      last_quote_at?: number | string;
    };

    if (payload.status === "error") {
      if (attempt === 0) {
        continue;
      }

      throw new Error(payload.message ?? "Official quote API error.");
    }

    const price = Number.parseFloat(String(payload.close ?? ""));

    if (!Number.isFinite(price)) {
      if (attempt === 0) {
        continue;
      }

      throw new Error(`Official quote missing close price for ${symbol}.`);
    }

    const officialTimeDate = parseQuoteTime(payload) ?? new Date();
    const now = new Date();

    return {
      symbol: payload.symbol ?? symbol,
      price,
      officialTime: formatDateTime(officialTimeDate),
      fetchedAt: formatDateTime(now),
      sourceLabel: "Twelve Data Official API",
      sourceUrl: "https://twelvedata.com/docs",
    };
  }

  throw new Error("Official quote request failed after retries.");
}
