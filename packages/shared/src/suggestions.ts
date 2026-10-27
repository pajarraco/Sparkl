import { z } from "zod";
import { jobSchema } from "./jobs.js";
import { publicCleanerProfileSchema } from "./user-inputs.js";

// Ranking weights: one config object, tuned without deploys behind the
// `ranking-weights-v2` flag (see RANKING_WEIGHTS_FLAG). Weights must sum to 1.
export const RANKING_WEIGHTS_V1 = {
  rating: 0.3,
  distance: 0.2,
  availability: 0.15,
  completedJobs: 0.1,
  acceptanceRate: 0.15,
  responseTime: 0.1,
} as const;

export const RANKING_WEIGHTS_V2 = {
  rating: 0.35,
  distance: 0.1,
  availability: 0.25,
  completedJobs: 0.1,
  acceptanceRate: 0.1,
  responseTime: 0.1,
} as const;

export const RANKING_WEIGHTS_FLAG = "ranking-weights-v2";

export const rankingWeightsSchema = z
  .object({
    rating: z.number().min(0).max(1),
    distance: z.number().min(0).max(1),
    availability: z.number().min(0).max(1),
    completedJobs: z.number().min(0).max(1),
    acceptanceRate: z.number().min(0).max(1),
    responseTime: z.number().min(0).max(1),
  })
  .strict()
  .refine(
    (w) =>
      Math.abs(
        w.rating +
          w.distance +
          w.availability +
          w.completedJobs +
          w.acceptanceRate +
          w.responseTime -
          1,
      ) < 1e-9,
    { message: "ranking weights must sum to 1" },
  );

export type RankingWeights = z.infer<typeof rankingWeightsSchema>;

// suggestions.forJob input: jobId comes from the host's job detail screen;
// hostId comes from the session, never the client.
export const suggestCleanersInput = z
  .object({
    jobId: z.string().uuid(),
    limit: z.number().int().min(1).max(100).default(20),
    offset: z.number().int().min(0).default(0),
  })
  .strict();

export type SuggestCleanersInput = z.infer<typeof suggestCleanersInput>;

// Per-signal scores, each 0..1. Missing data scores a neutral 0.5 for every
// signal (documented in the matching service).
export const matchBreakdownSchema = z
  .object({
    rating: z.number().min(0).max(1),
    distance: z.number().min(0).max(1),
    availability: z.number().min(0).max(1),
    completedJobs: z.number().min(0).max(1),
    acceptanceRate: z.number().min(0).max(1),
    responseTime: z.number().min(0).max(1),
  })
  .strict();

export type MatchBreakdown = z.infer<typeof matchBreakdownSchema>;

export const rankedCleanerSchema = z
  .object({
    cleaner: publicCleanerProfileSchema,
    score: z.number().min(0).max(1),
    breakdown: matchBreakdownSchema,
  })
  .strict();

export type RankedCleaner = z.infer<typeof rankedCleanerSchema>;

export const suggestCleanersOutputSchema = z
  .object({
    suggestions: z.array(rankedCleanerSchema),
    total: z.number().int().min(0),
  })
  .strict();

export type SuggestCleanersOutput = z.infer<typeof suggestCleanersOutputSchema>;

// Ranked board (cleaner view): the same six signals score each open job for
// the calling cleaner. Ranked subjects differ per direction — suggestions rank
// cleaners (cleaner-side acceptance), the board ranks jobs (host-side
// acceptance and host trust) — but the weights object is shared.
export const rankedJobSchema = z
  .object({
    job: jobSchema,
    score: z.number().min(0).max(1),
    breakdown: matchBreakdownSchema,
  })
  .strict();

export type RankedJob = z.infer<typeof rankedJobSchema>;

export const rankJobsOutputSchema = z
  .object({
    jobs: z.array(rankedJobSchema),
    total: z.number().int().min(0),
  })
  .strict();

export type RankJobsOutput = z.infer<typeof rankJobsOutputSchema>;
