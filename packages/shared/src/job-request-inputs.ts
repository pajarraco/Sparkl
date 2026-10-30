import { z } from "zod";
import { jobRequestSchema, jobRequestStatusSchema } from "./job-requests";
import { jobSchema } from "./jobs";
import { userIdSchema, userSchema } from "./users";

export const requestJobInput = z.object({ jobId: z.string().uuid() }).strict();
export type RequestJobInput = z.infer<typeof requestJobInput>;

export const offerJobInput = z
  .object({ jobId: z.string().uuid(), cleanerId: userIdSchema })
  .strict();
export type OfferJobInput = z.infer<typeof offerJobInput>;

// Shared shape for accept, decline and withdraw: they all act on one
// existing request by id.
export const jobRequestActionInput = z
  .object({ requestId: z.string().uuid() })
  .strict();
export type JobRequestActionInput = z.infer<typeof jobRequestActionInput>;

export const listJobRequestsForJobInput = z
  .object({ jobId: z.string().uuid() })
  .strict();
export type ListJobRequestsForJobInput = z.infer<
  typeof listJobRequestsForJobInput
>;

export const listMyJobRequestsInput = z
  .object({ status: jobRequestStatusSchema.optional() })
  .strict();
export type ListMyJobRequestsInput = z.infer<typeof listMyJobRequestsInput>;

// Host's Requests section on Job Detail: each pending row plus the
// requesting/offered cleaner's public summary.
export const jobRequestWithCleanerSchema = z
  .object({
    request: jobRequestSchema,
    cleaner: userSchema.pick({
      id: true,
      name: true,
      photoUrl: true,
      avgRating: true,
      completedJobCount: true,
    }),
  })
  .strict();
export type JobRequestWithCleaner = z.infer<typeof jobRequestWithCleanerSchema>;

// Cleaner's own requests/offers across jobs (My Jobs "Offers" section),
// each paired with the job it is about.
export const jobRequestWithJobSchema = z
  .object({ request: jobRequestSchema, job: jobSchema })
  .strict();
export type JobRequestWithJob = z.infer<typeof jobRequestWithJobSchema>;

export const listJobRequestsForJobOutput = z.array(jobRequestWithCleanerSchema);
export const listMyJobRequestsOutput = z.array(jobRequestWithJobSchema);
