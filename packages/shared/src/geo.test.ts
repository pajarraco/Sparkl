import { describe, expect, it } from "vitest";
import {
  geoAutocompleteInput,
  geoGeocodeInput,
  geoPlaceSchema,
  geoPlacesOutput,
  geoReverseOutput,
} from "./geo";

describe("geo", () => {
  it("parses a valid place", () => {
    const result = geoPlaceSchema.safeParse({
      id: "123",
      label: "Test Place",
      latitude: 45.5,
      longitude: -122.7,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe("123");
      expect(result.data.label).toBe("Test Place");
      expect(result.data.latitude).toBe(45.5);
      expect(result.data.longitude).toBe(-122.7);
    }
  });

  it("rejects latitude 91", () => {
    const result = geoPlaceSchema.safeParse({
      id: "123",
      label: "Test Place",
      latitude: 91,
      longitude: -122.7,
    });
    expect(result.success).toBe(false);
  });

  it("rejects longitude -181", () => {
    const result = geoPlaceSchema.safeParse({
      id: "123",
      label: "Test Place",
      latitude: 45.5,
      longitude: -181,
    });
    expect(result.success).toBe(false);
  });

  it("rejects extra keys (strict)", () => {
    const result = geoPlaceSchema.safeParse({
      id: "123",
      label: "Test Place",
      latitude: 45.5,
      longitude: -122.7,
      extra: "key",
    });
    expect(result.success).toBe(false);
  });

  it("autocomplete trims query and applies limit default", () => {
    const result = geoAutocompleteInput.safeParse({
      query: "  test  ",
      near: { latitude: 45.5, longitude: -122.7 },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.query).toBe("test");
      expect(result.data.limit).toBe(5);
    }
  });

  it("rejects 2-char query", () => {
    const result = geoGeocodeInput.safeParse({
      query: "ab",
    });
    expect(result.success).toBe(false);
  });

  it("rejects near with only latitude", () => {
    const result = geoAutocompleteInput.safeParse({
      query: "test",
      near: { latitude: 45.5 },
    });
    expect(result.success).toBe(false);
  });

  it("reverse output accepts { place: null }", () => {
    const result = geoReverseOutput.safeParse({
      place: null,
    });
    expect(result.success).toBe(true);
  });

  it("places output rejects 11 places", () => {
    const result = geoPlacesOutput.safeParse({
      places: Array(11).fill({
        id: "123",
        label: "Test Place",
        latitude: 45.5,
        longitude: -122.7,
      }),
    });
    expect(result.success).toBe(false);
  });
});
