import { formatDate } from "@/lib/market-shared";

type MarketKey = "SP500" | "NASDAQ100";

type DisplayIndexDefinition = {
  marketKey: MarketKey;
  title: string;
  fmpSymbol: string;
  stooqSymbol: string;
};

export type DisplayIndexPoint = {
  marketKey: MarketKey;
  title: string;
  symbol: string;
  price: number;
  sourceLabel: string;
  sourceTimeLabel: string;
  sourceStatus: "ok" | "fallback" | "unavailable";
  warningMessage: string | null;
};

type CacheEntry = {
  expiresAt: number;
  data: Map<MarketKey, DisplayIndexPoint>;
};

const DISPLAY_INDEX_CACHE_MS = 60_000;
const FMP_QUOTE_SHORT_URL = "https://financialmodelingprep.com/stable/quote-short";
const STOOQ_DAILY_CSV_URL = "https://stooq.com/q/d/l/";

const DISPLAY_INDEX_DEFINITIONS: DisplayIndexDefinition[] = [
  {
    marketKey: "SP500",
    title: "S&P 500",
    fmpSymbol: "^GSPC",
    stooqSymbol: "^spx",
  },
  {
    marketKey: "NASDAQ100",
    title: "Nasdaq 100",
    fmpSymbol: "^NDX",
    stooqSymbol: "^ndx",
  },
];

let displayIndexCache: CacheEntry | null = null;
let pendingDisplayIndexTask: Promise<Map<MarketKey, DisplayIndexPoint>> | null = null;

function getFmpApiKey() {
  return process.env.FMP_API_KEY?.trim() || null;
}

function formatCsvDate(dateValue: string) {
  const parsed = new Date(`${dateValue}T00:00:00Z`);

  if (Number.isNaN(parsed.getTime())) {
    return `${dateValue} UTC`;
  }

  return `${formatDate(parsed)} UTC`;
}

async function fetchFmpPoint(definition: DisplayIndexDefinition): Promise<DisplayIndexPoint | null> {
  const apiKey = getFmpApiKey();

  if (!apiKey) {
    return null;
  }

  const url = new URL(FMP_QUOTE_SHORT_URL);
  url.searchParams.set("symbol", definition.fmpSymbol);
  url.searchParams.set("apikey", apiKey);

  const response = await fetch(url.toString(), {
    headers: { accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`FMP request failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as
    | Array<{ symbol?: string; price?: number }>
    | { ["Error Message"]?: string };

  if (!Array.isArray(payload)) {
    return null;
  }

  const quote = payload[0];

  if (!quote || !Number.isFinite(quote.price)) {
    return null;
  }

  return {
    marketKey: definition.marketKey,
    title: definition.title,
    symbol: quote.symbol ?? definition.fmpSymbol,
    price: Number(quote.price),
    sourceLabel: "FMP Index Quote",
    sourceTimeLabel: "最新指数点位",
    sourceStatus: "ok",
    warningMessage: null,
  };
}

async function fetchStooqPoint(definition: DisplayIndexDefinition): Promise<DisplayIndexPoint | null> {
  const url = new URL(STOOQ_DAILY_CSV_URL);
  url.searchParams.set("s", definition.stooqSymbol);
  url.searchParams.set("i", "d");

  const response = await fetch(url.toString(), {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Stooq request failed with status ${response.status}.`);
  }

  const csvText = await response.text();
  const lines = csvText
    .trim()
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return null;
  }

  const latestRow = lines.at(-1);

  if (!latestRow) {
    return null;
  }

  const [dateValue, , , , closeValue] = latestRow.split(",");
  const price = Number.parseFloat(closeValue ?? "");

  if (!dateValue || !Number.isFinite(price)) {
    return null;
  }

  return {
    marketKey: definition.marketKey,
    title: definition.title,
    symbol: definition.stooqSymbol.toUpperCase(),
    price,
    sourceLabel: "Stooq Daily Index",
    sourceTimeLabel: `最近交易日 ${formatCsvDate(dateValue)}`,
    sourceStatus: "fallback",
    warningMessage: "真实指数点位当前由备用数据源提供；如果备用源不可用，将回退显示 ETF 价格。",
  };
}

async function resolveDisplayIndexPoint(definition: DisplayIndexDefinition): Promise<DisplayIndexPoint> {
  try {
    const fmpPoint = await fetchFmpPoint(definition);

    if (fmpPoint) {
      return fmpPoint;
    }
  } catch {
    // FMP 是优先源，但任何失败都继续尝试备用源，避免首页头部因单一服务失败而空白。
  }

  try {
    const stooqPoint = await fetchStooqPoint(definition);

    if (stooqPoint) {
      return stooqPoint;
    }
  } catch {
    // 备用源也可能失败，此时交给最终不可用态统一提示。
  }

  return {
    marketKey: definition.marketKey,
    title: definition.title,
    symbol: definition.fmpSymbol,
    price: 0,
    sourceLabel: "指数点位暂时不可用",
    sourceTimeLabel: "当前已回退到 ETF 价格",
    sourceStatus: "unavailable",
    warningMessage: "真实指数点位服务暂时不可用，页面当前继续显示 SPY / QQQ 的价格与指标。",
  };
}

async function fetchDisplayIndexPointsInner() {
  const entries = await Promise.all(
    DISPLAY_INDEX_DEFINITIONS.map(async (definition) => {
      const point = await resolveDisplayIndexPoint(definition);
      return [definition.marketKey, point] as const;
    }),
  );

  return new Map<MarketKey, DisplayIndexPoint>(entries);
}

export async function getDisplayIndexPoints() {
  const now = Date.now();

  if (displayIndexCache && displayIndexCache.expiresAt > now) {
    return displayIndexCache.data;
  }

  if (!pendingDisplayIndexTask) {
    pendingDisplayIndexTask = fetchDisplayIndexPointsInner().finally(() => {
      pendingDisplayIndexTask = null;
    });
  }

  const data = await pendingDisplayIndexTask;
  displayIndexCache = {
    expiresAt: Date.now() + DISPLAY_INDEX_CACHE_MS,
    data,
  };

  return data;
}
