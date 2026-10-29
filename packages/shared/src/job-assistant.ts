import { z } from "zod";
import { geoPlaceSchema } from "./geo";

export const ASSISTANT_MAX_TURNS = 20; // messages per request
export const ASSISTANT_MAX_MESSAGE_CHARS = 1000;
export const ASSISTANT_MAX_QUICK_REPLIES = 4;

// Same field names as the Post form (apps/frontend/providers/post-job.ts).
export const JOB_DRAFT_FIELDS = [
  "address",
  "latitude",
  "longitude",
  "date",
  "windowStart",
  "windowEnd",
  "sizeSqm",
  "notes",
  "price",
] as const;
export const jobDraftFieldSchema = z.enum(JOB_DRAFT_FIELDS);
export type JobDraftField = z.infer<typeof jobDraftFieldSchema>;

// Fields the assistant must collect before the review form opens.
export const ASSISTANT_REQUIRED_FIELDS = [
  "address",
  "date",
  "windowStart",
  "windowEnd",
] as const satisfies readonly JobDraftField[];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// Strings, like the form inputs; validatePostJob stays the final authority.
export const jobDraftSchema = z
  .object({
    address: z.string().max(500).optional(),
    latitude: z.string().max(32).optional(),
    longitude: z.string().max(32).optional(),
    date: z.string().regex(DATE_RE).optional(),
    windowStart: z.string().regex(TIME_RE).optional(),
    windowEnd: z.string().regex(TIME_RE).optional(),
    sizeSqm: z.string().max(16).optional(),
    notes: z.string().max(2000).optional(),
    price: z.string().max(16).optional(),
    // Set only by the pin_usual_cleaner tool, never by update_draft.
    preferredCleanerId: z.string().min(1).max(256).optional(),
  })
  .strict();
export type JobDraft = z.infer<typeof jobDraftSchema>;

// What the model's update_draft tool may set. No address, coordinates or
// price: the address comes from a geocoder place (placeId) and the host sets
// the price. Strict, so hostId / status / price etc. are rejected.
export const assistantDraftPatchSchema = z
  .object({
    date: z.string().regex(DATE_RE).optional(),
    windowStart: z.string().regex(TIME_RE).optional(),
    windowEnd: z.string().regex(TIME_RE).optional(),
    sizeSqm: z.number().positive().max(100000).optional(),
    notes: z.string().max(2000).optional(),
    placeId: z.string().min(1).max(128).optional(),
  })
  .strict();
export type AssistantDraftPatch = z.infer<typeof assistantDraftPatchSchema>;

export const assistantMessageSchema = z
  .object({
    role: z.enum(["user", "assistant"]),
    content: z.string().trim().min(1).max(ASSISTANT_MAX_MESSAGE_CHARS),
  })
  .strict();
export type AssistantMessage = z.infer<typeof assistantMessageSchema>;

export const assistantTurnInput = z
  .object({
    sessionId: z.string().uuid(),
    messages: z.array(assistantMessageSchema).min(1).max(ASSISTANT_MAX_TURNS),
    draft: jobDraftSchema,
    timeZone: z.string().min(1).max(64).optional(), // IANA name, e.g. "Australia/Sydney"
  })
  .strict()
  .refine((v) => v.messages[v.messages.length - 1]?.role === "user", {
    message: "the last message must be from the user",
    path: ["messages"],
  });
export type AssistantTurnInput = z.infer<typeof assistantTurnInput>;

export const PRICE_HINT_SOURCES = ["comparables", "per_sqm"] as const;
export const priceHintSchema = z
  .object({
    medianMinorUnits: z.number().int().min(0),
    comparables: z.number().int().min(0),
    source: z.enum(PRICE_HINT_SOURCES),
  })
  .strict();
export type PriceHint = z.infer<typeof priceHintSchema>;

export const assistantTurnOutput = z
  .object({
    reply: z.string().max(2000),
    draft: jobDraftSchema,
    missingFields: z.array(jobDraftFieldSchema),
    readyForReview: z.boolean(),
    quickReplies: z
      .array(z.string().min(1).max(60))
      .max(ASSISTANT_MAX_QUICK_REPLIES),
    places: z.array(geoPlaceSchema).max(5),
    priceHint: priceHintSchema.nullable(),
  })
  .strict();
export type AssistantTurnOutput = z.infer<typeof assistantTurnOutput>;

export const ASSISTANT_OUTCOMES = ["posted", "abandoned", "fell_back"] as const;
export const assistantOutcomeSchema = z.enum(ASSISTANT_OUTCOMES);
export type AssistantOutcome = z.infer<typeof assistantOutcomeSchema>;

// Closes a session with its outcome and the fields the host changed on the
// review form. What the model filled is recorded by the server from its own
// turns, not taken from the client. Never carries message text.
export const assistantFinishInput = z
  .object({
    sessionId: z.string().uuid(),
    outcome: assistantOutcomeSchema,
    jobId: z.string().uuid().optional(),
    hostChanged: z.array(jobDraftFieldSchema).max(JOB_DRAFT_FIELDS.length),
  })
  .strict()
  .refine((v) => (v.outcome === "posted") === (v.jobId !== undefined), {
    message: "jobId is required when posted and only then",
    path: ["jobId"],
  });
export type AssistantFinishInput = z.infer<typeof assistantFinishInput>;
