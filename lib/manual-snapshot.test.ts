import { describe, expect, it } from "vitest";

import { getSnapshotRefreshAvailability } from "./manual-snapshot";

describe("manual-snapshot", () => {
  it("allows forex refresh on weekends", () => {
    const availability = getSnapshotRefreshAvailability("forex", new Date("2026-03-15T14:00:00Z"));

    expect(availability).toEqual({
      canRefresh: true,
      reason: null,
    });
  });

  it("allows btc refresh outside market hours", () => {
    const availability = getSnapshotRefreshAvailability("btc", new Date("2026-03-16T01:00:00Z"));

    expect(availability).toEqual({
      canRefresh: true,
      reason: null,
    });
  });

  it("blocks market refresh on weekends", () => {
    const availability = getSnapshotRefreshAvailability("market", new Date("2026-03-15T14:00:00Z"));

    expect(availability.canRefresh).toBe(false);
    expect(availability.reason).toContain("周末休市");
  });
});
