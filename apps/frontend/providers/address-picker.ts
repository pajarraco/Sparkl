import type { GeoPlace } from "@sparkl/shared";

// Pure helpers for the address + map picker (rules.md: no logic in
// components). Coordinates only come from a geocoder place or the pin:
// typing a new address clears them, so the host must pick a suggestion or
// drop the pin before posting.

export const AUTOCOMPLETE_MIN_CHARS = 3;
export const AUTOCOMPLETE_DEBOUNCE_MS = 400;
export const AUTOCOMPLETE_LIMIT = 5;

export interface AddressValue {
  address: string;
  latitude: string;
  longitude: string;
}

export function shouldAutocomplete(query: string, picked: boolean): boolean {
  return !picked && query.trim().length >= AUTOCOMPLETE_MIN_CHARS;
}

// Typing replaces the address and drops coordinates from an earlier pick.
export function typedAddress(text: string): AddressValue {
  return { address: text, latitude: "", longitude: "" };
}

export function placeToValue(place: GeoPlace): AddressValue {
  return {
    address: place.label,
    latitude: String(place.latitude),
    longitude: String(place.longitude),
  };
}

// The pin moved: keep the typed/picked label until reverse geocoding
// answers, so the address never goes blank under the host's finger.
export function pinToValue(
  current: AddressValue,
  latitude: number,
  longitude: number,
  reversed: GeoPlace | null,
): AddressValue {
  return {
    address: reversed?.label ?? current.address,
    latitude: latitude.toFixed(7),
    longitude: longitude.toFixed(7),
  };
}

export function coordsOf(
  value: Pick<AddressValue, "latitude" | "longitude">,
): { latitude: number; longitude: number } | null {
  if (value.latitude.trim() === "" || value.longitude.trim() === "") {
    return null;
  }
  const latitude = Number(value.latitude);
  const longitude = Number(value.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
}
