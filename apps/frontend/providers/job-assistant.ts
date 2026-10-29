import {
  ASSISTANT_MAX_MESSAGE_CHARS,
  ASSISTANT_MAX_TURNS,
  type AssistantMessage,
  type AssistantTurnInput,
  type AssistantTurnOutput,
  type GeoPlace,
  type JobDraft,
  type JobDraftField,
  type PriceHint,
} from "@sparkl/shared";
import { getStrings } from "./i18n";
import { formatPriceMinorUnits } from "./my-jobs";

// Pure state helpers for the Post-tab assistant (rules.md: no logic in
// components). The client holds the transcript and sends at most the last
// ASSISTANT_MAX_TURNS messages per turn; the server owns the draft rules
// (missing fields, readyForReview) and the client only mirrors them. The
// host can always leave for the form with the draft kept.

export interface AssistantState {
  sessionId: string;
  messages: AssistantMessage[];
  draft: JobDraft;
  missingFields: JobDraftField[];
  readyForReview: boolean;
  places: GeoPlace[];
  priceHint: PriceHint | null;
}

export function createAssistantState(
  sessionId: string,
  draft: JobDraft = {},
): AssistantState {
  return {
    sessionId,
    messages: [],
    draft,
    missingFields: [],
    readyForReview: false,
    places: [],
    priceHint: null,
  };
}

export function validateAssistantMessage(text: unknown): string | null {
  const strings = getStrings();
  if (typeof text !== "string" || text.trim() === "") {
    return strings.errors.requiredField;
  }
  if (text.trim().length > ASSISTANT_MAX_MESSAGE_CHARS) {
    return strings.assistant.tooLong;
  }
  return null;
}

export function withUserMessage(
  state: AssistantState,
  text: string,
): AssistantState {
  return {
    ...state,
    messages: [...state.messages, { role: "user", content: text.trim() }],
  };
}

export function buildTurnInput(
  state: AssistantState,
  timeZone: string | undefined,
): AssistantTurnInput {
  return {
    sessionId: state.sessionId,
    messages: state.messages.slice(-ASSISTANT_MAX_TURNS),
    draft: state.draft,
    ...(timeZone === undefined ? {} : { timeZone }),
  };
}

export function applyTurnOutput(
  state: AssistantState,
  output: AssistantTurnOutput,
): AssistantState {
  return {
    ...state,
    messages: [...state.messages, { role: "assistant", content: output.reply }],
    draft: output.draft,
    missingFields: output.missingFields,
    readyForReview: output.readyForReview,
    places: output.places,
    priceHint: output.priceHint,
  };
}

// The price suggestion under the draft card. The host sets the final price.
export function priceHintLine(hint: PriceHint | null): string | null {
  if (hint === null) return null;
  const strings = getStrings();
  const price = formatPriceMinorUnits(hint.medianMinorUnits);
  if (hint.source === "per_sqm") {
    return strings.assistant.priceRate.replace("{price}", price);
  }
  return strings.assistant.priceComparables
    .replace("{price}", price)
    .replace("{count}", String(hint.comparables));
}

// The host picked a geocoder candidate: coordinates come from the place.
export function choosePlace(
  state: AssistantState,
  place: GeoPlace,
): AssistantState {
  return {
    ...state,
    draft: {
      ...state.draft,
      address: place.label,
      latitude: String(place.latitude),
      longitude: String(place.longitude),
    },
    missingFields: state.missingFields.filter((f) => f !== "address"),
    places: [],
  };
}

export interface PostJobFormValues {
  address: string;
  date: string;
  windowStart: string;
  windowEnd: string;
  sizeSqm: string;
  notes: string;
  price: string;
  latitude: string;
  longitude: string;
  // The pinned usual cleaner, or "" when none is pinned.
  preferredCleanerId: string;
}

export function draftToFormValues(draft: JobDraft): PostJobFormValues {
  return {
    address: draft.address ?? "",
    date: draft.date ?? "",
    windowStart: draft.windowStart ?? "",
    windowEnd: draft.windowEnd ?? "",
    sizeSqm: draft.sizeSqm ?? "",
    notes: draft.notes ?? "",
    price: draft.price ?? "",
    latitude: draft.latitude ?? "",
    longitude: draft.longitude ?? "",
    preferredCleanerId: draft.preferredCleanerId ?? "",
  };
}

export interface DraftSummaryRow {
  field: JobDraftField;
  label: string;
  value: string;
}

const SUMMARY_FIELDS = [
  "address",
  "date",
  "windowStart",
  "windowEnd",
  "sizeSqm",
  "notes",
] as const satisfies readonly JobDraftField[];

// Filled fields only, in form order, for the live draft card.
export function draftSummary(draft: JobDraft): DraftSummaryRow[] {
  const strings = getStrings();
  const labels: Record<(typeof SUMMARY_FIELDS)[number], string> = {
    address: strings.postJob.addressLabel,
    date: strings.postJob.dateLabel,
    windowStart: strings.postJob.windowStartLabel,
    windowEnd: strings.postJob.windowEndLabel,
    sizeSqm: strings.postJob.sizeLabel,
    notes: strings.postJob.notesLabel,
  };
  const rows: DraftSummaryRow[] = [];
  for (const field of SUMMARY_FIELDS) {
    const raw = draft[field]?.trim();
    if (!raw) continue;
    const value =
      field === "sizeSqm"
        ? strings.assistant.sizeValue.replace("{size}", raw)
        : raw;
    rows.push({ field, label: labels[field], value });
  }
  return rows;
}

// tRPC client errors carry the mapped code in data.code.
export function assistantErrorMessage(error: unknown): string {
  const strings = getStrings();
  const code = (error as { data?: { code?: unknown } } | null)?.data?.code;
  return code === "TOO_MANY_REQUESTS"
    ? strings.assistant.rateLimited
    : strings.assistant.unavailable;
}

export function deviceTimeZone(): string | undefined {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return typeof zone === "string" && zone !== "" ? zone : undefined;
  } catch {
    return undefined;
  }
}

// Session ids only group a host's turns for analytics, so a Math.random
// fallback is fine where crypto.randomUUID is missing (older Hermes).
export function newSessionId(random: () => number = Math.random): string {
  const native = (
    globalThis as { crypto?: { randomUUID?: () => string } }
  ).crypto?.randomUUID?.();
  if (typeof native === "string") return native;
  const hex = Array.from({ length: 32 }, () =>
    Math.floor(random() * 16).toString(16),
  );
  hex[12] = "4";
  hex[16] = ((Number.parseInt(hex[16] ?? "0", 16) & 0x3) | 0x8).toString(16);
  const s = hex.join("");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}
