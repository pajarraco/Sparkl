import type { Job } from "@sparkl/shared";
import { describe, expect, it } from "vitest";
import {
  boardMetaLine,
  formatMatchPercent,
  validateBoardFilters,
} from "./ranked-board";

function openJob(): Job {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    hostId: "22222222-2222-4222-8222-222222222222",
    address: "12 Beach Road, Apt 4",
    latitude: 25.7617,
    longitude: -80.1918,
    windowStart: "2026-11-07T09:00:00Z",
    windowEnd: "2026-11-07T13:00:00Z",
    sizeSqm: 90,
    notes: null,
    priceMinorUnits: 7500,
    status: "open",
    claimedByCleanerId: null,
    createdAt: "2026-10-27T20:00:00Z",
    updatedAt: "2026-10-27T20:00:00Z",
  };
}

describe("validateBoardFilters", () => {
  it("passes empty filters through with query defaults", () => {
    const result = validateBoardFilters({});
    expect(result.errors).toEqual({});
    expect(result.data).toMatchObject({ limit: 20, offset: 0 });
    expect(result.data?.dateFrom).toBeUndefined();
    expect(result.data?.maxDistanceKm).toBeUndefined();
    expect(result.data?.minPriceMinorUnits).toBeUndefined();
  });

  it("maps a day to UTC day bounds", () => {
    const result = validateBoardFilters({ date: "2026-11-07" });
    expect(result.errors).toEqual({});
    expect(result.data?.dateFrom).toBe("2026-11-07T00:00:00Z");
    expect(result.data?.dateTo).toBe("2026-11-07T23:59:59Z");
  });

  it("rejects impossible calendar dates", () => {
    const result = validateBoardFilters({ date: "2026-02-30" });
    expect(result.data).toBeNull();
    expect(result.errors.date).toBe("Use YYYY-MM-DD.");
  });

  it("converts a dollar floor to minor units", () => {
    const result = validateBoardFilters({ minPrice: "75.50" });
    expect(result.errors).toEqual({});
    expect(result.data?.minPriceMinorUnits).toBe(7550);
  });

  it("rejects a non-numeric price floor", () => {
    const result = validateBoardFilters({ minPrice: "lots" });
    expect(result.data).toBeNull();
    expect(result.errors.minPrice).toBe("Enter a valid price.");
  });

  it("pairs a distance with the service-area center", () => {
    const result = validateBoardFilters(
      { maxDistanceKm: "10" },
      { latitude: 25.7617, longitude: -80.1918 },
    );
    expect(result.errors).toEqual({});
    expect(result.data?.maxDistanceKm).toBe(10);
    expect(result.data?.centerLat).toBe(25.7617);
    expect(result.data?.centerLng).toBe(-80.1918);
  });

  it("asks for a service area when distance has no center", () => {
    const result = validateBoardFilters({ maxDistanceKm: "10" });
    expect(result.data).toBeNull();
    expect(result.errors.maxDistanceKm).toBe(
      "Set your service area in Profile to filter by distance.",
    );
  });

  it("rejects a non-numeric distance", () => {
    const result = validateBoardFilters(
      { maxDistanceKm: "far" },
      { latitude: 25.7617, longitude: -80.1918 },
    );
    expect(result.data).toBeNull();
    expect(result.errors.maxDistanceKm).toBe("Enter a valid number.");
  });
});

describe("board formatting", () => {
  it("builds the date/time and price meta line", () => {
    expect(boardMetaLine(openJob())).toBe(
      "Sat, Nov 7 · 9:00 AM–1:00 PM · $75.00",
    );
  });

  it("appends the match percent when a score is given", () => {
    expect(boardMetaLine(openJob(), 0.947)).toBe(
      "Sat, Nov 7 · 9:00 AM–1:00 PM · $75.00 · 95% match",
    );
  });

  it("rounds the match percent and clamps out-of-range scores", () => {
    expect(formatMatchPercent(0.947)).toBe("95% match");
    expect(formatMatchPercent(1.5)).toBe("100% match");
    expect(formatMatchPercent(-0.2)).toBe("0% match");
  });
});
