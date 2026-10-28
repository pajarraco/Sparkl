import {
  type ListOpenJobsInput,
  type RankedJob,
  listOpenJobsInput,
} from "@sparkl/shared";
import { getStrings } from "./i18n";
import { formatJobWindow, formatPriceMinorUnits } from "./my-jobs";

// Pure validation + formatting for the cleaner Ranked Board (rules.md: no
// logic in components). Raw filter fields stay text until here; this module
// coerces them into listOpenJobsInput shape. The day filter keeps jobs whose
// window starts that UTC day; the distance filter needs the cleaner's
// service-area center (from their profile) because the shared schema
// requires centerLat/centerLng alongside maxDistanceKm.

export type BoardFilterField = "date" | "maxDistanceKm" | "minPrice";

export type BoardFilterErrors = Partial<Record<BoardFilterField, string>>;

export interface BoardFilterInput {
  date?: unknown;
  maxDistanceKm?: unknown;
  minPrice?: unknown;
}

export interface BoardServiceCenter {
  latitude: number;
  longitude: number;
}

export interface BoardFilterResult {
  data: ListOpenJobsInput | null;
  errors: BoardFilterErrors;
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
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

export function validateBoardFilters(
  input: BoardFilterInput,
  center?: BoardServiceCenter,
): BoardFilterResult {
  const strings = getStrings();
  const errors: BoardFilterErrors = {};

  const dateRaw = typeof input.date === "string" ? input.date.trim() : "";
  const date = dateRaw === "" ? null : dateRaw;
  if (date !== null && !isRealCalendarDate(date)) {
    errors.date = strings.errors.invalidDate;
  }

  const distance = toNumber(input.maxDistanceKm ?? "");
  if (
    typeof input.maxDistanceKm === "string" &&
    input.maxDistanceKm.trim() !== "" &&
    distance === null
  ) {
    errors.maxDistanceKm = strings.errors.invalidNumber;
  } else if (distance !== null && center === undefined) {
    errors.maxDistanceKm = strings.filters.noLocation;
  }

  const priceRaw =
    typeof input.minPrice === "string" ? input.minPrice.trim() : "";
  const minPriceMinorUnits =
    priceRaw === ""
      ? null
      : PRICE_RE.test(priceRaw)
        ? Math.round(Number(priceRaw) * 100)
        : null;
  if (priceRaw !== "" && minPriceMinorUnits === null) {
    errors.minPrice = strings.errors.invalidPrice;
  }

  if (
    errors.date !== undefined ||
    errors.maxDistanceKm !== undefined ||
    errors.minPrice !== undefined
  ) {
    return { data: null, errors };
  }

  // All pre-checks passed; the shared schema is the final authority on
  // ranges (day bounds, distance cap, price floor).
  const parsed = listOpenJobsInput.safeParse({
    dateFrom: date === null ? undefined : `${date}T00:00:00Z`,
    dateTo: date === null ? undefined : `${date}T23:59:59Z`,
    centerLat: distance === null ? undefined : center?.latitude,
    centerLng: distance === null ? undefined : center?.longitude,
    maxDistanceKm: distance ?? undefined,
    minPriceMinorUnits: minPriceMinorUnits ?? undefined,
  });
  if (parsed.success) return { data: parsed.data, errors: {} };

  const mapped: BoardFilterErrors = { ...errors };
  for (const issue of parsed.error.issues) {
    const field = issue.path[0];
    if (field === "dateFrom" || field === "dateTo") {
      mapped.date ??= strings.errors.invalidDate;
    } else if (
      field === "maxDistanceKm" ||
      field === "centerLat" ||
      field === "centerLng"
    ) {
      mapped.maxDistanceKm ??= strings.errors.invalidNumber;
    } else if (
      field === "minPriceMinorUnits" ||
      field === "maxPriceMinorUnits"
    ) {
      mapped.minPrice ??= strings.errors.invalidPrice;
    }
  }
  return { data: null, errors: mapped };
}

// Board meta line per design.md job card: date/time · price · match. The
// match percent takes the distance slot — the API returns a score, not
// kilometres — so rows stay tabular without inventing data.
export function boardMetaLine(job: RankedJob["job"], score?: number): string {
  const head = `${formatJobWindow(job.windowStart, job.windowEnd)} · ${formatPriceMinorUnits(job.priceMinorUnits)}`;
  return score === undefined ? head : `${head} · ${formatMatchPercent(score)}`;
}

// Match percent shown on board rows, e.g. "94% match".
export function formatMatchPercent(score: number): string {
  const percent = Math.round(Math.min(Math.max(score, 0), 1) * 100);
  return `${percent}% ${getStrings().board.matchWord}`;
}
