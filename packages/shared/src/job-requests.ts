import { z } from "zod";
import { userIdSchema } from "./users";

export const jobRequestInitiatorSchema = z.enum(["host", "cleaner"]);
export type JobRequestInitiator = z.infer<typeof jobRequestInitiatorSchema>;

export const jobRequestStatusSchema = z.enum([
  "pending",
  "accepted",
  "declined",
  "withdrawn",
  "closed",
]);
export type JobRequestStatus = z.infer<typeof jobRequestStatusSchema>;

// A cleaner's request ("initiatedBy: cleaner") or a host's offer
// ("initiatedBy: host") on one job. At most one pending row per
// (jobId, cleanerId): see the DB's partial unique index.
export const jobRequestSchema = z
  .object({
    id: z.string().uuid(),
    jobId: z.string().uuid(),
    cleanerId: userIdSchema,
    initiatedBy: jobRequestInitiatorSchema,
    status: jobRequestStatusSchema,
    createdAt: z.string().datetime(),
    respondedAt: z.string().datetime().nullable(),
  })
  .strict();

export type JobRequest = z.infer<typeof jobRequestSchema>;

// Anti-spam caps (plan D): every limit maps to its own shared error code.
export const JOB_REQUEST_CAPS = {
  MAX_PENDING_OFFERS_PER_JOB: 3,
  MAX_PENDING_REQUESTS_PER_CLEANER: 10,
} as const;
