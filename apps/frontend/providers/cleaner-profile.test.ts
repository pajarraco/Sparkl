import { describe, expect, it } from "vitest";
import {
  availabilitySlotsForToggles,
  initialsForName,
  togglesForAvailability,
  validateServiceArea,
} from "./cleaner-profile";

describe("availabilitySlotsForToggles", () => {
  it("expands weekdays to Mon–Fri 9–5", () => {
    const slots = availabilitySlotsForToggles({
      weekdays: true,
      weekend: false,
    });
    expect(slots.map((slot) => slot.weekday).sort()).toEqual([1, 2, 3, 4, 5]);
    for (const slot of slots) {
      expect(slot.startTime).toBe("09:00");
      expect(slot.endTime).toBe("17:00");
    }
  });

  it("expands the weekend to Sat–Sun and clears on all-off", () => {
    expect(
      availabilitySlotsForToggles({ weekdays: false, weekend: true }).map(
        (slot) => slot.weekday,
      ),
    ).toEqual([0, 6]);
    expect(
      availabilitySlotsForToggles({ weekdays: false, weekend: false }),
    ).toEqual([]);
  });
});

describe("togglesForAvailability", () => {
  it("reads toggles back from default slots", () => {
    expect(
      togglesForAvailability([
        { weekday: 1, startTime: "09:00", endTime: "17:00" },
        { weekday: 2, startTime: "09:00", endTime: "17:00" },
        { weekday: 3, startTime: "09:00", endTime: "17:00" },
        { weekday: 4, startTime: "09:00", endTime: "17:00" },
        { weekday: 5, startTime: "09:00", endTime: "17:00" },
      ]),
    ).toEqual({ weekdays: true, weekend: false });
  });

  it("requires the full default set, not a subset", () => {
    expect(
      togglesForAvailability([
        { weekday: 1, startTime: "09:00", endTime: "17:00" },
      ]),
    ).toEqual({ weekdays: false, weekend: false });
  });
});

describe("validateServiceArea", () => {
  it("accepts a valid area", () => {
    expect(
      validateServiceArea({
        latitude: "25.7617",
        longitude: "-80.1918",
        radiusKm: "10",
      }),
    ).toEqual({
      data: { latitude: 25.7617, longitude: -80.1918, radiusKm: 10 },
      errors: {},
    });
  });

  it("rejects out-of-range and non-numeric fields", () => {
    const result = validateServiceArea({
      latitude: "99",
      longitude: "abc",
      radiusKm: "-5",
    });
    expect(result.data).toBe(null);
    expect(result.errors.latitude).toBe("Enter a valid number.");
    expect(result.errors.longitude).toBe("Enter a valid number.");
    expect(result.errors.radiusKm).toBe("Enter a valid number.");
  });
});

describe("initialsForName", () => {
  it("takes the first two initials", () => {
    expect(initialsForName("Ada Cleaner")).toBe("AC");
    expect(initialsForName("  ada  ")).toBe("A");
    expect(initialsForName("")).toBe("?");
  });
});
