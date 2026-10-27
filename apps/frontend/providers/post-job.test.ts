import { describe, expect, it } from "vitest";
import { validatePostJob } from "./post-job.js";

function validForm() {
  return {
    address: "12 Beach Road, Apt 4",
    date: "2026-11-07",
    windowStart: "09:00",
    windowEnd: "13:00",
    sizeSqm: "90",
    notes: "Entry code 1234",
    price: "75",
    latitude: "25.7617",
    longitude: "-80.1918",
  };
}

describe("validatePostJob", () => {
  it("coerces a complete form into createJobInput shape", () => {
    const result = validatePostJob(validForm());
    expect(result.errors).toEqual({});
    expect(result.data).toStrictEqual({
      address: "12 Beach Road, Apt 4",
      latitude: 25.7617,
      longitude: -80.1918,
      windowStart: "2026-11-07T09:00:00Z",
      windowEnd: "2026-11-07T13:00:00Z",
      sizeSqm: 90,
      notes: "Entry code 1234",
      priceMinorUnits: 7500,
    });
  });

  it("omits optional size and notes when blank", () => {
    const result = validatePostJob({
      ...validForm(),
      sizeSqm: "",
      notes: "   ",
    });
    expect(result.errors).toEqual({});
    expect(result.data).toStrictEqual({
      address: "12 Beach Road, Apt 4",
      latitude: 25.7617,
      longitude: -80.1918,
      windowStart: "2026-11-07T09:00:00Z",
      windowEnd: "2026-11-07T13:00:00Z",
      sizeSqm: undefined,
      notes: undefined,
      priceMinorUnits: 7500,
    });
  });

  it("converts decimal prices to minor units", () => {
    const result = validatePostJob({ ...validForm(), price: "75.50" });
    expect(result.errors).toEqual({});
    expect(result.data?.priceMinorUnits).toBe(7550);
  });

  it("rejects an empty address", () => {
    const result = validatePostJob({ ...validForm(), address: "  " });
    expect(result.data).toBeNull();
    expect(result.errors.address).toBe("This field is required.");
  });

  it("rejects impossible calendar dates", () => {
    for (const date of ["2026-13-40", "2026-02-30", "11/07/2026", ""]) {
      const result = validatePostJob({ ...validForm(), date });
      expect(result.data).toBeNull();
      expect(result.errors.date).toBe("Use YYYY-MM-DD.");
    }
  });

  it("rejects malformed times", () => {
    const result = validatePostJob({ ...validForm(), windowStart: "9am" });
    expect(result.data).toBeNull();
    expect(result.errors.windowStart).toBe("Use 24-hour HH:MM.");
  });

  it("rejects a window that ends before it starts", () => {
    const result = validatePostJob({
      ...validForm(),
      windowStart: "13:00",
      windowEnd: "09:00",
    });
    expect(result.data).toBeNull();
    expect(result.errors.windowEnd).toBe("End must be after start.");
  });

  it("rejects unparseable prices", () => {
    for (const price of ["abc", "-5", "75.999", ""]) {
      const result = validatePostJob({ ...validForm(), price });
      expect(result.data).toBeNull();
      expect(result.errors.price).toBe("Enter a valid price.");
    }
  });

  it("rejects non-numeric coordinates", () => {
    const result = validatePostJob({ ...validForm(), latitude: "north" });
    expect(result.data).toBeNull();
    expect(result.errors.latitude).toBe("Enter a valid number.");
  });

  it("rejects out-of-range coordinates via the shared schema", () => {
    const result = validatePostJob({ ...validForm(), latitude: "95" });
    expect(result.data).toBeNull();
    expect(result.errors.latitude).toBe("Enter a valid number.");
  });
});
