import { type CreatePropertyInput, createPropertyInput } from "@sparkl/shared";
import { getStrings } from "./i18n";

// Pure validation for the host Properties add/edit form (rules.md: no
// logic in components). Mirrors post-job.ts: text stays strings until
// here, and the shared schema is the final authority on ranges.

export type PropertyField = "name" | "address" | "sizeSqm" | "notes";
export type PropertyFieldErrors = Partial<Record<PropertyField, string>>;

export interface PropertyFormResult {
  data: CreatePropertyInput | null;
  errors: PropertyFieldErrors;
}

export interface PropertyFormInput {
  name?: unknown;
  address?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  sizeSqm?: unknown;
  notes?: unknown;
}

function toNumber(raw: unknown): number | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

export function validateProperty(input: PropertyFormInput): PropertyFormResult {
  const strings = getStrings();
  const errors: PropertyFieldErrors = {};

  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (name === "") errors.name = strings.errors.requiredField;

  const address = typeof input.address === "string" ? input.address.trim() : "";
  if (address === "") errors.address = strings.errors.requiredField;

  const latitude = toNumber(input.latitude ?? "");
  const longitude = toNumber(input.longitude ?? "");
  if (latitude === null || longitude === null) {
    errors.address = strings.errors.requiredField;
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

  if (
    errors.name !== undefined ||
    errors.address !== undefined ||
    errors.sizeSqm !== undefined ||
    errors.notes !== undefined
  ) {
    return { data: null, errors };
  }

  const parsed = createPropertyInput.safeParse({
    name,
    address,
    latitude: latitude as number,
    longitude: longitude as number,
    sizeSqm: sizeSqm ?? undefined,
    defaultNotes: notes === "" ? undefined : notes,
  });
  if (parsed.success) return { data: parsed.data, errors: {} };

  const mapped: PropertyFieldErrors = { ...errors };
  for (const issue of parsed.error.issues) {
    const field = issue.path[0];
    if (field === "name") mapped.name ??= strings.errors.requiredField;
    else if (field === "address") {
      mapped.address ??= strings.errors.requiredField;
    } else if (field === "sizeSqm") {
      mapped.sizeSqm ??= strings.errors.invalidNumber;
    } else if (field === "defaultNotes")
      mapped.notes ??= strings.errors.generic;
  }
  return { data: null, errors: mapped };
}

// Property row meta line (design.md Property row): size if set.
export function propertyMetaLine(sizeSqm: number | null): string | undefined {
  return sizeSqm === null ? undefined : `${sizeSqm} m²`;
}
