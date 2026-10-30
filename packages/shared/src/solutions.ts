import { z } from "zod";
import { TIME_RE } from "./time";

// Solutions store (04 L1): reusable answers the assistant proposes. Kinds,
// tags and payloads are a closed list, so no free text is ever matched or
// stored as a trigger (04 decision 2).
export const SOLUTION_KINDS = [
  "checklist",
  "window_preference",
  "offer_preference",
  "faq",
] as const;
export const solutionKindSchema = z.enum(SOLUTION_KINDS);
export type SolutionKind = z.infer<typeof solutionKindSchema>;

export const SOLUTION_SCOPES = ["host", "global"] as const;
export const solutionScopeSchema = z.enum(SOLUTION_SCOPES);
export type SolutionScope = z.infer<typeof solutionScopeSchema>;

export const SOLUTION_STATUSES = ["candidate", "active", "retired"] as const;
export const solutionStatusSchema = z.enum(SOLUTION_STATUSES);
export type SolutionStatus = z.infer<typeof solutionStatusSchema>;

export const SOLUTION_SOURCES = ["model", "service", "seed"] as const;
export const solutionSourceSchema = z.enum(SOLUTION_SOURCES);
export type SolutionSource = z.infer<typeof solutionSourceSchema>;

export const SOLUTION_TAGS = [
  "turnover",
  "deep_clean",
  "pets",
  "linen",
  "studio",
  "large_home",
] as const;
export const solutionTagSchema = z.enum(SOLUTION_TAGS);
export type SolutionTag = z.infer<typeof solutionTagSchema>;

// Who may write each kind. The model never writes a global row, an FAQ
// entry or a service-owned kind; the service rejects anything else.
export const SOLUTION_WRITERS: Record<SolutionSource, readonly SolutionKind[]> =
  {
    model: ["checklist", "window_preference"],
    service: ["offer_preference"],
    seed: ["checklist", "faq"],
  };

export const SOLUTION_MAX_CHECKLIST_ITEMS = 12;
export const SOLUTION_MAX_CHECKLIST_ITEM_CHARS = 80;
export const SOLUTION_MAX_FAQ_QUESTION_CHARS = 160;
export const SOLUTION_MAX_FAQ_ANSWER_CHARS = 600;

export const checklistPayloadSchema = z
  .object({
    items: z
      .array(z.string().trim().min(1).max(SOLUTION_MAX_CHECKLIST_ITEM_CHARS))
      .min(1)
      .max(SOLUTION_MAX_CHECKLIST_ITEMS),
  })
  .strict();
export type ChecklistPayload = z.infer<typeof checklistPayloadSchema>;

export const windowPreferencePayloadSchema = z
  .object({
    weekday: z.number().int().min(0).max(6),
    start: z.string().regex(TIME_RE),
    end: z.string().regex(TIME_RE),
  })
  .strict();
export type WindowPreferencePayload = z.infer<
  typeof windowPreferencePayloadSchema
>;

export const SOLUTION_OFFERS = ["price_hint", "usual_cleaner"] as const;
// The host's answer is a vote on the row (accepted / rejected), not a field.
export type SolutionOffer = (typeof SOLUTION_OFFERS)[number];

export const offerPreferencePayloadSchema = z
  .object({
    offer: z.enum(SOLUTION_OFFERS),
  })
  .strict();
export type OfferPreferencePayload = z.infer<
  typeof offerPreferencePayloadSchema
>;

export const faqPayloadSchema = z
  .object({
    question: z.string().trim().min(1).max(SOLUTION_MAX_FAQ_QUESTION_CHARS),
    answer: z.string().trim().min(1).max(SOLUTION_MAX_FAQ_ANSWER_CHARS),
  })
  .strict();
export type FaqPayload = z.infer<typeof faqPayloadSchema>;

// One strict payload schema per kind. Checked on every write and on every
// read, so a bad row can never reach the agent.
export const SOLUTION_PAYLOAD_SCHEMAS = {
  checklist: checklistPayloadSchema,
  window_preference: windowPreferencePayloadSchema,
  offer_preference: offerPreferencePayloadSchema,
  faq: faqPayloadSchema,
} as const satisfies Record<SolutionKind, z.ZodTypeAny>;

export type SolutionPayload =
  | ChecklistPayload
  | WindowPreferencePayload
  | OfferPreferencePayload
  | FaqPayload;

// Ranking constants (04 "Ranking" and "Sharing"). Next to the job-assistant
// and ranking-weights config so they are tuned in one place.
export const SOLUTION_RANKING_CONFIG = {
  wilsonZ: 1.96, // 95% confidence for the lower bound
  recencyHalfLifeDays: 30,
  topK: 3, // solutions returned by find_solutions
  toolResultMaxChars: 1500,
  maxSavesPerSession: 3,
  retireAfterRejections: 3, // consecutive rejections before retirement
  sharingMinHosts: 3, // distinct hosts with posted jobs before a global row is active
} as const;

// The host's response to a proposal: the "Use this" / "Not this" chips.
export const solutionVoteSchema = z.enum(["accepted", "rejected"]);
export type SolutionVote = z.infer<typeof solutionVoteSchema>;

export const assistantFeedbackInput = z
  .object({
    sessionId: z.string().uuid(),
    proposalId: z.string().uuid(),
    vote: solutionVoteSchema,
  })
  .strict();
export type AssistantFeedbackInput = z.infer<typeof assistantFeedbackInput>;

// A solution the assistant offered this turn, as the chat shows it.
export const solutionProposalSchema = z
  .object({
    id: z.string().uuid(),
    kind: solutionKindSchema,
    label: z.string().trim().min(1).max(80),
  })
  .strict();
export type SolutionProposal = z.infer<typeof solutionProposalSchema>;
