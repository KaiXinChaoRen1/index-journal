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

export function getLivePricePollMs() {
  return 60_000;
}

export function buildLivePriceMeta(payload: Pick<LivePricePayload, "officialTime" | "sourceLabel">) {
  return `官方实时价格 · ${payload.officialTime} · ${payload.sourceLabel}`;
}
