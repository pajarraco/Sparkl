import { type CreateJobInput, createJobInput } from "@sparkl/shared";
import { getStrings } from "./i18n";

// Pure validation for the host Post Job form (rules.md: no logic in
// components). Text inputs stay strings until here; this module coerces
// them into createJobInput shape. Date + times are interpreted as UTC —
// MVP has no timezone picker — and emitted with a Z suffix. Latitude and
// longitude are typed numerically; geocoding lookup is out of MVP scope.
// Every message comes from the i18n package.

export type PostJobField =
  | "address"
  | "date"
  | "windowStart"
  | "windowEnd"
  | "sizeSqm"
  | "notes"
  | "price"
  | "latitude"
  | "longitude";

export type PostJobFieldErrors = Partial<Record<PostJobField, string>>;

export interface PostJobFormResult {
  data: CreateJobInput | null;
  errors: PostJobFieldErrors;
}

export interface PostJobFormInput {
  address?: unknown;
  date?: unknown;
  windowStart?: unknown;
  windowEnd?: unknown;
  sizeSqm?: unknown;
  notes?: unknown;
  price?: unknown;
  latitude?: unknown;
  longitude?: unknown;
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const PRICE_RE = /^\d+(\.\d{1,2})?$/;

function toNumber(raw: unknown): number | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

function isRealCalendarDate(date: string): boolean {
  const match = DATE_RE.exec(date);
  if (match === null) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const built = new Date(Date.UTC(year, month - 1, day));
  return (
    built.getUTCFullYear() === year &&
    built.getUTCMonth() === month - 1 &&
    built.getUTCDate() === day
  );
}

export function validatePostJob(input: PostJobFormInput): PostJobFormResult {
  const strings = getStrings();
  const errors: PostJobFieldErrors = {};

  const address = typeof input.address === "string" ? input.address.trim() : "";
  if (address === "") errors.address = strings.errors.requiredField;

  const date = typeof input.date === "string" ? input.date.trim() : "";
  const dateOk = isRealCalendarDate(date);
  if (!dateOk) errors.date = strings.errors.invalidDate;

  const windowStart =
    typeof input.windowStart === "string" ? input.windowStart.trim() : "";
  if (!TIME_RE.test(windowStart)) {
    errors.windowStart = strings.errors.invalidTime;
  }

  const windowEnd =
    typeof input.windowEnd === "string" ? input.windowEnd.trim() : "";
  if (!TIME_RE.test(windowEnd)) {
    errors.windowEnd = strings.errors.invalidTime;
  } else if (TIME_RE.test(windowStart) && dateOk && windowEnd <= windowStart) {
    errors.windowEnd = strings.errors.invalidWindow;
  }

  const sizeSqm = toNumber(input.sizeSqm ?? "");
  if (
    typeof input.sizeSqm === "string" &&
    input.sizeSqm.trim() !== "" &&
    sizeSqm === null
  ) {
    errors.sizeSqm = strings.errors.invalidNumber;
  }

  const notes = typeof input.notes === "string" ? input.notes.trim() : "";
  if (notes.length > 2000) errors.notes = strings.errors.generic;

  const priceRaw = typeof input.price === "string" ? input.price.trim() : "";
  const priceMinorUnits = PRICE_RE.test(priceRaw)
    ? Math.round(Number(priceRaw) * 100)
    : null;
  if (priceMinorUnits === null) errors.price = strings.errors.invalidPrice;

  const latitude = toNumber(input.latitude ?? "");
  if (latitude === null) errors.latitude = strings.errors.invalidNumber;

  const longitude = toNumber(input.longitude ?? "");
  if (longitude === null) errors.longitude = strings.errors.invalidNumber;

  if (
    errors.address !== undefined ||
    errors.date !== undefined ||
    errors.windowStart !== undefined ||
    errors.windowEnd !== undefined ||
    errors.sizeSqm !== undefined ||
    errors.notes !== undefined ||
    errors.price !== undefined ||
    errors.latitude !== undefined ||
    errors.longitude !== undefined
  ) {
    return { data: null, errors };
  }

  // All pre-checks passed; the shared schema is the final authority on
  // ranges (lat/lng bounds, size cap, notes length).
  const parsed = createJobInput.safeParse({
    address,
    latitude: latitude as number,
    longitude: longitude as number,
    windowStart: `${date}T${windowStart}:00Z`,
    windowEnd: `${date}T${windowEnd}:00Z`,
    sizeSqm: sizeSqm ?? undefined,
    notes: notes === "" ? undefined : notes,
    priceMinorUnits: priceMinorUnits as number,
  });
  if (parsed.success) return { data: parsed.data, errors: {} };

  const mapped: PostJobFieldErrors = { ...errors };
  for (const issue of parsed.error.issues) {
    const field = issue.path[0];
    if (field === "address") mapped.address ??= strings.errors.requiredField;
    else if (field === "windowEnd") {
      mapped.windowEnd ??= strings.errors.invalidWindow;
    } else if (
      field === "sizeSqm" ||
      field === "latitude" ||
      field === "longitude"
    ) {
      if (field === "sizeSqm") mapped.sizeSqm ??= strings.errors.invalidNumber;
      else if (field === "latitude") {
        mapped.latitude ??= strings.errors.invalidNumber;
      } else mapped.longitude ??= strings.errors.invalidNumber;
    } else if (field === "priceMinorUnits") {
      mapped.price ??= strings.errors.invalidPrice;
    } else if (field === "notes") mapped.notes ??= strings.errors.generic;
  }
  return { data: null, errors: mapped };
}
