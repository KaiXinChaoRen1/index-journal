export type LivePricePayload = {
  symbol: string;
  price: number;
  officialTime: string;
  fetchedAt: string;
  sourceLabel: string;
  sourceUrl: string;
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function formatDateTime(value: Date) {
  const year = value.getUTCFullYear();
  const month = pad(value.getUTCMonth() + 1);
  const day = pad(value.getUTCDate());
  const hour = pad(value.getUTCHours());
  const minute = pad(value.getUTCMinutes());
  const second = pad(value.getUTCSeconds());

  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

export function parseOfficialTime(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const withTimezone =
    normalized.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(normalized)
      ? normalized
      : `${normalized}Z`;
  const parsed = new Date(withTimezone);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

export function parseQuoteTime(payload: {
  datetime?: string | null;
  timestamp?: number | string | null;
  last_quote_at?: number | string | null;
}) {
  // 解析官方“报价时间”优先级：
  // 1) last_quote_at（秒级时间戳，优先使用）
  // 2) datetime（ISO 或“YYYY-MM-DD HH:MM:SS”，自动补 Z 解析为 UTC）
  // 3) timestamp（秒级时间戳）
  const byLastQuoteAt =
    payload.last_quote_at === undefined || payload.last_quote_at === null
      ? null
      : new Date(Number.parseInt(String(payload.last_quote_at), 10) * 1000);

  if (byLastQuoteAt && Number.isFinite(byLastQuoteAt.getTime())) {
    return byLastQuoteAt;
  }

  const byDatetime = parseOfficialTime(payload.datetime);

  if (byDatetime) {
    return byDatetime;
  }

  const byTimestamp =
    payload.timestamp === undefined || payload.timestamp === null
      ? null
      : new Date(Number.parseInt(String(payload.timestamp), 10) * 1000);

  if (byTimestamp && Number.isFinite(byTimestamp.getTime())) {
    return byTimestamp;
  }

  return null;
}

export function getLivePricePollMs() {
  return 60_000;
}

export function buildLivePriceMeta(payload: Pick<LivePricePayload, "officialTime" | "sourceLabel">) {
  return `官方实时价格 · ${payload.officialTime} · ${payload.sourceLabel}`;
}
