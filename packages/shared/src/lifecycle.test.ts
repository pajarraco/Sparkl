import { describe, expect, it } from "vitest";
import { JOB_STATUS_TRANSITIONS, jobStatusSchema } from "./lifecycle";

describe("jobStatusSchema", () => {
  it("accepts every lifecycle state", () => {
    for (const status of [
      "open",
      "claimed",
      "in_progress",
      "completed",
      "cancelled",
    ] as const) {
      expect(jobStatusSchema.parse(status)).toBe(status);
    }
  });

  it("rejects unknown states", () => {
    expect(() => jobStatusSchema.parse("assigned")).toThrow();
  });
});

describe("JOB_STATUS_TRANSITIONS", () => {
  it("follows open → claimed → in_progress → completed", () => {
    expect(JOB_STATUS_TRANSITIONS.open).toContain("claimed");
    expect(JOB_STATUS_TRANSITIONS.claimed).toContain("in_progress");
    expect(JOB_STATUS_TRANSITIONS.in_progress).toContain("completed");
  });

  it("is terminal for completed and cancelled", () => {
    expect(JOB_STATUS_TRANSITIONS.completed).toEqual([]);
    expect(JOB_STATUS_TRANSITIONS.cancelled).toEqual([]);
  });
});
