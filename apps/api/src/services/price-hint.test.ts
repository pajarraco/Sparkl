import { type Job, PRICE_HINT_CONFIG } from "@sparkl/shared";
import { describe, expect, it } from "vitest";
import { comparableJobs, median, suggestPriceHint } from "./price-hint.js";

const HERE = { sizeSqm: 80, latitude: -33.8909546, longitude: 151.2633431 };

function job(overrides: Partial<Job> = {}): Job {
  return {
    id: "job-1",
    hostId: "host-1",
    address: "12 Ocean St, Bondi",
    latitude: HERE.latitude,
    longitude: HERE.longitude,
    windowStart: "2026-10-30T10:00:00.000Z",
    windowEnd: "2026-10-30T13:00:00.000Z",
    sizeSqm: 80,
    notes: null,
    priceMinorUnits: 6000,
    status: "open",
    claimedByCleanerId: null,
    preferredCleanerId: null,
    createdAt: "2026-10-29T03:00:00.000Z",
    updatedAt: "2026-10-29T03:00:00.000Z",
    ...overrides,
  };
}

// About 11 km north of HERE: outside the 5 km radius.
const FAR = { latitude: -33.7, longitude: 151.2633431 };

describe("median", () => {
  it("takes the middle value, or the rounded mean of the two middle values", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(3);
    expect(median([1, 2])).toBe(2); // 1.5 rounds up
  });

  it("returns 0 for no values", () => {
    expect(median([])).toBe(0);
  });
});

describe("comparableJobs", () => {
  it("keeps jobs with a price, a size within tolerance and a spot within the radius", () => {
    const pool = [
      job({ id: "near-same-size" }),
      job({ id: "no-price", priceMinorUnits: 0 }),
      job({ id: "no-size", sizeSqm: null }),
      job({ id: "too-big", sizeSqm: 200 }),
      job({ id: "too-far", latitude: FAR.latitude }),
      job({
        id: "edge-size",
        sizeSqm: 80 * (1 + PRICE_HINT_CONFIG.sizeTolerance),
      }),
    ];

    expect(comparableJobs(HERE, pool).map((j) => j.id)).toEqual([
      "near-same-size",
      "edge-size",
    ]);
  });
});

describe("suggestPriceHint", () => {
  it("uses the median of comparables when there are enough", () => {
    const pool = [
      job({ id: "a", priceMinorUnits: 5000 }),
      job({ id: "b", priceMinorUnits: 6000 }),
      job({ id: "c", priceMinorUnits: 9000 }),
    ];

    expect(suggestPriceHint(HERE, pool)).toEqual({
      medianMinorUnits: 6000,
      comparables: 3,
      source: "comparables",
    });
  });

  it("falls back to the per-m² rate with too few comparables", () => {
    const pool = [
      job({ priceMinorUnits: 5000 }),
      job({ priceMinorUnits: 7000 }),
    ];

    expect(suggestPriceHint(HERE, pool)).toEqual({
      medianMinorUnits: 80 * PRICE_HINT_CONFIG.perSqmMinorUnits,
      comparables: 2,
      source: "per_sqm",
    });
  });

  it("uses the per-m² rate on an empty pool", () => {
    expect(suggestPriceHint(HERE, [])).toEqual({
      medianMinorUnits: 32000,
      comparables: 0,
      source: "per_sqm",
    });
  });

  it("honours a custom config", () => {
    const config = { ...PRICE_HINT_CONFIG, minComparables: 1 };
    const pool = [job({ priceMinorUnits: 4200 })];

    expect(suggestPriceHint(HERE, pool, config)).toEqual({
      medianMinorUnits: 4200,
      comparables: 1,
      source: "comparables",
    });
  });
});
