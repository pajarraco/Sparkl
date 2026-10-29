import type { GeoPlace } from "@sparkl/shared";
import { describe, expect, it } from "vitest";
import {
  AUTOCOMPLETE_MIN_CHARS,
  coordsOf,
  pinToValue,
  placeToValue,
  shouldAutocomplete,
  typedAddress,
} from "./address-picker";

const PLACE: GeoPlace = {
  id: "osm:W1082668130",
  label:
    "12 Ocean Street North, Bondi, Sydney, New South Wales, 2026, Australia",
  latitude: -33.8909546,
  longitude: 151.2633431,
};

describe("address-picker", () => {
  it("exports AUTOCOMPLETE_MIN_CHARS as 3", () => {
    expect(AUTOCOMPLETE_MIN_CHARS).toBe(3);
  });

  it("shouldAutocomplete correctly", () => {
    expect(shouldAutocomplete("12 ", false)).toBe(false); // trimmed length 2
    expect(shouldAutocomplete("12 O", false)).toBe(true); // trimmed length 3
    expect(shouldAutocomplete("12 Ocean St", true)).toBe(false); // already picked
    expect(shouldAutocomplete("   ", false)).toBe(false); // trimmed length 0
  });

  it("typedAddress correctly", () => {
    expect(typedAddress("12 Oce")).toEqual({
      address: "12 Oce",
      latitude: "",
      longitude: "",
    });
  });

  it("placeToValue correctly", () => {
    expect(placeToValue(PLACE)).toEqual({
      address: PLACE.label,
      latitude: "-33.8909546",
      longitude: "151.2633431",
    });
  });

  it("pinToValue correctly", () => {
    const current = placeToValue(PLACE);

    // Test with no reverse geocoding result
    const result1 = pinToValue(current, -33.89, 151.27, null);
    expect(result1).toEqual({
      address: PLACE.label,
      latitude: "-33.8900000",
      longitude: "151.2700000",
    });
    // Ensure original is not mutated
    expect(current).toEqual({
      address: PLACE.label,
      latitude: "-33.8909546",
      longitude: "151.2633431",
    });

    // Test with reverse geocoding result
    const reversed = { ...PLACE, label: "Penkivil Street, Bondi" };
    const result2 = pinToValue(current, -33.89, 151.27, reversed);
    expect(result2).toEqual({
      address: "Penkivil Street, Bondi",
      latitude: "-33.8900000",
      longitude: "151.2700000",
    });
  });

  it("coordsOf correctly", () => {
    expect(coordsOf({ latitude: "-33.89", longitude: "151.27" })).toEqual({
      latitude: -33.89,
      longitude: 151.27,
    });

    // Test null cases
    expect(coordsOf({ latitude: "", longitude: "" })).toBeNull();
    expect(coordsOf({ latitude: "", longitude: "151.27" })).toBeNull();
    expect(coordsOf({ latitude: "abc", longitude: "151.27" })).toBeNull();
    expect(coordsOf({ latitude: "-33.89", longitude: "  " })).toBeNull();
    expect(coordsOf({ latitude: "91", longitude: "151.27" })).toBeNull();
    expect(coordsOf({ latitude: "-33.89", longitude: "-181" })).toBeNull();

    // Test valid edge case
    expect(coordsOf({ latitude: "90", longitude: "-180" })).toEqual({
      latitude: 90,
      longitude: -180,
    });
  });
});
