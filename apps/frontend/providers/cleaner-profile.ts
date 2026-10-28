import type { AvailabilitySlotInput } from "@sparkl/shared";
import { getStrings } from "./i18n";

// Pure helpers for the cleaner Profile screen (rules.md: no logic in
// components). The availability editor is two toggles (weekdays /
// weekend, per the i18n strings); each toggle maps to full-day 09:00–
// 17:00 slots because the shared schema needs explicit weekday windows
// and the MVP has no per-day time picker. The service replaces all
// slots, so saving writes the toggles' full expansion (possibly empty).

export const AVAILABILITY_DAY_START = "09:00";
export const AVAILABILITY_DAY_END = "17:00";
export const WEEKDAY_NUMBERS = [1, 2, 3, 4, 5] as const;
export const WEEKEND_NUMBERS = [0, 6] as const;

export interface AvailabilityToggles {
  weekdays: boolean;
  weekend: boolean;
}

function slotsForWeekdays(numbers: readonly number[]): AvailabilitySlotInput[] {
  return numbers.map((weekday) => ({
    weekday,
    startTime: AVAILABILITY_DAY_START,
    endTime: AVAILABILITY_DAY_END,
  }));
}

export function availabilitySlotsForToggles(
  toggles: AvailabilityToggles,
): AvailabilitySlotInput[] {
  return [
    ...(toggles.weekdays ? slotsForWeekdays(WEEKDAY_NUMBERS) : []),
    ...(toggles.weekend ? slotsForWeekdays(WEEKEND_NUMBERS) : []),
  ];
}

function hasDefaultSlots(
  slots: Pick<AvailabilitySlotInput, "weekday" | "startTime" | "endTime">[],
  numbers: readonly number[],
): boolean {
  return numbers.every((weekday) =>
    slots.some(
      (slot) =>
        slot.weekday === weekday &&
        slot.startTime === AVAILABILITY_DAY_START &&
        slot.endTime === AVAILABILITY_DAY_END,
    ),
  );
}

export function togglesForAvailability(
  slots: Pick<AvailabilitySlotInput, "weekday" | "startTime" | "endTime">[],
): AvailabilityToggles {
  return {
    weekdays: hasDefaultSlots(slots, WEEKDAY_NUMBERS),
    weekend: hasDefaultSlots(slots, WEEKEND_NUMBERS),
  };
}

export interface ServiceAreaFieldErrors {
  latitude?: string | undefined;
  longitude?: string | undefined;
  radiusKm?: string | undefined;
}

export interface ServiceAreaFormResult {
  data: { latitude: number; longitude: number; radiusKm: number } | null;
  errors: ServiceAreaFieldErrors;
}

function toNumber(raw: unknown): number | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

export function validateServiceArea(input: {
  latitude?: unknown;
  longitude?: unknown;
  radiusKm?: unknown;
}): ServiceAreaFormResult {
  const strings = getStrings();
  const errors: ServiceAreaFieldErrors = {};
  const latitude = toNumber(input.latitude ?? "");
  const longitude = toNumber(input.longitude ?? "");
  const radiusKm = toNumber(input.radiusKm ?? "");
  if (latitude === null || latitude < -90 || latitude > 90) {
    errors.latitude = strings.errors.invalidNumber;
  }
  if (longitude === null || longitude < -180 || longitude > 180) {
    errors.longitude = strings.errors.invalidNumber;
  }
  if (radiusKm === null || radiusKm <= 0 || radiusKm > 500) {
    errors.radiusKm = strings.errors.invalidNumber;
  }
  if (
    errors.latitude !== undefined ||
    errors.longitude !== undefined ||
    errors.radiusKm !== undefined
  ) {
    return { data: null, errors };
  }
  return {
    data: {
      latitude: latitude as number,
      longitude: longitude as number,
      radiusKm: radiusKm as number,
    },
    errors: {},
  };
}

// Avatar initials (design.md: photo or initials on paper-2). First
// letters of the first two words, uppercased; falls back to "?" so an
// empty name never renders a blank circle.
export function initialsForName(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((part) => part !== "");
  const picked = parts.slice(0, 2).map((part) => part[0] ?? "");
  const initials = picked.join("").toUpperCase();
  return initials === "" ? "?" : initials;
}
