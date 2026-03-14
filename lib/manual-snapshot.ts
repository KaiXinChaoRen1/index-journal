import { BTC_SYMBOL } from "@/lib/btc-data";
import { FOREX_DEFINITIONS } from "@/lib/forex-data";
import { MARKET_DEFINITIONS } from "@/lib/index-data";
import { formatDateTime, parseOfficialTime } from "@/lib/live-price-shared";
import { prisma } from "@/lib/prisma";

const TWELVE_DATA_QUOTE_URL = "https://api.twelvedata.com/quote";
const SNAPSHOT_COOLDOWN_MS = 5 * 60 * 1000;

export const SNAPSHOT_GROUPS = {
  market: {
    groupKey: "market",
    symbols: MARKET_DEFINITIONS.map((item) => item.symbol),
    sourceLabel: "Twelve Data Quote API",
  },
  forex: {
    groupKey: "forex",
    symbols: FOREX_DEFINITIONS.map((item) => item.symbol),
    sourceLabel: "Twelve Data Quote API",
  },
  btc: {
    groupKey: "btc",
    symbols: [BTC_SYMBOL],
    sourceLabel: "Twelve Data Quote API",
  },
} as const;

export type SnapshotGroupKey = keyof typeof SNAPSHOT_GROUPS;

export type SnapshotEntry = {
  symbol: string;
  price: number;
  sourceTimestamp: string;
  fetchedAt: string;
  sourceLabel: string;
};

type SnapshotPayload = Record<string, SnapshotEntry>;

type SnapshotStateRecord = {
  payload: SnapshotPayload;
  lastSuccessAt: Date | null;
  lastAttemptAt: Date | null;
  lastErrorMessage: string | null;
};

export type SnapshotRefreshResult = {
  ok: boolean;
  status: "updated" | "cooldown" | "error" | "blocked";
  message: string;
  cooldownRemainingSeconds: number;
  state: SnapshotStateRecord;
};

export type SnapshotRefreshAvailability = {
  canRefresh: boolean;
  reason: string | null;
};

function parsePayload(value: string | null): SnapshotPayload {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value) as SnapshotPayload;
    return parsed ?? {};
  } catch {
    return {};
  }
}

function isRateLimitMessage(message: string) {
  const lowered = message.toLowerCase();
  return (
    lowered.includes("run out of api credits") ||
    lowered.includes("api credits") ||
    lowered.includes("rate limit") ||
    lowered.includes("too many requests")
  );
}

function toFriendlyErrorMessage(error: unknown) {
  const raw = error instanceof Error ? error.message : "未知错误";

  if (isRateLimitMessage(raw)) {
    return "当前数据服务请求较频繁，实时刷新额度可能接近上限，请稍后再试。";
  }

  if (raw.includes("Missing TWELVE_DATA_API_KEY")) {
    return "尚未配置 TWELVE_DATA_API_KEY，暂时无法刷新最新快照。";
  }

  return "刷新失败，当前仍显示最近一次快照或日线数据。";
}

function toSnapshotState(record: {
  payloadJson: string | null;
  lastSuccessAt: Date | null;
  lastAttemptAt: Date | null;
  lastErrorMessage: string | null;
} | null): SnapshotStateRecord {
  if (!record) {
    return {
      payload: {},
      lastSuccessAt: null,
      lastAttemptAt: null,
      lastErrorMessage: null,
    };
  }

  return {
    payload: parsePayload(record.payloadJson),
    lastSuccessAt: record.lastSuccessAt,
    lastAttemptAt: record.lastAttemptAt,
    lastErrorMessage: record.lastErrorMessage,
  };
}

function getCooldownRemainingSeconds(lastSuccessAt: Date | null, now = Date.now()) {
  if (!lastSuccessAt) {
    return 0;
  }

  const remainingMs = SNAPSHOT_COOLDOWN_MS - (now - lastSuccessAt.getTime());
  if (remainingMs <= 0) {
    return 0;
  }

  return Math.ceil(remainingMs / 1000);
}

function buildCooldownMessage(lastSuccessAt: Date, remainingSeconds: number) {
  return `最近一次更新于 ${formatDateTime(lastSuccessAt)} UTC，5 分钟内不重复请求（剩余 ${remainingSeconds} 秒）。`;
}

function getNewYorkSessionClock(now = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "Mon";
  const hour = Number.parseInt(parts.find((part) => part.type === "hour")?.value ?? "0", 10);
  const minute = Number.parseInt(parts.find((part) => part.type === "minute")?.value ?? "0", 10);

  return {
    weekday,
    minutes: hour * 60 + minute,
  };
}

export function getSnapshotRefreshAvailability(
  groupKey: SnapshotGroupKey,
  now = new Date(),
): SnapshotRefreshAvailability {
  // 口径约束：BTC 允许 7x24；指数和汇率只在纽约常规交易时段开放手动刷新。
  if (groupKey === "btc") {
    return {
      canRefresh: true,
      reason: null,
    };
  }

  const session = getNewYorkSessionClock(now);
  const isWeekend = session.weekday === "Sat" || session.weekday === "Sun";

  if (isWeekend) {
    return {
      canRefresh: false,
      reason: "当前是周末休市时段，暂不开放手动刷新。请继续参考最近快照与日线数据。",
    };
  }

  const openMinutes = 9 * 60 + 30;
  const closeMinutes = 16 * 60;

  if (session.minutes < openMinutes || session.minutes > closeMinutes) {
    return {
      canRefresh: false,
      reason:
        "当前不在美股常规交易时段，手动刷新已关闭。按项目口径，上午优先昨夜收盘，中午后优先官方EOD。",
    };
  }

  return {
    canRefresh: true,
    reason: null,
  };
}

