import type { Job } from "@sparkl/shared";
import { describe, expect, it } from "vitest";
import {
  cleanerMetaLine,
  cleanerSegmentForStatus,
  filterCleanerJobsBySegment,
  filterJobsBySegment,
  formatJobWindow,
  formatPriceMinorUnits,
  hostMetaLine,
  pillKeyForStatus,
  segmentForStatus,
  spotlightCleanerJob,
  statusLabelFor,
} from "./my-jobs";

function jobWithStatus(
  status: Job["status"],
  overrides: Partial<Job> = {},
): Job {
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
    ...overrides,
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

describe("cleaner my-jobs segments", () => {
  it("maps every lifecycle state to a cleaner segment", () => {
    expect(cleanerSegmentForStatus("claimed")).toBe("claimed");
    expect(cleanerSegmentForStatus("in_progress")).toBe("active");
    expect(cleanerSegmentForStatus("completed")).toBe("history");
    expect(cleanerSegmentForStatus("cancelled")).toBe("history");
    expect(cleanerSegmentForStatus("open")).toBe("history");
  });

  it("filters claimed jobs by segment", () => {
    const jobs = [
      jobWithStatus("claimed"),
      jobWithStatus("in_progress"),
      jobWithStatus("completed"),
    ];
    expect(filterCleanerJobsBySegment(jobs, "claimed")).toHaveLength(1);
    expect(filterCleanerJobsBySegment(jobs, "active")).toHaveLength(1);
    expect(filterCleanerJobsBySegment(jobs, "history")).toHaveLength(1);
  });

  it("spotlights the earliest window in claimed/active, never history", () => {
    const early = jobWithStatus("claimed", {
      id: "early",
      windowStart: "2026-11-01T09:00:00Z",
      windowEnd: "2026-11-01T11:00:00Z",
    });
    const late = jobWithStatus("claimed", {
      id: "late",
      windowStart: "2026-11-09T09:00:00Z",
      windowEnd: "2026-11-09T11:00:00Z",
    });
    // Newest-first input order must not decide: earliest window wins.
    expect(spotlightCleanerJob([late, early], "claimed")?.id).toBe("early");
    const active = jobWithStatus("in_progress", { id: "active" });
    expect(spotlightCleanerJob([active, early], "active")?.id).toBe("active");
    expect(spotlightCleanerJob([late, early], "history")).toBeNull();
  });

  it("returns no spotlight when the segment is empty", () => {
    expect(spotlightCleanerJob([], "claimed")).toBeNull();
    expect(
      spotlightCleanerJob([jobWithStatus("completed")], "claimed"),
    ).toBeNull();
  });

  it("builds the cleaner meta line like the host card", () => {
    expect(cleanerMetaLine(jobWithStatus("claimed"))).toBe(
      hostMetaLine(jobWithStatus("claimed")),
    );
  });
});
