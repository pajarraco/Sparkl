import { describe, expect, it } from "vitest";
import { cleanerAvailabilitySchema } from "./availability";

const baseSlot = {
  cleanerId: "33333333-3333-4333-8333-333333333333",
  weekday: 5,
  startTime: "09:00",
  endTime: "17:00",
} as const;

describe("cleanerAvailabilitySchema", () => {
  it("accepts a valid weekday slot", () => {
    expect(cleanerAvailabilitySchema.parse(baseSlot).weekday).toBe(5);
  });

  it("rejects an end time before the start time", () => {
    expect(() =>
      cleanerAvailabilitySchema.parse({
        ...baseSlot,
        startTime: "17:00",
        endTime: "09:00",
      }),
    ).toThrow("startTime must be before endTime");
  });

  it("rejects out-of-range weekdays", () => {
    expect(() =>
      cleanerAvailabilitySchema.parse({ ...baseSlot, weekday: 7 }),
    ).toThrow();
  });
});