async function fetchQuoteSnapshot(symbol: string, sourceLabel: string): Promise<SnapshotEntry> {
  const apiKey = process.env.TWELVE_DATA_API_KEY;

  if (!apiKey) {
    throw new Error("Missing TWELVE_DATA_API_KEY in environment.");
  }

  const url = new URL(TWELVE_DATA_QUOTE_URL);
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("apikey", apiKey);
  url.searchParams.set("format", "JSON");

  const response = await fetch(url.toString(), {
    headers: { accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Quote request failed: ${response.status}`);
  }

  const payload = (await response.json()) as {
    status?: string;
    message?: string;
    symbol?: string;
    close?: string;
    datetime?: string;
    timestamp?: number | string;
  };

  if (payload.status === "error") {
    throw new Error(payload.message ?? "Quote API error.");
  }

  const price = Number.parseFloat(String(payload.close ?? ""));

  if (!Number.isFinite(price)) {
    throw new Error(`Quote missing close price for ${symbol}.`);
  }

  const parsedDatetime = parseOfficialTime(payload.datetime);
  const parsedTimestamp =
    payload.timestamp === undefined
      ? null
      : new Date(Number.parseInt(String(payload.timestamp), 10) * 1000);
  const sourceTime =
    parsedDatetime ??
    (parsedTimestamp && Number.isFinite(parsedTimestamp.getTime()) ? parsedTimestamp : new Date());
  const fetchedAt = new Date();

  return {
    symbol: payload.symbol ?? symbol,
    price,
    sourceTimestamp: formatDateTime(sourceTime),
    fetchedAt: formatDateTime(fetchedAt),
    sourceLabel,
  };
}

export function isSnapshotGroupKey(value: string): value is SnapshotGroupKey {
  return value in SNAPSHOT_GROUPS;
}

export async function getSnapshotGroupState(groupKey: SnapshotGroupKey) {
  const record = await prisma.manualSnapshotState.findUnique({
    where: { groupKey },
    select: {
      payloadJson: true,
      lastSuccessAt: true,
      lastAttemptAt: true,
      lastErrorMessage: true,
    },
  });

  return toSnapshotState(record);
}

export async function refreshSnapshotGroup(groupKey: SnapshotGroupKey): Promise<SnapshotRefreshResult> {
  const config = SNAPSHOT_GROUPS[groupKey];
  const now = new Date();
  const currentState = await getSnapshotGroupState(groupKey);
  const availability = getSnapshotRefreshAvailability(groupKey, now);

  if (!availability.canRefresh) {
    return {
      ok: false,
      status: "blocked",
      message: availability.reason ?? "当前时段不可刷新。",
      cooldownRemainingSeconds: 0,
      state: currentState,
    };
  }

  const cooldownRemainingSeconds = getCooldownRemainingSeconds(currentState.lastSuccessAt, now.getTime());
  const hasAllSymbols = config.symbols.every((symbol) => currentState.payload[symbol]);

  if (cooldownRemainingSeconds > 0 && hasAllSymbols && currentState.lastSuccessAt) {
    return {
      ok: true,
      status: "cooldown",
      message: buildCooldownMessage(currentState.lastSuccessAt, cooldownRemainingSeconds),
      cooldownRemainingSeconds,
      state: currentState,
    };
  }

  try {
    // 统一按页面数据组刷新，避免单个按钮触发多次分散请求。
    const entries = await Promise.all(
      config.symbols.map((symbol) => fetchQuoteSnapshot(symbol, config.sourceLabel)),
    );
    const payload = Object.fromEntries(entries.map((entry) => [entry.symbol, entry])) as SnapshotPayload;

    await prisma.manualSnapshotState.upsert({
      where: { groupKey },
      update: {
        payloadJson: JSON.stringify(payload),
        lastSuccessAt: now,
        lastAttemptAt: now,
        lastErrorMessage: null,
      },
      create: {
        groupKey,
        payloadJson: JSON.stringify(payload),
        lastSuccessAt: now,
        lastAttemptAt: now,
        lastErrorMessage: null,
      },
    });

    const nextState: SnapshotStateRecord = {
      payload,
      lastSuccessAt: now,
      lastAttemptAt: now,
      lastErrorMessage: null,
    };

    return {
      ok: true,
      status: "updated",
      message: `已更新到 ${formatDateTime(now)} UTC。`,
      cooldownRemainingSeconds: 0,
      state: nextState,
    };
  } catch (error) {
    const friendlyError = toFriendlyErrorMessage(error);

    await prisma.manualSnapshotState.upsert({
      where: { groupKey },
      update: {
        lastAttemptAt: now,
        lastErrorMessage: friendlyError,
      },
      create: {
        groupKey,
        payloadJson: null,
        lastSuccessAt: null,
        lastAttemptAt: now,
        lastErrorMessage: friendlyError,
      },
    });

    const fallbackState = await getSnapshotGroupState(groupKey);

    return {
      ok: false,
      status: "error",
      message: `${friendlyError} 当前仍展示最近一次已获取的数据。`,
      cooldownRemainingSeconds: 0,
      state: fallbackState,
    };
  }
}
