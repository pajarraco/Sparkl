import { describe, expect, it } from "vitest";
import { jobSchema } from "./jobs.js";

const baseJob = {
  id: "11111111-1111-4111-8111-111111111111",
  hostId: "22222222-2222-4222-8222-222222222222",
  address: "12 Beach Road, Apt 4",
  latitude: 25.7617,
  longitude: -80.1918,
  windowStart: "2026-11-01T09:00:00Z",
  windowEnd: "2026-11-01T13:00:00Z",
  sizeSqm: 90,
  notes: null,
  priceMinorUnits: 7500,
  status: "open",
  claimedByCleanerId: null,
  createdAt: "2026-10-27T06:00:00Z",
  updatedAt: "2026-10-27T06:00:00Z",
} as const;

describe("jobSchema", () => {
  it("accepts a valid open job", () => {
    expect(jobSchema.parse(baseJob).status).toBe("open");
  });

  it("rejects a window that ends before it starts", () => {
    expect(() =>
      jobSchema.parse({
        ...baseJob,
        windowStart: "2026-11-01T13:00:00Z",
        windowEnd: "2026-11-01T09:00:00Z",
      }),
    ).toThrow("windowEnd must be after windowStart");
  });

  it("rejects negative prices", () => {
    expect(() =>
      jobSchema.parse({ ...baseJob, priceMinorUnits: -100 }),
    ).toThrow();
  });
});
