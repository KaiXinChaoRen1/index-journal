import { describe, expect, it } from "vitest";
import {
  buildLivePriceMeta,
  formatDateTime,
  getLivePricePollMs,
  parseOfficialTime,
  parseQuoteTime,
} from "./live-price-shared";

describe("live-price-shared", () => {
  it("formats timestamp as YYYY-MM-DD HH:MM:SS", () => {
    const value = new Date("2026-03-14T12:34:56Z");
    expect(formatDateTime(value)).toBe("2026-03-14 12:34:56");
  });

  it("parses datetime string with and without timezone", () => {
    const withTimezone = parseOfficialTime("2026-03-14T12:34:56Z");
    const withoutTimezone = parseOfficialTime("2026-03-14 12:34:56");

    expect(withTimezone?.toISOString()).toBe("2026-03-14T12:34:56.000Z");
    expect(withoutTimezone?.toISOString()).toBe("2026-03-14T12:34:56.000Z");
  });

  it("keeps poll frequency aligned to one-minute official refresh window", () => {
    expect(getLivePricePollMs()).toBe(60_000);
  });

  it("builds meta text with timestamp and source label", () => {
    expect(
      buildLivePriceMeta({
        officialTime: "2026-03-14 12:34:56",
        sourceLabel: "Twelve Data Official API",
      }),
    ).toBe("官方实时价格 · 2026-03-14 12:34:56 · Twelve Data Official API");
  });

  it("prefers last_quote_at over daily datetime fields", () => {
    const value = parseQuoteTime({
      datetime: "2026-03-16",
      timestamp: 1773604800,
      last_quote_at: 1773650820,
    });

    expect(value?.toISOString()).toBe("2026-03-16T08:47:00.000Z");
  });

  it("falls back to datetime when last_quote_at is missing", () => {
    const value = parseQuoteTime({
      datetime: "2026-03-16 09:31:00",
      timestamp: 1773604800,
    });

    expect(value?.toISOString()).toBe("2026-03-16T09:31:00.000Z");
  });
});
