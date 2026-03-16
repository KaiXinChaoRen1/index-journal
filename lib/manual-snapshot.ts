import { BTC_SYMBOL } from "@/lib/btc-data";
import { FOREX_DEFINITIONS } from "@/lib/forex-data";
import { MARKET_DEFINITIONS } from "@/lib/index-data";
import { formatDateTime, parseQuoteTime } from "@/lib/live-price-shared";
import { prisma } from "@/lib/prisma";

const TWELVE_DATA_QUOTE_URL = "https://api.twelvedata.com/quote";
const SNAPSHOT_COOLDOWN_MS_BY_GROUP: Record<SnapshotGroupKey, number> = {
  market: 60 * 1000,
  forex: 5 * 60 * 1000,
  btc: 5 * 60 * 1000,
};

/**
 * 手动快照服务层。
 *
 * 这层处理的不是长期历史，而是“页面上最近一次主动刷新出来的价格”。
 * 它回答的是：
 * - 某个页面组能不能刷新？
 * - 现在要不要走冷却复用？
 * - 刷新成功或失败后，SQLite 里该如何记录状态？
 */
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

  // 超时或网络超时
  if (
    raw.includes("timeout") ||
    raw.includes("The operation was aborted") ||
    raw.includes("AbortError")
  ) {
    return "数据源响应较慢，暂时无法获取最新快照，请稍后手动刷新。";
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

export function getSnapshotCooldownMs(groupKey: SnapshotGroupKey) {
  return SNAPSHOT_COOLDOWN_MS_BY_GROUP[groupKey];
}

function getCooldownRemainingSeconds(
  groupKey: SnapshotGroupKey,
  lastSuccessAt: Date | null,
  now = Date.now(),
) {
  if (!lastSuccessAt) {
    return 0;
  }

  const remainingMs = getSnapshotCooldownMs(groupKey) - (now - lastSuccessAt.getTime());
  if (remainingMs <= 0) {
    return 0;
  }

  return Math.ceil(remainingMs / 1000);
}

// 自动刷新最大容忍时间（2天）
const MAX_AUTO_REFRESH_AGE_MS = 2 * 24 * 60 * 60 * 1000;

/**
 * 判断是否需要自动刷新。
 *
 * 用于页面进入时的服务端判断：如果数据超过指定时间未更新，
 * 应该自动触发刷新，而不是让用户看到过时数据。
 */
export function shouldAutoRefresh(
  groupKey: SnapshotGroupKey,
  lastSuccessAt: Date | null,
  options?: { maxAgeMs?: number }
): { needed: boolean; reason?: string } {
  const maxAge = options?.maxAgeMs ?? getSnapshotCooldownMs(groupKey);

  if (!lastSuccessAt) {
    return { needed: true, reason: "无历史快照" };
  }

  const ageMs = Date.now() - lastSuccessAt.getTime();

  // 超过2天未刷新，强烈建议刷新
  if (ageMs > MAX_AUTO_REFRESH_AGE_MS) {
    return { needed: true, reason: `数据已过期 ${Math.round(ageMs / 60000)} 分钟` };
  }

  // 超过指定冷却时间，建议刷新
  if (ageMs > maxAge) {
    return { needed: true, reason: `数据已过期 ${Math.round(ageMs / 60000)} 分钟` };
  }

  return { needed: false };
}

/**
 * 后台触发刷新（不等待结果）。
 *
 * 用于首页等场景：快速检查是否需要刷新，如果需要则在后台触发，
 * 不阻塞页面渲染。用户后续进入 BTC/Forex 页面时数据已更新。
 */
export async function triggerBackgroundRefresh(groupKey: SnapshotGroupKey): Promise<void> {
  const state = await getSnapshotGroupState(groupKey);
  const check = shouldAutoRefresh(groupKey, state.lastSuccessAt);
  const availability = getSnapshotRefreshAvailability(groupKey);

  if (!check.needed || !availability.canRefresh) {
    return;
  }

  // 使用 Promise.resolve 确保异步执行，不阻塞当前调用方
  Promise.resolve().then(async () => {
    try {
      await refreshSnapshotGroup(groupKey);
    } catch {
      // 后台刷新失败静默处理
    }
  });
}

function buildCooldownMessage(
  groupKey: SnapshotGroupKey,
  lastSuccessAt: Date,
  remainingSeconds: number,
) {
  const cooldownSeconds = Math.floor(getSnapshotCooldownMs(groupKey) / 1000);
  const cooldownMinutes =
    cooldownSeconds % 60 === 0 ? `${cooldownSeconds / 60} 分钟` : `${cooldownSeconds} 秒`;

  return `最近一次更新于 ${formatDateTime(lastSuccessAt)} UTC，${cooldownMinutes}内不重复请求（剩余 ${remainingSeconds} 秒）。`;
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
  // 口径约束：BTC 与外汇允许 7x24；只有美股指数受纽约常规交易时段限制。
  if (groupKey === "btc" || groupKey === "forex") {
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
    signal: AbortSignal.timeout(5000),
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
    last_quote_at?: number | string;
  };

  if (payload.status === "error") {
    throw new Error(payload.message ?? "Quote API error.");
  }

  const price = Number.parseFloat(String(payload.close ?? ""));

  if (!Number.isFinite(price)) {
    throw new Error(`Quote missing close price for ${symbol}.`);
  }

  const sourceTime = parseQuoteTime(payload) ?? new Date();
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
  const groupConfig = SNAPSHOT_GROUPS[groupKey];
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

  const cooldownRemainingSeconds = getCooldownRemainingSeconds(
    groupKey,
    currentState.lastSuccessAt,
    now.getTime(),
  );
  const hasAllSymbols = groupConfig.symbols.every((symbol) => currentState.payload[symbol]);

  if (cooldownRemainingSeconds > 0 && hasAllSymbols && currentState.lastSuccessAt) {
    return {
      ok: true,
      status: "cooldown",
      message: buildCooldownMessage(groupKey, currentState.lastSuccessAt, cooldownRemainingSeconds),
      cooldownRemainingSeconds,
      state: currentState,
    };
  }

  try {
    // 统一按页面数据组刷新，避免单个按钮触发多次分散请求。
    const entries = await Promise.all(
      groupConfig.symbols.map((symbol) => fetchQuoteSnapshot(symbol, groupConfig.sourceLabel)),
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
