import type { Job } from "@sparkl/shared";
import { describe, expect, it } from "vitest";
import {
  filterJobsBySegment,
  formatJobWindow,
  formatPriceMinorUnits,
  hostMetaLine,
  pillKeyForStatus,
  segmentForStatus,
  statusLabelFor,
} from "./my-jobs";

function jobWithStatus(status: Job["status"]): Job {
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
    status,
    claimedByCleanerId: null,
    createdAt: "2026-10-27T20:00:00Z",
    updatedAt: "2026-10-27T20:00:00Z",
  };
}

describe("my-jobs segments", () => {
  it("maps every lifecycle state to a segment", () => {
    expect(segmentForStatus("open")).toBe("open");
    expect(segmentForStatus("claimed")).toBe("active");
    expect(segmentForStatus("in_progress")).toBe("active");
    expect(segmentForStatus("completed")).toBe("history");
    expect(segmentForStatus("cancelled")).toBe("history");
  });

  it("filters jobs by segment", () => {
    const jobs = [
      jobWithStatus("open"),
      jobWithStatus("claimed"),
      jobWithStatus("completed"),
    ];
    expect(filterJobsBySegment(jobs, "open")).toHaveLength(1);
    expect(filterJobsBySegment(jobs, "active")).toHaveLength(1);
    expect(filterJobsBySegment(jobs, "history")).toHaveLength(1);
  });

  it("maps in_progress to the camelCase pill key", () => {
    expect(pillKeyForStatus("in_progress")).toBe("inProgress");
    expect(pillKeyForStatus("open")).toBe("open");
    expect(pillKeyForStatus("cancelled")).toBe("cancelled");
  });

  it("labels every lifecycle state", () => {
    expect(statusLabelFor("open")).toBe("Open");
    expect(statusLabelFor("claimed")).toBe("Claimed");
    expect(statusLabelFor("in_progress")).toBe("In progress");
    expect(statusLabelFor("completed")).toBe("Completed");
    expect(statusLabelFor("cancelled")).toBe("Cancelled");
  });
});

describe("my-jobs formatting", () => {
  it("formats prices with cents", () => {
    expect(formatPriceMinorUnits(7500)).toBe("$75.00");
    expect(formatPriceMinorUnits(7550)).toBe("$75.50");
  });

  it("formats the window as day plus time range", () => {
    expect(
      formatJobWindow("2026-11-07T09:00:00Z", "2026-11-07T13:00:00Z"),
    ).toBe("Sat, Nov 7 · 9:00 AM–1:00 PM");
  });

  it("builds the host meta line with size", () => {
    expect(hostMetaLine(jobWithStatus("open"))).toBe(
      "Sat, Nov 7 · 9:00 AM–1:00 PM · $75.00 · 90 m²",
    );
  });

  it("omits size from the meta line when absent", () => {
    const job = { ...jobWithStatus("open"), sizeSqm: null };
    expect(hostMetaLine(job)).toBe("Sat, Nov 7 · 9:00 AM–1:00 PM · $75.00");
  });
});
