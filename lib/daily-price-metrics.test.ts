import { describe, expect, it } from "vitest";

import { computePeriodChangeMetrics } from "./daily-price-metrics";

function row(date: string, close: number) {
  return {
    date: new Date(`${date}T00:00:00Z`),
    close,
  };
}

describe("daily-price-metrics", () => {
  it("computes shared period changes using the first available row in week/month/year", () => {
    const metrics = computePeriodChangeMetrics([
      row("2025-12-31", 100),
      row("2026-01-02", 110),
      row("2026-01-05", 120),
      row("2026-01-06", 132),
    ]);

    expect(metrics).not.toBeNull();
    expect(metrics?.dailyChangePct).toBe(10);
    expect(metrics?.weeklyChangePct).toBe(10);
    expect(metrics?.monthlyChangePct).toBe(20);
    expect(metrics?.ytdChangePct).toBe(20);
  });

  it("returns null when there are not enough rows for short-term metrics", () => {
    expect(computePeriodChangeMetrics([row("2026-01-05", 120)])).toBeNull();
  });
});
