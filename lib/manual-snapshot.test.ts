import { describe, expect, it } from "vitest";

import { getSnapshotCooldownMs, getSnapshotRefreshAvailability } from "./manual-snapshot";

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

  it("uses a one-minute cooldown for homepage market snapshots only", () => {
    expect(getSnapshotCooldownMs("market")).toBe(60_000);
    expect(getSnapshotCooldownMs("forex")).toBe(300_000);
    expect(getSnapshotCooldownMs("btc")).toBe(300_000);
  });
});
