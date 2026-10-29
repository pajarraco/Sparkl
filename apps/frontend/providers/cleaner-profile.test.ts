import { describe, expect, it } from "vitest";
import {
  DEFAULT_RADIUS_KM,
  RADIUS_OPTIONS_KM,
  areaValueFromProfile,
  availabilitySlotsForToggles,
  initialsForName,
  planProfileSave,
  togglesForAvailability,
  validateServiceArea,
} from "./cleaner-profile";
import { getStrings } from "./i18n";

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

describe("service area on a map", () => {
  it("has correct radius options and default", () => {
    expect(RADIUS_OPTIONS_KM).toEqual([2, 5, 10, 25, 50]);
    expect(RADIUS_OPTIONS_KM).toContain(DEFAULT_RADIUS_KM);
    expect(DEFAULT_RADIUS_KM).toBe(10);
  });

  it("converts profile to area value", () => {
    expect(
      areaValueFromProfile({ serviceLat: null, serviceLng: null }),
    ).toEqual({
      address: "",
      latitude: "",
      longitude: "",
    });
    expect(
      areaValueFromProfile({ serviceLat: -33.89, serviceLng: 151.27 }),
    ).toEqual({
      address: "",
      latitude: "-33.89",
      longitude: "151.27",
    });
  });

  it("plans save with no area and default toggles", () => {
    const result = planProfileSave({
      area: { address: "", latitude: "", longitude: "" },
      radiusKm: 10,
      toggles: { weekdays: true, weekend: false },
    });
    expect(result.serviceArea).toBeNull();
    expect(result.error).toBeNull();
    expect(result.slots.length).toBe(5);
    for (const slot of result.slots) {
      expect(slot.weekday).toBeGreaterThanOrEqual(1);
      expect(slot.weekday).toBeLessThanOrEqual(5);
      expect(slot.startTime).toBe("09:00");
      expect(slot.endTime).toBe("17:00");
    }
  });

  it("blocks save with typed but not picked area", () => {
    const result = planProfileSave({
      area: { address: "12 Ocean", latitude: "", longitude: "" },
      radiusKm: 10,
      toggles: { weekdays: true, weekend: false },
    });
    expect(result.serviceArea).toBeNull();
    expect(result.error).toBe(getStrings().profile.pickArea);
  });

  it("saves picked area with weekend toggles", () => {
    const result = planProfileSave({
      area: {
        address: "12 Ocean St",
        latitude: "-33.8909546",
        longitude: "151.2633431",
      },
      radiusKm: 25,
      toggles: { weekdays: false, weekend: true },
    });
    expect(result.serviceArea).toEqual({
      serviceLat: -33.8909546,
      serviceLng: 151.2633431,
      serviceRadiusKm: 25,
    });
    expect(result.error).toBeNull();
    expect(result.slots.length).toBe(2);
    expect(result.slots.map((slot) => slot.weekday)).toEqual([0, 6]);
  });

  it("saves a pin with empty label", () => {
    const result = planProfileSave({
      area: { address: "", latitude: "-33.89", longitude: "151.27" },
      radiusKm: 10,
      toggles: { weekdays: true, weekend: false },
    });
    expect(result.serviceArea).not.toBeNull();
  });

  it("blocks save with out-of-range coordinates", () => {
    const result = planProfileSave({
      area: { address: "12 Ocean St", latitude: "95", longitude: "151.27" },
      radiusKm: 10,
      toggles: { weekdays: true, weekend: false },
    });
    expect(result.serviceArea).toBeNull();
    expect(result.error).toBe(getStrings().profile.pickArea);
  });

  it("handles both toggles off", () => {
    const result = planProfileSave({
      area: {
        address: "12 Ocean St",
        latitude: "-33.8909546",
        longitude: "151.2633431",
      },
      radiusKm: 25,
      toggles: { weekdays: false, weekend: false },
    });
    expect(result.slots).toEqual([]);
  });
});
