import {
  ASSISTANT_MAX_MESSAGE_CHARS,
  ASSISTANT_MAX_TURNS,
  type AssistantFinishInput,
  type AssistantMessage,
  type AssistantTurnInput,
  type AssistantTurnOutput,
  type GeoPlace,
  JOB_DRAFT_FIELDS,
  type JobDraft,
  type JobDraftField,
  type PriceHint,
  type SolutionProposal,
  type SolutionVote,
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
  // Saved answers offered by the latest reply, and the host's vote on each
  // (04 step 8). Votes persist across turns so a voted answer stays hidden.
  proposals: SolutionProposal[];
  votes: Record<string, SolutionVote>;
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
    proposals: [],
    votes: {},
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
    proposals: output.proposals ?? [],
  };
}

// Proposals still waiting for the host's chip tap.
export function openProposals(state: AssistantState): SolutionProposal[] {
  return state.proposals.filter((proposal) => !state.votes[proposal.id]);
}

export function recordVote(
  state: AssistantState,
  proposalId: string,
  vote: SolutionVote,
): AssistantState {
  return { ...state, votes: { ...state.votes, [proposalId]: vote } };
}

// The review-form fields the host changed from the draft the form opened
// with. The server only votes on fields the model had filled.
export function hostChangedFields(
  opened: JobDraft,
  values: PostJobFormValues,
): JobDraftField[] {
  const before = draftToFormValues(opened);
  return JOB_DRAFT_FIELDS.filter(
    (field) => before[field].trim() !== values[field].trim(),
  );
}

// "accepted" when the posted price is exactly the hint; "ignored" otherwise.
// Undefined when no hint was shown, so nothing is voted on.
export function priceHintResponseFor(
  hint: PriceHint | null,
  postedPrice: string,
): "accepted" | "ignored" | undefined {
  if (hint === null) return undefined;
  const trimmed = postedPrice.trim();
  const posted = /^\d+(\.\d{1,2})?$/.test(trimmed)
    ? Math.round(Number(trimmed) * 100)
    : null;
  return posted === hint.medianMinorUnits ? "accepted" : "ignored";
}

// Closes the session as posted, with the host's review-form answers.
export function postedFinishInput(
  state: AssistantState,
  jobId: string,
  values: PostJobFormValues,
): AssistantFinishInput {
  const priceHintResponse = priceHintResponseFor(state.priceHint, values.price);
  return {
    sessionId: state.sessionId,
    outcome: "posted",
    jobId,
    hostChanged: hostChangedFields(state.draft, values),
    ...(priceHintResponse === undefined ? {} : { priceHintResponse }),
  };
}

// Closes a session the host discarded. No votes are taken from it.
export function abandonedFinishInput(
  state: AssistantState,
): AssistantFinishInput {
  return {
    sessionId: state.sessionId,
    outcome: "abandoned",
    hostChanged: [],
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
